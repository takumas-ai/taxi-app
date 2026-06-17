import { useState } from "react";
import { C } from "../../lib/constants";

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem("taxi_ai_card_collapsed") || "false"); } catch { return false; }
}

export default function AiAdviceCard({ reports }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = () => {
    setCollapsed(p => {
      localStorage.setItem("taxi_ai_card_collapsed", JSON.stringify(!p));
      return !p;
    });
  };

  // 最新日報のAIコメントを取得
  const sorted  = [...reports].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const latest  = sorted.find(r => r.ai_comment);
  const comment = latest?.ai_comment || null;

  // コメントなし → カード非表示
  if (!comment) return null;

  const dateLabel = latest?.date
    ? new Date(latest.date).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric", weekday:"short" })
    : "";

  return (
    <div style={{ backgroundColor:C.card, border:`1px solid ${C.accentLight}33`, borderRadius:14, marginBottom:14, overflow:"hidden" }}>
      {/* ヘッダー（タップで折りたたみ） */}
      <div
        onClick={toggle}
        style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", cursor:"pointer", userSelect:"none" }}
      >
        <span style={{ fontSize:20 }}>🦉</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.text }}>AIアドバイス</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{dateLabel}の記録をもとに分析</div>
        </div>
        <span style={{ fontSize:18, color:C.muted, lineHeight:1 }}>{collapsed ? "›" : "⌄"}</span>
      </div>

      {/* 本文 */}
      {!collapsed && (
        <div style={{ padding:"0 16px 16px" }}>
          <div style={{ fontSize:14, color:C.text, lineHeight:1.8, whiteSpace:"pre-wrap" }}>
            {comment}
          </div>
        </div>
      )}
    </div>
  );
}
