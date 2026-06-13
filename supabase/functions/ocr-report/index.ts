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
              text: `あなたはタクシー日報の読み取り専門AIです。
この画像はタクシードライバーが記入した日報（乗務日報）です。
画像をよく見て、以下の項目を正確に読み取り、JSON形式のみで返してください。

【抽出ルール】
- 数値はカンマや単位（円・km・回・時間）を除いた純粋な数字のみ
- 「万」単位の場合は円に換算（例：6万1800円→61800）
- 時間は小数点表記（例：13時間30分→13.5）
- 読み取れない項目はnull
- JSONのみ返す（説明文・コードブロック不要）

【抽出項目】
{
  "date": "日付（YYYY-MM-DD形式、例：2026-06-12）",
  "gross_sales": "総売上・売上合計（円）",
  "cash_sales": "現金売上（円）",
  "card_sales": "クレジットカード売上（円）",
  "app_sales": "配車アプリ・GO・DiDi等の売上（円）",
  "highway_fee": "高速料金・有料道路料金（円）",
  "ride_count": "乗車回数・営業回数（回）",
  "total_distance": "総走行距離・走行キロ（km）",
  "occupied_distance": "実車距離・営業距離（km）",
  "work_hours": "乗務時間・勤務時間（時間、小数点）",
  "break_hours": "休憩時間（時間、小数点）"
}`,
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
