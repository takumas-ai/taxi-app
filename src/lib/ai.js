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
// Haiku: OCR等の速度優先タスク
async function callClaude(prompt, maxTokens = 1000, model = "claude-haiku-4-5-20251001") {
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
      model,
    }),
  });

  if (!res.ok) {
    console.error("[ai.js] Edge Function エラー:", res.status, await res.text());
    return "";
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? data.text ?? "";
}

// Sonnet: アドバイス・分析系（品質優先）
const callSonnet = (prompt, maxTokens = 1200) =>
  callClaude(prompt, maxTokens, "claude-sonnet-4-6");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 日報のAIコメント生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function generateReportComment(report, allReports) {
  const recent = [...allReports].sort((a,b) => b.date?.localeCompare(a.date)).slice(0, 30);
  const avg = recent.length
    ? Math.round(recent.reduce((s, r) => s + (r.gross_sales||0), 0) / recent.length)
    : 0;

  // 曜日別平均
  const dowMap = {};
  recent.forEach(r => {
    const d = dow(r.date);
    if (!dowMap[d]) dowMap[d] = { sum:0, cnt:0 };
    dowMap[d].sum += r.gross_sales||0;
    dowMap[d].cnt++;
  });
  const dowStats = Object.entries(dowMap)
    .map(([d, {sum, cnt}]) => `${d}曜:${fmt(Math.round(sum/cnt))}円(${cnt}回)`)
    .join(" / ");

  // 実車率・時間単価の平均
  const avgOcc = recent.filter(r=>r.work_hours&&r.total_distance&&r.occupied_distance)
    .reduce((s,r,_,a) => s + occ(r)/a.length, 0);
  const avgHr = recent.filter(r=>r.work_hours&&r.gross_sales)
    .reduce((s,r,_,a) => s + hourly(r)/a.length, 0);

  return callSonnet(`あなたは経験豊富なタクシー営業コーチです。以下のデータを分析し、具体的で実践的なアドバイスを日本語・丁寧語で3〜4文でください。
データに根拠のない推測や精神論は避け、数字を引用して具体的に指摘してください。データが少ない項目については断言せず「傾向として」と添えてください。

【今日の記録】
日付: ${report.date}(${dow(report.date)}曜)
売上: ${fmt(report.gross_sales)}円（過去平均比 ${report.gross_sales >= avg ? "+" : ""}${fmt(report.gross_sales - avg)}円）
営業回数: ${report.ride_count}回 / 実車率: ${occ(report)}%（平均${Math.round(avgOcc)}%）
時間単価: ${fmt(hourly(report))}円/h（平均${fmt(Math.round(avgHr))}円/h）
${report.work_area ? `エリア: ${report.work_area}` : ""}
${report.dispatch_type ? `配車: ${report.dispatch_type}` : ""}
${report.trouble_note ? `備考: ${report.trouble_note}` : ""}

【過去${recent.length}回の傾向】
全体平均売上: ${fmt(avg)}円
曜日別平均: ${dowStats || "データ不足"}`, 1200);
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
  const recent = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  // 曜日別集計
  const dowMap = {};
  recent.forEach(r => {
    const d = dow(r.date);
    if (!dowMap[d]) dowMap[d] = { sum:0, cnt:0, occ:0, hr:0 };
    dowMap[d].sum += r.gross_sales||0;
    dowMap[d].cnt++;
    if (r.total_distance&&r.occupied_distance) dowMap[d].occ += occ(r);
    if (r.work_hours&&r.gross_sales) dowMap[d].hr += hourly(r);
  });
  const dowLines = Object.entries(dowMap).map(([d,v]) =>
    `${d}曜 平均${fmt(Math.round(v.sum/v.cnt))}円 実車率${Math.round(v.occ/v.cnt)}% (${v.cnt}回)`
  ).join("\n");

  const avgSales = Math.round(recent.reduce((s,r)=>s+(r.gross_sales||0),0)/recent.length);
  const best = [...recent].sort((a,b)=>(b.gross_sales||0)-(a.gross_sales||0))[0];
  const worst = [...recent].sort((a,b)=>(a.gross_sales||0)-(b.gross_sales||0))[0];

  return callSonnet(`あなたは経験豊富なタクシー営業コーチです。以下の直近データを分析し、改善ポイントと来週の戦略を日本語・丁寧語で4〜5文でアドバイスしてください。
具体的な曜日・数字を引用し、実践的な行動提案を含めてください。データが少ない場合は「まだ傾向が見えにくいですが」と添えてください。

【直近${recent.length}回の集計】
全体平均売上: ${fmt(avgSales)}円
最高: ${best?.date}(${dow(best?.date)}) ${fmt(best?.gross_sales)}円
最低: ${worst?.date}(${dow(worst?.date)}) ${fmt(worst?.gross_sales)}円

【曜日別平均】
${dowLines || "データ不足"}

【直近記録（新しい順）】
${recent.slice(0,10).map(r => `${r.date}(${dow(r.date)}) ${fmt(r.gross_sales)}円 実車率${occ(r)}% ${fmt(hourly(r))}円/h`).join("\n")}`, 1500);
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

export async function runReportOCRP2(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, REPORT_OCR_PROMPT_P2);
}

