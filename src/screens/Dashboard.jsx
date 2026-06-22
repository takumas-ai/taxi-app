// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard.jsx — ダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, fmt, occ, dow, hourly, FREE_LIMIT, loadS, saveS, getClosingPeriod } from "../lib/constants";
import { Card, Btn, ProgressBar, Badge, KpiCard } from "../components/UI";
import { MOCK_YESTERDAY_SUMMARY, AREA_MASTER } from "../data/mockData";
import { levelFromXp, getTitle, MISSIONS, getMissionState } from "../lib/xp";
import { CURRENT_VERSION, CHANGELOG } from "../lib/changelog";
import { getCachedWeather, weatherMeta } from "../lib/weather";
import { SalesPointCard } from "../components/SalesPointCard";
import BreakTimeCard from "../components/dashboard/BreakTimeCard";
import AiAdviceCard from "../components/dashboard/AiAdviceCard";
import { ShiftSummaryCard } from "../components/dashboard/ShiftCalendar";
import { fetchShifts } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ━━━ 更新通知バナー ━━━━━━━━━━━━━━━━━━━━━━━━
export function UpdateBanner() {
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

// ━━━ ランキング新着バナー（通知ONのユーザーのみ） ━━
// 集計が出た日だけホームに小さく表示。タップでランキング画面へ。
export function RankingNoticeBanner({ onGoRanking }) {
  const s = MOCK_YESTERDAY_SUMMARY;
  return (
    <div onClick={onGoRanking}
      style={{ display:"flex", alignItems:"center", gap:10, backgroundColor:C.accentGlow, border:`1.5px solid ${C.accentLight}44`, borderRadius:12, padding:"10px 14px", marginBottom:14, cursor:"pointer" }}>
      <span style={{ fontSize:20 }}>🏆</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:C.accentLight, fontWeight:700 }}>集計結果が出ました</div>
        <div style={{ fontSize:12, color:C.text }}>{s.date} 分 · {s.totalDrivers}人参加</div>
      </div>
      <span style={{ fontSize:13, color:C.accentLight, fontWeight:700 }}>見る →</span>
    </div>
  );
}

// ━━━ 売上グラフ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SalesChart({ reports }) {
  const recent = [...reports].filter(r => r && r.gross_sales && r.date).sort((a,b) => (a.date||"").localeCompare(b.date||"")).slice(-7);
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

