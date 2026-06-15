// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude API 呼び出し — Supabase Edge Functions 経由
//
// 本番: VITE_EDGE_FUNCTIONS_URL を .env に設定
//       Edge Function 側で ANTHROPIC_API_KEY を管理（フロントには置かない）
//
// ローカル開発: supabase functions serve でローカル実行可能
//   npx supabase functions serve claude-proxy --env-file .env.local
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { fmt, occ, dow, hourly } from './constants';
import { supabase } from './supabase';

const EDGE_BASE = import.meta.env.VITE_EDGE_FUNCTIONS_URL ?? "";

/**
 * Edge Function "claude-proxy" を経由して Claude を呼び出す
 * Edge Function のコードは supabase/functions/claude-proxy/index.ts に配置
 */
async function callClaude(prompt, maxTokens = 1000) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${EDGE_BASE}/claude-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    console.error("[ai.js] Edge Function エラー:", res.status, await res.text());
    return "";
  }
  const data = await res.json();
  // claude-proxy は Anthropic レスポンスをそのまま返す
  return data.content?.[0]?.text ?? data.text ?? "";
}

/**
 * OCR専用: 画像をBase64で送り、JSON文字列を返す
 * Edge Function "ocr-report" に画像データを送信
 */
async function callOCR(imageBase64, mimeType, prompt) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${EDGE_BASE}/ocr-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: imageBase64, mime_type: mimeType, prompt }),
  });

  if (!res.ok) {
    console.error("[ai.js] OCR Edge Function エラー:", res.status, await res.text());
    return null;
  }
  return await res.json();  // { result: {...OCRデータ}, raw: "..." }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 日報のAIコメント生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function generateReportComment(report, allReports) {
  const avg = allReports.length
    ? Math.round(allReports.reduce((s, r) => s + r.gross_sales, 0) / allReports.length)
    : 0;
  return callClaude(`タクシー運転手の営業コーチとして3文以内でアドバイス。数字を引用し丁寧語で。

${report.date}(${dow(report.date)}) 売上${fmt(report.gross_sales)}円 回数${report.ride_count}回
実車率${occ(report)}% 時間単価${fmt(hourly(report))}円/h
過去平均${fmt(avg)}円（差異${report.gross_sales >= avg ? "+" : ""}${fmt(report.gross_sales - avg)}円）
${report.trouble_note ? "備考:" + report.trouble_note : ""}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 今日の営業戦略AI生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function generateDayStrategy(events, delays, traffic, userAreas) {
  const areaLabel = userAreas.length ? userAreas.join("・") : "全エリア";
  const alerts = delays.filter(d => d.status !== "normal");
  return callClaude(`タクシー運転手の今日の営業戦略を3〜4文でアドバイス。エリア・時間帯を具体的に。丁寧語で。

対象エリア: ${areaLabel}
イベント: ${events.map(e => `${e.title}(${e.venue} ${e.startTime}〜 需要${e.demandScore})`).join(" / ") || "なし"}
遅延: ${alerts.map(d => `${d.line}${d.status === "stop" ? "運転見合わせ" : "遅延" + d.minutes + "分"}`).join(" / ") || "なし"}
渋滞: ${traffic.filter(t => t.level >= 2).map(t => `${t.area}(${t.desc})`).join(" / ") || "なし"}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 週次インサイト生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function generateWeeklyInsight(reports) {
  const recent = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  return callClaude(`タクシー運転手の直近${recent.length}回分のデータを分析して、傾向と今後の戦略を3〜4文でアドバイス。具体的な数字と曜日を引用。丁寧語で。

${recent.map(r => `${r.date}(${dow(r.date)}) 売上${fmt(r.gross_sales)}円 実車率${occ(r)}% 時間単価${fmt(hourly(r))}円`).join("\n")}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 日報OCR（Claude Vision）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// claude-proxy経由でOCRを実行する共通関数（promptを確実に使用できる）
async function runOCRviaClaude(imageBase64, mimeType, prompt) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${EDGE_BASE}/claude-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) { console.error("[ai.js] OCR error:", res.status); return null; }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  // <scan>タグ（全行読み取りログ）を除去してJSONだけ抽出
  const stripped = text.replace(/<scan>[\s\S]*?<\/scan>/g, "").replace(/```json\n?|\n?```/g, "").trim();
  // JSON部分だけ切り出す（{から始まる最初のブロック）
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch ? jsonMatch[0] : stripped;
  try { return { fields: JSON.parse(cleaned) }; }
  catch { console.error("[ai.js] JSON parse error:", cleaned.slice(0, 200)); return null; }
}

export async function runReportOCR(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, REPORT_OCR_PROMPT);
}

export async function runShiftOCR(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, SHIFT_OCR_PROMPT);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OCRプロンプト定数（Edge Function 側でも使用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const REPORT_OCR_PROMPT = `あなたはタクシー日報OCRシステムです。
画像を解析し、JSONのみを返してください。前置き・説明・マークダウン不要。

フォーマット判定ルール:
・美松交通（簡易版）: 合計金額列の合計 → gross_sales
・美松交通（フル版）: 「総営収」 → gross_sales
・グリーンキャブ: 「税込運収」 → gross_sales、「高速納金」 → highway_fee、差引・走行粁 → total_distance

重要: occupied_distance（実車距離）は両社とも記載なし → 必ずnull

営業場所の読み取り:
・「営業エリア」「主要エリア」「主な乗車地」「乗車場所」「エリアコード」などがあれば work_area に入れる
・地名・駅名・エリアコードなど記載内容をそのまま読み取る（例: "渋谷・新宿", "港区", "A地区"）
・記載がなければ null

出力JSON:
{
  "company": "会社名",
  "driver_name": "氏名",
  "report_date": "YYYY-MM-DD",
  "clock_in": "HH:MM",
  "clock_out": "HH:MM",
  "gross_sales": 整数,
  "highway_fee": 整数またはnull,
  "ride_count": 整数,
  "total_distance": 整数またはnull,
  "occupied_distance": null,
  "work_hours": 小数,
  "work_area": "営業エリア名またはnull",
  "format_type": "mismatsu_simple|mismatsu_full|greencab|unknown",
  "confidence": 0〜100,
  "unreadable_fields": ["読み取れなかった項目名"],
  "notes": "特記事項"
}`;

export const SHIFT_OCR_PROMPT = `あなたはタクシー会社の勤務予定表を読み取るアシスタントです。
画像をじっくり観察し、以下の手順で丁寧に処理してください。

## STEP1: 表の構造を把握する
まず画像全体を見て「表が何列構成か」「ヘッダーに何が書いてあるか」を確認してください。
典型的なレイアウト: 左半分・右半分の2ブロック構成で、各ブロックに「日付」「曜日」「勤務」列がある。
ヘッダーから期間（dateFrom・dateTo）を読み取る。例: "2026年6月分 (2026/06/16 〜 2026/07/15)"

## STEP2: 1行ずつ声に出して読む（最重要）
<scan> タグの中に、表の全行を1行ずつ書き出してください。
左ブロックを上から最後まで読み終えてから、右ブロックを上から読む。
各行の書き方: "行番号. 日付(曜日) → 勤務内容"
例:
1. 16日(火) → 隔勤
2. 17日(水) → 公休
3. 18日(木) → 隔勤
...
（1行も飛ばさないこと。29日・30日など末尾の行も必ず含める）

## STEP3: 年月を確定する
・日付数値 ≥ dateFromの日 → 開始月の年月
・日付数値 < dateFromの日 → 終了月の年月
例) dateFrom=2026/06/16: 16〜末日 → 2026-06、01〜15 → 2026-07

## STEP4: 出勤日を抽出する
【shiftsに含める】隔勤・指隔・日勤・夜勤・出勤・その他勤務コード
【含めない】公休・休・空白・塗りつぶしのみの行

## STEP5: 時刻
出庫・帰庫時刻の列があれば読み取る。なければ clockIn/clockOut は null。

## 出力形式
<scan> タグで全行を書き出した後、以下のJSONのみ出力（マークダウン不要）:
{
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "shifts": [
    { "date": "YYYY-MM-DD", "clockIn": null, "clockOut": null, "isNight": false, "note": "隔勤" }
  ],
  "confidence": 0〜100,
  "notes": "全行数・出勤日数を必ず記載（例: 全30行中 出勤13日）"
}`;
