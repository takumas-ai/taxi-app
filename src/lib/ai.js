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
export async function runReportOCR(imageBase64, mimeType) {
  return callOCR(imageBase64, mimeType, REPORT_OCR_PROMPT);
}

export async function runShiftOCR(imageBase64, mimeType) {
  return callOCR(imageBase64, mimeType, SHIFT_OCR_PROMPT);
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
  "format_type": "mismatsu_simple|mismatsu_full|greencab|unknown",
  "confidence": 0〜100,
  "unreadable_fields": ["読み取れなかった項目名"],
  "notes": "特記事項"
}`;

export const SHIFT_OCR_PROMPT = `あなたはタクシー会社のシフト表OCRシステムです。
画像からこの月のシフト情報を読み取り、JSONのみ返してください。前置き・説明不要。

出力形式:
{
  "year": 年（整数）,
  "month": 月（整数）,
  "shifts": [
    { "date": "YYYY-MM-DD", "clockIn": "HH:MM", "clockOut": "HH:MM", "isNight": true/false, "note": "備考" }
  ],
  "confidence": 0〜100,
  "notes": "特記事項"
}

注意:
・隔日勤務は出庫日と帰庫日が異なる。clockOutが翌日の場合はisNight=true
・公休・休日は含めない（出勤日のみ）
・時刻不明の場合は標準時刻を推定してnotesに記載`;
