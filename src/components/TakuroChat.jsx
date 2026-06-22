// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TakuroChat.jsx — タクローとのチャット（ボトムシート）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useRef, useEffect } from "react";
import { C } from "../lib/constants";

const SUGGESTIONS = [
  "今日どうだった？",
  "アドバイスほしい",
  "愚痴聞いて",
  "稼ぐコツ教えて",
  "使い方を教えて",
];

const WELCOME = "お疲れさまです！今日も1日どうでしたか？なんでも話しかけてください 🦉";

export default function TakuroChat({ onClose, user, callChat }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: t }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // assistant メッセージを除いた会話履歴をAPIに渡す（最新10件）
      const history = newMessages
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await callChat(history, {
        name:       user?.name,
        todaySales: user?.todaySales,
        todayRides: user?.todayRides,
        monthSales: user?.monthSales,
        target:     user?.target,
        streak:     user?.streak,
        workType:   user?.workType,
      });

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "ごめんなさい、うまく返事できませんでした。もう一度試してみてください。" }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      {/* オーバーレイ */}
      <div
        onClick={onClose}
        style={{ position:"fixed", inset:0, backgroundColor:"#00000055", zIndex:200 }}
      />

      {/* ボトムシート */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:201,
        backgroundColor:C.surface, borderRadius:"20px 20px 0 0",
        maxWidth:480, margin:"0 auto",
        display:"flex", flexDirection:"column",
        height:"72vh", boxShadow:"0 -8px 40px #00000033",
      }}>

        {/* ヘッダー */}
        <div style={{ padding:"14px 16px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", backgroundColor:C.accentLight+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🦉</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>タクロー</div>
            <div style={{ fontSize:11, color:C.muted }}>なんでも話しかけてね</div>
          </div>
          <div onClick={onClose} style={{ marginLeft:"auto", fontSize:22, color:C.muted, cursor:"pointer", padding:"4px 8px" }}>×</div>
        </div>

        {/* メッセージ一覧 */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start", gap:8, alignItems:"flex-end" }}>
              {m.role === "assistant" && (
                <div style={{ fontSize:20, flexShrink:0, marginBottom:2 }}>🦉</div>
              )}
              <div style={{
                maxWidth:"78%", padding:"10px 13px", borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                backgroundColor: m.role==="user" ? C.accentLight : C.card,
                color: m.role==="user" ? "#fff" : C.text,
                fontSize:14, lineHeight:1.65,
                border: m.role==="assistant" ? `1px solid ${C.border}` : "none",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
              <div style={{ fontSize:20 }}>🦉</div>
              <div style={{ padding:"10px 14px", borderRadius:"16px 16px 16px 4px", backgroundColor:C.card, border:`1px solid ${C.border}` }}>
                <span style={{ display:"inline-flex", gap:4 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:6, height:6, borderRadius:"50%", backgroundColor:C.muted, display:"inline-block", animation:`bounce 1s ${i*0.2}s infinite` }}/>
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* サジェスト */}
        {messages.length <= 2 && !loading && (
          <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"0 14px 10px", flexShrink:0 }}>
            {SUGGESTIONS.map(s => (
              <div key={s} onClick={() => send(s)}
                style={{ flexShrink:0, padding:"7px 13px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  border:`1.5px solid ${C.accentLight}66`, color:C.accentLight, whiteSpace:"nowrap",
                  backgroundColor:C.accentLight+"11" }}>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* 入力欄 */}
        <div style={{ padding:"10px 12px 28px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, flexShrink:0 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="メッセージを入力…"
            disabled={loading}
            style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:22, padding:"11px 16px", fontSize:14, color:C.text, outline:"none" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              backgroundColor: input.trim() && !loading ? C.accentLight : C.border,
              color:"#fff", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)}
        }
      `}</style>
    </>
  );
}
