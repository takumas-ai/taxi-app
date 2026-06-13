import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 会社フォーマット対応の詳細プロンプト
const REPORT_OCR_PROMPT = `あなたはタクシー日報OCRシステムです。
画像を解析し、JSONのみを返してください。前置き・説明・マークダウン不要。

フォーマット判定ルール:
・美松交通（簡易版）: 合計金額列の合計 → gross_sales
・美松交通（フル版）: 「総営収」 → gross_sales
・グリーンキャブ: 「税込運収」 → gross_sales、「高速納金」 → highway_fee、「走行粁」 → total_distance

重要: occupied_distance（実車距離）は両社とも記載なし → 必ずnull

出力JSON（数値は整数または小数のみ、単位・カンマ不要、読み取れない項目はnull）:
{
  "date": "YYYY-MM-DD",
  "gross_sales": 総売上円,
  "cash_sales": 現金売上円またはnull,
  "card_sales": カード売上円またはnull,
  "app_sales": アプリ配車売上円またはnull,
  "highway_fee": 高速料金円またはnull,
  "ride_count": 乗車回数またはnull,
  "total_distance": 総走行距離kmまたはnull,
  "occupied_distance": null,
  "work_hours": 勤務時間（小数）またはnull,
  "break_hours": 休憩時間（小数）またはnull,
  "confidence": 読み取り信頼度0〜100,
  "format_type": "mismatsu_simple|mismatsu_full|greencab|unknown",
  "unreadable_fields": ["読み取れなかった項目名"]
}`;

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

    const body = await req.json();
    const { image_base64, media_type = "image/jpeg" } = body;

    // 入力バリデーション
    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), { status: 400, headers: corsHeaders });
    }
    const MAX_BASE64_CHARS = 11 * 1024 * 1024; // ~8MB画像
    if (image_base64.length > MAX_BASE64_CHARS) {
      return new Response(JSON.stringify({ error: "Image too large. Max 8MB." }), { status: 413, headers: corsHeaders });
    }
    const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    const normalizedType = String(media_type).toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.includes(normalizedType)) {
      return new Response(JSON.stringify({ error: "Unsupported image type" }), { status: 400, headers: corsHeaders });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: corsHeaders });
    }
    console.log("[ocr-report] user:", user.id, "type:", normalizedType);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: normalizedType, data: image_base64 },
            },
            { type: "text", text: REPORT_OCR_PROMPT },
          ],
        }],
      }),
    });

    const result = await response.json();
    console.log("[ocr-report] anthropic status:", response.status, JSON.stringify(result).slice(0, 300));

    if (!response.ok) {
      const msg = result.error?.message ?? `Anthropic error ${response.status}`;
      return new Response(JSON.stringify({ error: msg }), { status: 502, headers: corsHeaders });
    }

    const text = result.content?.[0]?.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(cleaned);
    } catch {
      console.error("[ocr-report] JSON parse error:", cleaned.slice(0, 200));
      return new Response(JSON.stringify({ error: "AIの返答をパースできませんでした" }), { status: 422, headers: corsHeaders });
    }

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
