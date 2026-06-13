// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard.jsx — ダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, fmt, occ, dow, hourly, THIS_YEAR, THIS_MONTH, FREE_LIMIT, loadS, saveS } from "../lib/constants";
import { Card, Btn, ProgressBar, Badge, KpiCard } from "../components/UI";
import { AreaFilterBanner } from "../components/AreaFilter";
import { MOCK_YESTERDAY_SUMMARY, AREA_MASTER } from "../data/mockData";
import { levelFromXp, getTitle, MISSIONS, getMissionState } from "../lib/xp";
import { CURRENT_VERSION, CHANGELOG } from "../lib/changelog";
import { getCachedWeather, weatherMeta } from "../lib/weather";

// ━━━ 更新通知バナー ━━━━━━━━━━━━━━━━━━━━━━━━
function UpdateBanner() {
  const seenKey = "taxi_seen_version";
  const seenVersion = loadS(seenKey, "");
  const [dismissed, setDismissed] = useState(seenVersion === CURRENT_VERSION);
  const [showDetail, setShowDetail] = useState(false);

  if (dismissed) return null;

  const latest = CHANGELOG[0];

  const dismiss = () => {
    saveS(seenKey, CURRENT_VERSION);
    setDismissed(true);
    setShowDetail(false);
  };

  return (
    <>
      {/* バナー */}
      <div style={{ backgroundColor:C.accentLight+"18", border:`1.5px solid ${C.accentLight}55`, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🎉</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.accentLight }}>v{CURRENT_VERSION} {latest.title}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{latest.date} 更新</div>
        </div>
        <button onClick={()=>setShowDetail(true)} style={{ fontSize:11, color:C.accentLight, background:"none", border:`1px solid ${C.accentLight}55`, borderRadius:7, padding:"4px 10px", cursor:"pointer", flexShrink:0 }}>詳細 →</button>
        <button onClick={dismiss} style={{ fontSize:16, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:"0 2px", flexShrink:0, lineHeight:1 }}>×</button>
      </div>

      {/* 詳細モーダル */}
      {showDetail && (
        <div style={{ position:"fixed", inset:0, backgroundColor:"#00000088", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={dismiss}>
          <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", maxHeight:"80vh", overflowY:"auto", padding:24, paddingBottom:40 }}>
            <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>🆕 アップデート情報</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:20 }}>最新バージョン v{CURRENT_VERSION}</div>

            {CHANGELOG.map((log, i) => (
              <div key={log.version} style={{ marginBottom:20, opacity: i === 0 ? 1 : 0.65 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:800, color: i===0?C.accentLight:C.muted }}>v{log.version}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{log.date}</div>
                  {log.badge && <div style={{ fontSize:10, backgroundColor:C.accentLight+"22", color:C.accentLight, borderRadius:5, padding:"2px 7px", fontWeight:700 }}>{log.badge}</div>}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>{log.title}</div>
                {log.items.map((item, j) => (
                  <div key={j} style={{ fontSize:12, color:C.sub, padding:"3px 0 3px 10px", borderLeft:`2px solid ${i===0?C.accentLight:C.border}` }}>• {item}</div>
                ))}
              </div>
            ))}

            <button onClick={dismiss} style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff", marginTop:8 }}>
              確認しました
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ━━━ 天気ウィジェット ━━━━━━━━━━━━━━━━━━━━━━━
function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [detail, setDetail]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCachedWeather().then(w => { setWeather(w); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ backgroundColor:C.surface, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8, opacity:0.5 }}>
      <span style={{ fontSize:18 }}>🌀</span>
      <span style={{ fontSize:12, color:C.muted }}>天気を取得中...</span>
    </div>
  );

  if (!weather) return null; // APIキー未設定時は非表示

  const meta    = weatherMeta(weather.code);
  const rainMsg = meta.isRainy ? "☔ 雨の日は単価が上がりやすいチャンス！" : null;

  return (
    <>
      <div onClick={() => setDetail(p=>!p)}
        style={{ backgroundColor: meta.isRainy ? C.accentGlow : C.surface, border:`1px solid ${meta.isRainy?C.accentLight+"44":C.border}`, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
        <span style={{ fontSize:26 }}>{meta.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontSize:18, fontWeight:800 }}>{weather.temp}°C</span>
            <span style={{ fontSize:12, color:C.muted }}>{meta.label}</span>
            <span style={{ fontSize:11, color:C.muted }}>📍 {weather.city}</span>
          </div>
          {rainMsg && <div style={{ fontSize:11, color:C.accentLight, fontWeight:700, marginTop:2 }}>{rainMsg}</div>}
        </div>
        <span style={{ fontSize:11, color:C.muted }}>{detail?"▲":"▼"}</span>
      </div>

      {detail && (
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", marginTop:-10, marginBottom:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
            {[
              { label:"体感温度", value:`${weather.feels}°C`, icon:"🌡️" },
              { label:"湿度",     value:`${weather.humidity}%`, icon:"💧" },
              { label:"風速",     value:`${weather.wind}km/h`, icon:"💨" },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ backgroundColor:C.bg, borderRadius:8, padding:"8px 4px" }}>
                <div style={{ fontSize:14 }}>{icon}</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text, marginTop:2 }}>{value}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{label}</div>
              </div>
            ))}
          </div>
          {meta.isRainy && (
            <div style={{ marginTop:10, padding:"8px 12px", backgroundColor:C.accentGlow, borderRadius:8, fontSize:12, color:C.accentLight, fontWeight:600 }}>
              💡 駅周辺・繁華街での待機が効果的です
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ━━━ 翌日発表カード ━━━━━━━━━━━━━━━━━━━━━━━━
function YesterdayCard({ userAreas, rankPrefs, reports }) {
  const [open, setOpen] = useState(false);
  const s = MOCK_YESTERDAY_SUMMARY;
  const myReport = reports.find(r => r.date === s.date);
  const myAreaStats = s.areaStats.filter(a => userAreas.length === 0 || userAreas.includes(a.area));
  const trendIcon = t => t === "up" ? "📈" : t === "down" ? "📉" : "➡️";

  return (
    <div style={{ backgroundColor:C.accentGlow, border:`1.5px solid ${C.accentLight}44`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: open ? 10 : 0 }}>
        <div>
          <div style={{ fontSize:11, color:C.accentLight, fontWeight:700, marginBottom:2 }}>📣 翌日発表 — {s.date}</div>
          <div style={{ fontSize:13, fontWeight:700 }}>{s.totalDrivers}人参加の集計結果</div>
        </div>
        <button onClick={() => setOpen(p => !p)} style={{ backgroundColor:C.accentLight+"22", border:`1px solid ${C.accentLight}44`, borderRadius:8, padding:"5px 12px", color:C.accentLight, fontSize:12, fontWeight:700, cursor:"pointer" }}>
          {open ? "閉じる" : "詳細 →"}
        </button>
      </div>
      {open && (
        <>
          {myReport && rankPrefs.showMyRank && (
            <div style={{ backgroundColor:C.accentLight+"18", border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>あなたの昨日</div>
                  <div style={{ fontSize:20, fontWeight:800 }}>{fmt(s.myResult.sales)}<span style={{ fontSize:11, color:C.muted, marginLeft:3 }}>円</span></div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:22, fontWeight:900, color:C.gold }}>第{s.myResult.rank}位</div>
                  <div style={{ fontSize:10, color:C.muted }}>上位{s.myResult.percentile}%</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>エリア別平均売上</div>
            {(userAreas.length > 0 ? myAreaStats : s.areaStats).map(a => {
              const meta = AREA_MASTER[a.area];
              return (
                <div key={a.area} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:15 }}>{meta?.emoji || "📍"}</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{a.area}</span>
                    <span style={{ fontSize:10, color:C.muted }}>{a.count}人</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{fmt(a.avg)}円</span>
                    <span style={{ fontSize:16 }}>{trendIcon(a.trend)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {rankPrefs.showTopSales && (
            <div>
              <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:8 }}>🏆 昨日のトップ5（匿名）</div>
              {s.topSales.map(t => (
                <div key={t.rank} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:14 }}>{t.badge}</span>
                    <span style={{ fontSize:12, color:C.sub }}>{t.area}</span>
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, color:C.gold }}>{fmt(t.sales)}円</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ━━━ 売上グラフ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SalesChart({ reports }) {
  const recent = [...reports].filter(r => r && r.gross_sales).sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  if (recent.length === 0) return null;
  const maxSales = Math.max(...recent.map(r => r.gross_sales));
  const chartH = 80, barW = 32, gap = 8;
  const totalW = recent.length * (barW + gap) - gap;
  return (
    <Card style={{ padding:"14px 14px 10px", marginBottom:14 }}>
      <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:12 }}>直近{recent.length}日の売上</div>
      <div style={{ overflowX:"auto" }}>
        <svg width={Math.max(totalW, 280)} height={chartH + 42} style={{ display:"block", margin:"0 auto" }}>
          {recent.map((r, i) => {
            const barH = Math.max(4, Math.round((r.gross_sales / maxSales) * chartH));
            const x = i * (barW + gap), y = chartH - barH;
            const isToday = r.date === new Date().toISOString().slice(0, 10);
            const barColor = r.gross_sales >= 65000 ? C.green : r.gross_sales >= 58000 ? C.accentLight : C.orange;
            return (
              <g key={r.id}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill={barColor} opacity={isToday ? 1 : 0.75}/>
                <text x={x+barW/2} y={y-4} textAnchor="middle" fontSize={9} fill={C.sub}>{Math.round(r.gross_sales/1000)}k</text>
                <text x={x+barW/2} y={chartH+16} textAnchor="middle" fontSize={9} fill={isToday?C.accentLight:C.muted} fontWeight={isToday?"bold":"normal"}>{r.date.slice(5).replace("-","/")}</text>
                <text x={x+barW/2} y={chartH+28} textAnchor="middle" fontSize={8} fill={isToday?C.accentLight:C.muted}>{["日","月","火","水","木","金","土"][new Date(r.date).getDay()]}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
        {[{color:C.green,label:"65k以上"},{color:C.accentLight,label:"58〜65k"},{color:C.orange,label:"58k未満"}].map(({color,label})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:2, backgroundColor:color, opacity:0.8 }}/>
            <span style={{ fontSize:9, color:C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ━━━ 直近日報リスト ━━━━━━━━━━━━━━━━━━━━━━━━━━
function RecentReports({ reports, onOpenReport, simple }) {
  const recent = [...reports].filter(r => r && r.gross_sales).sort((a,b) => b.date.localeCompare(a.date)).slice(0, simple ? 2 : 3);
  if (recent.length === 0) return null;
  const avg = reports.length ? Math.round(reports.reduce((s,x) => s + x.gross_sales, 0) / reports.length) : 0;

  return (
    <div>
      <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:10 }}>直近の日報</div>
      {recent.map(r => {
        const or = occ(r), oc = or >= 55 ? C.green : or >= 45 ? C.gold : C.red;
        const diff = r.gross_sales - avg;
        return (
          <div key={r.id} onClick={() => onOpenReport(r)}
            style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding: simple ? "16px 16px" : "12px 14px", marginBottom:8, cursor:"pointer" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cardHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.card}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize: simple ? 12 : 10, color:C.muted }}>{r.date}（{dow(r.date)}）</div>
                <div style={{ fontSize: simple ? 28 : 20, fontWeight:900, marginTop:2 }}>
                  {fmt(r.gross_sales)}<span style={{ fontSize: simple ? 14 : 10, color:C.muted, marginLeft:2 }}>円</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <Badge color={oc} size={simple ? 12 : 10}>実車率 {or}%</Badge>
                <div style={{ fontSize: simple ? 13 : 10, color:diff >= 0 ? C.green : C.red, marginTop:4, fontWeight:700 }}>
                  {diff >= 0 ? "+" : ""}{fmt(diff)}円
                </div>
              </div>
            </div>
            {!simple && (
              <div style={{ display:"flex", gap:10, fontSize:10, color:C.muted, marginTop:6 }}>
                <span>🚗 {r.ride_count}回</span>
                <span>⏱ {fmt(hourly(r))}円/h</span>
                {r.ai_comment && <span style={{ color:C.accentLight }}>💬 AIコメントあり</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ━━━ XP・ミッションカード（折りたたみ対応） ━━━
function XpCard({ user }) {
  const [open, setOpen] = useState(false);
  const xpData = levelFromXp(user.xp || 0);
  const title = getTitle(xpData.level);
  const missionState = getMissionState();
  const completedCount = missionState.completed.length;

  return (
    <Card style={{ marginBottom:14, padding:"12px 16px" }}>
      <div onClick={() => setOpen(p => !p)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:`conic-gradient(${title.color} ${xpData.progress}%, ${C.border} 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:"50%", backgroundColor:C.card, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
            <span style={{ fontSize:7, color:C.muted, lineHeight:1 }}>Lv</span>
            <span style={{ fontSize:13, fontWeight:900, color:title.color, lineHeight:1.1 }}>{xpData.level}</span>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span style={{ fontSize:12, fontWeight:700, color:title.color }}>{title.name}</span>
            <span style={{ fontSize:10, color:C.muted }}>次まで {xpData.xpForNext - xpData.xpInLevel} XP</span>
          </div>
          <div style={{ backgroundColor:C.border, borderRadius:99, height:4, overflow:"hidden" }}>
            <div style={{ width:`${xpData.progress}%`, height:"100%", backgroundColor:title.color, borderRadius:99 }}/>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:800 }}>{user.xp || 0}</div>
            <div style={{ fontSize:9, color:C.muted }}>総XP</div>
          </div>
          <span style={{ fontSize:11, color:C.muted }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginTop:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.muted }}>📋 デイリーミッション</span>
            <span style={{ fontSize:10, color:completedCount===MISSIONS.length ? C.green : C.muted }}>
              {completedCount}/{MISSIONS.length}{completedCount===MISSIONS.length ? " ✨ +30ボーナス!" : ""}
            </span>
          </div>
          {MISSIONS.map(m => {
            const done = missionState.completed.includes(m.id);
            return (
              <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0" }}>
                <span style={{ fontSize:14, opacity:done?1:0.4 }}>{m.icon}</span>
                <span style={{ flex:1, fontSize:12, color:done?C.text:C.muted, textDecoration:done?"line-through":"none" }}>{m.name}</span>
                <span style={{ fontSize:10, fontWeight:700, color:done?C.green:C.muted }}>+{m.xp} XP</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ━━━ AIアドバイスカード ━━━━━━━━━━━━━━━━━━━━━━━
function AiAdviceCard({ reports, appMode }) {
  const count = reports.length;
  const needed = Math.max(0, 3 - count);

  // データ不足の場合：あと何回か表示（3回未満）
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

  // データから簡易インサイトを計算
  const sorted   = [...reports].sort((a,b)=>b.gross_sales-a.gross_sales);
  const bestDay  = sorted[0];
  const avgSales = Math.round(reports.reduce((s,r)=>s+(r.gross_sales||0),0)/reports.length);
  const avgHourly= Math.round(reports.reduce((s,r)=>s+(r.gross_sales&&r.work_hours?(r.gross_sales/r.work_hours):0),0)/reports.length);
  const DAYS_JA  = ["日","月","火","水","木","金","土"];
  const bestDow  = bestDay ? DAYS_JA[new Date(bestDay.date).getDay()] : "";

  // かんたんモード：シンプル一言カード
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

  // 通常・分析モード：ボタンカード
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

      {/* 簡易インサイト */}
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

// ━━━ 月間カレンダー ━━━━━━━━━━━━━━━━━━━━━━━━━━
function MonthCalendar({ reports, monthTarget }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=日
  const DAYS = ["日","月","火","水","木","金","土"];

  // reports を日付 → 売上 のマップに
  const byDate = {};
  reports.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + (r.gross_sales || 0); });

  const targetPerDay = monthTarget / daysInMonth;

  const cellColor = (sales) => {
    if (!sales) return null;
    if (sales >= 65000) return C.green;
    if (sales >= targetPerDay) return C.accentLight;
    if (sales >= 50000) return C.gold;
    return C.orange;
  };

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card style={{ marginBottom:14, padding:"12px 14px" }}>
      <div onClick={()=>setOpen(p=>!p)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", marginBottom: open ? 14 : 0 }}>
        <div style={{ fontSize:13, fontWeight:700 }}>📅 {month+1}月 実績カレンダー</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", gap:6 }}>
            {[{c:C.green,l:"65k↑"},{c:C.accentLight,l:"目標↑"},{c:C.gold,l:"50k↑"},{c:C.orange,l:"低"}].map(({c,l})=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <div style={{ width:7, height:7, borderRadius:2, backgroundColor:c }}/>
                <span style={{ fontSize:9, color:C.muted }}>{l}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize:11, color:C.muted }}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open && (
        <>
          {/* 曜日ヘッダー */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
            {DAYS.map((d,i)=>(
              <div key={d} style={{ textAlign:"center", fontSize:10, color: i===0?C.red:i===6?C.accentLight:C.muted, fontWeight:700, paddingBottom:4 }}>{d}</div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i}/>;
              const dateStr  = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const sales    = byDate[dateStr];
              const color    = cellColor(sales);
              const isToday  = d === today.getDate();
              const isFuture = d > today.getDate();
              return (
                <div key={i} style={{
                  borderRadius: 6,
                  padding: "5px 2px",
                  textAlign: "center",
                  backgroundColor: color ? color + "22" : isFuture ? "transparent" : C.surface,
                  border: isToday ? `2px solid ${C.accentLight}` : `1px solid ${color ? color+"55" : C.border}`,
                  opacity: isFuture ? 0.4 : 1,
                }}>
                  <div style={{ fontSize:10, color: isToday ? C.accentLight : C.muted, fontWeight: isToday ? 800 : 400 }}>{d}</div>
                  {sales ? (
                    <div style={{ fontSize:8, color: color, fontWeight:700, marginTop:1, lineHeight:1.1 }}>
                      {Math.round(sales/1000)}k
                    </div>
                  ) : (
                    <div style={{ fontSize:8, color:C.border, marginTop:1 }}>—</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 月間サマリー */}
          <div style={{ marginTop:12, padding:"10px 12px", backgroundColor:C.bg, borderRadius:8, display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted }}>
            <span>記録日数: <b style={{ color:C.text }}>{Object.keys(byDate).filter(d=>d.startsWith(`${year}-${String(month+1).padStart(2,"0")}`)).length}日</b></span>
            <span>日平均: <b style={{ color:C.text }}>{fmt(Object.values(byDate).length ? Math.round(Object.values(byDate).reduce((a,b)=>a+b,0)/Object.values(byDate).length) : 0)}円</b></span>
          </div>
        </>
      )}
    </Card>
  );
}

// ━━━ Dashboard メイン ━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Dashboard({ reports, user, onOpenReport, onManageArea, rankPrefs = { showMyRank:false, showTopSales:false }, appMode = "standard" }) {
  const monthReports = reports.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === THIS_YEAR && d.getMonth() + 1 === THIS_MONTH;
  });

  const monthTotal    = monthReports.reduce((s,r) => s + (r.gross_sales || 0), 0);
  const monthTarget   = parseInt(user.target) || 380000;
  const achievement   = monthTarget > 0 ? Math.round((monthTotal / monthTarget) * 100) : 0;
  const avgSales      = monthReports.length ? Math.round(monthTotal / monthReports.length) : 0;
  const avgOcc        = monthReports.length ? Math.round(monthReports.reduce((s,r) => s + occ(r), 0) / monthReports.length) : 0;
  const remaining     = FREE_LIMIT - (user.uploadCount || 0);
  const takePay       = loadS("taxi_takepay", { rate:55, deduction:30000 });
  const estimatedTake = Math.max(0, Math.round(monthTotal * takePay.rate / 100 - takePay.deduction));
  const achColor      = achievement >= 100 ? C.green : achievement >= 80 ? C.gold : achievement >= 60 ? C.orange : C.red;

  const isSimple   = appMode === "simple";
  const isAnalysis = appMode === "analysis";

  // ── 残りシフト・1本必要額 ──
  const today         = new Date();
  const daysInMonth   = new Date(THIS_YEAR, THIS_MONTH, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - today.getDate());
  const shiftsPerDay  = (user.workType === "隔日勤務") ? 0.5 : 0.75;
  const remainingShifts = Math.round(remainingDays * shiftsPerDay);
  const remainingAmount = Math.max(0, monthTarget - monthTotal);
  const neededPerShift  = remainingShifts > 0 ? Math.round(remainingAmount / remainingShifts) : 0;

  // ━━━ かんたんモード ━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isSimple) {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
        <UpdateBanner />
        <AreaFilterBanner userAreas={user.areas || []} onManage={onManageArea} />
        <WeatherWidget />

        {/* 売上メインカード（大きな文字） */}
        <Card style={{ marginBottom:14, padding:"24px 20px", borderColor:C.gold+"33" }}>
          <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>今月の総売上</div>
          <div style={{ fontSize:52, fontWeight:900, color:C.text, lineHeight:1.1 }}>
            {fmt(monthTotal)}<span style={{ fontSize:20, color:C.muted, marginLeft:6 }}>円</span>
          </div>
          <div style={{ fontSize:15, color:C.muted, marginTop:8 }}>
            目標 {fmt(monthTarget)}円
            <span style={{ color:achColor, fontWeight:700, marginLeft:8 }}>達成率 {achievement}%</span>
          </div>
          <ProgressBar value={Math.min(achievement, 100)} max={100} color={achColor} height={10} style={{ marginTop:12 }} />

          {/* 残り目標 + シフト情報 */}
          <div style={{ marginTop:16, padding:"14px 0 0", borderTop:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>残り目標</div>
            <div style={{ fontSize:34, fontWeight:900, color:achColor }}>
              {monthTotal >= monthTarget
                ? <span style={{ color:C.green }}>達成！🎉</span>
                : <>{fmt(monthTarget - monthTotal)}<span style={{ fontSize:16, marginLeft:4 }}>円</span></>
              }
            </div>
            {monthTotal < monthTarget && remainingShifts > 0 && (
              <div style={{ display:"flex", gap:12, marginTop:12 }}>
                <div style={{ flex:1, backgroundColor:C.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>残りシフト</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.text }}>{remainingShifts}<span style={{ fontSize:12, marginLeft:2 }}>回</span></div>
                </div>
                <div style={{ flex:1, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>1本あたり必要</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>{fmt(neededPerShift)}<span style={{ fontSize:12, marginLeft:2 }}>円</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* カレンダー */}
        <MonthCalendar reports={monthReports} monthTarget={monthTarget} />

        {/* XP（コンパクト・折りたたみ） */}
        <XpCard user={user} />

        {/* AIアドバイス */}
        <AiAdviceCard reports={monthReports} appMode={appMode} />

        {/* 直近日報（大きめ表示） */}
        {reports.length > 0 ? (
          <RecentReports reports={reports} onOpenReport={onOpenReport} simple={true} />
        ) : (
          <Card style={{ textAlign:"center", padding:32 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📄</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>日報をアップロードしよう</div>
            <div style={{ fontSize:14, color:C.muted }}>日報を登録すると売上が表示されます</div>
          </Card>
        )}
      </div>
    );
  }

  // ━━━ 通常・分析モード ━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <UpdateBanner />
      <AreaFilterBanner userAreas={user.areas || []} onManage={onManageArea} />
      <WeatherWidget />

      {/* ① 売上サマリー（最上位） */}
      <Card style={{ marginBottom:14, borderColor:C.gold+"33" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>今月の総売上</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text }}>
              {fmt(monthTotal)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
              目標 {fmt(monthTarget)}円
              <span style={{ color:achColor, fontWeight:700, marginLeft:6 }}>達成率 {achievement}%</span>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>残り目標</div>
            <div style={{ fontSize:18, fontWeight:800, color:achColor }}>
              {monthTotal >= monthTarget
                ? <span style={{ color:C.green }}>達成！🎉</span>
                : `${fmt(monthTarget - monthTotal)}円`}
            </div>
          </div>
        </div>
        <ProgressBar value={Math.min(achievement, 100)} max={100} color={achColor} height={8} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginTop:5 }}>
          <span>{THIS_MONTH}月 {monthReports.length}件入力済み</span>
          <span>{achievement}%</span>
        </div>

        {/* 残りシフト・1本必要額 */}
        {monthTotal < monthTarget && remainingShifts > 0 && (
          <div style={{ display:"flex", gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            <div style={{ flex:1, backgroundColor:C.bg, borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>残りシフト(推定)</div>
              <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{remainingShifts}<span style={{ fontSize:10, marginLeft:2 }}>回</span></div>
            </div>
            <div style={{ flex:1, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>1本あたり必要</div>
              <div style={{ fontSize:18, fontWeight:900, color:C.accentLight }}>{fmt(neededPerShift)}<span style={{ fontSize:10, marginLeft:2 }}>円</span></div>
            </div>
            <div style={{ flex:1, backgroundColor:C.surface, borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>残り日数</div>
              <div style={{ fontSize:18, fontWeight:900, color:C.sub }}>{remainingDays}<span style={{ fontSize:10, marginLeft:2 }}>日</span></div>
            </div>
          </div>
        )}
        {monthTotal >= monthTarget && (
          <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, textAlign:"center", fontSize:16, fontWeight:800, color:C.green }}>
            🎉 今月の目標達成！
          </div>
        )}

        {monthTotal > 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize:11, color:C.muted }}>推定手取り（歩合{takePay.rate}%）</div>
              <div style={{ fontSize:22, fontWeight:800, color:C.green }}>約 {fmt(estimatedTake)}<span style={{ fontSize:12, marginLeft:2 }}>円</span></div>
            </div>
            <div style={{ fontSize:10, color:C.muted, textAlign:"right" }}>
              <div>控除 {fmt(takePay.deduction)}円</div>
              <div style={{ marginTop:2 }}>設定 › 手取り設定</div>
            </div>
          </div>
        )}
      </Card>

      {/* カレンダー */}
      <MonthCalendar reports={monthReports} monthTarget={monthTarget} />

      {/* ② KPI グリッド */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <KpiCard label="平均売上"   value={fmt(avgSales)} unit="円" accent={C.accentLight} />
        <KpiCard label="平均実車率" value={avgOcc}         unit="%" accent={avgOcc >= 55 ? C.green : avgOcc >= 45 ? C.gold : C.orange} />
        <KpiCard label="無料残り"   value={remaining}      unit="件" accent={remaining <= 1 ? C.red : C.gold} />
      </div>

      {/* ③ XP・ミッション（折りたたみ） */}
      <XpCard user={user} />

      {/* ④ 翌日発表（分析モードのみ常に展開、通常は折りたたみ） */}
      <YesterdayCard userAreas={user.areas || []} rankPrefs={rankPrefs} reports={reports} />

      {/* ⑤ 売上グラフ */}
      <SalesChart reports={reports} />

      {/* ⑥ AIアドバイス（3件以上でモード別表示） */}
      <AiAdviceCard reports={monthReports} appMode={appMode} />

      {/* ⑦ 直近日報 */}
      <RecentReports reports={reports} onOpenReport={onOpenReport} simple={false} />

      {reports.length === 0 && (
        <Card style={{ textAlign:"center", padding:28, marginTop:8 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📄</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>日報をアップロードしよう</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>日報を登録すると、売上グラフや<br/>AI分析コメントが表示されます</div>
        </Card>
      )}
    </div>
  );
}
