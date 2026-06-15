// ランキング画面
import { useState } from "react";
import { C, loadS, saveS } from "../lib/constants";
import { Card } from "../components/UI";
import { MOCK_YESTERDAY_SUMMARY, MOCK_AREA_STATS } from "../data/mockData";

const fmt = n => Number(n).toLocaleString();

// 「既読」管理: 日付をキーに seen 済みかどうか保存
const SEEN_KEY = "taxi_ranking_seen";
const getSeen = () => loadS(SEEN_KEY, "");
const markSeen = (date) => saveS(SEEN_KEY, date);

export function hasUnseenRanking() {
  return getSeen() !== MOCK_YESTERDAY_SUMMARY.date;
}

export default function RankingScreen({ user, rankPrefs = { showMyRank: true, showTopSales: true } }) {
  const s = MOCK_YESTERDAY_SUMMARY;
  const [areaSortKey, setAreaSortKey]       = useState("avg_unit");
  const [areaParentFilter, setAreaParentFilter] = useState("all");

  // 開いた瞬間に既読にする
  useState(() => { markSeen(s.date); });

  const myReport = true; // TODO: 実際は reports から s.date の日報があるか確認
  const trendIcon  = t => t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const trendColor = t => t === "up" ? C.green : t === "down" ? C.red : C.muted;
  const unitColor  = v => v >= 3000 ? C.green : v >= 2500 ? C.gold : C.orange;
  const occColor   = v => v >= 60   ? C.green : v >= 50   ? C.gold : C.orange;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 100px" }}>

      {/* ━━ 前日集計結果 ━━ */}
      <Card style={{ marginBottom: 14, borderColor: C.gold + "44" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>📣</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>前日の集計結果</div>
            <div style={{ fontSize: 11, color: C.muted }}>{s.date} 分・参加 {s.totalDrivers} 人</div>
          </div>
        </div>

        {/* 自分の順位 */}
        {rankPrefs.showMyRank && myReport && (
          <div style={{ backgroundColor: C.accentLight + "18", border: `1px solid ${C.accentLight}33`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.accentLight, fontWeight: 700, marginBottom: 8 }}>🙋 自分の結果</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>{fmt(s.myResult.sales)}円</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  エリア平均より <span style={{ color: s.myResult.diffFromAvg >= 0 ? C.green : C.red, fontWeight: 700 }}>
                    {s.myResult.diffFromAvg >= 0 ? "+" : ""}{fmt(s.myResult.diffFromAvg)}円
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.gold }}>第{s.myResult.rank}位</div>
                <div style={{ fontSize: 11, color: C.muted }}>上位 {s.myResult.percentile}%</div>
              </div>
            </div>
          </div>
        )}

        {/* エリア別平均 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8 }}>📍 エリア別平均売上</div>
          {s.areaStats.map(a => (
            <div key={a.area} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.area} <span style={{ fontSize: 10, color: C.muted }}>({a.count}人)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{fmt(a.avg)}円</div>
                <span style={{ fontSize: 14, color: trendColor(a.trend), fontWeight: 900 }}>{trendIcon(a.trend)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* トップ5 */}
        {rankPrefs.showTopSales && (
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 8 }}>🏆 トップ5（匿名）</div>
            {s.topSales.map(t => (
              <div key={t.rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, width: 28 }}>{t.badge}</span>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted }}>ドライバー {t.driverCode}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{t.area}</div>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{fmt(t.sales)}円</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ━━ エリア別ランキング ━━ */}
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 10 }}>📊 エリア別ランキング</div>

      {/* 親エリアフィルター */}
      {(() => {
        const parents = ["all", ...new Set(MOCK_AREA_STATS.map(s => s.parent))];
        return (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
            {parents.map(p => (
              <div key={p} onClick={() => setAreaParentFilter(p)}
                style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", backgroundColor: areaParentFilter === p ? C.accentLight : C.surface, color: areaParentFilter === p ? "#fff" : C.muted, border: `1px solid ${areaParentFilter === p ? C.accentLight : C.border}` }}>
                {p === "all" ? "全エリア" : p}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ソート */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["avg_unit", "時間単価"], ["avg_occ", "実車率"], ["sample", "データ数"]].map(([k, l]) => (
          <div key={k} onClick={() => setAreaSortKey(k)}
            style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, cursor: "pointer", backgroundColor: areaSortKey === k ? C.gold + "22" : C.surface, color: areaSortKey === k ? C.gold : C.muted, border: `1px solid ${areaSortKey === k ? C.gold + "44" : C.border}`, fontWeight: areaSortKey === k ? 700 : 400 }}>
            {l}順
          </div>
        ))}
      </div>

      {MOCK_AREA_STATS
        .filter(s => areaParentFilter === "all" || s.parent === areaParentFilter)
        .sort((a, b) => b[areaSortKey] - a[areaSortKey])
        .map((s, i) => {
          const rankColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.muted;
          return (
            <Card key={s.area} style={{ padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 16 : 13, fontWeight: 900, color: rankColor, flexShrink: 0 }}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.area}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{s.parent}　n={s.sample}件</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: unitColor(s.avg_unit) }}>¥{s.avg_unit.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>時間単価</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: occColor(s.avg_occ) }}>{s.avg_occ}%</div>
                  <div style={{ fontSize: 10, color: C.muted }}>実車率</div>
                </div>
                <div style={{ fontSize: 16, color: trendColor(s.trend), flexShrink: 0, marginLeft: 4, fontWeight: 900 }}>{trendIcon(s.trend)}</div>
              </div>
            </Card>
          );
        })
      }

      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 8 }}>
        データはすべて匿名・集計値です
      </div>
    </div>
  );
}
