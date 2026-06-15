// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ナビゲーションコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C, loadS, saveS } from "../lib/constants";
import { MOCK_DELAYS } from "../data/mockData";

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
              <div style={{ width:48, height:48, borderRadius:14, backgroundColor:C.accentLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#fff", boxShadow:`0 4px 20px ${C.accentLight}66`, marginTop:-20 }}>＋</div>
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
// 営業ポイント管理モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BusinessPointModal({ onClose }) {
  const [points, setPoints] = useState(() => loadS("taxi_biz_points", []));
  const [input, setInput] = useState("");
  const [editIdx, setEditIdx] = useState(null);

  const save = (next) => { setPoints(next); saveS("taxi_biz_points", next); };

  const handleAdd = () => {
    const v = input.trim();
    if (!v) return;
    if (editIdx !== null) {
      const next = points.map((p,i) => i===editIdx ? v : p);
      save(next); setEditIdx(null);
    } else {
      save([...points, v]);
    }
    setInput("");
  };

  const handleEdit = (i) => { setInput(points[i]); setEditIdx(i); };
  const handleDelete = (i) => save(points.filter((_,j)=>j!==i));

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000088", zIndex:300 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, backgroundColor:C.surface, borderRadius:"20px 20px 0 0", padding:24, paddingBottom:44, maxWidth:480, margin:"0 auto", maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>📍 営業ポイント管理</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>よく行く乗り場・エリアを登録しておくと記録時に選択できます</div>

        {/* 入力欄 */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleAdd()}
            placeholder="例：銀座駅付近、新橋駅前"
            style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:14, outline:"none" }}
          />
          <button onClick={handleAdd} style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:9, padding:"0 18px", fontSize:14, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            {editIdx!==null ? "更新" : "追加"}
          </button>
        </div>
        {editIdx!==null && (
          <button onClick={()=>{setEditIdx(null);setInput("");}} style={{ fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer", marginBottom:12, padding:0 }}>× キャンセル</button>
        )}

        {/* ポイント一覧 */}
        {points.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px 0", color:C.muted, fontSize:13 }}>まだ登録されていません</div>
        ) : (
          points.map((p,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:8 }}>
              <span style={{ fontSize:16 }}>📍</span>
              <span style={{ flex:1, fontSize:14, color:C.text, fontWeight:500 }}>{p}</span>
              <button onClick={()=>handleEdit(i)} style={{ fontSize:12, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>編集</button>
              <button onClick={()=>handleDelete(i)} style={{ fontSize:12, color:C.red, background:C.redGlow||C.red+"11", border:`1px solid ${C.red}44`, borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>削除</button>
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
function HamburgerDrawer({ user, onClose, setTab, onOpenBizPoints, onNavigateSettings }) {
  const items = [
    { icon:"🎁", label:"友達を招待",       action:()=>{ onNavigateSettings("referral"); onClose(); } },
    { icon:"📍", label:"営業ポイント管理", action:()=>{ onOpenBizPoints(); onClose(); } },
    { icon:"👤", label:"プロフィール",     action:()=>{ onNavigateSettings("profile"); onClose(); } },
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
export function Header({ user, tab, setTab, appMode="simple", onModeChange, alertsSeen=false, onNavigateSettings }) {
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

        {/* 左：ハンバーガーメニュー */}
        <button onClick={() => setShowDrawer(true)}
          style={{ display:"flex", flexDirection:"column", gap:4, cursor:"pointer", background:"none", border:"none", padding:"6px 8px", borderRadius:8 }}>
          <div style={{ width:20, height:2, backgroundColor:C.text, borderRadius:2 }}/>
          <div style={{ width:16, height:2, backgroundColor:C.text, borderRadius:2 }}/>
          <div style={{ width:20, height:2, backgroundColor:C.text, borderRadius:2 }}/>
        </button>

        {/* 中央：アプリ名（絶対配置で完全センター） */}
        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"baseline", gap:4, pointerEvents:"none" }}>
          <span style={{ fontSize:17, fontWeight:900, color:C.text, letterSpacing:"-0.5px" }}>🦉 タクロー</span>
          <span style={{ fontSize:9, color:C.muted }}>β</span>
        </div>

        {/* 右：モード + 通知 */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {/* モード切替ボタン */}
          <div onClick={() => setShowModeSheet(true)}
            style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:99, padding:"4px 10px" }}>
            <span style={{ fontSize:12 }}>{currentMode.icon}</span>
            <span style={{ fontSize:10, fontWeight:700, color:C.sub }}>{currentMode.label}</span>
            <span style={{ fontSize:9, color:C.muted }}>▾</span>
          </div>

          {/* 通知 */}
          <div onClick={() => setTab("info")} style={{ position:"relative", cursor:"pointer", padding:"6px 8px", borderRadius:10, backgroundColor:tab==="info"?C.accentGlow:"transparent" }}>
            <span style={{ fontSize:19, opacity:tab==="info"?1:0.6 }}>🔔</span>
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
        />
      )}

      {/* モード選択シート */}
      {showModeSheet && <ModeSheet appMode={appMode} onModeChange={onModeChange} onClose={() => setShowModeSheet(false)}/>}

      {/* 営業ポイント管理モーダル */}
      {showBizPoints && <BusinessPointModal onClose={() => setShowBizPoints(false)}/>}
    </>
  );
}
