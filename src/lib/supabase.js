// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase クライアント初期化
// .env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してから使用
// React Native 移行時: @supabase/supabase-js の import はそのまま使える
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] 環境変数が未設定です。.env.example を参照して .env を作成してください。");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 認証ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** メールアドレスでサインアップ */
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

/** メールアドレスでサインイン */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** Apple / Google OAuth（React Native 移行後に有効化） */
export async function signInWithOAuth(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider });
  return { data, error };
}

/** サインアウト */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** 現在のセッション取得 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** 認証状態の変化を監視 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ユーザープロフィール
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** ユーザープロフィールを取得 */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  return { data, error };
}

/** ユーザープロフィールを作成 or 更新（upsert） */
export async function upsertProfile(profile) {
  const { id, ...fields } = profile;
  const { error } = await supabase
    .from("users")
    .update(fields)
    .eq("id", id);
  if (error) console.error("[upsertProfile] error:", error.message, JSON.stringify(profile));
  return { error };
}

/** 新規登録時の初回プロフィール作成（INSERT） */
export async function insertProfile(profile) {
  const { error } = await supabase
    .from("users")
    .insert(profile);
  if (error) console.error("[insertProfile] error:", error.message, JSON.stringify(profile));
  return { error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 日報 CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 日報一覧取得（当該ユーザーのみ・日付降順） */
export async function fetchReports(userId) {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("user_id", userId)
    .order("report_date", { ascending: false });
  return { data: data ?? [], error };
}

/** 日報を保存（insert） */
export async function insertReport(report) {
  const { data, error } = await supabase
    .from("daily_reports")
    .insert(report)
    .select()
    .single();
  return { data, error };
}

/** 日報を更新 */
export async function updateReport(id, updates) {
  const { data, error } = await supabase
    .from("daily_reports")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 画像アップロード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 日報画像をStorage にアップロードし、公開URLを返す
 * path 例: `reports/{userId}/{reportDate}_{timestamp}.jpg`
 */
export async function uploadReportImage(file, userId) {
  const ext  = file.name.split(".").pop();
  const path = `reports/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("report-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { url: null, error };
  const { data } = supabase.storage.from("report-images").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 紹介コード（referral）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 紹介コードを使った登録者数を取得（RPCで RLS バイパス） */
export async function fetchReferralCount(refCode) {
  const { data, error } = await supabase
    .rpc("count_referrals", { ref_code: refCode });
  return { count: data ?? 0, error };
}

/** 登録時に使った紹介コードをプロフィールに保存 */
export async function saveReferredBy(userId, referredBy) {
  const { error } = await supabase
    .from("users")
    .update({ referred_by: referredBy })
    .eq("id", userId);
  return { error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 意見箱（feedback）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 意見を送信 */
export async function insertFeedback({ userId, category, body, anonymous }) {
  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id:   anonymous ? null : userId,
      category,
      body,
      anonymous,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理画面用（service role 不要・RLS対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 全ユーザー一覧（管理者のみ：RLSポリシーで admin ユーザーのみ許可） */
export async function adminFetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, company_name, plan, xp, monthly_upload_count, referred_by, deletion_requested, created_at, updated_at, areas")
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

/** 全フィードバック一覧 */
export async function adminFetchFeedback() {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

/** フィードバックを既読にする */
export async function adminMarkFeedbackRead(id) {
  const { error } = await supabase
    .from("feedback")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  return { error };
}

/** 紹介一覧（referred_by がある全ユーザー） */
export async function adminFetchReferrals() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, referred_by, created_at, xp")
    .not("referred_by", "is", null)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

/** ユーザーに XP を付与 */
export async function adminGrantXP(userId, xp) {
  const { data: current } = await supabase.from("users").select("xp").eq("id", userId).single();
  const newXp = (current?.xp ?? 0) + xp;
  const { error } = await supabase.from("users").update({ xp: newXp }).eq("id", userId);
  return { error };
}

/** アカウント削除リクエストを処理済みにする（実際の削除は手動） */
export async function adminResolveDeleteRequest(userId) {
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested: false })
    .eq("id", userId);
  return { error };
}

/** お知らせを作成（notifications テーブル） */
export async function adminCreateNotification({ title, body, area, severity }) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ title, body, area: area || null, severity: severity || "info", created_at: new Date().toISOString() })
    .select()
    .single();
  return { data, error };
}

/** お知らせ一覧取得 */
export async function adminFetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: data ?? [], error };
}

/** アプリ全体メトリクス */
export async function adminFetchMetrics() {
  const [usersRes, reportsRes] = await Promise.all([
    supabase.from("users").select("id, created_at, plan", { count: "exact" }),
    supabase.from("daily_reports").select("id, created_at", { count: "exact" }),
  ]);
  const now = new Date();
  const day30ago = new Date(now - 30 * 86400000).toISOString();
  const mauCount = (usersRes.data ?? []).filter(u => u.updated_at > day30ago || u.created_at > day30ago).length;
  return {
    totalUsers: usersRes.count ?? 0,
    totalReports: reportsRes.count ?? 0,
    mau: mauCount,
    paidUsers: (usersRes.data ?? []).filter(u => u.plan === "paid").length,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// シフト管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** シフト一覧取得 */
export async function fetchShifts(userId) {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .order("shift_date", { ascending: true });
  return { data: data ?? [], error };
}

/** シフトをupsert（shift_dateが同じなら上書き） */
export async function upsertShifts(userId, shifts) {
  const rows = shifts.map(s => ({
    user_id:    userId,
    shift_date: s.date,
    clock_in:   s.clockIn  || null,
    clock_out:  s.clockOut || null,
    is_night:   s.isNight  || false,
    note:       s.note     || null,
  }));
  const { data, error } = await supabase
    .from("shifts")
    .upsert(rows, { onConflict: "user_id,shift_date" })
    .select();
  return { data: data ?? [], error };
}

/** シフト1件削除（shift_date で指定） */
export async function deleteShift(userId, shiftDate) {
  const { error } = await supabase
    .from("shifts")
    .delete()
    .eq("user_id", userId)
    .eq("shift_date", shiftDate);
  return { error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 翌日発表（daily_summaries）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 指定日の集計サマリーを取得 */
export async function fetchSummary(summaryDate) {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .eq("summary_date", summaryDate)
    .single();
  return { data, error };
}
