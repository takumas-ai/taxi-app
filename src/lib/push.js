// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// push.js — Web Push 通知ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

/** base64url → Uint8Array（VAPID公開鍵の変換用） */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/** Service Worker を登録する（アプリ起動時に1度呼ぶ） */
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (e) {
    console.warn("[push] SW registration failed:", e);
    return null;
  }
}

/**
 * 通知許可を求め、Push購読を取得して返す
 * @returns {{ subscription: PushSubscription|null, error: string|null }}
 */
export async function requestPushPermission() {
  if (!("Notification" in window)) return { subscription: null, error: "このブラウザはプッシュ通知に対応していません" };
  if (!VAPID_PUBLIC_KEY)           return { subscription: null, error: "VAPID公開鍵が設定されていません" };

  // 許可を求める
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { subscription: null, error: "通知が拒否されました" };

  // Service Worker 取得
  const reg = await navigator.serviceWorker.ready;

  // 既存購読を確認
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // 新規購読
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  return { subscription: sub, error: null };
}

/** 現在の許可状態 */
export function getNotificationStatus() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

/** 現在の購読を解除する */
export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
