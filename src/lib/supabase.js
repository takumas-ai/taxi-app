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

/** メールアドレス変更 */
export async function updateEmail(newEmail) {
  const { data, error } = await supabase.auth.updateUser({ email: newEmail });
  return { data, error };
}

/** パスワード変更 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
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
  const { data, error } = await supabase
    .from("users")
    .update(fields)
    .eq("id", id)
    .select("id, name");
  if (error) {
    console.error("[upsertProfile] error:", error.message, error.code, JSON.stringify(profile));
  } else if (!data || data.length === 0) {
    console.warn("[upsertProfile] 0件更新 — IDが一致するrowなし:", id);
  } else {
    console.log("[upsertProfile] 更新成功:", data[0]);
  }
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
    .is("deleted_at", null)
    .order("report_date", { ascending: false });
  return { data: data ?? [], error };
}

/** 日報を保存（同日付は上書きupsert） */
export async function insertReport(report) {
  const { data, error } = await supabase
    .from("daily_reports")
    .upsert(report, { onConflict: "user_id,report_date", ignoreDuplicates: false })
    .select()
    .single();
  return { data, error };
}

/** 日報を更新 */
export async function updateReport(id, updates, userId) {
  const query = supabase
    .from("daily_reports")
    .update(updates)
    .eq("id", id);
  if (userId) query.eq("user_id", userId);
  const { data, error } = await query.select().single();
  return { data, error };
}

/** 日報をソフトデリート（ゴミ箱へ・30日後に自動削除） */
export async function deleteReport(id, userId) {
  let query = supabase
    .from("daily_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  return { error };
}

/** ゴミ箱の日報一覧（deleted_atがある・30日以内） */
export async function fetchDeletedReports(userId) {
  const limit = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, gross_sales, net_sales, ride_count, deleted_at")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", limit)
    .order("deleted_at", { ascending: false });
  return { data: data ?? [], error };
}

/** 日報を復元（deleted_atをnullに戻す） */
export async function restoreReport(id, userId) {
  let query = supabase
    .from("daily_reports")
    .update({ deleted_at: null })
    .eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  return { error };
}

