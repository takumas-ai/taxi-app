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

/** パスワードリセットメールを送信 */
export async function resetPasswordForEmail(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
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

/** 日報を削除 */
export async function deleteReport(id) {
  const { error } = await supabase
    .from("daily_reports")
    .delete()
    .eq("id", id);
  return { error };
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

/**
 * アバター画像をStorageにアップロードし、公開URLを返す
 * 既存ファイルは上書き（upsert: true）
 * path: `{userId}/avatar.{ext}`
 */
export async function uploadAvatar(file, userId) {
  const ext  = file.name.split(".").pop().toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { url: null, error };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // キャッシュ破棄のためタイムスタンプを付与
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 招待・紹介システム
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 自分の招待コードを生成・取得（未生成なら発行、生成済みならそのまま返す） */
export async function ensureReferralCode(userId) {
  // まず既存コードを確認
  const { data: profile } = await supabase
    .from("users").select("referral_code").eq("id", userId).single();
  if (profile?.referral_code) return { code: profile.referral_code, error: null };
  // なければRPCで生成
  const { data, error } = await supabase.rpc("generate_referral_code", { user_id: userId });
  return { code: data, error };
}

/**
 * 招待コードを使った登録を記録し、関連クーポンを発行する
 * 招待された側：invitedクーポン発行 / 招待した側：マイルストーン確認
 */
export async function registerWithReferral({ referredId, referredName, referralCode }) {
  // 1. 招待コードからreferrerを特定
  const { data: referrer } = await supabase
    .from("users").select("id, name").eq("referral_code", referralCode).single();
  if (!referrer) return { error: "無効な招待コードです", valid: false };

  // 2. referred_byを保存
  await supabase.from("users").update({ referred_by: referralCode }).eq("id", referredId);

  // 3. referral_eventsに記録（重複はUNIQUE制約で弾かれる）
  const { error: evErr } = await supabase.from("referral_events").insert({
    referrer_id:   referrer.id,
    referred_id:   referredId,
    referral_code: referralCode,
    referrer_name: referrer.name,
    referred_name: referredName,
  });
  if (evErr) {
    // referred_idのUNIQUE違反 = すでに招待済みの人
    if (evErr.code === "23505") return { error: "このコードはすでに使用済みです", valid: false };
    return { error: evErr.message, valid: false };
  }

  // 4. 招待された人にinvitedクーポンを発行（14日→44日分のため+30日）
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const invCode = "INV-" + Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  await supabase.from("coupons").insert({
    user_id:       referredId,
    code:          invCode,
    type:          "invited",
    benefit_days:  30,
    issued_reason: "招待コード登録ボーナス（+30日）",
  });

  // 5. 招待した人に +100 XP を付与
  const { data: cur } = await supabase.from("users").select("xp").eq("id", referrer.id).single();
  await supabase.from("users").update({ xp: (cur?.xp ?? 0) + 100 }).eq("id", referrer.id);

  // 6. 招待した人のマイルストーンをチェック・クーポン発行（RPC）
  const { data: milestone } = await supabase
    .rpc("check_referral_milestone", { referrer_id_input: referrer.id });

  return { error: null, valid: true, milestone, xpGranted: 100 };
}

/** 自分の招待実績（招待した人数 + 発行済みクーポン）を取得 */
export async function fetchMyReferralStats(userId, referralCode) {
  const [eventsRes, couponsRes] = await Promise.all([
    supabase.from("referral_events").select("referred_name, created_at")
      .eq("referrer_id", userId).order("created_at", { ascending: false }),
    supabase.from("coupons").select("*")
      .eq("user_id", userId).order("issued_at", { ascending: false }),
  ]);
  return {
    events:  eventsRes.data  ?? [],
    coupons: couponsRes.data ?? [],
  };
}

/** 自分のクーポン一覧を取得 */
export async function fetchMyCoupons(userId) {
  const { data, error } = await supabase
    .from("coupons").select("*").eq("user_id", userId)
    .order("issued_at", { ascending: false });
  return { data: data ?? [], error };
}

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
// 乗車記録 CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 乗車記録一覧取得（当該ユーザー・新しい順） */
export async function fetchRideRecords(userId) {
  const { data, error } = await supabase
    .from("ride_records")
    .select("*")
    .eq("user_id", userId)
    .order("boarding_time", { ascending: false });
  return { data: data ?? [], error };
}

/** 乗車記録をupsert（id が同じなら上書き） */
export async function upsertRideRecord(userId, rec) {
  const row = {
    id:               rec.id,
    user_id:          userId,
    work_date:        rec.workDate || null,
    boarding_time:    rec.boardingTime || null,
    pickup_location:  rec.pickupLocation || null,
    dropoff_time:     rec.dropoffTime || null,
    dropoff_location: rec.dropoffLocation || null,
    passengers:       rec.passengers || null,
    fare:             rec.fare || 0,
    highway_fee:      rec.highwayFee || null,
    payment_method:   rec.paymentMethod || null,
    boarding_method:  rec.boardingMethod || null,
    radio_type:       rec.radioType || null,
    memo:             rec.memo || null,
    lat:              rec.lat || null,
    lng:              rec.lng || null,
  };
  const { error } = await supabase
    .from("ride_records")
    .upsert(row, { onConflict: "id" });
  if (error) console.error("[upsertRideRecord]", error.message);
  return { error };
}

/** 乗車記録を削除 */
export async function deleteRideRecord(id) {
  const { error } = await supabase
    .from("ride_records")
    .delete()
    .eq("id", id);
  return { error };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ガイドスポット CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** ガイドスポット一覧取得（エリアで絞り込み可） */
export async function fetchGuideSpots(area = null) {
  let q = supabase.from("guide_spots").select("*").eq("status", "active");
  if (area) q = q.eq("area", area);
  const { data, error } = await q.order("demand_score", { ascending: false });
  return { data: data ?? [], error };
}

/** ガイドスポット投稿 */
export async function insertGuideSpot(userId, userName, spot) {
  const { data, error } = await supabase
    .from("guide_spots")
    .insert({
      category:         spot.category,
      subcategory:      spot.subcategory || null,
      name:             spot.name,
      area:             spot.area,
      emoji:            spot.emoji || "📍",
      tags:             spot.tags || [],
      peak:             spot.peak || null,
      lineup:           spot.lineup || null,
      tips:             spot.tips || [],
      caution:          spot.caution || null,
      access_note:      spot.accessNote || null,
      flow:             spot.flow || [],
      description:      spot.description || null,
      address:          spot.address || null,
      has_parking:      spot.hasParking || false,
      open_hours:       spot.openHours || null,
      demand_score:     3.0,
      contributor_id:   userId,
      contributor_name: userName,
    })
    .select().single();
  return { data, error };
}

/** ガイドスポット更新（編集履歴も記録） */
export async function updateGuideSpot(spotId, editorId, editorName, patch, changes) {
  const [spotRes, editRes] = await Promise.all([
    supabase.from("guide_spots").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", spotId).select().single(),
    supabase.from("guide_edits").insert({ spot_id: spotId, editor_id: editorId, editor_name: editorName, changes }),
  ]);
  return { data: spotRes.data, error: spotRes.error || editRes.error };
}

/** レビュー投稿（1ユーザー1スポット1件：upsert） */
export async function insertGuideReview(spotId, userId, userName, rating, body) {
  const { data, error } = await supabase
    .from("guide_reviews")
    .upsert({ spot_id: spotId, user_id: userId, user_name: userName, rating, body }, { onConflict: "spot_id,user_id" })
    .select().single();
  if (!error) {
    // rating 平均を再計算して guide_spots を更新
    const { data: reviews } = await supabase.from("guide_reviews").select("rating").eq("spot_id", spotId);
    if (reviews?.length) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await supabase.from("guide_spots")
        .update({ rating: Math.round(avg * 10) / 10, review_count: reviews.length })
        .eq("id", spotId);
    }
  }
  return { data, error };
}

/** スポットにフラグを立てる */
export async function flagGuideSpot(spotId, userId, reason) {
  const { error } = await supabase.from("guide_flags").insert({ spot_id: spotId, user_id: userId, reason });
  if (!error) {
    const { data } = await supabase.from("guide_spots").select("flag_count").eq("id", spotId).single();
    if (data) await supabase.from("guide_spots").update({ flag_count: (data.flag_count || 0) + 1 }).eq("id", spotId);
  }
  return { error };
}

/** スポットの編集履歴取得 */
export async function fetchGuideEdits(spotId) {
  const { data, error } = await supabase
    .from("guide_edits").select("*").eq("spot_id", spotId)
    .order("created_at", { ascending: false }).limit(10);
  return { data: data ?? [], error };
}

/** スポットのレビュー一覧取得 */
export async function fetchGuideReviews(spotId) {
  const { data, error } = await supabase
    .from("guide_reviews").select("*").eq("spot_id", spotId)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
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
    .from("referral_events")
    .select("id, referrer_id, referred_id, referral_code, referrer_name, referred_name, created_at")
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

export async function adminFetchCoupons() {
  const { data, error } = await supabase
    .from("coupons")
    .select("id, user_id, code, type, benefit_days, milestone_at, issued_at, used_at, expires_at")
    .order("issued_at", { ascending: false });
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 東京イベント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 指定日の東京イベントを優先度降順で取得 */
export async function fetchTodayEvents(eventDate) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("event_date", eventDate)
    .order("priority", { ascending: false })
    .order("estimated_capacity", { ascending: false });
  return { data: data ?? [], error };
}
