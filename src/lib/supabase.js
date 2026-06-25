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

export const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "", {
  auth: {
    persistSession: true,       // localStorageにセッションを保持
    autoRefreshToken: true,     // トークンを自動更新
    storageKey: "takuro_auth",  // 他アプリと衝突しないキー名
  },
});

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

/** 他のデバイスからサインアウト（現在のデバイスはログイン維持） */
export async function signOutOtherDevices() {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  return { error };
}

/** 備考略語辞書を保存（memo_dict: { "電": "電子マネー", ... }） */
export async function saveMemoDict(userId, dict) {
  const { error } = await supabase
    .from("users")
    .update({ memo_dict: dict })
    .eq("id", userId);
  return { error };
}

/** タクローチャット：Edge Functionを呼び出してAI返答を取得 */
export async function callTakuroChat(messages, userContext) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/takuro-chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ messages, userContext }),
  });
  const data = await res.json();
  if (res.status === 429) throw Object.assign(new Error("rate_limit"), { message: "rate_limit" });
  if (data.error) throw new Error(data.error);
  // { text, remaining } をそのまま返す
  return { text: data.text || "少し時間をおいてもう一度試してください。", remaining: data.remaining ?? null };
}

/** 現在のセッション取得 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** 認証状態の変化を監視（event と session を両方渡す） */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(session, event));
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

/** 新規登録時の初回プロフィール作成（重複キーは無視） */
export async function insertProfile(profile) {
  const { error } = await supabase
    .from("users")
    .insert(profile);
  // 23505 = duplicate key (プロフィール作成済み) → エラーとして扱わない
  if (error && error.code !== "23505") {
    console.error("[insertProfile] error:", error.message, JSON.stringify(profile));
  }
  return { error: error?.code === "23505" ? null : error };
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
  const { data, error } = await q.order("created_at", { ascending: false });
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
      open_hours:       spot.open_hours || null,
      map_url:          spot.map_url || null,
      wait_times:       Object.keys(spot.wait_times||{}).length ? spot.wait_times : null,
      facilities:       Object.keys(spot.facilities||{}).length ? spot.facilities : null,
      price_range:      spot.price_range || null,
      demand_score:     3.0,
      vote_count:       0,
      contributor_id:   userId,
      contributor_name: userName,
    })
    .select().single();
  return { data, error };
}

/** 「参考になった」投票（1ユーザー1スポット：UNIQUE制約で重複防止） */
export async function voteGuideSpot(spotId, userId) {
  const { error } = await supabase.from("guide_votes").insert({ spot_id: spotId, user_id: userId });
  if (!error) {
    const { data } = await supabase.from("guide_spots").select("vote_count").eq("id", spotId).single();
    if (data) await supabase.from("guide_spots").update({ vote_count: (data.vote_count || 0) + 1 }).eq("id", spotId);
  }
  return { error };
}

