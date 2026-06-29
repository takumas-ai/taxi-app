// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EventNotificationCard — 今日の東京イベント通知
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C } from "../../lib/constants";
import { Card } from "../UI";
import { fetchTodayEvents } from "../../lib/supabase";

const PRIORITY_COLOR = {
  3: "#EF4444",  // 高（赤）
  2: "#F59E0B",  // 中（黄）
  1: "#64748B",  // 低（グレー）
};

const PRIORITY_LABEL = {
  3: "高",
  2: "中",
  1: "低",
};

const EVENT_TYPE_ICON = {
  baseball: "⚾",
  concert:  "🎵",
  sports:   "🏆",
  other:    "📅",
};

export default function EventNotificationCard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const todayYMD = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    setFetchError(false);
    try {
      const { data, error } = await fetchTodayEvents(todayYMD);
      if (error) {
        setFetchError(true);
      } else {
        setEvents(data ?? []);
      }
      setLastFetched(new Date());
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }

  async function refreshEvents() {
    // Edge Functionを手動呼び出して最新データを取得
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/functions/v1/fetch-events`, {
          method: "GET",
          headers: { Authorization: `Bearer ${supabaseKey}` },
        });
        await loadEvents();
      }
    } catch {
      setFetchError(true);
      setLoading(false);
    }
  }

  const hasHighPriority = events.some(e => e.priority === 3);
  const accentColor = hasHighPriority ? C.red : C.gold;

  return (
    <Card style={{ marginBottom:14, padding:"12px 14px" }}>
      {/* ヘッダー */}
      <div
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>📣</span>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>今日の東京イベント</span>
          {!loading && events.length > 0 && (
            <span style={{
              fontSize:10, fontWeight:800, color:"#fff",
              backgroundColor: accentColor,
              borderRadius:9, padding:"2px 7px", lineHeight:1.5,
            }}>
              {events.length}件
            </span>
          )}
          {hasHighPriority && (
            <span style={{ fontSize:10, color:C.red, fontWeight:800, animation:"pulse 2s infinite" }}>
              ● 要注目
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {!loading && (
            <button
              onClick={e => { e.stopPropagation(); refreshEvents(); }}
              style={{ fontSize:11, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"2px 8px", cursor:"pointer" }}
            >
              更新
            </button>
          )}
          <span style={{ fontSize:12, color:C.muted }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* コンテンツ */}
      {open && (
        <div style={{ marginTop:10 }}>
          {loading ? (
            <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:"12px 0" }}>
              <div style={{ marginBottom:4 }}>⏳ 取得中...</div>
            </div>
          ) : fetchError ? (
            <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:"12px 0" }}>
              <div>取得に失敗しました</div>
              <button
                onClick={refreshEvents}
                style={{ marginTop:6, fontSize:11, color:C.accentLight, background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}
              >
                再試行
              </button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:"12px 0" }}>
              <div>今日の大型イベントはありません</div>
              <div style={{ fontSize:10, marginTop:4 }}>
                毎朝5:00に自動更新 ·{" "}
                <span
                  onClick={refreshEvents}
                  style={{ color:C.accentLight, cursor:"pointer", textDecoration:"underline" }}
                >
                  今すぐ更新
                </span>
              </div>
            </div>
          ) : (
            <div>
              {events.map((ev, idx) => (
                <EventItem key={idx} event={ev} />
              ))}
              <div style={{ fontSize:10, color:C.muted, marginTop:8, textAlign:"right" }}>
                毎朝5:00自動更新 ·{" "}
                {lastFetched && `最終: ${lastFetched.getHours()}:${String(lastFetched.getMinutes()).padStart(2,"0")}`}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EventItem({ event }) {
  const priorityColor = PRIORITY_COLOR[event.priority] ?? C.muted;

  return (
    <div style={{
      padding:"10px 12px",
      marginBottom:8,
      borderRadius:10,
      backgroundColor:C.surface,
      border:`1.5px solid ${priorityColor}33`,
      position:"relative",
      overflow:"hidden",
    }}>
      {/* 左ボーダーアクセント */}
      <div style={{
        position:"absolute", left:0, top:0, bottom:0, width:4,
        backgroundColor:priorityColor,
        borderRadius:"3px 0 0 3px",
      }} />

      <div style={{ paddingLeft:8 }}>
        {/* タイトル + 優先度バッジ */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, flex:1, lineHeight:1.3 }}>
            {event.title}
          </div>
          <span style={{
            fontSize:10, fontWeight:800,
            color: priorityColor,
            backgroundColor: priorityColor + "22",
            borderRadius:6, padding:"2px 7px",
            marginLeft:6, flexShrink:0,
          }}>
            優先度{PRIORITY_LABEL[event.priority] ?? "-"}
          </span>
        </div>

        {/* 会場・時間 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:C.muted }}>
            🏟 {event.venue}
          </span>
          {event.start_time && (
            <span style={{ fontSize:11, color:C.muted }}>
              🕐 {event.start_time}
            </span>
          )}
          <span style={{ fontSize:11, color:C.muted }}>
            👥 {event.estimated_capacity >= 10000
              ? `${Math.round(event.estimated_capacity/10000)}万人規模`
              : `${event.estimated_capacity.toLocaleString()}人規模`}
          </span>
        </div>

        {/* アクセス情報 */}
        {event.access_info && (
          <div style={{ fontSize:11, color:C.accentLight, marginTop:4 }}>
            🚕 {event.access_info}
          </div>
        )}
      </div>
    </div>
  );
}
