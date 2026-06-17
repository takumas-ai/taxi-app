import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_OCR_LIMIT = 8; // 無料ユーザーの月次上限

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 汎用タクシー日報OCRプロンプト（会社フォーマット自動検出 + 勤務時間計算）
const REPORT_OCR_PROMPT = `あなたはタクシー日報OCRの専門AIです。
画像を解析し、JSONのみを返してください。前置き・説明・マークダウン不要。

## ステップ1: 会社フォーマットを自動判定して各項目を読み取る

どんな会社の日報でも、以下の対応表を使って柔軟にマッピングしてください:

| 出力フィールド | よく使われる欄名・手がかり |
|---|---|
| gross_sales | 税込運収 / 総営収 / 合計金額 / 総売上 / 運収合計 / 売上合計 |
| cash_sales | 現金 / 現収 / 現金売上 / 現金運収 |
| card_sales | カード / クレジット / カード売上 / カード運収 |
| app_sales | アプリ / GO / S.RIDE / 配車アプリ / Uber |
| highway_fee | 高速納金 / 高速料金 / 高速代 / 高速 |
| ride_count | 回数 / 乗車回数 / 営業回数 / 件数 |
| total_distance | 走行粁 / 走行距離 / 総走行 / 走行km |
| occupied_distance | 実車距離 / 実車粁 / 営業距離（記載なければnull） |
| clock_in | 出庫時刻 / 出庫 / 出発 |
| clock_out | 帰庫時刻 / 帰庫 / 到着 |
| clock_in_date | 出庫日（日付欄や出庫日時から読む） |
| clock_out_date | 帰庫日（帰庫日時から読む。翌日になることが多い） |

## ステップ2: 勤務時間を計算する

clock_in と clock_out が読み取れた場合、work_hours を計算してください。
- 日付またぎ（例: 出庫12:10 → 帰庫翌日08:21）に必ず対応する
- 計算式: (帰庫のUnixtime - 出庫のUnixtime) / 3600 を小数第1位で丸める
- 例: 出庫12:10 帰庫翌日08:21 → 20.2時間

## ステップ3: JSONを出力する

{
  "date": "出庫日のYYYY-MM-DD",
  "gross_sales": 総売上円（整数）またはnull,
  "cash_sales": 現金売上円またはnull,
  "card_sales": カード売上円またはnull,
  "app_sales": アプリ売上円またはnull,
  "highway_fee": 高速料金円またはnull,
  "ride_count": 乗車回数（整数）またはnull,
  "total_distance": 総走行距離km（整数）またはnull,
  "occupied_distance": 実車距離kmまたはnull,
  "work_hours": 勤務時間（小数、計算値）またはnull,
  "break_hours": 休憩時間（小数）またはnull,
  "clock_in": "HH:MM"またはnull,
  "clock_out": "HH:MM"またはnull,
  "confidence": 読み取り信頼度0〜100,
  "company": "会社名（読み取れた場合）",
  "unreadable_fields": ["読み取れなかった項目名"]
}

数値はカンマ・単位を除いた純粋な数字のみ。読み取れない項目はnull。`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey     = req.headers.get("apikey") || authHeader;
    if (!apiKey) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // ─── サーバーサイド月次制限チェック ───
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    // Bearer トークンからユーザーIDを取得
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const { data: { user } } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    if (userId) {
      const { data: profile } = await db.from("users").select("plan, monthly_upload_count, upload_reset_month").eq("id", userId).single();
      if (profile && profile.plan !== "paid") {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const count = profile.upload_reset_month === currentMonth ? (profile.monthly_upload_count || 0) : 0;
        if (count >= FREE_OCR_LIMIT) {
          return new Response(JSON.stringify({ error: "monthly_limit_exceeded", limit: FREE_OCR_LIMIT }), { status: 429, headers: corsHeaders });
        }
      }
    }

    const body = await req.json();
    const { image_base64, media_type = "image/jpeg", prompt } = body;

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
    console.log("[ocr-report] type:", normalizedType);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: normalizedType, data: image_base64 },
            },
            { type: "text", text: prompt || REPORT_OCR_PROMPT },
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
