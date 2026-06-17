// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ナビゲーションコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C, loadS, saveS } from "../lib/constants";
import { MOCK_DELAYS } from "../data/mockData";
import { ZONE_META } from "../data/trafficZones";

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
    { id:"community",  icon:"💬", label:"コミュニティ" },
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
        <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>📍 営業ポイント記録</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>稼げた場所をGPSで記録。日報の営業エリア選択にも使えます</div>

        {/* GPS取得ボタン */}
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

        <button onClick={onClose} style={{ width:"100%", marginTop:16, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}>閉じる</button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ハンバーガーメニュー（左ドロワー）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function HamburgerDrawer({ user, onClose, setTab, onOpenBizPoints, onNavigateSettings, onManageArea, hasNewRanking }) {
  const items = [
    { icon:"📈", label:"統計",             action:()=>{ setTab("stats"); onClose(); } },
    { icon:"🏆", label:"ランキング",       action:()=>{ setTab("ranking"); onClose(); }, badge: hasNewRanking },
    { icon:"🗺️", label:"エリア設定",       action:()=>{ onManageArea?.(); onClose(); } },
    { icon:"📍", label:"マイポイント",       action:()=>{ onOpenBizPoints(); onClose(); } },
    { icon:"💴", label:"手取り設定",       action:()=>{ onNavigateSettings("takepay"); onClose(); } },
  ];

  return (
    <>
      {/* オーバーレイ */}
      <div style={{ position:"fixed", inset:0, backgroundColor:"#00000066", zIndex:150 }} onClick={onClose}/>

      {/* ドロワー本体 */}
      <div style={{ position:"fixed", top:0, left:0, bottom:0, width:280, maxWidth:"80vw", backgroundColor:C.surface, zIndex:160, display:"flex", flexDirection:"column", boxShadow:"4px 0 24px #00000033" }}>

        {/* ユーザープロフィール */}
        <div style={{ padding:"52px 20px 20px", backgroundColor:C.card, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ width:48, height:48, borderRadius:"50%", backgroundColor:C.accentLight+"33", border:`2px solid ${C.accentLight}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:10 }}>🦉</div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{user?.name || "ゲスト"}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{user?.company || ""}</div>
          {user?.workType && <div style={{ display:"inline-block", marginTop:6, fontSize:10, backgroundColor:C.accentGlow, color:C.accentLight, border:`1px solid ${C.accentLight}44`, borderRadius:99, padding:"2px 10px", fontWeight:700 }}>{user.workType}</div>}
          <div onClick={()=>{ onNavigateSettings("profile"); onClose(); }} style={{ marginTop:10, display:"inline-block", fontSize:12, color:C.accentLight, cursor:"pointer", padding:"5px 12px", borderRadius:8, border:`1px solid ${C.accentLight}44`, backgroundColor:C.accentLight+"11" }}>✏️ プロフィールを編集</div>
        </div>

        {/* メニュー項目 */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
          {items.map(item => (
            <div key={item.label} onClick={item.action}
              style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer", transition:"background 0.1s" }}
              onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.card}
              onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}
            >
              <span style={{ fontSize:18, width:24, textAlign:"center" }}>{item.icon}</span>
              <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>{item.label}</span>
              {item.badge && (
                <span style={{ marginLeft:"auto", backgroundColor:C.red, color:"#fff", fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 7px" }}>NEW</span>
              )}
            </div>
          ))}
        </div>

        {/* 下部：設定 */}
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"8px 0 32px" }}>
          <div onClick={()=>{ setTab("settings"); onClose(); }}
            style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer" }}
            onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.card}
            onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}
          >
            <span style={{ fontSize:18, width:24, textAlign:"center" }}>⚙️</span>
            <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>設定</span>
          </div>
          {/* ビルド時刻 — デプロイ確認用 */}
          <div style={{ padding:"0 20px 4px", fontSize:10, color:C.muted, opacity:0.6 }}>
            {(() => {
              try {
                const d = new Date(__BUILD_TIME__);
                return `ビルド: ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
              } catch { return ""; }
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タクロー浮遊ボタン（右下常時表示）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function TakuroFAB({ setTab }) {
  const [visible, setVisible] = useState(() => loadS("taxi_takuro_fab", true));

  const hide = (e) => {
    e.stopPropagation();
    setVisible(false);
    saveS("taxi_takuro_fab", false);
  };

  if (!visible) return null;

  return (
    <div style={{ position:"fixed", bottom:90, right:16, zIndex:49 }}>
      {/* ×ボタン */}
      <button onClick={hide} style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", backgroundColor:C.muted, border:"none", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, zIndex:1 }}>×</button>

      {/* フクロウアイコン */}
      <div onClick={()=>setTab("feedback")}
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
export function Header({ user, tab, setTab, appMode="simple", onModeChange, alertsSeen=false, onNavigateSettings, onManageArea, hasNewRanking=false }) {
  const [showDrawer, setShowDrawer]     = useState(false);
  const [showModeSheet, setShowModeSheet] = useState(false);
  const [showBizPoints, setShowBizPoints] = useState(false);

  const userAreas = user?.areas || [];
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  const currentMode = MODES.find(m => m.id === appMode) || MODES[0];

  return (
    <>
      <div style={{ backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 14px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>

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

          {/* 強制リロード */}
          <div onClick={() => window.location.reload()} title="最新版に更新"
            style={{ cursor:"pointer", padding:"5px 6px", borderRadius:10, fontSize:15, opacity:0.55, lineHeight:1, flexShrink:0 }}>
            🔄
          </div>

          {/* 通知 */}
          <div onClick={() => setTab("info")} style={{ position:"relative", cursor:"pointer", padding:"5px 6px", borderRadius:10, backgroundColor:tab==="info"?C.accentGlow:"transparent", flexShrink:0 }}>
            <span style={{ fontSize:18, opacity:tab==="info"?1:0.6 }}>🔔</span>
            {alertCount > 0 && !alertsSeen && <div style={{ position:"absolute", top:2, right:4, width:8, height:8, borderRadius:"50%", backgroundColor:C.red }} />}
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
        />
      )}

      {/* モード選択シート */}
      {showModeSheet && <ModeSheet appMode={appMode} onModeChange={onModeChange} onClose={() => setShowModeSheet(false)}/>}

      {/* 営業ポイント管理モーダル */}
      {showBizPoints && <BusinessPointModal onClose={() => setShowBizPoints(false)}/>}
    </>
  );
}
