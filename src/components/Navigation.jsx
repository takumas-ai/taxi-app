// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ナビゲーションコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { MOCK_DELAYS } from "../data/mockData";

// ボトムナビ（5タブ）
// 📊ホーム | 📋日報 | ＋記録 | 📍ガイド | 💬コミュニティ
export function BottomNav({ tab, setTab, userAreas=[] }) {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// モード選択ボトムシート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MODES = [
  { id:"simple",   icon:"🟢", label:"かんたん", desc:"大きな文字・シンプル表示" },
  { id:"standard", icon:"🔵", label:"通常",     desc:"標準的な表示" },
  { id:"analysis", icon:"🟣", label:"分析",     desc:"詳細データ・グラフ表示" },
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
// ヘッダー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function Header({ user, tab, setTab, appMode="standard", onModeChange }) {
  const [showModeSheet, setShowModeSheet] = useState(false);

  const userAreas = user?.areas || [];
  const alertCount = MOCK_DELAYS.filter(d =>
    d.status !== "normal" && d.opportunity && d.severity === "high" &&
    (userAreas.length === 0 || d.areas.some(a => userAreas.includes(a)))
  ).length;

  const currentMode = MODES.find(m => m.id === appMode) || MODES[1];

  return (
    <>
      <div style={{ backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 14px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>

        {/* 左：モード選択 */}
        <div onClick={() => setShowModeSheet(true)}
          style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:99, padding:"5px 12px" }}>
          <span style={{ fontSize:13 }}>{currentMode.icon}</span>
          <span style={{ fontSize:11, fontWeight:700, color:C.sub }}>{currentMode.label}</span>
          <span style={{ fontSize:10, color:C.muted }}>▾</span>
        </div>

        {/* 中央：アプリ名（絶対配置で完全センター） */}
        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"baseline", gap:4, pointerEvents:"none" }}>
          <span style={{ fontSize:17, fontWeight:900, color:C.text, letterSpacing:"-0.5px" }}>🦉 タクロー</span>
          <span style={{ fontSize:9, color:C.muted }}>β</span>
        </div>

        {/* 右：通知・設定 */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <div onClick={() => setTab("info")} style={{ position:"relative", cursor:"pointer", padding:"6px 8px", borderRadius:10, backgroundColor:tab==="info"?C.accentGlow:"transparent" }}>
            <span style={{ fontSize:19, opacity:tab==="info"?1:0.6 }}>🔔</span>
            {alertCount > 0 && <div style={{ position:"absolute", top:2, right:4, width:8, height:8, borderRadius:"50%", backgroundColor:C.red }} />}
          </div>
          <div onClick={() => setTab("settings")} style={{ cursor:"pointer", padding:"6px 8px", borderRadius:10, backgroundColor:tab==="settings"?C.accentGlow:"transparent" }}>
            <span style={{ fontSize:19, opacity:tab==="settings"?1:0.6 }}>⚙️</span>
          </div>
        </div>
      </div>

      {showModeSheet && <ModeSheet appMode={appMode} onModeChange={onModeChange} onClose={() => setShowModeSheet(false)}/>}
    </>
  );
}
