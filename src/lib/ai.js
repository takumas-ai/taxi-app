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

export async function runReportOCRP2(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, REPORT_OCR_PROMPT_P2);
}

export async function runShiftOCR(imageBase64, mimeType) {
  return runOCRviaClaude(imageBase64, mimeType, SHIFT_OCR_PROMPT);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OCRプロンプト定数（Edge Function 側でも使用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const REPORT_OCR_PROMPT = `あなたはタクシー日報OCRシステムです。画像を丁寧に観察し、JSONのみ返してください。前置き・説明・マークダウン不要。

## 会社別フォーマット

### グリーンキャブ（日報 I）の読み方
画像に「グリーンキャブ」または「日報Ⅰ」「日報 I」と書かれていればこのフォーマット。

**ヘッダー行（最上部）**
- 日付 → report_date（"YYYY-MM-DD"）
- 出庫日時 → clock_in（"HH:MM"）
- 帰庫日時 → clock_out（"HH:MM"）
- 乗務員氏名 → driver_name
- 乗務員コード → driver_code

**右側の金額ボックス（最重要）**
右上に縦並びのボックスがある。上から順に読む:
- 「税込運収」の右の数字 → gross_sales（例: 22,300 → 22300）
- 「高速納金」の右の数字 → highway_fee（空欄なら0）
- 「納金額」の右の数字 → payment_amount
- 「消費税」の右の数字 → tax_amount
- 「運収」の右の数字 → net_sales（税抜き運収）

**集計表の差引行**
表の左側に帰庫/出庫/差引の3行がある。差引行を読む:
- 走行粁（走行キロ）の列 → total_distance
- 回数の列 → ride_count（この日の総乗車回数）

**乗車記録テーブル**
「No | 乗 | 降 | 乗車地 | 降車地 | 経由地 | 営業Km | 人員 | 金額 | 現収 | 未収 | 備考」の表を全行読む。

「休」と書かれた行は休憩: その行の時刻を "HH:MM-HH:MM" として break_times に追加
通常の乗車行: rides 配列に追加

乗車地・降車地の正規化ルール:
末尾の丁目番号（半角・全角数字）を除去し区名+町名だけ残す
例: "新宿区新宿7" → "新宿区新宿"
    "渋谷区千駄ヶ谷5" → "渋谷区千駄ヶ谷"
    "港区六本木5" → "港区六本木"
    "世田谷区駒沢1" → "世田谷区駒沢"
    "新宿区西新宿2" → "新宿区西新宿"

### 美松交通フォーマット
- 簡易版: 合計金額列の合計 → gross_sales
- フル版: 「総営収」 → gross_sales

## 出力JSON
{
  "company": "会社名",
  "driver_name": "氏名またはnull",
  "driver_code": "乗務員コードまたはnull",
  "report_date": "YYYY-MM-DD",
  "clock_in": "HH:MM",
  "clock_out": "HH:MM",
  "gross_sales": 整数,
  "net_sales": 整数またはnull,
  "tax_amount": 整数またはnull,
  "highway_fee": 整数,
  "payment_amount": 整数またはnull,
  "ride_count": 整数,
  "total_distance": 整数またはnull,
  "occupied_distance": null,
  "break_times": [
    { "start": "HH:MM", "end": "HH:MM" }
  ],
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
  "work_area": null,
  "format_type": "greencab|mismatsu_simple|mismatsu_full|unknown",
  "confidence": 0〜100,
  "notes": "読み取れなかった項目・特記事項"
}`;

// 日報 2枚目（乗車記録のみ抽出）
export const REPORT_OCR_PROMPT_P2 = `あなたはタクシー日報OCRシステムです。これは日報の2枚目（乗車記録の続き）です。
乗車記録テーブルだけを読み取り、JSONのみ返してください。前置き・説明・マークダウン不要。

「No | 乗 | 降 | 乗車地 | 降車地 | 経由地 | 営業Km | 人員 | 金額 | 現収 | 未収 | 備考」の表を全行読む。
「休」行は break_times に追加。通常行は rides に追加。

乗車地・降車地の正規化: 末尾の数字を除去（"新宿区新宿7" → "新宿区新宿"）

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
