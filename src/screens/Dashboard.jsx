// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard.jsx — ダッシュボード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, fmt, occ, dow, hourly, THIS_YEAR, THIS_MONTH, FREE_LIMIT, loadS, saveS, getClosingPeriod } from "../lib/constants";
import { Card, Btn, ProgressBar, Badge, KpiCard } from "../components/UI";
import { MOCK_YESTERDAY_SUMMARY, AREA_MASTER } from "../data/mockData";
import { levelFromXp, getTitle, MISSIONS, getMissionState } from "../lib/xp";
import { CURRENT_VERSION, CHANGELOG } from "../lib/changelog";
import { getCachedWeather, weatherMeta } from "../lib/weather";
import { SalesPointCard } from "../components/SalesPointCard";
import { upsertShifts, deleteShift } from "../lib/supabase";

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

// ━━━ シフト表カード ━━━━━━━━━━━━━━━━━━━━━━━━
function ShiftSummaryCard({ reports = [], user, onOpenReport, monthTarget = 380000, onGoShift }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth() + 1;
  const todayStr = `${y}-${String(m).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const allShifts = loadS("taxi_shifts", []);
  const monthShifts = allShifts.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });
  const remaining = monthShifts.filter(s => s.date >= todayStr).length;
  const todayShift = monthShifts.find(s => s.date === todayStr);

  return (
    <Card style={{ marginBottom:14, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        {/* 左: タイトル + 本日出勤バッジ */}
        <div onClick={() => setOpen(p=>!p)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
          <span style={{ fontSize:13, fontWeight:700 }}>📅 カレンダー</span>
          {todayShift && <span style={{ fontSize:10, backgroundColor:C.green+"22", color:C.green, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>本日出勤</span>}
        </div>
        {/* 右: 読み取りボタン + 残り勤務 + 開閉 */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button
            onClick={e=>{ e.stopPropagation(); onGoShift?.(); }}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:8, border:`1px solid ${C.accentLight}55`, backgroundColor:C.accentLight+"18", color:C.accentLight, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}
          >📷 シフトを読み取る</button>
          <div onClick={() => setOpen(p=>!p)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            {monthShifts.length > 0
              ? <span style={{ fontSize:11, color:C.muted }}>残り{remaining}勤</span>
              : <span style={{ fontSize:11, color:C.red }}>未登録</span>
            }
            <span style={{ fontSize:11, color:C.muted }}>{open?"▲":"▼"}</span>
          </div>
        </div>
      </div>
      {open && (
        <UnifiedCalendar
          reports={reports}
          monthTarget={monthTarget}
          user={user}
          onOpenReport={onOpenReport}
          noCard
        />
      )}
    </Card>
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

// ━━━ 休憩時間カード ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BreakTimeCard({ reports, onUpdateReport }) {
  const [showInput,  setShowInput]  = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [collapsed,  setCollapsed]  = useState(true); // デフォルト折りたたみ
  const [inputDate,  setInputDate]  = useState(() => new Date().toISOString().slice(0,10));
  const [inputVal,   setInputVal]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [editingId,  setEditingId]  = useState(null); // 編集中レコードid
  const [editVal,    setEditVal]    = useState("");

  const withBreak = [...reports]
    .filter(r => r.break_hours != null && r.break_hours !== "")
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalBreak = Math.round(withBreak.reduce((s, r) => s + parseFloat(r.break_hours || 0), 0) * 10) / 10;

  const inp = { padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, backgroundColor:C.card, color:C.text, fontSize:13 };

  const handleSave = async () => {
    const val = parseFloat(inputVal);
    if (isNaN(val) || val < 0) return;
    const target = reports.find(r => r.date === inputDate);
    if (!target) { alert("その日の日報がありません。先に日報を登録してください。"); return; }
    setSaving(true);
    await onUpdateReport?.({ ...target, break_hours: val });
    setSaving(false);
    setShowInput(false);
    setInputVal("");
  };

  const handleEdit = async (r) => {
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    await onUpdateReport?.({ ...r, break_hours: val });
    setSaving(false);
    setEditingId(null);
    setEditVal("");
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`${r.date} の休憩時間（${r.break_hours}h）を削除しますか？`)) return;
    await onUpdateReport?.({ ...r, break_hours: null });
  };

  // 1件表示用の行コンポーネント（カード内・モーダル共用）
  const BreakRow = ({ r, compact }) => {
    const isEditing = editingId === r.id;
    return (
      <div style={{ backgroundColor: compact ? "transparent" : C.bg, borderRadius: compact ? 0 : 12, padding: compact ? "9px 0" : "12px 14px", marginBottom: compact ? 0 : 10, borderBottom: compact ? `1px solid ${C.border}` : "none" }}>
        {isEditing ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="number" step="0.5" min="0" max="24" value={editVal}
              onChange={e => setEditVal(e.target.value)} autoFocus
              style={{ ...inp, flex:1 }} />
            <span style={{ fontSize:12, color:C.muted }}>h</span>
            <button onClick={() => handleEdit(r)} disabled={saving || !editVal}
              style={{ padding:"7px 14px", borderRadius:8, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer", opacity:(saving||!editVal)?0.5:1 }}>
              {saving ? "…" : "保存"}
            </button>
            <button onClick={() => setEditingId(null)}
              style={{ padding:"7px 10px", borderRadius:8, backgroundColor:"transparent", border:`1px solid ${C.border}`, fontSize:12, color:C.muted, cursor:"pointer" }}>
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize: compact ? 13 : 14, fontWeight:700, color:C.text }}>休憩 {r.break_hours}h</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{r.date}（{dow(r.date)}）{r.work_hours ? `· 勤務 ${r.work_hours}h` : ""}</div>
            </div>
            {onUpdateReport && (
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => { setEditingId(r.id); setEditVal(String(r.break_hours)); }}
                  style={{ fontSize:11, color:C.accentLight, background:C.accentGlow||"transparent", border:`1px solid ${C.accentLight}44`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
                  編集
                </button>
                <button onClick={() => handleDelete(r)}
                  style={{ fontSize:11, color:C.red, background:"transparent", border:`1px solid ${C.red}44`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
                  削除
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card style={{ marginBottom:14 }}>
        {/* ヘッダー */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: collapsed ? 0 : 12 }}>
          <div onClick={() => setCollapsed(p => !p)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.text }}>☕ 休憩時間</div>
            {withBreak.length > 0 && !collapsed && (
              <span style={{ fontSize:10, color:C.muted }}>計 {totalBreak}h</span>
            )}
            <span style={{ fontSize:11, color:C.muted, marginLeft:2 }}>{collapsed ? "▼" : "▲"}</span>
          </div>
          {!collapsed && (
            <button onClick={() => setShowInput(p => !p)}
              style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {showInput ? "閉じる" : "＋ 記録する"}
            </button>
          )}
        </div>

        {/* 折りたたみ時は何も表示しない */}
        {collapsed ? null : <>

        {/* 入力フォーム */}
        {showInput && (
          <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ marginBottom:8 }}>
              <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                style={{ ...inp, width:"100%", boxSizing:"border-box" }} />
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="number" step="0.5" min="0" max="24" value={inputVal}
                onChange={e => setInputVal(e.target.value)} placeholder="例) 1.0"
                style={{ ...inp, flex:1 }} />
              <span style={{ fontSize:13, color:C.muted }}>h</span>
              <button onClick={handleSave} disabled={saving || !inputVal}
                style={{ padding:"9px 18px", borderRadius:9, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", opacity:(saving||!inputVal)?0.5:1 }}>
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* 合計表示 */}
        {withBreak.length === 0 ? (
          <div style={{ textAlign:"center", padding:"8px 0", color:C.muted, fontSize:12 }}>まだ記録がありません</div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span style={{ fontSize:28, fontWeight:900, color:C.text }}>{totalBreak}</span>
              <span style={{ fontSize:13, color:C.muted }}>h</span>
              <span style={{ fontSize:11, color:C.muted, marginLeft:4 }}>（{withBreak.length}件合計）</span>
            </div>
            <button onClick={() => setShowDetail(true)}
              style={{ padding:"7px 16px", borderRadius:9, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}>
              詳細
            </button>
          </div>
        )}
        </> /* end collapsed check */}
      </Card>

      {/* 詳細モーダル */}
      {showDetail && (
        <div style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={() => setShowDetail(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"85vh", overflowY:"auto", padding:22, paddingBottom:40 }}>
            <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>☕ 休憩時間一覧</div>
              <div style={{ fontSize:12, color:C.muted }}>{withBreak.length}件</div>
            </div>

            {/* 統計 */}
            {withBreak.length > 0 && (() => {
              const avg = Math.round(withBreak.reduce((s,r) => s + parseFloat(r.break_hours), 0) / withBreak.length * 10) / 10;
              const total = Math.round(withBreak.reduce((s,r) => s + parseFloat(r.break_hours), 0) * 10) / 10;
              return (
                <div style={{ backgroundColor:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:18, display:"flex", gap:10 }}>
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:10, color:C.muted }}>平均休憩</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.text }}>{avg}<span style={{ fontSize:11 }}>h</span></div>
                  </div>
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:10, color:C.muted }}>累計休憩</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.text }}>{total}<span style={{ fontSize:11 }}>h</span></div>
                  </div>
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:10, color:C.muted }}>記録数</div>
                    <div style={{ fontSize:20, fontWeight:900, color:C.text }}>{withBreak.length}<span style={{ fontSize:11 }}>件</span></div>
                  </div>
                </div>
              );
            })()}

            {/* 一覧（編集・削除付き） */}
            {withBreak.map(r => <BreakRow key={r.id} r={r} compact={false} />)}
          </div>
        </div>
      )}
    </>
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

// ━━━ 統合カレンダー（シフト予定 ＋ 売上実績） ━━━━━
function UnifiedDayModal({ dateStr, shift, report, onClose, onSaveShift, onDeleteShift, onOpenReport }) {
  const d = new Date(dateStr);
  const wd = ["日","月","火","水","木","金","土"][d.getDay()];
  const todayStr = new Date().toISOString().slice(0,10);
  const isPast = dateStr < todayStr;

  const [editing, setEditing] = useState(!shift);
  const [form, setForm] = useState({ clockIn:shift?.clockIn||"", clockOut:shift?.clockOut||"", note:shift?.note||"" });
  const [saving, setSaving] = useState(false);

  const inp = { backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 11px", color:C.text, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" };

  const handleSave = async () => {
    setSaving(true);
    await onSaveShift({ id:shift?.id||("manual_"+Date.now()), date:dateStr, clockIn:form.clockIn, clockOut:form.clockOut, isNight:false, note:form.note });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:36, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>{dateStr}（{wd}）</div>

        {/* シフト */}
        {editing ? (
          <div style={{ backgroundColor:C.accentLight+"12", border:`1px solid ${C.accentLight}33`, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginBottom:12 }}>📅 {shift?"シフトを編集":"シフトを追加"}</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>出庫</div><input value={form.clockIn} onChange={e=>setForm(p=>({...p,clockIn:e.target.value}))} placeholder="07:00" style={inp}/></div>
              <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>帰庫</div><input value={form.clockOut} onChange={e=>setForm(p=>({...p,clockOut:e.target.value}))} placeholder="20:00" style={inp}/></div>
            </div>
            <div style={{ marginBottom:12 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>メモ</div><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} rows={2} placeholder="急な変更など" style={{ ...inp, resize:"vertical" }}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex:1, backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:9, padding:"11px 0", fontSize:13, fontWeight:700, cursor:"pointer", opacity:saving?0.6:1 }}>{saving?"保存中...":shift?"更新する":"追加する"}</button>
              {shift && <button onClick={()=>setEditing(false)} style={{ flex:1, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 0", fontSize:13, color:C.muted, cursor:"pointer" }}>キャンセル</button>}
            </div>
          </div>
        ) : shift ? (
          <div style={{ backgroundColor:C.green+"12", border:`1px solid ${C.green}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, color:C.green, fontWeight:700 }}>📅 出勤予定</div>
              <button onClick={()=>setEditing(true)} style={{ fontSize:11, color:C.accentLight, background:"transparent", border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontWeight:600 }}>編集</button>
            </div>
            <div style={{ display:"flex", gap:20, marginBottom:shift.note?8:0 }}>
              <div><div style={{ fontSize:10, color:C.muted }}>出庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockIn||"—"}</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>帰庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockOut||"—"}</div></div>
            </div>
            {shift.note&&<div style={{ fontSize:12, color:C.sub, whiteSpace:"pre-wrap", backgroundColor:C.bg, borderRadius:7, padding:"8px 10px" }}>📝 {shift.note}</div>}
            <button onClick={()=>onDeleteShift(shift)} style={{ marginTop:10, background:"transparent", border:`1px solid ${C.red}44`, borderRadius:8, padding:"6px 14px", fontSize:11, color:C.red, cursor:"pointer", fontWeight:600 }}>削除</button>
          </div>
        ) : (
          <div style={{ backgroundColor:C.border+"33", borderRadius:10, padding:"10px 14px", marginBottom:12, textAlign:"center", fontSize:12, color:C.muted }}>出勤予定なし</div>
        )}

        {/* 日報 */}
        {report ? (
          <div style={{ backgroundColor:C.goldGlow||C.gold+"12", border:`1px solid ${C.gold}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:8 }}>💴 日報入力済み</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:10, color:C.muted }}>総売上</div><div style={{ fontSize:22, fontWeight:900, color:C.gold }}>{fmt(report.gross_sales)}円</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>営業回数</div><div style={{ fontSize:22, fontWeight:900 }}>{report.ride_count}回</div></div>
            </div>
            <button onClick={()=>{ onOpenReport(report); onClose(); }} style={{ marginTop:10, width:"100%", backgroundColor:C.gold+"22", color:C.gold, border:`1px solid ${C.gold}44`, borderRadius:9, padding:"9px 0", fontSize:12, fontWeight:700, cursor:"pointer" }}>日報の詳細を見る →</button>
          </div>
        ) : isPast && shift ? (
          <div style={{ backgroundColor:C.orange+"12", border:`1px solid ${C.orange}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.orange, fontWeight:700, marginBottom:4 }}>⚠️ 日報が未入力です</div>
            <div style={{ fontSize:11, color:C.muted }}>「記録する（＋）」から日報を登録してください</div>
          </div>
        ) : null}

        <button onClick={onClose} style={{ width:"100%", backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:11, padding:"13px 0", fontSize:14, fontWeight:600, color:C.muted, cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

function UnifiedCalendar({ reports, monthTarget, user, onOpenReport, noCard = false }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayShift,    setDayShift]    = useState(null);
  const [dayReport,   setDayReport]   = useState(null);
  const [shifts, setShifts] = useState(() => loadS("taxi_shifts", []));

  const ym = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;
  const monthReports = reports.filter(r => r.date?.startsWith(ym));
  const monthShifts  = shifts.filter(s => s.date?.startsWith(ym));

  const reportByDate = {};  monthReports.forEach(r => { reportByDate[r.date] = r; });
  const shiftByDate  = {};  monthShifts.forEach(s  => { shiftByDate[s.date]  = s; });

  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const DAYS = ["日","月","火","水","木","金","土"];

  const prevMonth = () => viewMonth===0 ? (setViewYear(y=>y-1), setViewMonth(11)) : setViewMonth(m=>m-1);
  const nextMonth = () => viewMonth===11? (setViewYear(y=>y+1), setViewMonth(0))  : setViewMonth(m=>m+1);

  const handleSaveShift = async (s) => {
    const next = (() => {
      const idx = shifts.findIndex(x => x.date === s.date);
      return idx >= 0 ? shifts.map((x,i) => i===idx?s:x) : [...shifts, s];
    })();
    setShifts(next);
    saveS("taxi_shifts", next);
    if (SUPABASE_READY && user?.id) await upsertShifts(user.id, [s]);
  };

  const handleDeleteShift = async (sh) => {
    const next = shifts.filter(x => x.id !== sh.id);
    setShifts(next);
    saveS("taxi_shifts", next);
    if (SUPABASE_READY && user?.id) await deleteShift(user.id, sh.date);
    setSelectedDay(null);
  };

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const calendarBody = (
    <>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", color:C.sub, cursor:"pointer", fontSize:15 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:800 }}>📅 {viewYear}年{viewMonth+1}月</div>
          <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
            出勤 {monthShifts.length}日 · 日報 {monthReports.length}件
          </div>
        </div>
        <button onClick={nextMonth} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", color:C.sub, cursor:"pointer", fontSize:15 }}>›</button>
      </div>

      {/* 凡例 */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {[
          { color:C.green,      label:"出勤+日報済" },
          { color:C.orange,     label:"日報未入力"  },
          { color:C.accentLight,label:"出勤予定"    },
          { color:C.gold,       label:"日報のみ"    },
        ].map(({color,label}) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:3 }}>
            <div style={{ width:8, height:8, borderRadius:2, backgroundColor:color }}/>
            <span style={{ fontSize:9, color:C.muted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 曜日ヘッダー */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
        {DAYS.map((d,i) => (
          <div key={d} style={{ textAlign:"center", fontSize:9, color:i===0?C.red:i===6?C.accentLight:C.muted, fontWeight:700, paddingBottom:3 }}>{d}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i}/>;
          const dateStr  = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const shift    = shiftByDate[dateStr];
          const report   = reportByDate[dateStr];
          const isFuture = dateStr > todayStr;
          const isToday  = dateStr === todayStr;
          const isPast   = dateStr < todayStr;

          // セル色
          let bg = null;
          if (shift && report)        bg = C.green;
          else if (shift && isPast)   bg = C.orange;
          else if (shift)             bg = C.accentLight;
          else if (report)            bg = C.gold;

          return (
            <div key={i}
              onClick={() => { setSelectedDay(dateStr); setDayShift(shift||null); setDayReport(report||null); }}
              style={{
                borderRadius:6, padding:"4px 2px", textAlign:"center", cursor:"pointer",
                backgroundColor: bg ? bg+"22" : isFuture ? "transparent" : C.surface,
                border: isToday ? `2px solid ${C.accentLight}` : `1px solid ${bg ? bg+"55" : C.border}`,
                minHeight:54, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", gap:1,
                opacity: isFuture && !shift ? 0.4 : 1,
              }}
            >
              <div style={{ fontSize:10, color:isToday?C.accentLight:C.text, fontWeight:isToday?800:400 }}>{d}</div>
              {shift && (
                <div style={{ fontSize:7, color:bg||C.muted, fontWeight:600, lineHeight:1.3 }}>
                  {shift.clockIn&&shift.clockIn.slice(0,5)}<br/>{shift.clockOut&&shift.clockOut.slice(0,5)}
                </div>
              )}
              {report && (
                <div style={{ fontSize:8, color:C.gold, fontWeight:700, marginTop:1 }}>
                  {(report.gross_sales/10000).toFixed(1)}万
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <UnifiedDayModal
          dateStr={selectedDay}
          shift={dayShift}
          report={dayReport}
          onClose={()=>setSelectedDay(null)}
          onSaveShift={handleSaveShift}
          onDeleteShift={handleDeleteShift}
          onOpenReport={onOpenReport}
        />
      )}
    </>
  );
  if (noCard) return <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>{calendarBody}</div>;
  return <Card style={{ marginBottom:14, padding:"12px 14px" }}>{calendarBody}</Card>;
}

// ━━━ 月間目標クイック編集モーダル ━━━━━━━━━━━━━━
function TargetEditModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(String(current || 380000));
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
          <button onClick={()=>{ onSave(parseInt(val,10)||380000); onClose(); }}
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

  const monthTotal    = monthReports.reduce((s,r) => s + (r.gross_sales || 0), 0);
  const monthTarget   = parseInt(user.target) || 380000;
  const achievement   = monthTarget > 0 ? Math.round((monthTotal / monthTarget) * 100) : 0;
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

  // ── 残りシフト・今日必要な売上 ──
  const today         = new Date();
  const daysInMonth   = new Date(THIS_YEAR, THIS_MONTH, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - today.getDate());
  const shiftsPerDay  = (user.workType === "隔日勤務") ? 0.5 : 0.75;
  const remainingShifts = Math.round(remainingDays * shiftsPerDay);
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
          <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>今月の総売上</div>
          <div style={{ fontSize:52, fontWeight:900, color:C.text, lineHeight:1.1 }}>
            {fmt(monthTotal)}<span style={{ fontSize:20, color:C.muted, marginLeft:6 }}>円</span>
          </div>
          <div style={{ fontSize:15, color:C.muted, marginTop:8, display:"flex", alignItems:"center", gap:10 }}>
            <span onClick={()=>setShowTargetEdit(true)} style={{ cursor:"pointer", borderBottom:`1px dashed ${C.border}` }}>
              目標 {fmt(monthTarget)}円
            </span>
            <span style={{ color:achColor, fontWeight:700 }}>達成率 {achievement}%</span>
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
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>今日必要な売上<span style={{ fontSize:8, marginLeft:2 }}>(税抜)</span></div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>{fmt(neededToday)}<span style={{ fontSize:12, marginLeft:2 }}>円</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* AIアドバイス */}
        <AiAdviceCard reports={monthReports} appMode={appMode} />

        {reports.length === 0 && (
          <Card style={{ textAlign:"center", padding:32 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📄</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>日報をアップロードしよう</div>
            <div style={{ fontSize:14, color:C.muted }}>日報を登録すると売上が表示されます</div>
          </Card>
        )}
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
      <SalesPointCard />

      {/* 休憩時間 */}
      <BreakTimeCard reports={reports} onUpdateReport={onUpdateReport} />

      {/* ① 売上サマリー（最上位） */}
      <Card style={{ marginBottom:14, borderColor:C.gold+"33" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>今月の総売上</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.text }}>
              {fmt(monthTotal)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4, display:"flex", alignItems:"center", gap:8 }}>
              <span
                onClick={()=>setShowTargetEdit(true)}
                style={{ cursor:"pointer", borderBottom:`1px dashed ${C.border}` }}>
                目標 {fmt(monthTarget)}円
              </span>
              <span style={{ color:achColor, fontWeight:700 }}>達成率 {achievement}%</span>
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
              <div style={{ fontSize:9, color:C.muted, marginBottom:2 }}>今日必要な売上<span style={{ fontSize:7, marginLeft:1 }}>(税抜)</span></div>
              <div style={{ fontSize:18, fontWeight:900, color:C.accentLight }}>{fmt(neededToday)}<span style={{ fontSize:10, marginLeft:2 }}>円</span></div>
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
