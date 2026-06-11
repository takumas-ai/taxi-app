// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard.jsx — ダッシュボード
// 翌日発表カード / 今月KPI / 売上グラフ / 直近日報
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C, fmt, occ, dow, hourly, THIS_YEAR, THIS_MONTH, FREE_LIMIT } from "../lib/constants";
import { Card, Btn, ProgressBar, Badge, KpiCard } from "../components/UI";
import { AreaFilterBanner } from "../components/AreaFilter";
import { MOCK_YESTERDAY_SUMMARY, AREA_MASTER } from "../data/mockData";
import { levelFromXp, getTitle, MISSIONS, getMissionState } from "../lib/xp";
import { loadS } from "../lib/constants";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 翌日発表カード
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function YesterdayCard({ userAreas, rankPrefs, reports }) {
  const [open, setOpen] = useState(false);
  const s = MOCK_YESTERDAY_SUMMARY;

  // 昨日の自分の日報
  const myReport = reports.find(r => r.date === s.date);

  // ユーザーエリアの統計
  const myAreaStats = s.areaStats.filter(a =>
    userAreas.length === 0 || userAreas.includes(a.area)
  );

  const trendIcon = t => t === "up" ? "📈" : t === "down" ? "📉" : "➡️";
  const trendColor = t => t === "up" ? C.green : t === "down" ? C.red : C.muted;

  return (
    <div style={{ backgroundColor:C.accentGlow, border:`1.5px solid ${C.accentLight}44`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:11, color:C.accentLight, fontWeight:700, marginBottom:2 }}>📣 翌日発表 — {s.date}</div>
          <div style={{ fontSize:13, fontWeight:700 }}>{s.totalDrivers}人参加の集計結果</div>
        </div>
        <button
          onClick={() => setOpen(p => !p)}
          style={{ backgroundColor:C.accentLight+"22", border:`1px solid ${C.accentLight}44`, borderRadius:8, padding:"5px 12px", color:C.accentLight, fontSize:12, fontWeight:700, cursor:"pointer" }}
        >
          {open ? "閉じる" : "詳細 →"}
        </button>
      </div>

      {/* 自分の結果（rankPrefs.showMyRank がONの場合） */}
      {myReport && rankPrefs.showMyRank && (
        <div style={{ backgroundColor:C.accentLight+"18", border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>あなたの昨日</div>
              <div style={{ fontSize:20, fontWeight:800, color:C.text }}>{fmt(s.myResult.sales)}<span style={{ fontSize:11, color:C.muted, marginLeft:3 }}>円</span></div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:22, fontWeight:900, color:C.gold }}>第{s.myResult.rank}位</div>
              <div style={{ fontSize:10, color:C.muted }}>上位{s.myResult.percentile}%</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8, fontSize:11, color:C.sub }}>
            <span>エリア平均比 <strong style={{ color:s.myResult.diffFromAvg>=0?C.green:C.red }}>{s.myResult.diffFromAvg>=0?"+":""}{fmt(s.myResult.diffFromAvg)}円</strong></span>
            <span>|</span>
            <span>1位との差 <strong style={{ color:C.muted }}>-{fmt(s.myResult.diffFromTop)}円</strong></span>
          </div>
        </div>
      )}

      {/* エリア平均サマリー（折り畳み） */}
      {open && (
        <>
          {/* エリア別平均 */}
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

          {/* トップ5（rankPrefs.showTopSales がONの場合） */}
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

          {!rankPrefs.showMyRank && !rankPrefs.showTopSales && (
            <div style={{ fontSize:11, color:C.muted, textAlign:"center", padding:"10px 0" }}>
              設定 → ランクで順位・ランキング表示をONにできます
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 売上グラフ（SVGバーチャート）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SalesChart({ reports }) {
  const recent = [...reports]
    .filter(r => r && r.gross_sales)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  if (recent.length === 0) {
    return (
      <Card style={{ textAlign:"center", padding:20 }}>
        <div style={{ fontSize:12, color:C.muted }}>日報を追加するとグラフが表示されます</div>
      </Card>
    );
  }

  const maxSales = Math.max(...recent.map(r => r.gross_sales));
  const chartH = 80;
  const barW = 32;
  const gap = 8;
  const totalW = recent.length * (barW + gap) - gap;

  return (
    <Card style={{ padding:"14px 14px 10px" }}>
      <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:12 }}>直近{recent.length}日の売上</div>
      <div style={{ overflowX:"auto" }}>
        <svg width={Math.max(totalW, 280)} height={chartH + 42} style={{ display:"block", margin:"0 auto" }}>
          {recent.map((r, i) => {
            const barH = Math.max(4, Math.round((r.gross_sales / maxSales) * chartH));
            const x = i * (barW + gap);
            const y = chartH - barH;
            const isToday = r.date === new Date().toISOString().slice(0, 10);
            const barColor = r.gross_sales >= 65000 ? C.green : r.gross_sales >= 58000 ? C.accentLight : C.orange;

            return (
              <g key={r.id}>
                {/* バー */}
                <rect
                  x={x} y={y}
                  width={barW} height={barH}
                  rx={4}
                  fill={barColor}
                  opacity={isToday ? 1 : 0.75}
                />
                {/* 売上ラベル */}
                <text
                  x={x + barW / 2} y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={C.sub}
                >
                  {Math.round(r.gross_sales / 1000)}k
                </text>
                {/* 日付ラベル */}
                <text
                  x={x + barW / 2} y={chartH + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isToday ? C.accentLight : C.muted}
                  fontWeight={isToday ? "bold" : "normal"}
                >
                  {r.date.slice(5).replace("-", "/")}
                </text>
                {/* 曜日 */}
                <text
                  x={x + barW / 2} y={chartH + 28}
                  textAnchor="middle"
                  fontSize={8}
                  fill={isToday ? C.accentLight : C.muted}
                >
                  {["日","月","火","水","木","金","土"][new Date(r.date).getDay()]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* 凡例 */}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 直近日報リスト（ダッシュボード用簡易表示）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RecentReports({ reports, onOpenReport }) {
  const recent = [...reports]
    .filter(r => r && r.gross_sales)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:12, color:C.muted, fontWeight:700 }}>直近の日報</div>
      </div>
      {recent.map(r => {
        const or = occ(r);
        const oc = or >= 55 ? C.green : or >= 45 ? C.gold : C.red;
        const avg = reports.length ? Math.round(reports.reduce((s, x) => s + x.gross_sales, 0) / reports.length) : 0;
        const diff = r.gross_sales - avg;
        return (
          <div
            key={r.id}
            onClick={() => onOpenReport(r)}
            style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer", transition:"background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cardHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.card}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:10, color:C.muted }}>{r.date}（{dow(r.date)}）</div>
                <div style={{ fontSize:20, fontWeight:800, marginTop:2 }}>
                  {fmt(r.gross_sales)}<span style={{ fontSize:10, color:C.muted, marginLeft:2 }}>円</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <Badge color={oc} size={10}>実車率 {or}%</Badge>
                <div style={{ fontSize:10, color:diff >= 0 ? C.green : C.red, marginTop:4, fontWeight:700 }}>
                  {diff >= 0 ? "+" : ""}{fmt(diff)}円
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, fontSize:10, color:C.muted, marginTop:6 }}>
              <span>🚗 {r.ride_count}回</span>
              <span>⏱ {fmt(hourly(r))}円/h</span>
              {r.ai_comment && <span style={{ color:C.accentLight }}>💬 AIコメントあり</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dashboard メイン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Dashboard({ reports, user, onOpenReport, onManageArea, rankPrefs = { showMyRank:false, showTopSales:false } }) {
  // 今月の日報
  const monthReports = reports.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === THIS_YEAR && d.getMonth() + 1 === THIS_MONTH;
  });

  const monthTotal  = monthReports.reduce((s, r) => s + (r.gross_sales || 0), 0);
  const monthTarget = parseInt(user.target) || 380000;
  const achievement = monthTarget > 0 ? Math.round((monthTotal / monthTarget) * 100) : 0;
  const avgSales    = monthReports.length ? Math.round(monthTotal / monthReports.length) : 0;
  const avgOcc      = monthReports.length
    ? Math.round(monthReports.reduce((s, r) => s + occ(r), 0) / monthReports.length)
    : 0;
  const remaining   = FREE_LIMIT - (user.uploadCount || 0);

  // 手取り計算
  const takePay     = loadS("taxi_takepay", { rate:55, deduction:30000 });
  const estimatedTake = Math.max(0, Math.round(monthTotal * takePay.rate / 100 - takePay.deduction));

  // 達成率の色
  const achColor = achievement >= 100 ? C.green : achievement >= 80 ? C.gold : achievement >= 60 ? C.orange : C.red;

  // XP・レベル・ミッション
  const xpData       = levelFromXp(user.xp || 0);
  const title        = getTitle(xpData.level);
  const missionState = getMissionState();
  const completedCount = missionState.completed.length;
  const allMissionXp   = MISSIONS.reduce((s, m) => s + m.xp, 0) + 30; // +30ボーナス

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <AreaFilterBanner userAreas={user.areas || []} onManage={onManageArea} />

      {/* XP・レベルカード */}
      <Card style={{ marginBottom:14, padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:`conic-gradient(${title.color} ${xpData.progress}%, ${C.border} 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", backgroundColor:C.card, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
              <span style={{ fontSize:8, color:C.muted, lineHeight:1 }}>Lv</span>
              <span style={{ fontSize:15, fontWeight:900, color:title.color, lineHeight:1.1 }}>{xpData.level}</span>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:700, color:title.color }}>{title.name}</span>
              <span style={{ fontSize:10, color:C.muted }}>次のレベルまで {xpData.xpForNext - xpData.xpInLevel} XP</span>
            </div>
            <div style={{ backgroundColor:C.border, borderRadius:99, height:5, overflow:"hidden" }}>
              <div style={{ width:`${xpData.progress}%`, height:"100%", backgroundColor:title.color, borderRadius:99 }}/>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{user.xp || 0}</div>
            <div style={{ fontSize:9, color:C.muted }}>総XP</div>
          </div>
        </div>

        {/* デイリーミッション */}
        <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.muted }}>📋 デイリーミッション</span>
            <span style={{ fontSize:10, color:completedCount===MISSIONS.length?C.green:C.muted }}>
              {completedCount}/{MISSIONS.length} {completedCount===MISSIONS.length?"✨ +30ボーナス!":""}
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
      </Card>

      {/* 翌日発表カード */}
      <YesterdayCard userAreas={user.areas || []} rankPrefs={rankPrefs} reports={reports} />

      {/* 今月サマリー */}
      <Card style={{ marginBottom:14, borderColor:C.gold+"33" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>今月の総売上</div>
            <div style={{ fontSize:28, fontWeight:900, color:C.text }}>
              {fmt(monthTotal)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
              目標 {fmt(monthTarget)}円
              <span style={{ color:achColor, fontWeight:700, marginLeft:6 }}>達成率 {achievement}%</span>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>残り目標</div>
            <div style={{ fontSize:16, fontWeight:800, color:achColor }}>
              {monthTotal >= monthTarget
                ? <span style={{ color:C.green }}>達成！🎉</span>
                : `${fmt(monthTarget - monthTotal)}円`}
            </div>
          </div>
        </div>

        {/* 達成率バー */}
        <ProgressBar value={Math.min(achievement, 100)} max={100} color={achColor} height={8} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginTop:5 }}>
          <span>{THIS_MONTH}月 {monthReports.length}件入力済み</span>
          <span>{achievement}%</span>
        </div>

        {/* 推定手取り */}
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

      {/* KPI グリッド */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <KpiCard label="平均売上"     value={fmt(avgSales)} unit="円"    accent={C.accentLight} />
        <KpiCard label="平均実車率"   value={avgOcc}         unit="%"    accent={avgOcc >= 55 ? C.green : avgOcc >= 45 ? C.gold : C.orange} />
        <KpiCard label="無料残り"     value={remaining}      unit="件"   accent={remaining <= 1 ? C.red : C.gold} />
      </div>

      {/* 売上グラフ */}
      <SalesChart reports={reports} />

      {/* 直近日報 */}
      <div style={{ marginTop:14 }}>
        <RecentReports reports={reports} onOpenReport={onOpenReport} />
      </div>

      {/* 日報がない場合 */}
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
