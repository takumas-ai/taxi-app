// 乗り場・空港ガイド
import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { Card, Btn } from "../components/UI";
import { STAND_GUIDES } from "../data/mockData";
import { loadS, saveS } from "../lib/constants";

const SORT_OPTIONS = [
  { id:"demand", label:"🔥 需要順" },
  { id:"rating", label:"⭐ 評価順" },
  { id:"name",   label:"🔤 名前順" },
  { id:"area",   label:"📍 エリア順" },
];

export default function GuideScreen({ userAreas=[] }) {
  const [type, setType]         = useState("stand");
  const [selected, setSelected] = useState(null);
  const [bookmarks, setBookmarks] = useState(()=>loadS("taxi_guide_bm",[]));
  const [search, setSearch]     = useState("");
  const [sort, setSort]         = useState("demand");

  useEffect(()=>saveS("taxi_guide_bm",bookmarks),[bookmarks]);
  const toggleBm = id => setBookmarks(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  // 検索フィルター
  const q = search.trim().toLowerCase();
  const filtered = STAND_GUIDES.filter(g => {
    if (g.type !== type) return false;
    if (!q) return true;
    const haystack = [g.name, g.area, ...(g.tags||[]), g.peak, g.lineup, ...(g.tips||[])].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  // ソート
  const list = [...filtered].sort((a,b) => {
    if (sort === "demand") return (b.demandScore||0) - (a.demandScore||0);
    if (sort === "rating") return (b.rating||0) - (a.rating||0);
    if (sort === "name")   return a.name.localeCompare(b.name, "ja");
    if (sort === "area")   return a.area.localeCompare(b.area, "ja");
    return 0;
  });

  if (selected) {
    const g = selected;
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <button onClick={()=>setSelected(null)} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", color:C.sub, cursor:"pointer", fontSize:13 }}>← 戻る</button>
          <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800 }}>{g.emoji} {g.name}</div><div style={{ fontSize:11, color:C.muted }}>{g.area}</div></div>
          <button onClick={()=>toggleBm(g.id)} style={{ backgroundColor:"transparent", border:"none", fontSize:22, cursor:"pointer" }}>{bookmarks.includes(g.id)?"⭐":"☆"}</button>
        </div>

        {/* スコアバッジ */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>需要スコア</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.accentLight }}>🔥 {g.demandScore}</div>
          </div>
          <div style={{ backgroundColor:C.goldGlow, border:`1px solid ${C.gold}44`, borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>評価</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.gold }}>⭐ {g.rating}</div>
          </div>
          <div style={{ backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>レビュー</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{g.reviews}件</div>
          </div>
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
      </div>
    );
  }

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>📍 乗り場・空港ガイド</div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>並び方・コツ・進入路を新人〜ベテランまで</div>

      {/* タブ */}
      <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:12, padding:4, gap:4, marginBottom:12 }}>
        {[["stand","🚕 乗り場"],["airport","✈️ 空港"]].map(([v,l])=>(
          <div key={v} onClick={()=>{ setType(v); setSearch(""); }} style={{ flex:1, textAlign:"center", padding:"9px 0", borderRadius:9, fontSize:13, fontWeight:type===v?700:400, backgroundColor:type===v?C.card:"transparent", color:type===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
        ))}
      </div>

      {/* 検索バー */}
      <div style={{ position:"relative", marginBottom:10 }}>
        <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.muted, pointerEvents:"none" }}>🔍</span>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="名前・エリア・タグで検索..."
          style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"9px 12px 9px 34px", fontSize:13, color:C.text, outline:"none" }}
        />
        {search && (
          <button onClick={()=>setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
        )}
      </div>

      {/* ソートボタン */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
        {SORT_OPTIONS.map(o=>(
          <button key={o.id} onClick={()=>setSort(o.id)}
            style={{ flexShrink:0, padding:"5px 10px", borderRadius:99, fontSize:11, fontWeight:sort===o.id?700:400, border:`1px solid ${sort===o.id?C.accentLight:C.border}`, backgroundColor:sort===o.id?C.accentGlow:"transparent", color:sort===o.id?C.accentLight:C.muted, cursor:"pointer", whiteSpace:"nowrap" }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* お気に入り */}
      {bookmarks.length > 0 && !search && (
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

      {/* 件数 */}
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
        {search ? `「${search}」の検索結果: ${list.length}件` : `${list.length}件`}
      </div>

      {/* 検索結果なし */}
      {list.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
          <div style={{ fontSize:14 }}>「{search}」に一致する乗り場が見つかりませんでした</div>
          <button onClick={()=>setSearch("")} style={{ marginTop:12, padding:"7px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:"none", color:C.accentLight, cursor:"pointer", fontSize:13 }}>検索をクリア</button>
        </div>
      )}

      {/* リスト */}
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
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:11, color:C.accentLight }}>🔥 {g.demandScore}</span>
              <span style={{ color:C.gold, fontSize:11 }}>⭐ {g.rating}</span>
              <span style={{ color:C.muted, fontSize:11 }}>({g.reviews}件)</span>
            </div>
            <span style={{ fontSize:12, color:C.accentLight, fontWeight:700 }}>詳細 →</span>
          </div>
        </div>
      ))}
    </div>
  );
}
