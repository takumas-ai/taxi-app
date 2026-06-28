// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// validate.js — 入力バリデーション & サニタイズ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── XSS対策：テキスト入力のサニタイズ ───
// Reactは{}でのレンダリングは自動エスケープされるが、
// DBに保存する前にHTMLタグと危険文字を除去する

/** テキスト入力をサニタイズ（HTMLタグ除去・制御文字除去） */
export function sanitizeText(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>/g, "")         // HTMLタグ除去
    .replace(/[<>'"]/g, "")          // HTML特殊文字除去
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // 制御文字除去（改行\n=0x0Aは許可）
    .trim()
    .slice(0, maxLength);
}

/** メールアドレスの基本バリデーション */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase().trim());
}

/** パスワードの強度チェック（6文字以上） */
export function isValidPassword(pw) {
  return typeof pw === "string" && pw.length >= 6;
}

// ─── 日報データのバリデーション ───

// タクシー日報として現実的な範囲
const REPORT_BOUNDS = {
  gross_sales:       { min: 0, max: 500000, label: "総売上" },
  cash_sales:        { min: 0, max: 500000, label: "現金売上" },
  card_sales:        { min: 0, max: 500000, label: "カード売上" },
  app_sales:         { min: 0, max: 500000, label: "配車アプリ売上" },
  highway_fee:       { min: 0, max:  50000, label: "高速料金" },
  ride_count:        { min: 0, max:    200, label: "営業回数" },
  total_distance:    { min: 0, max:   2000, label: "走行距離" },
  occupied_distance: { min: 0, max:   2000, label: "実車距離" },
  work_hours:        { min: 0, max:     24, label: "勤務時間" },
  break_hours:       { min: 0, max:     12, label: "休憩時間" },
};

/**
 * 数値を現実的な範囲にクランプする
 * @param {string} fieldKey - REPORT_BOUNDSのキー
 * @param {number|string} value - 入力値
 * @returns {number} クランプ済みの数値
 */
export function clampReportValue(fieldKey, value) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num)) return 0;
  const bounds = REPORT_BOUNDS[fieldKey];
  if (!bounds) return num;
  return Math.min(Math.max(num, bounds.min), bounds.max);
}

/**
 * 日報フォームデータのバリデーション
 * @param {Object} form - フォームデータ
 * @returns {{ errors: Object, isValid: boolean }}
 */
export function validateReportForm(form) {
  const errors = {};

  // 日付チェック
  if (!form.date) {
    errors.date = "必須";
  } else {
    const d = new Date(form.date);
    const now = new Date();
    const minDate = new Date("2020-01-01");
    if (isNaN(d.getTime())) {
      errors.date = "無効な日付";
    } else if (d > now) {
      errors.date = "未来の日付は入力できません";
    } else if (d < minDate) {
      errors.date = "2020年以降の日付を入力してください";
    }
  }

  // 総売上チェック
  const grossSales = parseInt(form.gross_sales) || 0;
  if (!form.gross_sales || grossSales <= 0) {
    errors.gross_sales = "必須";
  } else if (grossSales > REPORT_BOUNDS.gross_sales.max) {
    errors.gross_sales = `${(REPORT_BOUNDS.gross_sales.max / 10000).toFixed(0)}万円以下で入力してください`;
  }

  // 実車距離 ≤ 走行距離 チェック
  const totalDist = parseInt(form.total_distance) || 0;
  const occDist   = parseInt(form.occupied_distance) || 0;
  if (totalDist > 0 && occDist > totalDist) {
    errors.occupied_distance = "走行距離以下にしてください";
  }

  // 勤務時間チェック
  const workH  = parseFloat(form.work_hours) || 0;
  const breakH = parseFloat(form.break_hours) || 0;
  if (workH > 0 && breakH >= workH) {
    errors.break_hours = "勤務時間より短くしてください";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

/**
 * 日報フォームデータをサニタイズ（保存直前に呼ぶ）
 * @param {Object} form - フォームデータ
 * @returns {Object} サニタイズ済みの保存用データ
 */
export function sanitizeReportData(form) {
  return {
    date:               String(form.date || "").slice(0, 10),
    gross_sales:        clampReportValue("gross_sales",       parseInt(form.gross_sales)      || 0),
    net_sales:          form.net_sales ? clampReportValue("gross_sales", parseInt(form.net_sales) || 0) : null,
    cash_sales:         clampReportValue("cash_sales",        parseInt(form.cash_sales)       || 0),
    card_sales:         clampReportValue("card_sales",        parseInt(form.card_sales)       || 0),
    app_sales:          clampReportValue("app_sales",         parseInt(form.app_sales)        || 0),
    highway_fee:        clampReportValue("highway_fee",       parseInt(form.highway_fee)      || 0),
    ride_count:         clampReportValue("ride_count",        parseInt(form.ride_count)       || 0),
    total_distance:     clampReportValue("total_distance",    parseInt(form.total_distance)   || 0),
    occupied_distance:  clampReportValue("occupied_distance", parseInt(form.occupied_distance)|| 0),
    work_hours:         clampReportValue("work_hours",        parseFloat(form.work_hours)     || 0),
    break_hours:        clampReportValue("break_hours",       parseFloat(form.break_hours)    || 0),
    emoney_sales:       clampReportValue("app_sales",  parseInt(form.emoney_sales) || 0),
    ticket_sales:       clampReportValue("app_sales",  parseInt(form.ticket_sales) || 0),
    tip_amount:         clampReportValue("app_sales",  parseInt(form.tip_amount)   || 0),
    adjustment:         Math.max(-9999999, Math.min(9999999, parseInt(form.adjustment) || 0)),
    trouble_note:       sanitizeText(form.trouble_note, 1000),
    work_area:          sanitizeText(form.work_area, 50),
    dispatch_type:      sanitizeText(form.dispatch_type || "", 50),
    ai_comment:         "",
  };
}

// ─── ファイルアップロードバリデーション ───

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILE_SIZE_MB = 30;

/**
 * アップロードファイルのバリデーション
 * @param {File} file
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: "ファイルが選択されていません" };

  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return { ok: false, error: `ファイルサイズは${MAX_FILE_SIZE_MB}MB以下にしてください（現在${sizeMB.toFixed(1)}MB）` };
  }

  // MIMEタイプの確認（ブラウザが設定するtype）
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { ok: false, error: "JPEG・PNG・WEBP・HEIC形式の画像のみ対応しています" };
  }

  return { ok: true };
}

// ─── プロフィールのバリデーション ───

/**
 * プロフィール更新データのサニタイズ
 * @param {Object} profile
 * @returns {Object} サニタイズ済み
 */
export function sanitizeProfile(profile) {
  const result = {};
  if ("name" in profile)         result.name         = sanitizeText(profile.name, 50);
  if ("company_name" in profile) result.company_name = sanitizeText(profile.company_name, 100);
  if ("work_type" in profile) {
    const VALID_WORK_TYPES = ["日勤", "夜勤", "隔日勤務", "個人タクシー"];
    result.work_type = VALID_WORK_TYPES.includes(profile.work_type) ? profile.work_type : "隔日勤務";
  }
  if ("monthly_target" in profile) {
    const t = parseInt(profile.monthly_target) || 0;
    result.monthly_target = Math.min(Math.max(t, 0), 10000000); // 0〜1000万
  }
  if ("areas" in profile) {
    result.areas = Array.isArray(profile.areas)
      ? profile.areas.slice(0, 10).map(a => sanitizeText(a, 20))
      : [];
  }
  return result;
}
