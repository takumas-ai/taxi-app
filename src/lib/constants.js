// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// デザイントークン・ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DARK_COLORS = {
  bg:"#0A0F1E", surface:"#111827", card:"#161F30", cardHover:"#1C2740",
  border:"#1E2D45", accent:"#2563EB", accentLight:"#3B82F6", accentGlow:"#3B82F620",
  gold:"#F59E0B", goldGlow:"#F59E0B15", green:"#10B981", greenGlow:"#10B98115",
  red:"#EF4444", redGlow:"#EF444415", orange:"#F97316", orangeGlow:"#F9731615",
  purple:"#A855F7", purpleGlow:"#A855F715",
  text:"#F1F5F9", sub:"#94A3B8", muted:"#64748B", white:"#FFFFFF",
};

const LIGHT_COLORS = {
  bg:"#F1F5F9", surface:"#FFFFFF", card:"#FFFFFF", cardHover:"#F8FAFC",
  border:"#CBD5E1", accent:"#2563EB", accentLight:"#2563EB", accentGlow:"#EFF6FF",
  gold:"#D97706", goldGlow:"#FFFBEB", green:"#16A34A", greenGlow:"#F0FDF4",
  red:"#DC2626", redGlow:"#FEF2F2", orange:"#EA580C", orangeGlow:"#FFF7ED",
  purple:"#9333EA", purpleGlow:"#FAF5FF",
  text:"#0F172A", sub:"#334155", muted:"#64748B", white:"#FFFFFF",
};

// ミュータブルなカラーオブジェクト（テーマ切替時に中身を入れ替える）
export const C = { ...DARK_COLORS };

/**
 * テーマを適用する。App.jsx から呼ぶ。
 * isDark=true → ダークモード、false → ライトモード
 */
export function applyTheme(isDark) {
  const src = isDark ? DARK_COLORS : LIGHT_COLORS;
  Object.keys(src).forEach(k => { C[k] = src[k]; });
  // body背景も同期
  if (typeof document !== "undefined") {
    document.body.style.backgroundColor = src.bg;
    document.body.style.color = src.text;
  }
}

// ━━━ 季節ごとの日没時間から isDark を判定 ━━━
export function computeIsDark(mode) {
  if (mode === "dark")  return true;
  if (mode === "light") return false;
  // auto: 季節の日没時間を超えたらダーク
  const now   = new Date();
  const month = now.getMonth() + 1;
  const mins  = now.getHours() * 60 + now.getMinutes();
  // 春3〜5: 17:45 / 夏6〜8: 18:30 / 秋9〜11: 17:15 / 冬12〜2: 16:30
  const sunset =
    month >= 6 && month <= 8 ? 18 * 60 + 30 :
    month >= 3 && month <= 5 ? 17 * 60 + 45 :
    month >= 9 && month <= 11 ? 17 * 60 + 15 :
    16 * 60 + 30;
  return mins >= sunset;
}

export const DAYS_JA = ["日","月","火","水","木","金","土"];
export const FREE_LIMIT = 30; // β版：全ユーザー月30枚
export const PLAN_OCR_LIMITS = { free: 30, standard: 30, pro: 60 }; // β版：free/standardとも30枚
export const PLAN_LABELS = { free: "無料プラン", standard: "スタンダード", pro: "プロ" };
export const TODAY = new Date().toISOString().slice(0,10);
export const THIS_YEAR  = new Date().getFullYear();
export const THIS_MONTH = new Date().getMonth() + 1;

/**
 * 締日ベースの集計期間を返す
 * closingDay: 0 = 月末, 1〜31 = その日
 * 戻り値: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 *
 * 例) closingDay=15, 今日=6/20 → start=6/16, end=7/15
 *     closingDay=15, 今日=6/10 → start=5/16, end=6/15
 */
export function getClosingPeriod(closingDay = 0) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-12
  const d = today.getDate();

  if (!closingDay || closingDay === 0) {
    // 月末締め: 当月1日〜末日
    const start = `${y}-${String(m).padStart(2,"0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end   = `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    return { start, end };
  }

  // 締日あり: 今日 > 締日 → 締日翌日〜翌月締日
  //           今日 ≤ 締日 → 前月締日翌日〜今月締日
  let startM, startY, endM, endY;
  if (d > closingDay) {
    startY = y; startM = m;
    endY   = m === 12 ? y + 1 : y;
    endM   = m === 12 ? 1 : m + 1;
  } else {
    startY = m === 1 ? y - 1 : y;
    startM = m === 1 ? 12 : m - 1;
    endY   = y; endM = m;
  }
  const lastDayOfEndM = new Date(endY, endM, 0).getDate();
  const actualEnd = Math.min(closingDay, lastDayOfEndM);
  const startDay  = closingDay + 1;
  // startDayが前月末日を超える場合は翌月1日に
  const lastDayOfStartM = new Date(startY, startM, 0).getDate();
  const actualStart = startDay > lastDayOfStartM ? 1 : startDay;
  const actualStartM = startDay > lastDayOfStartM
    ? (startM === 12 ? 1 : startM + 1)
    : startM;
  const actualStartY = startDay > lastDayOfStartM && startM === 12 ? startY + 1 : startY;

  return {
    start: `${actualStartY}-${String(actualStartM).padStart(2,"0")}-${String(actualStart).padStart(2,"0")}`,
    end:   `${endY}-${String(endM).padStart(2,"0")}-${String(actualEnd).padStart(2,"0")}`,
  };
}

// ユーティリティ
export const fmt    = n => (n==null||isNaN(Number(n))) ? "0" : Number(n).toLocaleString("ja-JP");
export const occ    = r => (r&&r.total_distance>0) ? Math.round(((r.occupied_distance||0)/r.total_distance)*100) : 0;
export const dow    = d => DAYS_JA[new Date(d + "T00:00:00").getDay()]; // UTC解釈による曜日ずれを防ぐ
export const hourly = r => (r&&r.work_hours>0) ? Math.round((r.gross_sales||0)/r.work_hours) : 0;
export const unit   = r => (r&&r.ride_count>0)  ? Math.round((r.gross_sales||0)/r.ride_count) : 0;
export const loadS  = (k,f) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):f; } catch { return f; } };
export const saveS  = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };
// NOTE: React Native移行時はlocalStorageをAsyncStorage / Supabaseに差し替え

/**
 * 手取り計算（ドライバー種別で分岐）
 * @param {number} sales - 売上（税込）
 * @param {{ rate:number, deduction:number, expenses:number }} settings - taxi_takepay
 * @param {string} workType - user.workType
 * @returns {number} 手取り金額
 */
export function calcTake(sales, settings = {}, workType = "") {
  if (workType === "個人タクシー") {
    // 個タク: 売上 − 月間経費
    return Math.max(0, Math.round(sales - (settings.expenses || 0)));
  }
  // 法人タク: 売上 × 歩合率 − 控除額
  const rate      = settings.rate      ?? 55;
  const deduction = settings.deduction ?? 30000;
  return Math.max(0, Math.round(sales * rate / 100 - deduction));
}
