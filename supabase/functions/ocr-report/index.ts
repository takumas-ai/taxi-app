import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT = "あなたはタクシー日報の読み取り専門AIです。この画像はタクシードライバーが記入した日報です。以下のJSONキーに対応する数値を読み取ってください。数値はカンマや単位を除いた純粋な数字のみ。読み取れない項目はnull。JSONのみ返してください（説明文不要）。\n\n{\"date\":\"日付YYYY-MM-DD\",\"gross_sales\":総売上円,\"cash_sales\":現金売上円,\"card_sales\":カード売上円,\"app_sales\":アプリ売上円,\"highway_fee\":高速料金円,\"ride_count\":乗車回数,\"total_distance\":総走行距離km,\"occupied_distance\":実車距離km,\"work_hours\":乗務時間小数,\"break_hours\":休憩時間小数}";

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

    const { image_base64, media_type = "image/jpeg", prompt } = await req.json();
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    console.log("[ocr-report] key exists:", !!anthropicKey, "custom prompt:", !!prompt);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            { type: "text", text: prompt ?? DEFAULT_PROMPT },
          ],
        }],
      }),
    });

    const result = await response.json();
    console.log("[ocr-report] anthropic status:", response.status, JSON.stringify(result).slice(0, 200));

    const text = result.content?.[0]?.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const json = JSON.parse(cleaned);

    return new Response(JSON.stringify({ fields: json }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ocr-report] error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
