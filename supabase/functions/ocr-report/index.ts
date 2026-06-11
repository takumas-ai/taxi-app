import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { image_base64, media_type = "image/jpeg" } = await req.json();
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type, data: image_base64 },
            },
            {
              type: "text",
              text: "この画像はタクシードライバーの日報です。以下の項目をJSON形式で抽出してください。項目が読み取れない場合はnullにしてください。\n\n{\"gross_sales\":総売上,\"cash_sales\":現金売上,\"card_sales\":カード売上,\"app_sales\":アプリ売上,\"highway_fee\":高速料金,\"ride_count\":乗車回数,\"total_distance\":総走行距離,\"work_hours\":乗務時間,\"break_hours\":休憩時間,\"format_type\":\"mismatsu_simple or mismatsu_full or greencab or unknown\"}\n\nJSONのみ返してください。",
            },
          ],
        }],
      }),
    });

    const result = await response.json();
    const text = result.content?.[0]?.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const json = JSON.parse(cleaned);

    return new Response(JSON.stringify({ fields: json, confidence: 85 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
