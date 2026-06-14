// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共通UIコンポーネント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";

export function Card({ children, style={}, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ backgroundColor:h&&onClick?C.cardHover:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:16, marginBottom:12, cursor:onClick?"pointer":"default", transition:"all 0.15s", ...style }}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, unit="", accent=C.accentLight, sub }) {
  return (
    <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
      <div style={{ fontSize:20, fontWeight:800, color:accent, lineHeight:1.1 }}>{value}<span style={{ fontSize:11, color:C.muted, marginLeft:2 }}>{unit}</span></div>
      <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color=C.accentLight, height=8 }) {
  const pct = Math.min(Math.round((value/max)*100), 100);
  return (
    <div style={{ backgroundColor:C.border, borderRadius:99, height, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, backgroundColor:color, borderRadius:99, transition:"width 0.6s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

export function Badge({ children, color=C.accentLight, size=10 }) {
  return <span style={{ display:"inline-block", backgroundColor:color+"22", color, fontSize:size, fontWeight:700, padding:"3px 8px", borderRadius:99 }}>{children}</span>;
}

export function Btn({ children, onClick, variant="primary", style={}, disabled=false }) {
  const [h, setH] = useState(false);
  const variants = {
    primary: { backgroundColor:C.accentLight, color:"#fff" },
    gold:    { backgroundColor:C.gold, color:"#000" },
    ghost:   { backgroundColor:"transparent", color:C.sub, border:`1px solid ${C.border}` },
    secondary: { backgroundColor:C.card, color:C.text, border:`1px solid ${C.border}` },
    danger:  { backgroundColor:C.red+"22", color:C.red, border:`1px solid ${C.red}44` },
  };
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", border:"none", transition:"all 0.15s", opacity:disabled?0.5:h?0.85:1, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Toggle({ value, onChange }) {
  return (
    <div onClick={()=>onChange(!value)}
      style={{ width:44, height:24, borderRadius:99, backgroundColor:value?C.accentLight:C.border, cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?22:3, width:18, height:18, borderRadius:"50%", backgroundColor:"#fff", transition:"left 0.2s" }} />
    </div>
  );
}

export function Divider({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0" }}>
      <div style={{ flex:1, height:1, backgroundColor:C.border }} />
      {label && <span style={{ fontSize:11, color:C.muted }}>{label}</span>}
      <div style={{ flex:1, height:1, backgroundColor:C.border }} />
    </div>
  );
}

export function AreaBadges({ areas=[] }) {
  const { AREA_MASTER } = require("../data/mockData");
  return (
    <span style={{ display:"inline-flex", gap:4, flexWrap:"wrap" }}>
      {areas.map(a => (
        <span key={a} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:99, backgroundColor:(AREA_MASTER[a]?.color||C.accentLight)+"22", color:AREA_MASTER[a]?.color||C.accentLight }}>
          {AREA_MASTER[a]?.emoji} {a}
        </span>
      ))}
    </span>
  );
}
