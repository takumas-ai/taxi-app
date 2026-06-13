// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ナビゲーションコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { C } from "../lib/constants";
import { AREA_MASTER } from "../data/mockData";
import { MOCK_DELAYS } from "../data/mockData";

// ボトムナビ（5タブ）
// 📊ホーム | 📋日報 | ＋記録 | 📍ガイド | ⚙️設定
export function BottomNav({ tab, setTab, userAreas=[] }) {
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  const items = [
    { id:"dashboard", icon:"📊", label:"ホーム"  },
    { id:"list",      icon:"📋", label:"日報"    },
    { id:"upload",    icon:"＋", label:"記録",  special:true },
    { id:"guide",     icon:"📍", label:"ガイド"  },
    { id:"settings",  icon:"⚙️", label:"設定"   },
  ];

  const isActive = id => {
    if (id === "dashboard") return ["dashboard","info","community","shift"].includes(tab);
    if (id === "guide")     return ["guide","spots"].includes(tab);
    return tab === id;
  };

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, backgroundColor:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-around", alignItems:"center", padding:"8px 0 20px", zIndex:50 }}>
      {items.map(item => (
        <div key={item.id} onClick={() => setTab(item.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer", flex:1 }}>
          {item.special ? (
            <>
              <div style={{ width:48, height:48, borderRadius:14, backgroundColor:C.accentLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#fff", boxShadow:`0 4px 20px ${C.accentLight}66`, marginTop:-20 }}>＋</div>
              <div style={{ fontSize:10, color:tab==="upload"?C.accentLight:C.muted, fontWeight:tab==="upload"?700:400 }}>記録</div>
            </>
          ) : (
            <>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:20, opacity:isActive(item.id)?1:0.45 }}>{item.icon}</div>
                {item.id === "dashboard" && alertCount > 0 && (
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

// ヘッダー（情報・シフトのショートカット付き）
export function Header({ user, tab, setTab, onManageArea, showAreaModal }) {
  const userAreas = user?.areas || [];
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  return (
    <div style={{ backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
        <span style={{ fontSize:18, fontWeight:900, color:C.accentLight, letterSpacing:"-0.5px" }}>🦉 タクロー</span>
        <span style={{ fontSize:10, color:C.muted }}>β</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {/* 情報ボタン */}
        <div onClick={() => setTab("info")} style={{ position:"relative", cursor:"pointer", padding:"4px 8px", borderRadius:8, backgroundColor:tab==="info"?C.accentGlow:"transparent" }}>
          <span style={{ fontSize:18, opacity:tab==="info"?1:0.6 }}>🔔</span>
          {alertCount > 0 && <div style={{ position:"absolute", top:0, right:2, width:8, height:8, borderRadius:"50%", backgroundColor:C.red }} />}
        </div>
        {/* シフトボタン */}
        <div onClick={() => setTab("shift")} style={{ cursor:"pointer", padding:"4px 8px", borderRadius:8, backgroundColor:tab==="shift"?C.accentGlow:"transparent" }}>
          <span style={{ fontSize:18, opacity:tab==="shift"?1:0.6 }}>📅</span>
        </div>
        {/* エリアバッジ */}
        {userAreas.length > 0 && (
          <div onClick={onManageArea} style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer", backgroundColor:C.accentGlow, borderRadius:99, padding:"3px 10px" }}>
            <span style={{ fontSize:11 }}>{AREA_MASTER[userAreas[0]]?.emoji}</span>
            <span style={{ fontSize:10, color:C.accentLight, fontWeight:700 }}>{userAreas.length === 1 ? userAreas[0] : `${userAreas[0]}他`}</span>
          </div>
        )}
      </div>
    </div>
  );
}