/** 日報を完全削除（ゴミ箱からの永久削除） */
export async function permanentDeleteReport(id, userId) {
  let query = supabase
    .from("daily_reports")
    .delete()
    .eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
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
 * 招待コードを使った登録を記録する（登録時）
 * ・招待された側：+30日クーポンをすぐ発行
 * ・招待した側の特典はOCR3枚達成後に activateReferral() で付与
 */
export async function registerWithReferral({ referredId, referredName, referralCode }) {
  // 1. 招待コードからreferrerを特定
  const { data: referrer } = await supabase
    .from("users").select("id, name").eq("referral_code", referralCode).single();
  if (!referrer) return { error: "無効な招待コードです", valid: false };

  // 2. referred_byを保存
  await supabase.from("users").update({ referred_by: referralCode }).eq("id", referredId);

  // 3. referral_eventsに記録（activated_at = null = 未アクティベート）
  const { error: evErr } = await supabase.from("referral_events").insert({
    referrer_id:   referrer.id,
    referred_id:   referredId,
    referral_code: referralCode,
    referrer_name: referrer.name,
    referred_name: referredName,
    // activated_at は null のまま（OCR3枚達成で activateReferral() がセット）
  });
  if (evErr) {
    if (evErr.code === "23505") return { error: "このコードはすでに使用済みです", valid: false };
    return { error: evErr.message, valid: false };
  }

  // 4. 招待された人にすぐ +30日クーポンを発行（来てくれたお礼）
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const invCode = "INV-" + Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  await supabase.from("coupons").insert({
    user_id:       referredId,
    code:          invCode,
    type:          "invited",
    benefit_days:  30,
    issued_reason: "招待コード登録ボーナス（+30日）",
  });

  return { error: null, valid: true };
}

/**
 * 招待されたユーザーがOCR3枚達成したタイミングで呼ぶ
 * ・招待した側に +100 XP ＋ マイルストーンクーポンを付与
 * ・べき等（activated_at があれば何もしない）
 */
export async function activateReferral(referredId) {
  // 1. 未アクティベートの招待イベントを検索
  const { data: ev } = await supabase
    .from("referral_events")
    .select("id, referrer_id")
    .eq("referred_id", referredId)
    .is("activated_at", null)
    .maybeSingle();
  if (!ev) return; // 招待経由でない or 既にアクティベート済み

  // 2. OCR枚数を確認（3枚以上ならアクティベート）
  const { count } = await supabase
    .from("daily_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredId);
  if ((count ?? 0) < 3) return;

  // 3. activated_at をセット
  await supabase.from("referral_events")
    .update({ activated_at: new Date().toISOString() })
    .eq("id", ev.id);

  // 4. 招待した人に +100 XP
  const { data: cur } = await supabase.from("users").select("xp").eq("id", ev.referrer_id).single();
  await supabase.from("users").update({ xp: (cur?.xp ?? 0) + 100 }).eq("id", ev.referrer_id);

  // 5. マイルストーンチェック・クーポン発行（RPC）
  await supabase.rpc("check_referral_milestone", { referrer_id_input: ev.referrer_id });
}

/** 自分の招待実績（アクティベート済みのみカウント + 発行済みクーポン）を取得 */
export async function fetchMyReferralStats(userId, referralCode) {
  const [eventsRes, couponsRes] = await Promise.all([
    // activated_at IS NOT NULL = OCR3枚達成済みの招待のみ
    supabase.from("referral_events").select("referred_name, created_at, activated_at")
      .eq("referrer_id", userId)
      .not("activated_at", "is", null)
      .order("activated_at", { ascending: false }),
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
    // SELECT→UPDATEの競合を避けるため実票数から再集計
    const { count } = await supabase.from("guide_votes").select("*", { count: "exact", head: true }).eq("spot_id", spotId);
    await supabase.from("guide_spots").update({ vote_count: count ?? 0 }).eq("id", spotId);
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
    const { count } = await supabase.from("guide_flags").select("*", { count: "exact", head: true }).eq("spot_id", spotId);
    await supabase.from("guide_spots").update({ flag_count: count ?? 0 }).eq("id", spotId);
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

/** ユーザーを停止／解除 */
export async function adminSetSuspended(userId, suspended) {
  const { error } = await supabase
    .from("users")
    .update({ suspended })
    .eq("id", userId);
  if (error) console.error("[adminSetSuspended]", error.message);
  return { error };
}

/** ユーザーを削除（Edge Function 経由で auth.users も削除） */
export async function adminDeleteUser(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: new Error("Not authenticated") };
  const edgeUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
  const res = await fetch(`${edgeUrl}/delete-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ target_user_id: userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: new Error(body.error || `HTTP ${res.status}`) };
  }
  return { error: null };
}

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

/** お知らせ一覧取得（管理画面用） */
export async function adminFetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return { data: data ?? [], error };
}

/** お知らせ一覧取得（全ユーザー向け・最新20件） */
export async function fetchPublicNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, severity, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return { data: data ?? [], error };
}

/** 特定ユーザーの日報一覧（管理者用） */
export async function adminFetchUserReports(userId) {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("id, report_date, gross_sales, net_sales, ride_count, work_hours, image_url, rides, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
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

/** フレンド申請を送る（QRスキャン後・ID検索後に呼び出す） */
export async function addFriend(currentUserId, targetUserId) {
  // 自分自身には送れない
  if (currentUserId === targetUserId) return { error: new Error("自分自身は追加できません") };
  // すでにフレンドか確認
  const { data: existing } = await supabase
    .from("friendships").select("id").eq("user_id", currentUserId).eq("friend_id", targetUserId).maybeSingle();
  if (existing) return { error: null, alreadyFriend: true };
  // すでに申請済みか確認
  const { data: existingReq } = await supabase
    .from("friend_requests")
    .select("id, status")
    .or(`and(from_user_id.eq.${currentUserId},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${currentUserId})`)
    .maybeSingle();
  if (existingReq) return { error: null, requested: true, status: existingReq.status };
  // 申請を作成
  const { error: reqErr } = await supabase
    .from("friend_requests").insert({ from_user_id: currentUserId, to_user_id: targetUserId });
  if (reqErr) return { error: reqErr };
  // 相手への通知
  const { data: me } = await supabase.from("users").select("name").eq("id", currentUserId).maybeSingle();
  await supabase.from("friend_notifications").insert({
    user_id: targetUserId,
    from_user_id: currentUserId,
    from_name: me?.name || "タクドラ",
    type: "friend_request",
  });
  return { error: null, requested: true };
}

/** フレンド申請を承認・拒否する */
export async function respondFriendRequest(requestId, status, fromUserId, toUserId, toName) {
  const { error } = await supabase
    .from("friend_requests").update({ status }).eq("id", requestId);
  if (error) return { error };
  if (status === "accepted") {
    await supabase.from("friendships").insert([
      { user_id: fromUserId, friend_id: toUserId },
      { user_id: toUserId, friend_id: fromUserId },
    ]);
    await supabase.from("friend_notifications").insert({
      user_id: fromUserId,
      from_user_id: toUserId,
      from_name: toName || "タクドラ",
      type: "friend_accepted",
    });
  }
  return { error: null };
}

/** 受信したフレンド申請一覧 */
export async function fetchIncomingFriendRequests(userId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, created_at")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (!data?.length) return { data: [], error };
  const fromIds = data.map(r => r.from_user_id);
  const { data: profiles } = await supabase
    .from("users").select("id, name, display_id, avatar_preset").in("id", fromIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    data: data.map(r => ({ ...r, fromName: profileMap[r.from_user_id]?.name || "?", fromDisplayId: profileMap[r.from_user_id]?.display_id })),
    error: null,
  };
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

/** フレンドの共有シフト一覧（シフト共有が承認済みのフレンドのみ・今日以降） */
export async function fetchFriendsShifts(userId) {
  // 承認済みのシフト共有ペアを取得
  const { data: accepted } = await supabase
    .from("shift_share_requests")
    .select("from_user_id, to_user_id")
    .eq("status", "accepted")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
  if (!accepted?.length) return { data: [], error: null };
  const sharedFriendIds = accepted.map(r =>
    r.from_user_id === userId ? r.to_user_id : r.from_user_id
  );
  const today = new Date().toISOString().slice(0, 10);
  // 承認済みフレンドのシフトは is_shared フラグに関わらず全件表示
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, user_id, shift_date, clock_in, clock_out, note")
    .in("user_id", sharedFriendIds)
    .gte("shift_date", today)
    .order("shift_date", { ascending: true }).limit(50);
  if (!shifts?.length) return { data: [], error };
  const { data: profiles } = await supabase
    .from("users").select("id, name, avatar_preset").in("id", sharedFriendIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    data: shifts.map(s => ({ ...s, userName: profileMap[s.user_id]?.name || "?", avatarPreset: profileMap[s.user_id]?.avatar_preset })),
    error: null,
  };
}

/** display_idでユーザー検索（英数字、大文字小文字無視） */
export async function searchUserByDisplayId(displayId) {
  const { data, error } = await supabase
    .from("users").select("id, name, display_id, avatar_preset, areas")
    .ilike("display_id", displayId.trim())
    .maybeSingle();
  return { data, error };
}

/** 自分のdisplay_idを変更（英数字4〜12文字、重複チェック込み） */
export async function updateDisplayId(userId, newId) {
  const clean = newId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 4 || clean.length > 12) return { error: { message: "IDは4〜12文字の英数字で入力してください" } };
  // 重複チェック
  const { data: existing } = await supabase
    .from("users").select("id").eq("display_id", clean).neq("id", userId).maybeSingle();
  if (existing) return { error: { message: "このIDはすでに使われています" } };
  const { error } = await supabase.from("users").update({ display_id: clean }).eq("id", userId);
  return { error, clean };
}

/** シフト共有申請を送る */
export async function sendShiftShareRequest(fromUserId, toUserId, fromName) {
  // 既存の申請チェック
  const { data: existing } = await supabase
    .from("shift_share_requests")
    .select("id, status")
    .or(`and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`)
    .maybeSingle();
  if (existing) return { error: null, existing };

  const { error } = await supabase
    .from("shift_share_requests")
    .insert({ from_user_id: fromUserId, to_user_id: toUserId });
  if (error) return { error };

  // 相手に通知（typeカラムがなくてもエラーを無視）
  await supabase.from("friend_notifications").insert({
    user_id: toUserId,
    from_user_id: fromUserId,
    from_name: fromName,
    type: "shift_share_request",
  }).then(({ error: e }) => { if (e) console.warn("[shift_share notif]", e.message); });
  return { error: null };
}

/** シフト共有申請に応答（accepted / rejected） */
export async function respondShiftShareRequest(requestId, status, toUserId, fromUserId, toName) {
  const { error } = await supabase
    .from("shift_share_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("to_user_id", toUserId);
  if (error) return { error };

  // 承認の場合は送信者に通知
  if (status === "accepted") {
    await supabase.from("friend_notifications").insert({
      user_id: fromUserId,
      from_user_id: toUserId,
      from_name: toName,
      type: "shift_share_accepted",
    }).then(({ error: e }) => { if (e) console.warn("[shift_share_accepted notif]", e.message); });
  }
  return { error: null };
}

/** 自分宛のシフト共有申請一覧（pending） */
export async function fetchIncomingShiftShareRequests(userId) {
  const { data, error } = await supabase
    .from("shift_share_requests")
    .select("id, from_user_id, status, created_at")
    .eq("to_user_id", userId).eq("status", "pending")
    .order("created_at", { ascending: false });
  if (!data?.length) return { data: [], error };
  const fromIds = data.map(r => r.from_user_id);
  const { data: profiles } = await supabase
    .from("users").select("id, name, display_id, avatar_preset").in("id", fromIds);
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
  return {
    data: data.map(r => ({ ...r, fromName: profileMap[r.from_user_id]?.name || "?", fromDisplayId: profileMap[r.from_user_id]?.display_id })),
    error: null,
  };
}

/** フレンドとのシフト共有ステータスを取得 */
export async function fetchShiftShareStatuses(userId, friendIds) {
  if (!friendIds?.length) return {};
  const { data } = await supabase
    .from("shift_share_requests")
    .select("id, from_user_id, to_user_id, status")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .in("from_user_id", [...friendIds, userId])
    .in("to_user_id", [...friendIds, userId]);
  const map = {};
  (data ?? []).forEach(r => {
    const friendId = r.from_user_id === userId ? r.to_user_id : r.from_user_id;
    const isSender = r.from_user_id === userId;
    map[friendId] = { id: r.id, status: r.status, isSender };
  });
  return map;
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
