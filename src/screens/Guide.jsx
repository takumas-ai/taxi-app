// 乗り場・空港ガイド
import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { Card, Btn } from "../components/UI";
import { STAND_GUIDES } from "../data/mockData";
import { loadS, saveS } from "../lib/constants";

export default function GuideScreen({ userAreas=[] }) {
  const [type, setType]         = useState("stand");
  const [selected, setSelected] = useState(null);
  const [bookmarks, setBookmarks] = useState(()=>loadS("taxi_guide_bm",[]));
  useEffect(()=>saveS("taxi_guide_bm",bookmarks),[bookmarks]);
  const toggleBm = id => setBookmarks(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const list = STAND_GUIDES.filter(g=>g.type===type);

  if (selected) {
    const g = selected;
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <button onClick={()=>setSelected(null)} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:C.sub, cursor:"pointer", fontSize:13 }}>← 戻る</button>
          <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800 }}>{g.emoji} {g.name}</div><div style={{ fontSize:11, color:C.muted }}>{g.area}</div></div>
          <button onClick={()=>toggleBm(g.id)} style={{ backgroundColor:"transparent", border:"none", fontSize:22, cursor:"pointer" }}>{bookmarks.includes(g.id)?"⭐":"☆"}</button>
        </div>
        <Card style={{ borderColor:C.gold+"44" }}><div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:6 }}>⏰ ピーク時間帯</div><div style={{ fontSize:13 }}>{g.peak}</div></Card>
        {g.access && <Card style={{ borderColor:C.purple+"44" }}><div style={{ fontSize:11, color:C.purple, fontWeight:700, marginBottom:6 }}>🛣️ 進入路・アクセス</div><div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>{g.access}</div></Card>}
        {g.flow && (
          <Card>
            <div style={{ fontSize:11, color:C.accentLight, fontWeight:700, marginBottom:10 }}>🔢 入港ステップ</div>
            {g.flow.map((s,i)=>(
              <div key={i} style={{ display:"flex", gap:10, marginBottom:8 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", backgroundColor:C.accentLight, color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                <div style={{ fontSize:13, color:C.sub, paddingTop:2 }}>{s}</div>
              </div>
            ))}
          </Card>
        )}
        <Card style={{ borderColor:C.green+"44" }}><div style={{ fontSize:11, color:C.green, fontWeight:700, marginBottom:8 }}>🚕 並び方・ルール</div><div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>{g.lineup}</div></Card>
        <Card>
          <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:10 }}>💡 稼ぐためのコツ</div>
          {g.tips.map((t,i)=>(
            <div key={i} style={{ display:"flex", gap:10, marginBottom:8, paddingBottom:8, borderBottom:i<g.tips.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:14, flexShrink:0 }}>✓</span><div style={{ fontSize:13, color:C.sub, lineHeight:1.7 }}>{t}</div>
            </div>
          ))}
        </Card>
        <Card style={{ borderColor:C.orange+"44", backgroundColor:C.orangeGlow }}><div style={{ fontSize:11, color:C.orange, fontWeight:700, marginBottom:6 }}>⚠️ 注意</div><div style={{ fontSize:13, color:C.sub, lineHeight:1.7 }}>{g.caution}</div></Card>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
          <span style={{ color:C.gold, fontSize:13 }}>{"★".repeat(Math.round(g.rating))}</span>
          <span style={{ color:C.gold, fontWeight:700 }}>{g.rating}</span>
          <span style={{ color:C.muted, fontSize:12 }}>（{g.reviews}件のレビュー）</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>📍 乗り場・空港ガイド</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>並び方・コツ・進入路を新人〜ベテランまで</div>
      <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:12, padding:4, gap:4, marginBottom:14 }}>
        {[["stand","🚕 乗り場"],["airport","✈️ 空港"]].map(([v,l])=>(
          <div key={v} onClick={()=>setType(v)} style={{ flex:1, textAlign:"center", padding:"9px 0", borderRadius:9, fontSize:13, fontWeight:type===v?700:400, backgroundColor:type===v?C.card:"transparent", color:type===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
        ))}
      </div>
      {bookmarks.length > 0 && (
        <>
          <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:8 }}>⭐ お気に入り</div>
          {STAND_GUIDES.filter(g=>bookmarks.includes(g.id)).map(g=>(
            <div key={g.id} onClick={()=>setSelected(g)} style={{ backgroundColor:C.card, border:`1px solid ${C.gold}44`, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer" }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{g.emoji} {g.name}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{g.peak}</div>
            </div>
          ))}
          <div style={{ height:1, backgroundColor:C.border, margin:"12px 0" }}/>
        </>
      )}
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{list.length}件</div>
      {list.map(g=>(
        <div key={g.id} onClick={()=>setSelected(g)}
          style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:16, marginBottom:12, cursor:"pointer", transition:"background 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.cardHover}
          onMouseLeave={e=>e.currentTarget.style.backgroundColor=C.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>{g.emoji} {g.name}</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {g.tags.map(t=><span key={t} style={{ backgroundColor:C.accentLight+"15", color:C.accentLight, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99 }}>{t}</span>)}
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();toggleBm(g.id);}} style={{ backgroundColor:"transparent", border:"none", fontSize:20, cursor:"pointer", marginLeft:8 }}>{bookmarks.includes(g.id)?"⭐":"☆"}</button>
          </div>
          <div style={{ backgroundColor:C.bg, borderRadius:8, padding:"8px 12px", marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>⏰ ピーク</div>
            <div style={{ fontSize:12, color:C.sub }}>{g.peak}</div>
          </div>
          <div style={{ fontSize:12, color:C.muted, backgroundColor:C.surface, borderRadius:8, padding:"8px 10px", borderLeft:`3px solid ${C.accentLight}`, lineHeight:1.6 }}>
            🚕 {g.lineup.slice(0,55)}...
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ color:C.gold, fontSize:12 }}>{"★".repeat(Math.round(g.rating))}</span>
              <span style={{ color:C.gold, fontWeight:700, fontSize:12 }}>{g.rating}</span>
              <span style={{ color:C.muted, fontSize:11 }}>（{g.reviews}件）</span>
            </div>
            <span style={{ fontSize:12, color:C.accentLight, fontWeight:700 }}>詳細 →</span>
          </div>
        </div>
      ))}
    </div>
  );
}
