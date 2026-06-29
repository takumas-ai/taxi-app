// ランキング画面
import { C } from "../lib/constants";
import { Card } from "../components/UI";

// ランキング機能はモニター50人から開始のため、現在は常に既読扱い
export function hasUnseenRanking() {
  return false;
}

export default function RankingScreen() {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 100px" }}>

      <Card style={{ textAlign: "center", padding: "48px 24px", borderColor: C.gold + "44" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 12 }}>
          ランキング機能
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
          モニター参加者が <span style={{ color: C.gold, fontWeight: 800 }}>50名</span> に達した時点でスタートします。<br />
          現在も仲間を増やし中です。もうしばらくお待ちください！
        </div>
        <div style={{ marginTop: 24, padding: "12px 16px", backgroundColor: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>予定機能</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 2, textAlign: "left" }}>
            📊 前日の売上・時間単価ランキング<br />
            📍 エリア別平均データ比較<br />
            🏅 トップドライバーの匿名結果表示
          </div>
        </div>
      </Card>

    </div>
  );
}
