// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// check-event-notifications — 終演1時間前プッシュ通知を送る
// cronから15分ごとに呼ばれる
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── VAPID署名 ───────────────────────────────────────────
function base64urlToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - b64.length % 4) % 4);
  const b64std  = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(b64std);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
) {
  const payloadStr = JSON.stringify(payload);
  const urlObj    = new URL(subscription.endpoint);
  const audience  = `${urlObj.protocol}//${urlObj.host}`;
  const now       = Math.floor(Date.now() / 1000);

  const header = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const claims = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 3600, sub: VAPID_SUBJECT }))
  );
  const sigInput = `${header}.${claims}`;

  const rawKey = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  );
  const jwt = `${sigInput}.${uint8ArrayToBase64url(new Uint8Array(sig))}`;

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type":     "application/octet-stream",
      "TTL":              "3600",
      "Authorization":    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
    },
    body: new TextEncoder().encode(payloadStr),
  });

  return res.status;
}

// ─── メインハンドラ ──────────────────────────────────────
Deno.serve(async (req) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not set" }),
      { status: 400, headers: CORS }
    );
  }

  try {
    const now         = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000);

    const { data: pending, error } = await supabase
      .from("event_notifications")
      .select("id, endpoint, p256dh, auth, notify_at, events(title, venue, start_time, event_type)")
      .lte("notify_at", now.toISOString())
      .gte("notify_at", windowStart.toISOString())
      .eq("sent", false);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "対象なし" }), { headers: CORS });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const n of pending) {
      const ev = (n as Record<string, unknown>).events as {
        title: string; venue: string; start_time: string | null; event_type: string;
      } | null;

      const title = ev?.title?.replace(/^[⚾🎵] /, "") ?? "イベント";
      const venue = ev?.venue ?? "";
      const timeStr = ev?.start_time ? ` ${ev.start_time}開演` : "";

      try {
        const status = await sendWebPush(
          { endpoint: n.endpoint, p256dh: n.p256dh, auth: n.auth },
          {
            title: "🚕 まもなく終演！お客さんを狙え",
            body:  `${title}（${venue}${timeStr}）\n終演まで約1時間 — 会場周辺への移動はお早めに`,
            url:   "/?tab=events",
          },
        );

        if (status < 300) {
          sentCount++;
          await supabase
            .from("event_notifications")
            .update({ sent: true })
            .eq("id", n.id);
        } else if (status === 410 || status === 404) {
          // 無効な購読は削除
          await supabase.from("event_notifications").delete().eq("id", n.id);
        }
      } catch (e) {
        errors.push(String(e));
      }
    }

    console.log(`[check-event-notifications] sent=${sentCount}, total=${pending.length}, errors=${errors.length}`);
    return new Response(
      JSON.stringify({ sent: sentCount, total: pending.length, errors }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[check-event-notifications] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
