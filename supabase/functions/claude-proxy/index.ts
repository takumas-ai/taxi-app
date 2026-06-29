import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ログイン済みユーザーのJWTのみ許可
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const { messages, system, max_tokens, model } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), { status: 400, headers: corsHeaders });
    }

    // サーバー側でコスト上限を強制（クライアント指定値を信用しない）
    const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"];
    const safeModel = ALLOWED_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";
    const safeMaxTokens = Math.min(typeof max_tokens === "number" ? max_tokens : 1500, 2000);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: corsHeaders });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: safeModel,
        max_tokens: safeMaxTokens,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[claude-proxy] Anthropic error:", response.status, JSON.stringify(data).slice(0, 200));
    }
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
