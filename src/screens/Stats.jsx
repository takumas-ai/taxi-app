// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 統計画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, loadS, fmt } from "../lib/constants";
import { generateWeeklyInsight } from "../lib/ai";

const TABS = [
  { id:"point", label:"ポイント" },
  { id:"dow",   label:"曜日"   },
  { id:"hour",  label:"時間帯" },
  { id:"month", label:"月次"   },
];

const DAYS = ["日","月","火","水","木","金","土"];

const AI_ADVICE_KEY = (n) => `taxi_stats_advice_${n}`;

export default function StatsScreen({ reports }) {
  const [activeTab, setActiveTab] = useState("point");

  // ─── AIアドバイス（5件刻み） ────────────────────────────────
  const milestone = Math.floor(reports.length / 5) * 5; // 5, 10, 15...
  const cacheKey  = AI_ADVICE_KEY(milestone);
  const [advice, setAdvice]         = useState(() => milestone >= 5 ? (localStorage.getItem(cacheKey) || "") : "");
  const [adviceLoading, setLoading] = useState(false);
  const [adviceError, setAdviceErr] = useState("");

  // マイルストーンが変わったらキャッシュを再読み込み
  useEffect(() => {
    if (milestone >= 5) setAdvice(localStorage.getItem(cacheKey) || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  const generateAdvice = async () => {
    if (reports.length < 5) return;
    setLoading(true); setAdviceErr("");
    try {
      const text = await generateWeeklyInsight(reports);
      if (text) {
        localStorage.setItem(cacheKey, text);
        setAdvice(text);
      } else {
        setAdviceErr("生成に失敗しました。もう一度お試しください。");
      }
    } catch {
      setAdviceErr("生成に失敗しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  // ─── ポイント別 ───────────────────────────────────────────
  // OCR/マージ済み rides → point_name
  // 手入力記録 → pickupLocation
  const pointMap = {};
  reports.forEach(r => {
    (r.rides || []).forEach(ride => {
      const name = ride.point_name?.trim();
      if (!name) return;
      if (!pointMap[name]) pointMap[name] = { count:0, total:0 };
      pointMap[name].count++;
      pointMap[name].total += Number(ride.amount) || 0;
    });
  });
  loadS("taxi_sales_records", []).forEach(r => {
    const name = (r.pickupLocation || r.point_name || "").trim();
    if (!name) return;
    if (!pointMap[name]) pointMap[name] = { count:0, total:0 };
    pointMap[name].count++;
    pointMap[name].total += parseInt(r.fare) || 0;
  });
  const pointStats = Object.entries(pointMap)
    .map(([name, { count, total }]) => ({ name, count, total, avg: Math.round(total / count) }))
    .sort((a, b) => b.avg - a.avg);

  // ─── 曜日別 ───────────────────────────────────────────────
  const dowMap = Array(7).fill(null).map(() => ({ count:0, total:0 }));
  reports.forEach(r => {
    if (!r.date || !r.gross_sales) return;
    const d = new Date(r.date + "T00:00:00").getDay();
    dowMap[d].count++;
    dowMap[d].total += Number(r.gross_sales) || 0;
  });
  const dowStats = dowMap.map((d, i) => ({
    day: DAYS[i], count: d.count,
    avg: d.count > 0 ? Math.round(d.total / d.count) : 0,
  }));

  // ─── 時間帯別 ─────────────────────────────────────────────
  const hourMap = {};
  const addHour = (timeStr, amt) => {
    if (!timeStr) return;
    const h = parseInt(timeStr.replace("T"," ").split(" ")[1]?.split(":")[0] ?? timeStr.split(":")[0]);
    if (isNaN(h) || h < 0 || h > 23) return;
    if (!hourMap[h]) hourMap[h] = { count:0, total:0 };
    hourMap[h].count++;
    hourMap[h].total += Number(amt) || 0;
  };
  reports.forEach(r => {
    (r.rides || []).forEach(ride => addHour(ride.pickup_time, ride.amount));
  });
  loadS("taxi_sales_records", []).forEach(r => addHour(r.boardingTime, r.fare));
  const hourStats = Object.entries(hourMap)
    .map(([h, { count, total }]) => ({ hour: Number(h), count, avg: Math.round(total / count) }))
    .sort((a, b) => a.hour - b.hour);

  // ─── 月次 ─────────────────────────────────────────────────
  const monthMap = {};
  reports.forEach(r => {
    if (!r.date || !r.gross_sales) return;
    const ym = r.date.slice(0,7);
    if (!monthMap[ym]) monthMap[ym] = { count:0, total:0 };
    monthMap[ym].count++;
    monthMap[ym].total += Number(r.gross_sales) || 0;
  });
  const monthStats = Object.entries(monthMap)
    .sort(([a],[b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([ym, { count, total }]) => ({ ym, count, total, avg: Math.round(total / count) }));

  // ─── 最大値（バー用） ────────────────────────────────────
  const maxPointAvg  = Math.max(...pointStats.map(p => p.avg), 1);
  const maxDowAvg    = Math.max(...dowStats.map(d => d.avg), 1);
  const maxHourAvg   = Math.max(...hourStats.map(h => h.avg), 1);
  const maxMonthTot  = Math.max(...monthStats.map(m => m.total), 1);

  const Bar = ({ ratio, color }) => (
    <div style={{ flex:1, backgroundColor:C.bg, borderRadius:99, height:7, overflow:"hidden" }}>
      <div style={{ width:`${Math.round(ratio*100)}%`, height:"100%", backgroundColor:color, borderRadius:99 }}/>
    </div>
  );

  const Empty = ({ msg }) => (
    <div style={{ textAlign:"center", padding:"40px 0", color:C.muted, fontSize:13 }}>{msg}</div>
  );

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:16 }}>📈 統計</div>

      {/* AIアドバイスカード */}
      {reports.length >= 5 && (
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.accentLight}44`, borderRadius:14, padding:"16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: advice ? 10 : 0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🦉</span>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>AIアドバイス</div>
                <div style={{ fontSize:10, color:C.muted }}>{reports.length}件目 / 次の更新 {milestone + 5}件</div>
              </div>
            </div>
            <button
              onClick={generateAdvice}
              disabled={adviceLoading}
              style={{ fontSize:11, fontWeight:700, padding:"6px 12px", borderRadius:20, border:`1.5px solid ${C.accentLight}`, backgroundColor: adviceLoading ? C.border : C.accentGlow, color: adviceLoading ? C.muted : C.accentLight, cursor: adviceLoading ? "default" : "pointer", flexShrink:0 }}
            >
              {adviceLoading ? "生成中..." : advice ? "再生成" : "生成する"}
            </button>
          </div>
          {adviceError && <div style={{ fontSize:12, color:C.red, marginTop:8 }}>{adviceError}</div>}
          {advice && !adviceLoading && (
            <div style={{ fontSize:13, color:C.sub, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{advice}</div>
          )}
          {!advice && !adviceLoading && (
            <div style={{ fontSize:12, color:C.muted, marginTop:8 }}>「生成する」を押すと、直近{reports.length}件のデータをもとにアドバイスが届きます。</div>
          )}
        </div>
      )}

      {/* タブ */}
      <div style={{ display:"flex", gap:4, marginBottom:20, backgroundColor:C.surface, borderRadius:12, padding:4, border:`1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", fontSize:12, fontWeight:700, cursor:"pointer",
              backgroundColor: activeTab===t.id ? C.accentLight : "transparent",
              color: activeTab===t.id ? "#fff" : C.muted }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ポイント別 */}
      {activeTab === "point" && (
        pointStats.length === 0
          ? <Empty msg={"まだデータがありません\n乗車記録にポイント名を入力すると集計されます"} />
          : pointStats.map((p, i) => (
            <div key={p.name} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:C.accentLight, backgroundColor:C.accentGlow, borderRadius:99, padding:"1px 7px" }}>#{i+1}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{p.count}件 · 累計 ¥{fmt(p.total)}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:C.gold }}>¥{fmt(p.avg)}</div>
                  <div style={{ fontSize:10, color:C.muted }}>平均単価</div>
                </div>
              </div>
              <Bar ratio={p.avg / maxPointAvg} color={C.gold} />
            </div>
          ))
      )}

      {/* 曜日別 */}
      {activeTab === "dow" && (
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 16px" }}>
          {dowStats.map(d => (
            <div key={d.day} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ width:20, fontSize:13, fontWeight:700, color: d.day==="日"?C.red : d.day==="土"?C.accentLight : C.text }}>{d.day}</div>
              <Bar ratio={d.count > 0 ? d.avg / maxDowAvg : 0} color={C.accentLight} />
              <div style={{ minWidth:64, textAlign:"right" }}>
                {d.count > 0
                  ? <span style={{ fontSize:13, fontWeight:700, color:C.text }}>¥{fmt(d.avg)}</span>
                  : <span style={{ fontSize:11, color:C.muted }}>-</span>}
              </div>
              <div style={{ fontSize:10, color:C.muted, minWidth:24 }}>{d.count > 0 ? `${d.count}件` : ""}</div>
            </div>
          ))}
        </div>
      )}

      {/* 時間帯別 */}
      {activeTab === "hour" && (
        hourStats.length === 0
          ? <Empty msg="乗車記録のデータがありません" />
          : <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px" }}>
              {hourStats.map(h => (
                <div key={h.hour} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:34, fontSize:11, color:C.muted, textAlign:"right" }}>{String(h.hour).padStart(2,"0")}時</div>
                  <Bar ratio={h.avg / maxHourAvg} color={C.green} />
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:60, textAlign:"right" }}>¥{fmt(h.avg)}</div>
                  <div style={{ fontSize:10, color:C.muted, minWidth:28 }}>{h.count}件</div>
                </div>
              ))}
            </div>
      )}

      {/* 月次 */}
      {activeTab === "month" && (
        monthStats.length === 0
          ? <Empty msg="日報データがありません" />
          : monthStats.map(m => (
            <div key={m.ym} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{m.ym.replace("-","年")}月</div>
                  <div style={{ fontSize:11, color:C.muted }}>{m.count}日</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:C.green }}>¥{fmt(m.total)}</div>
                  <div style={{ fontSize:10, color:C.muted }}>日平均 ¥{fmt(m.avg)}</div>
                </div>
              </div>
              <Bar ratio={m.total / maxMonthTot} color={C.green} />
            </div>
          ))
      )}
    </div>
  );
}
