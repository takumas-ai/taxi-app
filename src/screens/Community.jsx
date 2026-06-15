import { C } from "../lib/constants";

export default function CommunityScreen() {
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"60px 24px 100px", textAlign:"center" }}>
      <div style={{ fontSize:56, marginBottom:16 }}>💬</div>
      <div style={{ fontSize:20, fontWeight:900, color:C.text, marginBottom:8 }}>コミュニティ</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:32, lineHeight:1.7 }}>
        同じエリアの乗務員と情報共有できる<br/>コミュニティ機能を開発中です。
      </div>

      <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, marginBottom:20, textAlign:"left" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>予定している機能</div>
        {[
          ["📍", "エリア別の混雑・需要情報の共有"],
          ["💡", "稼げた時間帯・乗り場のTips"],
          ["🔔", "イベント・天気の有益情報通知"],
          ["🏆", "エリア内ランキング"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
            <span style={{ fontSize:13, color:C.sub }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"inline-block", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:99, padding:"6px 18px", fontSize:12, color:C.accentLight, fontWeight:700 }}>
        🔧 開発中
      </div>
    </div>
  );
}
