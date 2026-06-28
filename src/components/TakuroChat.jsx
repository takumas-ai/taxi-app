// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TakuroChat.jsx — タクローとのチャット（ボトムシート）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useRef, useEffect } from "react";
import { C, loadS, saveS } from "../lib/constants";

const DAILY_LIMIT = 30;
const SUGGESTIONS = [
  "今日どうだった？",
  "アドバイスほしい",
  "愚痴聞いて",
  "稼ぐコツ教えて",
  "使い方を教えて",
];

const WELCOME = "お疲れさまです！今日も1日どうでしたか？なんでも話しかけてください 🦉";

// ローカルの日次カウント管理
function getTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  const saved = loadS("takuro_chat_daily", { date: "", count: 0 });
  if (saved.date !== today) return 0;
  return saved.count;
}
function incrementTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  const saved = loadS("takuro_chat_daily", { date: "", count: 0 });
  const count = saved.date === today ? saved.count + 1 : 1;
  saveS("takuro_chat_daily", { date: today, count });
  return count;
}

export default function TakuroChat({ onClose, user, callChat, showFAB = true, onToggleFAB }) {
  const [hideNotice, setHideNotice] = useState(false);
  const [messages, setMessages]     = useState([{ role: "assistant", content: WELCOME }]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [localCount, setLocalCount] = useState(() => getTodayCount());
  const [remaining, setRemaining]   = useState(DAILY_LIMIT - getTodayCount());
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isLimitReached = localCount >= DAILY_LIMIT;

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || loading || isLimitReached) return;

    // フロント側カウントチェック
    if (localCount >= DAILY_LIMIT) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "今日はたくさん話しましたね！また明日話しかけてください 🦉",
      }]);
      return;
    }

    setInput("");
    const newMessages = [...messages, { role: "user", content: t }];
    setMessages(newMessages);
    setLoading(true);

    // フロント側カウントを先にインクリメント
    const newCount = incrementTodayCount();
    setLocalCount(newCount);

    try {
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

      // reply はオブジェクト { text, remaining } の場合とstring両対応
      const text   = typeof reply === "string" ? reply : reply.text;
      const rem    = typeof reply === "object" && reply.remaining != null ? reply.remaining : DAILY_LIMIT - newCount;

      setMessages(prev => [...prev, { role: "assistant", content: text }]);
      setRemaining(rem);
    } catch (err) {
      // 429 レート制限エラー
      const msg = err?.message?.includes("rate_limit")
        ? "今日はたくさん話しましたね！また明日話しかけてください 🦉"
        : "少し時間をおいてもう一度試してください。";
      setMessages(prev => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      {/* オーバーレイ */}
      <div onClick={onClose}
        style={{ position:"fixed", inset:0, backgroundColor:"#00000055", zIndex:200 }} />

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
          {/* 残り件数バッジ */}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              fontSize:11, color: remaining <= 5 ? C.red : C.muted,
              fontWeight: remaining <= 5 ? 700 : 400,
            }}>
              残り{remaining}件/日
            </div>
            {onToggleFAB && (
              <button onClick={() => { onToggleFAB(); if (showFAB) setHideNotice(true); }}
                title={showFAB ? "ボタンを非表示にする" : "ボタンを表示する"}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 8px", fontSize:11, color:C.muted, cursor:"pointer", whiteSpace:"nowrap" }}>
                {showFAB ? "🙈 非表示" : "👁 表示"}
              </button>
            )}
            <div onClick={onClose} style={{ fontSize:22, color:C.muted, cursor:"pointer", padding:"4px 8px" }}>×</div>
          </div>
        </div>

        {/* 非表示にした際の案内 */}
        {hideNotice && (
          <div style={{ margin:"8px 14px 0", padding:"10px 14px", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, fontSize:12, color:C.sub, lineHeight:1.6 }}>
            🦉 ボタンを非表示にしました。<br/>
            <span style={{ color:C.accentLight, fontWeight:700 }}>設定 › 画面設定</span> からいつでも再表示できます。
          </div>
        )}

        {/* メッセージ一覧 */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start", gap:8, alignItems:"flex-end" }}>
              {m.role === "assistant" && (
                <div style={{ fontSize:20, flexShrink:0, marginBottom:2 }}>🦉</div>
              )}
              <div style={{
                maxWidth:"78%", padding:"10px 13px",
                borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
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
        {messages.length <= 2 && !loading && !isLimitReached && (
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

        {/* 上限到達メッセージ */}
        {isLimitReached && (
          <div style={{ padding:"12px 16px", textAlign:"center", fontSize:13, color:C.muted, flexShrink:0 }}>
            今日の上限（30件）に達しました。また明日！
          </div>
        )}

        {/* 入力欄 */}
        <div style={{ padding:"10px 12px 28px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, flexShrink:0 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={isLimitReached ? "今日の上限に達しました" : "メッセージを入力…"}
            disabled={loading || isLimitReached}
            style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:22, padding:"11px 16px", fontSize:14, color:C.text, outline:"none", opacity: isLimitReached ? 0.5 : 1 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading || isLimitReached}
            style={{ width:44, height:44, borderRadius:"50%", border:"none",
              cursor: input.trim() && !loading && !isLimitReached ? "pointer" : "not-allowed",
              backgroundColor: input.trim() && !loading && !isLimitReached ? C.accentLight : C.border,
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
