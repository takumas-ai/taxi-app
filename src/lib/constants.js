// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// デザイントークン・ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const C = {
  bg:"#0A0F1E", surface:"#111827", card:"#161F30", cardHover:"#1C2740",
  border:"#1E2D45", accent:"#2563EB", accentLight:"#3B82F6", accentGlow:"#3B82F620",
  gold:"#F59E0B", goldGlow:"#F59E0B15", green:"#10B981", greenGlow:"#10B98115",
  red:"#EF4444", redGlow:"#EF444415", orange:"#F97316", orangeGlow:"#F9731615",
  purple:"#A855F7", purpleGlow:"#A855F715",
  text:"#F1F5F9", sub:"#94A3B8", muted:"#475569", white:"#FFFFFF",
};

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
