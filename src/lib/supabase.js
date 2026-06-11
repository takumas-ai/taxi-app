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
  const { data, error } = await supabase
    .from("users")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  return { data, error };
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
