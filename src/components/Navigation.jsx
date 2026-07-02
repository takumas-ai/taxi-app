// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ナビゲーションコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, loadS, saveS } from "../lib/constants";
import { MOCK_DELAYS } from "../data/mockData";
import { ZONE_META } from "../data/trafficZones";
import { UserAvatar } from "./AvatarPicker";
import { fetchFriendNotifs, markFriendNotifsRead, fetchPublicNotifications } from "../lib/supabase";

// ━━━ 通知パネル（ベルタップで開くボトムシート）━━━
function NotificationPanel({ user, onClose, onNavigateSettings, onMarkRead, newsCount=0 }) {
  const [activeTab,   setActiveTab]   = useState("personal"); // "personal" | "news"
  const [friendNotifs, setFriendNotifs] = useState([]);
  const [news,        setNews]        = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    Promise.all([
      fetchFriendNotifs(user.id),
      fetchPublicNotifications(),
    ]).then(([{ data: fn }, { data: ns }]) => {
      setFriendNotifs(fn || []);
      setNews(ns || []);
      setLoading(false);
    });
    markFriendNotifsRead(user.id).then(() => onMarkRead?.());
  }, []);

  const typeLabel = (type) => {
    const map = {
      friend_request:       "フレンド申請が届きました",
      friend_accepted:      "フレンド申請が承認されました",
      friend_added:         "フレンドに追加しました",
      shift_share_request:  "シフト共有の申請が届きました",
      shift_share_accepted: "シフト共有が承認されました",
    };
    return map[type] ?? type;
  };

  const severityColor = (s) => s === "alert" ? C.red : s === "warning" ? C.orange : C.accentLight;

  const tabs = [
    { id:"personal", label:"自分宛",   badge: friendNotifs.filter(n => !n.read).length },
    { id:"news",     label:"ニュース", badge: newsCount },
  ];

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000088", zIndex:500, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto", padding:"20px 20px 40px", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 14px" }}/>
        <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:14 }}>🔔 お知らせ</div>

        {/* タブ切り替え */}
        <div style={{ display:"flex", gap:4, marginBottom:18, backgroundColor:C.bg, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:activeTab===t.id?700:400, backgroundColor:activeTab===t.id?C.accentLight:"transparent", color:activeTab===t.id?"#fff":C.muted, cursor:"pointer", transition:"all 0.15s", position:"relative" }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ position:"absolute", top:2, right:6, backgroundColor:C.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:99, minWidth:14, height:14, display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 3px" }}>{t.badge}</span>
              )}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", color:C.muted, padding:"32px 0", fontSize:13 }}>読み込み中...</div>
        ) : activeTab === "personal" ? (
          /* 自分宛 */
          friendNotifs.length === 0 ? (
            <div style={{ textAlign:"center", color:C.muted, padding:"32px 0" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:13 }}>通知はありません</div>
            </div>
          ) : (
            <div>
              {friendNotifs.map(n => (
                <div key={n.id} style={{ padding:"12px 0", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight: n.read ? 400 : 700 }}>
                      {n.from_name ?? "だれか"}さんから
                    </div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{typeLabel(n.type)}</div>
                  </div>
                  <div style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{n.created_at?.slice(0,10)}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ニュース */
          news.length === 0 ? (
            <div style={{ textAlign:"center", color:C.muted, padding:"32px 0" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:13 }}>ニュースはありません</div>
            </div>
          ) : (
            <div>
              {news.map(n => (
                <div key={n.id} style={{ padding:"13px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5, gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:severityColor(n.severity), backgroundColor:severityColor(n.severity)+"22", borderRadius:5, padding:"1px 6px" }}>
                        {n.severity === "alert" ? "🚨" : n.severity === "warning" ? "⚠️" : "📢"}
                      </span>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{n.title}</div>
                    </div>
                    <div style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{n.created_at?.slice(0,10)}</div>
                  </div>
                  <div style={{ fontSize:12, color:C.sub, lineHeight:1.7 }}>{n.body}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* 通知設定 */}
        <button onClick={() => { onNavigateSettings?.("notif"); onClose(); }}
          style={{ width:"100%", marginTop:20, padding:"12px 0", borderRadius:10, backgroundColor:C.bg, border:`1px solid ${C.border}`, color:C.sub, fontSize:13, cursor:"pointer" }}>
          ⚙️ 通知設定
        </button>
      </div>
    </div>
  );
}

// ボトムナビ（5タブ）
export function BottomNav({ tab, setTab, userAreas=[], alertsSeen=false }) {
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  const items = [
    { id:"dashboard",  icon:"📊", label:"ホーム"   },
    { id:"list",       icon:"📋", label:"日報"     },
    { id:"upload",     icon:"＋", label:"記録",  special:true },
    { id:"guide",      icon:"📍", label:"ガイド"   },
    { id:"map",        icon:"🗺️", label:"マップ" },
  ];

  const isActive = id => {
    if (id === "dashboard") return ["dashboard","info","shift"].includes(tab);
    if (id === "guide")     return ["guide","spots"].includes(tab);
    return tab === id;
  };

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, backgroundColor:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-around", alignItems:"center", padding:"8px 0 20px", zIndex:50 }}>
      {items.map(item => (
        <div key={item.id} onClick={() => setTab(item.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer", flex:1 }}>
          {item.special ? (
            <>
              <div data-tutorial="upload-tab" style={{ width:48, height:48, borderRadius:14, backgroundColor:C.accentLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#fff", boxShadow:`0 4px 20px ${C.accentLight}66`, marginTop:-20 }}>＋</div>
              <div style={{ fontSize:10, color:tab==="upload"?C.accentLight:C.muted, fontWeight:tab==="upload"?700:400 }}>記録</div>
            </>
          ) : (
            <>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:20, opacity:isActive(item.id)?1:0.45 }}>{item.icon}</div>
                {item.id === "dashboard" && alertCount > 0 && !alertsSeen && (
                  <div style={{ position:"absolute", top:-4, right:-6, backgroundColor:C.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:99, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px" }}>{alertCount}</div>
                )}
              </div>
              <div style={{ fontSize:10, color:isActive(item.id)?C.accentLight:C.muted, fontWeight:isActive(item.id)?700:400 }}>{item.label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// モード選択ボトムシート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const MODES = [
  { id:"simple",       icon:"🟢", label:"かんたん",      desc:"シンプル表示・標準文字サイズ" },
  { id:"simple_large", icon:"🔵", label:"かんたん（大）", desc:"シンプル表示・文字を大きく" },
  { id:"analysis",     icon:"🟣", label:"分析",          desc:"詳細データ・グラフ・AI分析" },
];

function ModeSheet({ appMode, onModeChange, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000088", zIndex:200 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, backgroundColor:C.surface, borderRadius:"20px 20px 0 0", padding:24, paddingBottom:44, maxWidth:480, margin:"0 auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 20px" }}/>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:16 }}>表示モードを選択</div>
        {MODES.map(m => (
          <div key={m.id} onClick={() => { onModeChange(m.id); onClose(); }}
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:14, marginBottom:8, cursor:"pointer", border:`2px solid ${appMode===m.id ? C.accentLight : C.border}`, backgroundColor:appMode===m.id ? C.accentGlow : C.card }}>
            <span style={{ fontSize:24 }}>{m.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:appMode===m.id ? C.accentLight : C.text }}>{m.label}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{m.desc}</div>
            </div>
            {appMode===m.id && <span style={{ marginLeft:"auto", color:C.accentLight, fontSize:18 }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 営業ポイント管理モーダル（GPS対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BusinessPointModal({ onClose }) {
  const [modalTab, setModalTab] = useState("register"); // "register" | "ranking"

  // 旧形式(string[])と新形式({name,lat,lng,memo,timestamp}[])を両対応
  const [points, setPoints] = useState(() => {
    const raw = loadS("taxi_biz_points", []);
    return raw.map(p => typeof p === "string" ? { name: p, lat: null, lng: null, memo: "", timestamp: null } : p);
  });
  const [input, setInput]     = useState("");
  const [memo, setMemo]       = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]     = useState("");
  const [pendingCoords, setPendingCoords] = useState(null); // { lat, lng }

  // ランキング集計（taxi_sales_records）
  const ranking = (() => {
    const records = loadS("taxi_sales_records", []);
    const map = {};
    records.forEach(r => {
      const name = (r.pickupLocation || r.spotName || "").trim();
      if (!name) return;
      if (!map[name]) map[name] = { count: 0, total: 0 };
      map[name].count++;
      map[name].total += parseInt(r.fare) || parseInt(r.amount) || 0;
    });
    return Object.entries(map)
      .map(([name, { count, total }]) => ({ name, count, total, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg);
  })();

  const save = (next) => { setPoints(next); saveS("taxi_biz_points", next); };

  const handleAdd = () => {
    const v = input.trim();
    if (!v) return;
    const entry = { name: v, lat: pendingCoords?.lat ?? null, lng: pendingCoords?.lng ?? null, memo: memo.trim(), timestamp: new Date().toISOString() };
    if (editIdx !== null) {
      save(points.map((p, i) => i === editIdx ? entry : p));
      setEditIdx(null);
    } else {
      save([...points, entry]);
    }
    setInput(""); setMemo(""); setPendingCoords(null);
  };

  const handleEdit = (i) => {
    const p = points[i];
    setInput(p.name); setMemo(p.memo || "");
    setPendingCoords(p.lat ? { lat: p.lat, lng: p.lng } : null);
    setEditIdx(i);
  };
  const handleDelete = (i) => save(points.filter((_, j) => j !== i));

  // GPS取得 → Nominatim逆ジオコーディング
  const handleGPS = () => {
    if (!navigator.geolocation) { setGpsError("このデバイスはGPSに対応していません"); return; }
    setGpsLoading(true); setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPendingCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
            { headers: { "User-Agent": "TakuroApp/1.0" } }
          );
          const data = await res.json();
          const addr = data.address;
          // 市区町村レベルの地名を組み合わせる
          const area = [addr.suburb || addr.neighbourhood, addr.city_district || addr.quarter, addr.city || addr.town || addr.village]
            .filter(Boolean).slice(0, 2).join("・") || data.display_name?.split(",")[0] || `${lat.toFixed(4)},${lng.toFixed(4)}`;
          setInput(area);
        } catch {
          setInput(`${lat.toFixed(4)},${lng.toFixed(4)}`);
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.code === 1 ? "位置情報の許可が必要です" : "位置情報を取得できませんでした");
        setGpsLoading(false);
      },
      { timeout: 10000, maximumAge: 30000 }
    );
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000088", zIndex:300 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, backgroundColor:C.surface, borderRadius:"20px 20px 0 0", padding:24, paddingBottom:44, maxWidth:480, margin:"0 auto", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:12 }}>📍 マイスポット</div>

        {/* タブ切り替え */}
        <div style={{ display:"flex", gap:4, marginBottom:16, backgroundColor:C.bg, borderRadius:10, padding:3, border:`1px solid ${C.border}` }}>
          {[["register","📝 登録"],["ranking","🏆 ランキング"]].map(([v,l]) => (
            <div key={v} onClick={()=>setModalTab(v)}
              style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:modalTab===v?700:400, backgroundColor:modalTab===v?C.accentLight:"transparent", color:modalTab===v?"#fff":C.muted, cursor:"pointer", transition:"all 0.15s" }}>
              {l}
            </div>
          ))}
        </div>

        {/* ランキングタブ */}
        {modalTab === "ranking" && (
          ranking.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px 16px", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>まだデータがありません</div>
              <div style={{ fontSize:12 }}>ホーム画面の営業ポイント記録を使うと<br/>ここにランキングが表示されます</div>
            </div>
          ) : (
            <div>
              {ranking.map((s, i) => {
                const medalColor = i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.muted;
                const barW = Math.round(s.avg / ranking[0].avg * 100);
                return (
                  <div key={s.name} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                      <div style={{ fontSize:16, fontWeight:900, color:medalColor, width:26, textAlign:"center" }}>#{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.name}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{s.count}回記録</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:14, fontWeight:800, color:C.text }}>¥{s.avg.toLocaleString()}</div>
                        <div style={{ fontSize:10, color:C.muted }}>平均単価</div>
                      </div>
                    </div>
                    <div style={{ height:4, backgroundColor:C.border, borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${barW}%`, backgroundColor:i===0?C.gold:C.accentLight, borderRadius:99 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* GPS取得ボタン */}
        {modalTab === "register" && <>
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          style={{ width:"100%", marginBottom:10, padding:"12px 0", borderRadius:10, fontSize:14, fontWeight:700, cursor:gpsLoading?"not-allowed":"pointer", border:`1.5px solid ${C.accentLight}`, backgroundColor:C.accentGlow, color:C.accentLight, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
        >
          {gpsLoading ? "📡 現在地を取得中..." : "📡 現在地から自動入力"}
        </button>
        {gpsError && <div style={{ fontSize:12, color:C.red, marginBottom:8 }}>{gpsError}</div>}
        {pendingCoords && (
          <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>
            📌 GPS: {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
            {" · "}
            <a href={`https://www.google.com/maps?q=${pendingCoords.lat},${pendingCoords.lng}`} target="_blank" rel="noopener noreferrer" style={{ color:C.accentLight }}>地図で確認</a>
          </div>
        )}

        {/* 手動入力欄 */}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            placeholder="場所名（例：銀座駅付近、新橋駅前）"
            style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:14, outline:"none" }}
          />
          <button onClick={handleAdd} style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:9, padding:"0 18px", fontSize:14, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            {editIdx !== null ? "更新" : "追加"}
          </button>
        </div>
        <input
          value={memo}
          onChange={e=>setMemo(e.target.value)}
          placeholder="メモ（例：終電後、雨の日に需要高い）"
          style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", marginBottom:12 }}
        />
        {editIdx !== null && (
          <button onClick={()=>{setEditIdx(null);setInput("");setMemo("");setPendingCoords(null);}} style={{ fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer", marginBottom:12, padding:0 }}>× キャンセル</button>
        )}

        {/* ポイント一覧 */}
        {points.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px 0", color:C.muted, fontSize:13 }}>まだ登録されていません</div>
        ) : (
          points.map((p, i) => (
            <div key={i} style={{ padding:"12px 14px", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: p.memo ? 4 : 0 }}>
                <span style={{ fontSize:15 }}>{p.lat ? "📡" : "📍"}</span>
                <span style={{ flex:1, fontSize:14, color:C.text, fontWeight:600 }}>{p.name}</span>
                <button onClick={()=>handleEdit(i)} style={{ fontSize:11, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"3px 9px", cursor:"pointer" }}>編集</button>
                <button onClick={()=>handleDelete(i)} style={{ fontSize:11, color:C.red, background:(C.redGlow||C.red+"11"), border:`1px solid ${C.red}44`, borderRadius:6, padding:"3px 9px", cursor:"pointer" }}>削除</button>
              </div>
              {p.memo && <div style={{ fontSize:12, color:C.muted, marginLeft:23, marginBottom:2 }}>{p.memo}</div>}
              <div style={{ fontSize:11, color:C.muted, marginLeft:23, display:"flex", gap:10 }}>
                {p.timestamp && <span>🕐 {fmtDate(p.timestamp)}</span>}
                {p.lat && (
                  <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer" style={{ color:C.accentLight }}>🗺 地図</a>
                )}
              </div>
            </div>
          ))
        )}

        </>}

        <button onClick={onClose} style={{ width:"100%", marginTop:16, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}>閉じる</button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ハンバーガーメニュー（左ドロワー）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function HamburgerDrawer({ user, onClose, setTab, onOpenBizPoints, onNavigateSettings, onManageArea, hasNewRanking, eventCount = 0, friendNotifCount = 0, unreadAnalysisCount = 0 }) {
  // ドロワー表示中はbodyスクロールをロック（iOS対応）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isAdmin = user?.email === (import.meta.env.VITE_ADMIN_EMAIL ?? "yoshito.takeuchi@gmail.com");

  const items = [
    { icon:"👥", label:"マイページ",          action:()=>{ setTab("mypage"); onClose(); }, badge: friendNotifCount > 0 ? friendNotifCount : null },
    { icon:"🧠", label:"AI分析",              action:()=>{ setTab("ai_analysis"); onClose(); }, badge: unreadAnalysisCount > 0 ? unreadAnalysisCount : null },
    { icon:"📈", label:"統計",                action:()=>{ setTab("stats"); onClose(); } },
    { icon:"🧮", label:"売上シミュレーション", action:()=>{ setTab("simulation"); onClose(); } },
    { icon:"📍", label:"マイスポット",         action:()=>{ onOpenBizPoints(); onClose(); } },
    { icon:"🌏", label:"英語フレーズ",         action:()=>{ setTab("english"); onClose(); } },
    { icon:"🎓", label:"新人コース",           action:()=>{ setTab("newbie"); onClose(); } },
    { icon:"🏆", label:"ランキング（開発中）", action:()=>{ setTab("ranking"); onClose(); } },
    { icon:"💬", label:"コミュニティ（開発中）",action:()=>{ setTab("community"); onClose(); } },
    ...(isAdmin ? [{ icon:"📣", label:"イベント（試験中）", action:()=>{ setTab("events"); onClose(); }, badge: eventCount > 0 ? eventCount : null }] : []),
  ];

  return (
    <>
      {/* オーバーレイ */}
      <div style={{ position:"fixed", inset:0, backgroundColor:"#00000066", zIndex:150 }} onClick={onClose} onTouchMove={e=>e.preventDefault()}/>

      {/* ドロワー本体 */}
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:280, maxWidth:"80vw", backgroundColor:C.surface, zIndex:160, display:"flex", flexDirection:"column", boxShadow:"4px 0 24px #00000033", overscrollBehavior:"contain" }}>

        {/* ユーザープロフィール */}
        <div style={{ padding:"16px 16px 10px", backgroundColor:C.card, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <UserAvatar avatarUrl={user?.avatarUrl} avatarPreset={user?.avatarPreset} size={40} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.name || "ゲスト"}</div>
              {user?.workType && <div style={{ fontSize:11, color:C.muted }}>{user.workType}</div>}
            </div>
            <div
              onClick={()=>{ onNavigateSettings("profile"); onClose(); }}
              style={{ fontSize:11, color:C.accentLight, cursor:"pointer", padding:"6px 10px", borderRadius:8, border:`1px solid ${C.accentLight}44`, backgroundColor:C.accentLight+"11", fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}
            >
              編集
            </div>
          </div>
        </div>

        {/* メニュー項目 */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0", overscrollBehavior:"contain" }}>
          {items.map(item => (
            <div key={item.label} onClick={item.action}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer", transition:"background 0.1s" }}
              onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.card}
              onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}
            >
              <span style={{ fontSize:18, width:24, textAlign:"center" }}>{item.icon}</span>
              <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>{item.label}</span>
              {item.badge != null && (
                <span style={{ marginLeft:"auto", backgroundColor:C.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px", minWidth:18, textAlign:"center" }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 下部：設定 */}
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"8px 0 24px" }}>
          <div onClick={()=>{ setTab("settings"); onClose(); }}
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.card}
            onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}
          >
            <span style={{ fontSize:18, width:24, textAlign:"center" }}>⚙️</span>
            <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>設定</span>
          </div>
          <div style={{ padding:"0 20px 4px", fontSize:10, color:C.muted, opacity:0.5, letterSpacing:"0.03em" }}>
            β v0.8 · 更新日 2026/06/25
          </div>
        </div>
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タクロー浮遊ボタン（右下常時表示）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function TakuroFAB({ onOpenChat }) {
  return (
    <div style={{ position:"fixed", bottom:90, right:16, zIndex:49 }}>
      {/* フクロウアイコン */}
      <div onClick={onOpenChat}
        style={{ width:52, height:52, borderRadius:"50%", backgroundColor:C.surface, border:`2px solid ${C.accentLight}66`, boxShadow:`0 4px 20px ${C.accentLight}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, cursor:"pointer", transition:"transform 0.2s" }}
        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
      >🦉</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘッダー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function Header({ user, tab, setTab, appMode="simple", onModeChange, alertsSeen=false, onNavigateSettings, onManageArea, hasNewRanking=false, friendNotifCount=0, onMarkNotifsRead, unreadAnalysisCount=0 }) {
  const [showDrawer, setShowDrawer]           = useState(false);
  const [showModeSheet, setShowModeSheet]     = useState(false);
  const [showBizPoints, setShowBizPoints]     = useState(false);
  const [showNotifPanel, setShowNotifPanel]   = useState(false);
  const [newsCount, setNewsCount]             = useState(0);

  // 未読ニュース数をロード時に取得
  useEffect(() => {
    if (!user?.id) return;
    const lastSeen = localStorage.getItem("taxi_last_news_seen") || "1970-01-01";
    fetchPublicNotifications().then(({ data }) => {
      const unseen = (data || []).filter(n => n.created_at > lastSeen).length;
      setNewsCount(unseen);
    });
  }, [user?.id]);

  // 通知パネルを閉じるとき既読にする
  const closeNotifPanel = () => {
    setShowNotifPanel(false);
    if (newsCount > 0) {
      localStorage.setItem("taxi_last_news_seen", new Date().toISOString());
      setNewsCount(0);
    }
  };

  // 今日チェック済みイベント数（バッジ表示用）
  const eventChecks = loadS("taxi_event_checks", {});
  const checkedEventCount = Object.values(eventChecks).filter(Boolean).length;

  const userAreas = user?.areas || [];
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  const currentMode = MODES.find(m => m.id === appMode) || MODES[0];

  return (
    <>
      <div style={{ backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 14px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"fixed", top:0, left:0, right:0, zIndex:40, maxWidth:"100vw" }}>

        {/* 左：ハンバーガーメニュー ＋ エリアチップ */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
          <button onClick={() => setShowDrawer(true)}
            style={{ display:"flex", flexDirection:"column", gap:4, cursor:"pointer", background:"none", border:"none", padding:"6px 8px", borderRadius:8, flexShrink:0 }}>
            <div style={{ width:20, height:2, backgroundColor:C.text, borderRadius:2 }}/>
            <div style={{ width:16, height:2, backgroundColor:C.text, borderRadius:2 }}/>
            <div style={{ width:20, height:2, backgroundColor:C.text, borderRadius:2 }}/>
          </button>
          {/* エリア表示チップ */}
          <div onClick={() => onManageArea?.()} style={{ cursor:"pointer", minWidth:0, overflow:"hidden" }}>
            {userAreas.length === 0 ? (
              <span style={{ fontSize:10, color:C.red, backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:99, padding:"2px 8px", whiteSpace:"nowrap" }}>
                未設定
              </span>
            ) : (() => {
              const z0 = userAreas[0];
              const meta = ZONE_META[z0];
              const col = meta?.color ?? C.accentLight;
              const prefName = meta ? meta.region.replace(/(都|府|県)$/, "") : z0;
              const label = meta ? `${prefName}(${meta.index})` : z0;
              return (
                <span style={{ fontSize:10, color:col, backgroundColor:col+"22", border:`1px solid ${col}44`, borderRadius:99, padding:"2px 8px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"block", maxWidth:110 }}>
                  {label}{userAreas.length > 1 ? ` +${userAreas.length - 1}` : ""}
                </span>
              );
            })()}
          </div>
        </div>

        {/* 中央：アプリ名 */}
        <div style={{ display:"flex", alignItems:"baseline", gap:3, flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color:C.text, letterSpacing:"-0.5px" }}>🦉 タクロー</span>
          <span style={{ fontSize:9, color:C.muted }}>β</span>
        </div>

        {/* 右：モード + 強制リロード + 通知 */}
        <div style={{ display:"flex", alignItems:"center", gap:4, flex:1, justifyContent:"flex-end" }}>
          {/* モード切替ボタン */}
          <div onClick={() => setShowModeSheet(true)}
            style={{ display:"flex", alignItems:"center", gap:2, cursor:"pointer", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:99, padding:"4px 8px", flexShrink:0 }}>
            <span style={{ fontSize:11, color:C.sub, fontWeight:700 }}>モード</span>
            <span style={{ fontSize:9, color:C.muted }}>▾</span>
          </div>

          {/* 通知ベル → 通知パネルを開く */}
          <div onClick={() => setShowNotifPanel(true)} style={{ position:"relative", cursor:"pointer", padding:"5px 6px", borderRadius:10, backgroundColor:showNotifPanel?C.accentGlow:"transparent", flexShrink:0 }}>
            <span style={{ fontSize:18, opacity:showNotifPanel?1:0.6 }}>🔔</span>
            {(friendNotifCount + newsCount) > 0 && (
              <div style={{ position:"absolute", top:0, right:2, backgroundColor:C.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:99, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px" }}>{friendNotifCount + newsCount}</div>
            )}
          </div>
        </div>
      </div>

      {/* ハンバーガードロワー */}
      {showDrawer && (
        <HamburgerDrawer
          user={user}
          onClose={() => setShowDrawer(false)}
          setTab={setTab}
          onOpenBizPoints={() => setShowBizPoints(true)}
          onNavigateSettings={onNavigateSettings}
          onManageArea={onManageArea}
          hasNewRanking={hasNewRanking}
          eventCount={checkedEventCount}
          friendNotifCount={friendNotifCount}
          unreadAnalysisCount={unreadAnalysisCount}
        />
      )}

      {/* モード選択シート */}
      {showModeSheet && <ModeSheet appMode={appMode} onModeChange={onModeChange} onClose={() => setShowModeSheet(false)}/>}

      {/* 営業ポイント管理モーダル */}
      {showBizPoints && <BusinessPointModal onClose={() => setShowBizPoints(false)}/>}

      {/* 通知パネル */}
      {showNotifPanel && (
        <NotificationPanel
          user={user}
          onClose={closeNotifPanel}
          onNavigateSettings={onNavigateSettings}
          onMarkRead={onMarkNotifsRead}
          newsCount={newsCount}
        />
      )}
    </>
  );
}
