// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// send-event-push — 朝5時にWeb Push通知を送る
// cronから呼ばれる: fetch-events の後（5:05など）に実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── VAPID設定（Supabase Secrets に設定すること） ──────────
// supabase secrets set VAPID_PRIVATE_KEY="..."
// supabase secrets set VAPID_PUBLIC_KEY="..."
// supabase secrets set VAPID_SUBJECT="mailto:your@email.com"
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── 今日の日付（JST） ──────────────────────────────────
function getTodayJST(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

// ─── VAPID署名付きでWeb Pushを送る ──────────────────────
// Deno標準のCrypto APIを使ってVAPID JWTを生成
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
) {
  // 簡易実装: Supabase Edge FunctionからWebPush送信
  // 本格実装はweb-pushライブラリ相当のVAPID JWT生成が必要
  // ここではweb-push互換のHTTPリクエストを組み立てる

  const payloadStr = JSON.stringify(payload);

  // VAPID JWT header + claims
  const urlObj = new URL(subscription.endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header  = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const claims  = btoa(JSON.stringify({ aud: audience, exp: now + 3600, sub: VAPID_SUBJECT })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const sigInput = `${header}.${claims}`;

  // ECDSA P-256 秘密鍵をインポート
  const rawKey  = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  );
  const sigB64 = uint8ArrayToBase64url(new Uint8Array(sig));
  const jwt = `${sigInput}.${sigB64}`;

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type":  "application/octet-stream",
      "TTL":           "86400",
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
    },
    body: new TextEncoder().encode(payloadStr),
  });

  return res.status;
}

function base64urlToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - b64.length % 4) % 4);
  const b64std  = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(b64std);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...arr));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
      JSON.stringify({ error: "VAPID keys not set." }),
      { status: 400, headers: CORS }
    );
  }

  try {
    const today = getTodayJST();

    const { data: events } = await supabase
      .from("events")
      .select("title, venue, start_time, priority")
      .eq("event_date", today)
      .order("priority", { ascending: false })
      .limit(5);

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "今日のイベントなし" }), { headers: CORS });
    }

    const eventList = events.slice(0, 3).map(e =>
      `${e.title.replace(/^[⚾🎵] /, "")}（${e.venue}${e.start_time ? " " + e.start_time : ""}）`
    ).join("\n");

    const pushPayload = {
      title: `📣 今日の東京イベント（${events.length}件）`,
      body:  eventList,
      url:   "/?tab=events",
    };

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "購読者なし" }), { headers: CORS });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const status = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          pushPayload,
        );
        if (status < 300) sentCount++;
        else if (status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      } catch (e) {
        errors.push(String(e));
      }
    }

    console.log(`[send-event-push] sent=${sentCount}, errors=${errors.length}`);
    return new Response(
      JSON.stringify({ sent: sentCount, total: subscriptions.length, errors }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-event-push] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
