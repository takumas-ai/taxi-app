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
export const FREE_LIMIT = 8;
export const TODAY = new Date().toISOString().slice(0,10);
export const THIS_YEAR  = new Date().getFullYear();
export const THIS_MONTH = new Date().getMonth() + 1;

// ユーティリティ
export const fmt    = n => (n==null||isNaN(Number(n))) ? "0" : Number(n).toLocaleString("ja-JP");
export const occ    = r => (r&&r.total_distance>0) ? Math.round(((r.occupied_distance||0)/r.total_distance)*100) : 0;
export const dow    = d => DAYS_JA[new Date(d).getDay()];
export const hourly = r => (r&&r.work_hours>0) ? Math.round((r.gross_sales||0)/r.work_hours) : 0;
export const unit   = r => (r&&r.ride_count>0)  ? Math.round((r.gross_sales||0)/r.ride_count) : 0;
export const loadS  = (k,f) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):f; } catch { return f; } };
export const saveS  = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };
// NOTE: React Native移行時はlocalStorageをAsyncStorage / Supabaseに差し替え