export async function runShiftOCR(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, SHIFT_OCR_PROMPT);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OCRプロンプト定数（Edge Function 側でも使用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 汎用タクシー日報OCRプロンプト（会社フォーマット自動検出）
export const REPORT_OCR_PROMPT = `あなたはタクシー日報OCRの専門AIです。
画像を解析し、JSONのみを返してください。前置き・説明・マークダウン不要。

どんな会社の日報でも、以下の対応表を使って柔軟にマッピングしてください:

| 出力フィールド | よく使われる欄名 |
|---|---|
| gross_sales | 税込運収 / 総営収 / 合計金額 / 売上合計 |
| cash_sales | 現金 / 現収 / 現金売上 |
| card_sales | カード / クレジット / カード売上 |
| app_sales | アプリ / GO / S.RIDE / DiDi / Uber |
| highway_fee | 高速納金 / 高速料金 / 高速代 |
| ride_count | 回数 / 乗車回数 / 営業回数 / 件数 |
| total_distance | 走行粁 / 走行距離 / 総走行 |
| occupied_distance | 実車距離 / 実車粁（なければnull） |
| clock_in | 出庫時刻 / 出庫 / 出発 |
| clock_out | 帰庫時刻 / 帰庫 / 到着 |

乗車記録テーブルが読み取れる場合は全行をridesに追加。
「休」と書かれた行は break_times に追加（{ "start":"HH:MM", "end":"HH:MM" }）。
乗車地・降車地は丁目・番地まで正確に読み取ること。

出庫・帰庫が読み取れたら work_hours を計算（日付またぎ対応、小数第1位）。

{
  "company": "会社名またはnull",
  "driver_name": "氏名またはnull",
  "report_date": "YYYY-MM-DD",
  "clock_in": "HH:MM またはnull",
  "clock_out": "HH:MM またはnull",
  "work_hours": 小数またはnull,
  "gross_sales": 整数またはnull,
  "cash_sales": 整数またはnull,
  "card_sales": 整数またはnull,
  "app_sales": 整数またはnull,
  "highway_fee": 整数またはnull,
  "ride_count": 整数またはnull,
  "total_distance": 整数またはnull,
  "occupied_distance": 整数またはnull,
  "break_times": [{ "start": "HH:MM", "end": "HH:MM" }],
  "rides": [{
    "no": 番号,
    "pickup_time": "HH:MM",
    "dropoff_time": "HH:MM",
    "pickup_area": "乗車地",
    "dropoff_area": "降車地",
    "km": 小数またはnull,
    "passengers": 整数,
    "amount": 整数,
    "note": "備考またはnull"
  }],
  "confidence": 0〜100,
  "notes": "読み取れなかった項目・特記事項"
}`;

// 日報 2枚目（乗車記録のみ抽出）
export const REPORT_OCR_PROMPT_P2 = `あなたはタクシー日報OCRシステムです。これは日報の2枚目（乗車記録の続き）です。
乗車記録テーブルだけを読み取り、JSONのみ返してください。前置き・説明・マークダウン不要。

「No | 乗 | 降 | 乗車地 | 降車地 | 経由地 | 営業Km | 人員 | 金額 | 現収 | 未収 | 備考」の表を全行読む。
「休」行は break_times に追加。通常行は rides に追加。

乗車地・降車地は丁目・番地まで正確に読み取ること

{
  "rides": [
    {
      "no": 番号,
      "pickup_time": "HH:MM",
      "dropoff_time": "HH:MM",
      "pickup_area": "正規化済み乗車地",
      "dropoff_area": "正規化済み降車地",
      "km": 小数またはnull,
      "passengers": 整数,
      "amount": 整数,
      "cash": 整数またはnull,
      "uncollected": 整数またはnull,
      "note": "備考またはnull"
    }
  ],
  "break_times": [
    { "start": "HH:MM", "end": "HH:MM" }
  ]
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