// ━━━ シフト表カード ━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━ XP・ミッションカード（折りたたみ対応） ━━━
function XpCard({ user }) {
  const [open, setOpen] = useState(false);
  const xpData = levelFromXp(user.xp || 0);
  const title = getTitle(xpData.level);
  const missionState = getMissionState();
  const completedCount = missionState.completed.length;

  return (
    <Card style={{ marginBottom:14, padding:"6px 14px" }}>
      <div onClick={() => setOpen(p => !p)} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:`conic-gradient(${title.color} ${xpData.progress}%, ${C.border} 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <div style={{ width:20, height:20, borderRadius:"50%", backgroundColor:C.card, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
            <span style={{ fontSize:5, color:C.muted, lineHeight:1 }}>Lv</span>
            <span style={{ fontSize:10, fontWeight:900, color:title.color, lineHeight:1.1 }}>{xpData.level}</span>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
            <span style={{ fontSize:11, fontWeight:700, color:title.color }}>{title.name}</span>
            <span style={{ fontSize:9, color:C.muted }}>次まで {xpData.xpForNext - xpData.xpInLevel} XP</span>
          </div>
          <div style={{ backgroundColor:C.border, borderRadius:99, height:3, overflow:"hidden" }}>
            <div style={{ width:`${xpData.progress}%`, height:"100%", backgroundColor:title.color, borderRadius:99 }}/>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, fontWeight:800 }}>{user.xp || 0} XP</div>
          </div>
          <span style={{ fontSize:10, color:C.muted }}>{open ? "▲" : "▼"}</span>
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

// ━━━ 分析モード：今日の売上＆着地予想 ━━━━━━━━━━
function AnalysisTodayCard({ reports }) {
  // 集計表示のON/OFF（ユーザー選択を永続保存）
  const [show, setShow] = useState(() => loadS("taxi_analysis_today_show", true));
  const toggle = () => setShow(p => { saveS("taxi_analysis_today_show", !p); return !p; });

  const today = new Date().toISOString().slice(0, 10);
  const todayReport = reports.find(r => r.date === today);
  const todaySales = todayReport?.gross_sales ?? 0;

  // 着地予想：過去の平均単価 × 想定営業回数
  const withSales = reports.filter(r => r.gross_sales > 0 && r.ride_count > 0);
  const avgPerRide = withSales.length
    ? Math.round(withSales.reduce((s,r) => s + r.gross_sales / r.ride_count, 0) / withSales.length)
    : 0;
  const avgRideCount = withSales.length
    ? Math.round(withSales.reduce((s,r) => s + r.ride_count, 0) / withSales.length)
    : 0;
  const landingForecast = avgPerRide > 0 && avgRideCount > 0 ? avgPerRide * avgRideCount : 0;

  return (
    <div style={{ marginBottom:14 }}>
      {/* ヘッダー：タイトル＋表示切替ボタン */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted }}>📊 本日の営業状況</div>
        <button onClick={toggle} style={{ fontSize:10, color:show?C.muted:C.accentLight, background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 10px", cursor:"pointer" }}>
          {show ? "非表示" : "表示"}
        </button>
      </div>

      {show && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {/* 本日の売上 */}
          <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 14px" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>本日の売上（税抜き）</div>
            {todaySales > 0 ? (
              <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>
                {fmt(todaySales)}<span style={{ fontSize:11, marginLeft:2 }}>円</span>
              </div>
            ) : (
              <div style={{ fontSize:13, color:C.muted, fontWeight:600 }}>未入力</div>
            )}
            {todayReport?.ride_count > 0 && (
              <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>{todayReport.ride_count}回営業</div>
            )}
          </div>

          {/* 着地予想 */}
          <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:12, padding:"14px 14px" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>着地予想（税抜き）</div>
            {landingForecast > 0 ? (
              <>
                <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>
                  {fmt(landingForecast)}<span style={{ fontSize:11, marginLeft:2 }}>円</span>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>
                  平均単価{fmt(avgPerRide)}×{avgRideCount}回ペース
                </div>
              </>
            ) : (
              <div style={{ fontSize:13, color:C.muted, fontWeight:600 }}>データ不足</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ 月間目標クイック編集モーダル ━━━━━━━━━━━━━━
function TargetEditModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(current ? String(current) : "");
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ backgroundColor:C.surface, borderRadius:18, width:"100%", maxWidth:340, padding:24 }}>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:6 }}>🎯 月間目標を設定</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>達成率・必要売上の計算に使用されます</div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
          <input
            type="number"
            inputMode="numeric"
            value={val}
            onChange={e=>setVal(e.target.value)}
            autoFocus
            style={{ flex:1, padding:"13px 14px", borderRadius:11, border:`1.5px solid ${C.accentLight}`, backgroundColor:C.bg, color:C.text, fontSize:18, fontWeight:700, outline:"none" }}
          />
          <span style={{ fontSize:14, color:C.muted }}>円</span>
        </div>
        {/* クイック選択 */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {[300000,350000,380000,400000,450000,500000].map(v => (
            <button key={v} onClick={()=>setVal(String(v))}
              style={{ padding:"6px 10px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                border:`1.5px solid ${String(v)===val ? C.accentLight : C.border}`,
                backgroundColor: String(v)===val ? C.accentGlow : "transparent",
                color: String(v)===val ? C.accentLight : C.muted }}>
              {v/10000}万
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"12px 0", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted }}>
            キャンセル
          </button>
          <button onClick={()=>{ onSave(parseInt(val,10)||0); onClose(); }}
            style={{ flex:2, padding:"12px 0", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}>
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━ Dashboard メイン ━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Dashboard({ reports, user, onOpenReport, onManageArea, rankPrefs = { showMyRank:false, showTopSales:false }, appMode = "standard", onGoShift, onUpdateReport, onGoRanking, onUpdateUser }) {
  const { start: periodStart, end: periodEnd } = getClosingPeriod(user?.closing_day ?? 0);
  const monthReports = reports.filter(r => r.date >= periodStart && r.date <= periodEnd);

  const [showTargetEdit, setShowTargetEdit] = useState(false);
  // シフトデータ（localStorage初期値 + Supabaseから非同期同期）
  const [calShifts, setCalShifts] = useState(() => loadS("taxi_shifts", []));
  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) return;
    fetchShifts(user.id).then(({ data }) => {
      if (!data?.length) return;
      const mapped = data.map(s => ({
        id:       s.id || ("sb_" + s.shift_date),
        date:     s.shift_date,
        clockIn:  s.clock_in  || "",
        clockOut: s.clock_out || "",
        isNight:  s.is_night  || false,
        note:     s.note      || "",
      }));
      setCalShifts(mapped);
      saveS("taxi_shifts", mapped);
    });
  }, [user?.id]);

  const monthTotal    = monthReports.reduce((s,r) => s + (r.gross_sales || 0), 0);
  const monthTarget   = parseInt(user.target) || 0;  // 0 = 未設定
  const hasTarget     = monthTarget > 0;
  const achievement   = hasTarget ? Math.round((monthTotal / monthTarget) * 100) : 0;
  const avgSales      = monthReports.length ? Math.round(monthTotal / monthReports.length) : 0;
  const avgOcc        = monthReports.length ? Math.round(monthReports.reduce((s,r) => s + occ(r), 0) / monthReports.length) : 0;
  const remaining     = FREE_LIMIT - (user.uploadCount || 0);
  const takePay       = loadS("taxi_takepay", { rate:55, deduction:30000 });
  const estimatedTake = Math.max(0, Math.round(monthTotal * takePay.rate / 100 - takePay.deduction));
  const achColor      = achievement >= 100 ? C.green : achievement >= 80 ? C.gold : achievement >= 60 ? C.orange : C.red;

  const isSimple      = appMode === "simple" || appMode === "simple_large";
  const isSimpleLarge = appMode === "simple_large";
  const isAnalysis    = appMode === "analysis";

  // ── 乗車記録サマリー（税込/税抜） ──
  const totalRideCount = monthReports.reduce((s,r) => s + (r.ride_count || 0), 0);
  const totalSalesInc  = monthTotal; // 税込
  const totalSalesExc  = Math.round(monthTotal / 1.1); // 税抜（10%消費税）

  // ── 今月の残り出番・今日必要な売上（締日ベース） ──
  const today         = new Date();
  // periodEnd は "YYYY-MM-DD" 文字列。締日の23:59:59まで残り日数を計算
  const periodEndDate = new Date(periodEnd + "T23:59:59");
  const remainingDays = Math.max(0, Math.ceil((periodEndDate - today) / (1000 * 60 * 60 * 24)));
  // 今日の日付文字列（ローカル）
  const _todayYMD = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  // カレンダーに登録されたシフトから残り出番を計算。未登録時は従来の推定式にフォールバック
  const _periodShifts = calShifts.filter(s => s.date >= periodStart && s.date <= periodEnd);
  const _remainingCalShifts = _periodShifts.filter(s => s.date > _todayYMD).length;
  const shiftsPerDay  = (user.workType === "隔日勤務") ? 0.5 : 0.75;
  const remainingShifts = _periodShifts.length > 0
    ? _remainingCalShifts
    : Math.round(remainingDays * shiftsPerDay);
  const remainingAmount = Math.max(0, monthTarget - monthTotal);
  // 今日必要な売上 = 残り目標額 ÷ 残り出番日数（税抜き表示）
  const neededPerShift  = remainingShifts > 0 ? Math.round(remainingAmount / remainingShifts) : 0;
  const neededToday     = remainingDays > 0 ? Math.round(remainingAmount / remainingDays) : 0;

  // ── 今日の売り上げカード（カレンダー直下） ──
  // ※ toISOString()はUTCなので、ローカル日付を使用する
  const _todayLocal = new Date();
  const todayStr = `${_todayLocal.getFullYear()}-${String(_todayLocal.getMonth()+1).padStart(2,"0")}-${String(_todayLocal.getDate()).padStart(2,"0")}`;
  const todayReport   = reports.find(r => r.date === todayStr);
  const todayRides    = todayReport?.rides || [];
  const todayHighway  = Number(todayReport?.highway_fee || 0);

  // rides個票がある場合はそちらから集計、なければ日報のgross_salesを使用
  let todayTaxInc, todayTaxExc, todayRideCount;
  if (todayRides.length > 0) {
    const ridesTotal  = todayRides.reduce((s, r) => s + (r.amount || 0), 0);
    todayTaxInc       = ridesTotal + todayHighway;
    todayTaxExc       = Math.round(ridesTotal / 1.1);
    todayRideCount    = todayRides.length;
  } else if (todayReport) {
    todayTaxInc       = todayReport.gross_sales || 0;
    todayTaxExc       = Math.round((todayTaxInc - todayHighway) / 1.1);
    todayRideCount    = todayReport.ride_count || 0;
  } else {
    todayTaxInc = 0; todayTaxExc = 0; todayRideCount = 0;
  }

  // 乗車記録カード（SalesPointCard）から今日の個別記録を取得して統合
  const todaySalesRecs = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]");
      return all.filter(r => {
        const d = r.workDate || (r.timestamp ? r.timestamp.slice(0,10) : "");
        return d === todayStr;
      });
    } catch { return []; }
  })();
  const todaySalesCount = todaySalesRecs.length;
  const todaySalesTotal = todaySalesRecs.reduce((s, r) => s + (r.fare || r.amount || 0), 0);

  const MonthlyStatsCard = () => {
    const [open, setOpen] = useState(false);
    const hasReport = todayTaxInc > 0 || todayRideCount > 0;
    const hasRecs   = todaySalesCount > 0;
    const hasData   = hasReport || hasRecs;

    // ヘッダーに表示する回数（乗車記録カードの件数を優先）
    const displayCount = hasRecs ? todaySalesCount : todayRideCount;

    return (
      <Card style={{ marginBottom:14, padding:0, overflow:"hidden" }}>
        <div onClick={() => setOpen(p => !p)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", cursor:"pointer" }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>🚕 今日の売り上げ</span>
          {hasData
            ? <span style={{ fontSize:11, color:C.accentLight, fontWeight:700 }}>{displayCount}回</span>
            : <span style={{ fontSize:11, color:C.muted }}>記録なし</span>
          }
          <span style={{ fontSize:10, color:C.muted }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && hasData && (
          <div style={{ borderTop:`1px solid ${C.border}` }}>
            {/* 日報ベースの売上（税抜のみ・高速代除外） */}
            {hasReport && (
              <>
                <div style={{ textAlign:"center", padding:"16px 14px" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>売上（税抜 / 高速代除く）</div>
                  <div style={{ fontSize:28, fontWeight:900, color:C.text }}>{fmt(todayTaxExc)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span></div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:`1px solid ${C.border}` }}>
                  {[
                    { label:"乗車回数", value:todayRideCount, unit:"回", color:C.accentLight },
                    { label:"走行距離", value:todayReport?.total_distance || 0, unit:"km", color:C.text },
                    { label:"勤務時間", value:todayReport?.work_hours || 0, unit:"h", color:C.text },
                  ].map(({label,value,unit,color},i) => (
                    <div key={i} style={{ textAlign:"center", padding:"10px 4px", borderRight:i<2?`1px solid ${C.border}`:"none" }}>
                      <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:14, fontWeight:900, color }}>{value}<span style={{ fontSize:9, color:C.muted, marginLeft:1 }}>{unit}</span></div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* 乗車記録カードの今日の記録 */}
            {hasRecs && (
              <div style={{ borderTop: hasReport ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display:"flex" }}>
                  <div style={{ flex:1, textAlign:"center", padding:"12px 4px" }}>
                    <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>乗車記録 合計</div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>{fmt(todaySalesTotal)}<span style={{ fontSize:10, color:C.muted }}>円</span></div>
                  </div>
                  <div style={{ width:1, backgroundColor:C.border }}/>
                  <div style={{ flex:1, textAlign:"center", padding:"12px 4px" }}>
                    <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>乗車記録 件数</div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.accentLight }}>{todaySalesCount}<span style={{ fontSize:10, color:C.muted }}>件</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  const targetEditModal = showTargetEdit && (
    <TargetEditModal
      current={monthTarget}
      onSave={v => onUpdateUser?.({ ...user, target: String(v) })}
      onClose={() => setShowTargetEdit(false)}
    />
  );

  // ━━━ かんたんモード ━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isSimple) {
    return (
      <div style={{ maxWidth:600, margin:"0 auto", padding: isSimpleLarge ? "16px 10px 100px" : "16px 16px 100px", zoom: isSimpleLarge ? 1.32 : 1 }}>
        {/* ① レベル欄 */}
        <XpCard user={user} />

        {/* ② シフト表（カレンダー） */}
        <ShiftSummaryCard reports={monthReports} monthTarget={monthTarget} user={user} onOpenReport={onOpenReport} onGoShift={onGoShift} />

        {/* ③ 月次統計（カレンダー直下、折りたたみ） */}
        <MonthlyStatsCard />

        <WeatherWidget />

        {/* 営業ポイント記録 */}
        <SalesPointCard user={user} />

        {/* 休憩時間 */}
        <BreakTimeCard reports={reports} onUpdateReport={onUpdateReport} />

        {/* 売上メインカード（大きな文字） */}
        <Card style={{ marginBottom:14, padding:"24px 20px", borderColor:C.gold+"33" }}>
          <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>今月の総売上（税抜）</div>
          <div style={{ fontSize:52, fontWeight:900, color:C.text, lineHeight:1.1 }}>
            {fmt(monthTotal)}<span style={{ fontSize:20, color:C.muted, marginLeft:6 }}>円</span>
          </div>
          <div style={{ fontSize:15, color:C.muted, marginTop:8, display:"flex", alignItems:"center", gap:10 }}>
            <span onClick={()=>setShowTargetEdit(true)}
              style={{ cursor:"pointer", borderBottom:`1px dashed ${C.border}`,
                color: hasTarget ? C.muted : C.accentLight, fontWeight: hasTarget ? 400 : 700 }}>
              {hasTarget ? `目標 ${fmt(monthTarget)}円` : "🎯 目標を設定する"}
            </span>
            {hasTarget && <span style={{ color:achColor, fontWeight:700 }}>達成率 {achievement}%</span>}
          </div>
          {hasTarget && <ProgressBar value={Math.min(achievement, 100)} max={100} color={achColor} height={10} style={{ marginTop:12 }} />}

          {/* 残り目標 + シフト情報 */}
          <div style={{ marginTop:16, padding:"14px 0 0", borderTop:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>残り目標</div>
            <div style={{ fontSize:34, fontWeight:900, color:achColor }}>
              {monthTotal >= monthTarget
                ? <span style={{ color:C.green }}>達成！🎉</span>
                : <>{fmt(monthTarget - monthTotal)}<span style={{ fontSize:16, marginLeft:4 }}>円</span></>
              }
            </div>
            {hasTarget && monthTotal < monthTarget && remainingShifts > 0 && (
              <div style={{ display:"flex", gap:12, marginTop:12 }}>
                <div style={{ flex:1, backgroundColor:C.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>今月の残り出番</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.text }}>{remainingShifts}<span style={{ fontSize:12, marginLeft:2 }}>回</span></div>
                </div>
                <div style={{ flex:1, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>目標まで1出番あたり<span style={{ fontSize:8, marginLeft:2 }}>(税抜)</span></div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>{fmt(neededPerShift)}<span style={{ fontSize:12, marginLeft:2 }}>円</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* AIアドバイス */}
        <AiAdviceCard reports={monthReports} appMode={appMode} />

        {targetEditModal}
      </div>
    );
  }

  // ━━━ 通常・分析モード ━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>
      {/* ① レベル欄 */}
      <XpCard user={user} />

      {/* ② シフト表（カレンダー） */}
      <ShiftSummaryCard reports={reports} monthTarget={monthTarget} user={user} onOpenReport={onOpenReport} onGoShift={onGoShift} />

      {/* ③ 月次統計（カレンダー直下、折りたたみ） */}
      <MonthlyStatsCard />

      <WeatherWidget />

      {/* 営業ポイント記録 */}
      <SalesPointCard user={user} />

      {/* 休憩時間 */}
      <BreakTimeCard reports={reports} onUpdateReport={onUpdateReport} />

      {/* ① 売上サマリー（最上位） */}
      <Card style={{ marginBottom:14, borderColor:C.gold+"33" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>今月の総売上（税抜）</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text }}>
              {fmt(monthTotal)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4, display:"flex", alignItems:"center", gap:8 }}>
              <span onClick={()=>setShowTargetEdit(true)}
                style={{ cursor:"pointer", borderBottom:`1px dashed ${C.border}`,
                  color: hasTarget ? C.muted : C.accentLight, fontWeight: hasTarget ? 400 : 700 }}>
                {hasTarget ? `目標 ${fmt(monthTarget)}円` : "🎯 目標を設定する"}
              </span>
              {hasTarget && <span style={{ color:achColor, fontWeight:700 }}>達成率 {achievement}%</span>}
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
        {hasTarget && <>
          <ProgressBar value={Math.min(achievement, 100)} max={100} color={achColor} height={8} />
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginTop:5 }}>
            <span>{new Date().getMonth()+1}月 {monthReports.length}件入力済み</span>
            <span>{achievement}%</span>
          </div>
        </>}

        {/* 残りシフト・1本必要額 */}
        {hasTarget && monthTotal < monthTarget && remainingShifts > 0 && (
          <div style={{ display:"flex", gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            <div style={{ flex:1, backgroundColor:C.bg, borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>今月の残り出番</div>
              <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{remainingShifts}<span style={{ fontSize:10, marginLeft:2 }}>回</span></div>
            </div>
            <div style={{ flex:1, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>目標まで1出番あたり<span style={{ fontSize:7, marginLeft:1 }}>(税抜)</span></div>
              <div style={{ fontSize:18, fontWeight:900, color:C.accentLight }}>{fmt(neededPerShift)}<span style={{ fontSize:10, marginLeft:2 }}>円</span></div>
            </div>
          </div>
        )}
        {hasTarget && monthTotal >= monthTarget && (
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

      {/* ② KPI グリッド */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <KpiCard label="平均売上"   value={fmt(avgSales)} unit="円" accent={C.accentLight} />
        <KpiCard label="平均実車率" value={avgOcc}         unit="%" accent={avgOcc >= 55 ? C.green : avgOcc >= 45 ? C.gold : C.orange} />
        <KpiCard label="無料残り"   value={remaining}      unit="件" accent={remaining <= 1 ? C.red : C.gold} />
      </div>

      {/* ④ ランキング新着バナー（通知ON時のみ App.jsx から onGoRanking が渡される） */}
      {onGoRanking && <RankingNoticeBanner onGoRanking={onGoRanking} />}

      {/* ⑤ 今日の売上＆着地予想（分析モードのみ） */}
      {isAnalysis && <AnalysisTodayCard reports={reports} />}

      {/* ⑥ 売上グラフ */}
      <SalesChart reports={reports} />

      {/* ⑥ AIアドバイス（3件以上でモード別表示） */}
      <AiAdviceCard reports={monthReports} appMode={appMode} />

      {targetEditModal}
    </div>
  );
}
