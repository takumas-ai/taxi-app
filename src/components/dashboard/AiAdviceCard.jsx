import { C } from "../../lib/constants";

const DAYS_JA = ["日","月","火","水","木","金","土"];

export default function AiAdviceCard({ reports, appMode }) {
  const count = reports.length;
  const needed = Math.max(0, 3 - count);

  if (count < 3) {
    return (
      <div style={{ backgroundColor:C.surface, border:`1px dashed ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:24, opacity:0.5 }}>🤖</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted }}>AIアドバイスはまだ使えません</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>あと<span style={{ color:C.accentLight, fontWeight:800 }}> {needed}回 </span>記録するとAIが分析を開始します</div>
        </div>
      </div>
    );
  }

  const sorted    = [...reports].sort((a,b) => b.gross_sales - a.gross_sales);
  const bestDay   = sorted[0];
  const avgSales  = Math.round(reports.reduce((s,r) => s + (r.gross_sales||0), 0) / reports.length);
  const avgHourly = Math.round(reports.reduce((s,r) => s + (r.gross_sales&&r.work_hours ? r.gross_sales/r.work_hours : 0), 0) / reports.length);
  const bestDow   = bestDay ? DAYS_JA[new Date(bestDay.date).getDay()] : "";

  if (appMode === "simple") {
    return (
      <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ fontSize:10, color:C.accentLight, fontWeight:700, marginBottom:6 }}>🤖 AI からのひとこと</div>
        <div style={{ fontSize:15, fontWeight:800, color:C.text, lineHeight:1.6 }}>
          {bestDow ? `${bestDow}曜日が一番稼げています！` : "記録を続けると傾向が見えてきます"}
        </div>
        {avgSales > 0 && (
          <div style={{ fontSize:12, color:C.sub, marginTop:6 }}>平均売上 {avgSales.toLocaleString()}円 / 1回</div>
        )}
      </div>
    );
  }

  const isAnalysis = appMode === "analysis";
  return (
    <div style={{ backgroundColor:C.card, border:`1px solid ${C.accentLight}44`, borderRadius:14, padding:"16px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ fontSize:22 }}>🤖</span>
        <div>
          <div style={{ fontSize:13, fontWeight:800 }}>{isAnalysis ? "AI戦略アドバイス" : "AIアドバイス"}</div>
          <div style={{ fontSize:11, color:C.muted }}>{count}件のデータを分析できます</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {bestDow && (
          <div style={{ flex:1, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>ベスト曜日</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.gold }}>{bestDow}曜</div>
          </div>
        )}
        {avgSales > 0 && (
          <div style={{ flex:1, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>平均売上</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.accentLight }}>{Math.round(avgSales/1000)}k円</div>
          </div>
        )}
        {isAnalysis && avgHourly > 0 && (
          <div style={{ flex:1, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>時間効率</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.green }}>{Math.round(avgHourly/100)*100}円/h</div>
          </div>
        )}
      </div>
      <button style={{ width:"100%", padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}>
        {isAnalysis ? "🔍 詳細な戦略分析を見る" : "💡 アドバイスを見る"}
      </button>
    </div>
  );
}