/** ユーザーの投票済みスポット一覧取得 */
export async function fetchUserVotes(userId) {
  const { data, error } = await supabase
    .from("guide_votes").select("spot_id").eq("user_id", userId);
  return { data: data ?? [], error };
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
    .select("*")
    .order("created_at", { ascending: false });
  if (error) console.error("[adminFetchUsers]", error.message, error.code);
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

/** 特定ユーザーの日報一覧（管理者用） */
export async function adminFetchUserReports(userId) {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, gross_sales, ride_count, work_hours, created_at")
    .eq("user_id", userId)
    .order("report_date", { ascending: false })
    .limit(100);
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
// マイフレンド
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** フレンド追加（QRスキャン後に呼び出す） */
export async function addFriend(currentUserId, targetUserId) {
  // 自分自身には送れない
  if (currentUserId === targetUserId) return { error: new Error("自分自身は追加できません") };
  // すでにフレンドか確認
  const { data: existing } = await supabase
    .from("friendships").select("id").eq("user_id", currentUserId).eq("friend_id", targetUserId).single();
  if (existing) return { error: null, alreadyFriend: true };
  // フレンドシップ insert（DBトリガーが相互分を自動作成）
  const { error: fErr } = await supabase
    .from("friendships").insert({ user_id: currentUserId, friend_id: targetUserId });
  if (fErr) return { error: fErr };
  // 相手への通知を作成
  const { data: me } = await supabase.from("users").select("name").eq("id", currentUserId).single();
  await supabase.from("friend_notifications").insert({
    user_id: targetUserId,
    from_user_id: currentUserId,
    from_name: me?.name || "タクドラ",
  });
  return { error: null, alreadyFriend: false };
}

/** フレンド一覧取得 */
export async function fetchFriends(userId) {
  const { data: friendships, error } = await supabase
    .from("friendships").select("friend_id").eq("user_id", userId);
  if (!friendships?.length) return { data: [], error };
  const friendIds = friendships.map(f => f.friend_id);
  const { data: profiles } = await supabase
    .from("users").select("id, name, avatar_url, avatar_preset, areas").in("id", friendIds);
  return { data: profiles ?? [], error: null };
}

/** フレンドを削除（双方向） */
export async function removeFriend(currentUserId, targetUserId) {
  await supabase.from("friendships")
    .delete().eq("user_id", currentUserId).eq("friend_id", targetUserId);
  await supabase.from("friendships")
    .delete().eq("user_id", targetUserId).eq("friend_id", currentUserId);
  return { error: null };
}

/** 未読フレンド通知数 */
export async function fetchFriendNotifCount(userId) {
  const { count, error } = await supabase
    .from("friend_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("read", false);
  return { count: count ?? 0, error };
}

/** フレンド通知一覧（最新10件） */
export async function fetchFriendNotifs(userId) {
  const { data, error } = await supabase
    .from("friend_notifications").select("*")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
  return { data: data ?? [], error };
}

/** 通知を既読にする */
export async function markFriendNotifsRead(userId) {
  const { error } = await supabase
    .from("friend_notifications").update({ read: true }).eq("user_id", userId);
  return { error };
}

/** 日報の共有フラグを切り替え */
export async function toggleShareReport(reportId, isShared) {
  const { error } = await supabase
    .from("daily_reports").update({ is_shared: isShared }).eq("id", reportId);
  return { error };
}

/** シフトの共有フラグを切り替え（shift_dateで指定） */
export async function toggleShareShift(userId, shiftDate, isShared) {
  const { error } = await supabase
    .from("shifts").update({ is_shared: isShared })
    .eq("user_id", userId).eq("shift_date", shiftDate);
  return { error };
}

/** フレンドの共有シフト一覧（今日以降） */
export async function fetchFriendsShifts(userId) {
  const { data: friendships } = await supabase
    .from("friendships").select("friend_id").eq("user_id", userId);
  if (!friendships?.length) return { data: [], error: null };
  const friendIds = friendships.map(f => f.friend_id);
  const today = new Date().toISOString().slice(0, 10);
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, user_id, shift_date, clock_in, clock_out, note")
    .in("user_id", friendIds).eq("is_shared", true)
    .gte("shift_date", today)
    .order("shift_date", { ascending: true }).limit(50);
  if (!shifts?.length) return { data: [], error };
  const { data: profiles } = await supabase
    .from("users").select("id, name, avatar_preset").in("id", friendIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    data: shifts.map(s => ({ ...s, userName: profileMap[s.user_id]?.name || "?", avatarPreset: profileMap[s.user_id]?.avatar_preset })),
    error: null,
  };
}

/** フレンドの共有日報一覧 */
export async function fetchFriendsReports(userId) {
  const { data: friendships } = await supabase
    .from("friendships").select("friend_id").eq("user_id", userId);
  if (!friendships?.length) return { data: [], error: null };
  const friendIds = friendships.map(f => f.friend_id);
  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select("id, user_id, report_date, gross_sales, ride_count, work_hours, occupied_distance, total_distance")
    .in("user_id", friendIds).eq("is_shared", true)
    .order("report_date", { ascending: false }).limit(50);
  if (!reports?.length) return { data: [], error };
  // ユーザー名を取得
  const { data: profiles } = await supabase
    .from("users").select("id, name, avatar_preset").in("id", friendIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    data: reports.map(r => ({ ...r, userName: profileMap[r.user_id]?.name || "?", avatarPreset: profileMap[r.user_id]?.avatar_preset })),
    error: null,
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
    is_shared:  s.isShared ?? false,
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
// AI分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** AI分析一覧を取得（新しい順） */
export async function fetchAiAnalyses(userId) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

/** AI分析を保存 */
export async function saveAiAnalysis(userId, reportCount, content) {
  const { error } = await supabase
    .from("ai_analyses")
    .insert({ user_id: userId, report_count: reportCount, content });
  return { error };
}

/** 未読のAI分析を既読に */
export async function markAnalysesRead(userId) {
  const { error } = await supabase
    .from("ai_analyses")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return { error };
}

/** 未読のAI分析件数を取得 */
export async function fetchUnreadAnalysisCount(userId) {
  const { count, error } = await supabase
    .from("ai_analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return { count: count ?? 0, error };
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
