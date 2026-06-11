import { useState } from "react";
import { C, fmt, occ, dow, hourly } from "../lib/constants";
import { Card, Badge } from "../components/UI";

// 日報詳細モーダル
export function ReportModal({ report, onClose }) {
  if (!report || !report.gross_sales) return null;
  const or = occ(report), oc = or>=55?C.green:or>=45?C.gold:C.red;
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", maxHeight:"88vh", overflowY:"auto", padding:24, paddingBottom:40 }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:12, color:C.muted }}>{report.date}（{dow(report.date)}）</div>
            <div style={{ fontSize:28, fontWeight:800 }}>{fmt(report.gross_sales)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span></div>
          </div>
          <Badge color={oc} size={11}>実車率 {or}%</Badge>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>売上内訳</div>
        {[{l:"現金",v:report.cash_sales,c:C.gold},{l:"カード",v:report.card_sales,c:C.accentLight},{l:"配車アプリ",v:report.app_sales,c:C.green}].map(({l,v,c})=>(
          <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:8, height:8, borderRadius:"50%", backgroundColor:c }}/><span style={{ fontSize:13, color:C.sub }}>{l}</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:72, backgroundColor:C.border, borderRadius:99, height:4, overflow:"hidden" }}><div style={{ height:"100%", width:`${Math.round((v||0)/report.gross_sales*100)}%`, backgroundColor:c, borderRadius:99 }}/></div>
              <span style={{ fontSize:13, color:C.text, minWidth:64, textAlign:"right" }}>{fmt(v)}円</span>
            </div>
          </div>
        ))}
        <div style={{ height:1, backgroundColor:C.border, margin:"12px 0" }}/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
          {[{l:"営業回数",v:report.ride_count,u:"回",c:C.accentLight},{l:"時間単価",v:fmt(hourly(report)),u:"円/h",c:C.gold},{l:"実車率",v:or,u:"%",c:oc}].map(({l,v,u,c})=>(
            <div key={l} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:800, color:c }}>{v}<span style={{ fontSize:10, color:C.muted, marginLeft:2 }}>{u}</span></div>
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>
        {report.trouble_note && <div style={{ backgroundColor:C.orangeGlow, border:`1px solid ${C.orange}44`, borderRadius:10, padding:12, marginBottom:10, fontSize:13, color:C.orange }}>⚠️ {report.trouble_note}</div>}
        {report.ai_comment && <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:14, fontSize:13, color:C.sub, lineHeight:1.7 }}>💬 {report.ai_comment}</div>}
        <button onClick={onClose} style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub, marginTop:18 }}>閉じる</button>
      </div>
    </div>
  );
}

// 日報一覧
export default function ReportList({ reports, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date");
  const avg = reports.length ? Math.round(reports.reduce((s,r)=>s+r.gross_sales,0)/reports.length) : 0;
  const filtered = reports
    .filter(r => r && r.gross_sales)
    .filter(r => filter==="high"?r.gross_sales>=65000:filter==="low"?r.gross_sales<58000:true)
    .sort((a,b) => sort==="sales"?b.gross_sales-a.gross_sales:sort==="occ"?occ(b)-occ(a):b.date.localeCompare(a.date));
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        {[["all","すべて"],["high","高売上"],["low","要改善"]].map(([v,l])=>(
          <div key={v} onClick={()=>setFilter(v)} style={{ padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:filter===v?700:400, backgroundColor:filter===v?C.accentLight+"22":C.card, color:filter===v?C.accentLight:C.muted, border:`1px solid ${filter===v?C.accentLight+"44":C.border}`, cursor:"pointer" }}>{l}</div>
        ))}
        <div style={{ flex:1 }}/>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", color:C.sub, fontSize:12, outline:"none" }}>
          <option value="date">日付順</option><option value="sales">売上順</option><option value="occ">実車率順</option>
        </select>
      </div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{filtered.length}件</div>
      {filtered.map(r => {
        const or=occ(r), oc=or>=55?C.green:or>=45?C.gold:C.red, diff=r.gross_sales-avg;
        return (
          <Card key={r.id} onClick={()=>onSelect(r)} style={{ padding:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div><div style={{ fontSize:11, color:C.muted }}>{r.date}（{dow(r.date)}）</div><div style={{ fontSize:22, fontWeight:800, marginTop:2 }}>{fmt(r.gross_sales)}<span style={{ fontSize:11, color:C.muted, marginLeft:3 }}>円</span></div></div>
              <div style={{ textAlign:"right" }}><Badge color={oc}>実車率 {or}%</Badge><div style={{ fontSize:11, color:diff>=0?C.green:C.red, marginTop:5, fontWeight:700 }}>{diff>=0?"+":""}{fmt(diff)}円</div></div>
            </div>
            <div style={{ display:"flex", gap:12, fontSize:11, color:C.muted }}>
              <span>🚗 {r.ride_count}回</span><span>📍 {r.total_distance}km</span><span>⏱ {fmt(hourly(r))}円/h</span>{r.trouble_note&&<span style={{ color:C.red }}>⚠️</span>}
            </div>
            {r.ai_comment && <div style={{ marginTop:10, fontSize:12, color:C.sub, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", borderLeft:`3px solid ${C.accentLight}`, lineHeight:1.6 }}>💬 {r.ai_comment.slice(0,70)}...</div>}
          </Card>
        );
      })}
    </div>
  );
}
