// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EventsScreen — 東京イベント画面
// ハンバーガーメニューからアクセス
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, loadS, saveS } from "../lib/constants";
import { Card } from "../components/UI";
import { fetchTodayEvents } from "../lib/supabase";
import { getNotificationStatus, requestPushPermission, unsubscribePush, registerServiceWorker } from "../lib/push";

const PRIORITY_COLOR  = { 3: "#EF4444", 2: "#F59E0B", 1: "#64748B" };
const PRIORITY_LABEL  = { 3: "高", 2: "中", 1: "低" };

// 今日〜3日分の日付を生成
function getDateRange(days = 3) {
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const DOWS = ["日","月","火","水","木","金","土"];
    const label = i === 0 ? "今日" : i === 1 ? "明日" : `${d.getMonth()+1}/${d.getDate()}(${DOWS[d.getDay()]})`;
    result.push({ ymd, label });
  }
  return result;
}

// DB に push 購読を保存
async function savePushSubscription(userId, subscription) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const sub = subscription.toJSON();
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        user_id:  userId,
        endpoint: sub.endpoint,
        p256dh:   sub.keys?.p256dh,
        auth:     sub.keys?.auth,
      }),
    });
  } catch (e) {
    console.warn("[push] save subscription error:", e);
  }
}

export default function EventsScreen({ user, onBack }) {
  const dates        = getDateRange(3);
  const [activeDate, setActiveDate] = useState(dates[0].ymd);
  const [events,     setEvents]     = useState({});       // { ymd: EventRow[] }
  const [loading,    setLoading]    = useState({});
  const [checked,    setChecked]    = useState(() => loadS("taxi_event_checks", {}));
  const [pushStatus, setPushStatus] = useState(() => getNotificationStatus());
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg,    setPushMsg]    = useState("");

  // 日付切替時にデータ取得
  useEffect(() => {
    if (events[activeDate] !== undefined) return; // キャッシュ済み
    loadEvents(activeDate);
  }, [activeDate]);

  async function loadEvents(ymd) {
    setLoading(prev => ({ ...prev, [ymd]: true }));
    const { data } = await fetchTodayEvents(ymd);
    // DBに無ければEdge Functionを呼んで取得
    if (!data || data.length === 0) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          await fetch(`${supabaseUrl}/functions/v1/fetch-events?date=${ymd}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${supabaseKey}` },
          });
          const { data: fresh } = await fetchTodayEvents(ymd);
          setEvents(prev => ({ ...prev, [ymd]: fresh ?? [] }));
          setLoading(prev => ({ ...prev, [ymd]: false }));
          return;
        }
      } catch {}
    }
    setEvents(prev => ({ ...prev, [ymd]: data ?? [] }));
    setLoading(prev => ({ ...prev, [ymd]: false }));
  }

  async function refreshEvents() {
    setLoading(prev => ({ ...prev, [activeDate]: true }));
    // Edge Function を呼んで最新データ取得
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/functions/v1/fetch-events`, {
          method: "GET",
          headers: { Authorization: `Bearer ${supabaseKey}` },
        });
      }
    } catch {}
    const { data } = await fetchTodayEvents(activeDate);
    setEvents(prev => ({ ...prev, [activeDate]: data ?? [] }));
    setLoading(prev => ({ ...prev, [activeDate]: false }));
  }

  // 終演1時間前の通知時刻を計算（JST）
  function calcNotifyAt(event) {
    const date = event.event_date; // YYYY-MM-DD
    if (event.start_time) {
      const [h, m] = event.start_time.split(":").map(Number);
      const startMs = new Date(`${date}T${String(h).padStart(2,"0")}:${String(m||0).padStart(2,"0")}:00+09:00`).getTime();
      // 野球: 3.5h、その他: 2.5h → 終演の1h前 = 開演 + (duration - 1)h
      const durationH = event.event_type === "baseball" ? 3.5 : 2.5;
      return new Date(startMs + (durationH - 1) * 3600 * 1000).toISOString();
    }
    // 時間未定 → 21:00 JST（終演20:00想定）
    return new Date(`${date}T20:00:00+09:00`).toISOString();
  }

  // 「行く」チェックをトグル + 終演1時間前通知をスケジュール
  async function toggleCheck(eventId, event) {
    const isNowChecked = !checked[eventId];
    const next = { ...checked, [eventId]: isNowChecked };
    if (!isNowChecked) delete next[eventId];
    setChecked(next);
    saveS("taxi_event_checks", next);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    if (isNowChecked) {
      // SW購読情報を取得してSupabaseに通知スケジュールを保存
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const s = sub.toJSON();
        const notifyAt = calcNotifyAt(event);

        await fetch(`${supabaseUrl}/rest/v1/event_notifications`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            event_id:  eventId,
            endpoint:  s.endpoint,
            p256dh:    s.keys?.p256dh,
            auth:      s.keys?.auth,
            notify_at: notifyAt,
          }),
        });
      } catch (e) {
        console.warn("[toggleCheck] schedule error:", e);
      }
    } else {
      // チェック解除 → 未送信の通知スケジュールを削除
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const ep = encodeURIComponent(sub.endpoint);
        await fetch(
          `${supabaseUrl}/rest/v1/event_notifications?event_id=eq.${eventId}&endpoint=eq.${ep}&sent=eq.false`,
          {
            method: "DELETE",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );
      } catch {}
    }
  }

  // プッシュ通知をON/OFF
  async function handlePushToggle() {
    setPushLoading(true);
    setPushMsg("");

    if (pushStatus === "granted") {
      // OFF にする
      await unsubscribePush();
      setPushStatus("default");
      setPushMsg("通知をオフにしました");
    } else {
      // SW登録
      await registerServiceWorker();
      const { subscription, error } = await requestPushPermission();
      if (error) {
        setPushMsg(error);
        setPushStatus(getNotificationStatus());
      } else {
        setPushStatus("granted");
        setPushMsg("朝5時にイベントをお知らせします");
        // DB保存
        if (user?.id && subscription) {
          await savePushSubscription(user.id, subscription);
        }
      }
    }
    setPushLoading(false);
  }

  const todayEvents   = events[activeDate] ?? [];
  const isLoading     = loading[activeDate];
  const checkedToday  = todayEvents.filter(e => checked[e.id]);
  const uncheckedToday = todayEvents.filter(e => !checked[e.id]);

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>

      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        <button onClick={onBack}
          style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:"4px 8px 4px 0", lineHeight:1 }}>
          ←
        </button>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text }}>📣 東京イベント</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>行くイベントをチェックして効率よく客拾い</div>
        </div>
      </div>

      {/* 通知設定バナー */}
      <Card style={{ marginBottom:14, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.text }}>🔔 朝の通知</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
              {pushStatus === "granted"
                ? "毎朝5:00に今日のイベントをお知らせ中"
                : pushStatus === "denied"
                ? "ブラウザで通知がブロックされています"
                : "毎朝5:00に今日のイベントをプッシュ通知"}
            </div>
            {pushMsg && <div style={{ fontSize:11, color:C.green, marginTop:3 }}>{pushMsg}</div>}
          </div>
          <button
            onClick={handlePushToggle}
            disabled={pushLoading || pushStatus === "denied"}
            style={{
              padding:"8px 14px",
              borderRadius:10,
              border:"none",
              cursor: pushStatus === "denied" ? "not-allowed" : "pointer",
              fontSize:12,
              fontWeight:700,
              backgroundColor: pushStatus === "granted" ? C.border : C.accentLight,
              color: pushStatus === "granted" ? C.muted : "#fff",
              opacity: pushLoading ? 0.6 : 1,
              flexShrink:0,
            }}
          >
            {pushLoading ? "..." : pushStatus === "granted" ? "通知OFF" : "通知ON"}
          </button>
        </div>
        {pushStatus === "denied" && (
          <div style={{ marginTop:8, fontSize:11, color:C.orange }}>
            ブラウザの設定から通知を許可してください
          </div>
        )}
      </Card>

      {/* 日付タブ */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {dates.map(d => (
          <button
            key={d.ymd}
            onClick={() => setActiveDate(d.ymd)}
            style={{
              flex:1,
              padding:"8px 6px",
              borderRadius:10,
              border:`1.5px solid ${activeDate === d.ymd ? C.accentLight : C.border}`,
              backgroundColor: activeDate === d.ymd ? C.accentGlow : C.card,
              color: activeDate === d.ymd ? C.accentLight : C.muted,
              fontSize:12,
              fontWeight: activeDate === d.ymd ? 800 : 500,
              cursor:"pointer",
              position:"relative",
            }}
          >
            {d.label}
            {/* チェック済みバッジ */}
            {(events[d.ymd] ?? []).some(e => checked[e.id]) && (
              <span style={{
                position:"absolute", top:3, right:3,
                width:7, height:7, borderRadius:"50%",
                backgroundColor:C.green,
              }}/>
            )}
          </button>
        ))}
      </div>

      {/* イベントリスト */}
      {isLoading ? (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>
          取得中...
        </div>
      ) : todayEvents.length === 0 ? (
        <Card style={{ textAlign:"center", padding:"32px 16px" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:14, color:C.muted }}>
            {activeDate === dates[0].ymd ? "今日" : "この日"}の大型イベントはありません
          </div>
          <button
            onClick={refreshEvents}
            style={{ marginTop:12, fontSize:12, color:C.accentLight, background:"none", border:`1px solid ${C.accentLight}44`, borderRadius:8, padding:"7px 16px", cursor:"pointer" }}
          >
            最新情報を取得
          </button>
        </Card>
      ) : (
        <>
          {/* チェック済み（行く予定）*/}
          {checkedToday.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.green, marginBottom:8, letterSpacing:"0.05em" }}>
                ✅ 行く予定
              </div>
              {checkedToday.map(ev => (
                <EventCard key={ev.id} event={ev} checked={true} onToggle={() => toggleCheck(ev.id, ev)} />
              ))}
            </div>
          )}

          {/* 未チェック */}
          {uncheckedToday.length > 0 && (
            <div>
              {checkedToday.length > 0 && (
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, letterSpacing:"0.05em" }}>
                  その他のイベント
                </div>
              )}
              {uncheckedToday.map(ev => (
                <EventCard key={ev.id} event={ev} checked={false} onToggle={() => toggleCheck(ev.id, ev)} />
              ))}
            </div>
          )}

          <div style={{ textAlign:"right", marginTop:8 }}>
            <button
              onClick={refreshEvents}
              style={{ fontSize:11, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}
            >
              更新
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ━━━ イベントカード ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function EventCard({ event, checked, onToggle }) {
  const priorityColor = PRIORITY_COLOR[event.priority] ?? C.muted;

  return (
    <div style={{
      marginBottom:10,
      borderRadius:12,
      backgroundColor: checked ? C.green + "10" : C.card,
      border: `1.5px solid ${checked ? C.green + "55" : priorityColor + "33"}`,
      overflow:"hidden",
      position:"relative",
    }}>
      {/* 左ボーダー */}
      <div style={{
        position:"absolute", left:0, top:0, bottom:0, width:4,
        backgroundColor: checked ? C.green : priorityColor,
      }}/>

      <div style={{ padding:"12px 14px 12px 18px", display:"flex", alignItems:"flex-start", gap:12 }}>

        {/* テキスト情報 */}
        <div style={{ flex:1 }}>
          {/* タイトル + 優先度 */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, flex:1, lineHeight:1.3 }}>
              {event.title}
            </div>
            <span style={{
              fontSize:10, fontWeight:800,
              color: checked ? C.green : priorityColor,
              backgroundColor: (checked ? C.green : priorityColor) + "22",
              borderRadius:6, padding:"2px 7px", flexShrink:0,
            }}>
              {checked ? "行く" : `優先${PRIORITY_LABEL[event.priority] ?? "-"}`}
            </span>
          </div>

          {/* 詳細情報 */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 12px" }}>
            <span style={{ fontSize:11, color:C.muted }}>🏟 {event.venue}</span>
            <span style={{ fontSize:11, color:C.muted }}>
              🕐 {event.start_time ? `${event.start_time}〜` : "時間未定"}
            </span>
            <span style={{ fontSize:11, color:C.muted }}>
              👥 {event.estimated_capacity >= 10000
                ? `${Math.round(event.estimated_capacity / 10000)}万人規模`
                : `${event.estimated_capacity.toLocaleString()}人規模`}
            </span>
          </div>

          {event.access_info && (
            <div style={{ fontSize:11, color:C.accentLight, marginTop:4 }}>
              🚕 {event.access_info}
            </div>
          )}
        </div>

        {/* 「行く」ボタン */}
        <button
          onClick={onToggle}
          style={{
            padding:"8px 14px",
            borderRadius:10,
            border: checked ? `1.5px solid ${C.green}` : `1.5px solid ${C.border}`,
            backgroundColor: checked ? C.green + "22" : "transparent",
            color: checked ? C.green : C.muted,
            fontSize:12,
            fontWeight:800,
            cursor:"pointer",
            flexShrink:0,
            transition:"all 0.15s",
          }}
        >
          {checked ? "✓ 行く" : "行く"}
        </button>
      </div>
    </div>
  );
}

// ─── 今日チェックしたイベント数を返す（他コンポーネントから参照用） ───
export function getTodayCheckedCount() {
  const checks = loadS("taxi_event_checks", {});
  return Object.keys(checks).filter(k => checks[k]).length;
}
