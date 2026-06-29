// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タクロー Service Worker
// Web Push 通知を受け取ってOSに表示する
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// fetchは一切干渉しない（プッシュ通知専用SW）

// プッシュ通知を受け取ったとき
self.addEventListener("push", event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "タクロー", body: event.data.text() };
  }

  const { title = "タクロー", body = "", url = "/" } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  "/icon-192.png",
      badge: "/icon-192.png",
      tag:   "takuro-event",   // 同じtagは上書き（重複防止）
      renotify: true,
      data: { url },
      actions: [
        { action: "open",    title: "イベントを見る" },
        { action: "dismiss", title: "閉じる" },
      ],
    })
  );
});

// 通知をクリックしたとき
self.addEventListener("notificationclick", event => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // すでに開いているウィンドウがあればそちらにフォーカス
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // なければ新規タブ
      return self.clients.openWindow(targetUrl);
    })
  );
});
