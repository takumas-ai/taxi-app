// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AiAnalysisScreen — AI分析履歴画面
// 5枚ごとに自動生成された分析を一覧表示
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { Card } from "../components/UI";
import { fetchAiAnalyses, markAnalysesRead } from "../lib/supabase";

export default function AiAnalysisScreen({ user, onBack, onMarkRead }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null); // 開いているカードのid

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    fetchAiAnalyses(user.id).then(({ data }) => {
      setAnalyses(data ?? []);
      setLoading(false);
    });
    // 画面を開いたら全て既読に
    markAnalysesRead(user.id).then(() => onMarkRead?.());
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  };

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>

      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={onBack}
          style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:"4px 8px 4px 0", lineHeight:1 }}>
          ←
        </button>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text }}>🧠 AI分析</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>日報5枚ごとに自動生成</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>読み込み中...</div>
      ) : analyses.length === 0 ? (
        <Card style={{ textAlign:"center", padding:"40px 16px" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:8 }}>まだ分析がありません</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.8 }}>
            日報を5枚記録するとAIが自動で分析します。<br />
            10枚、15枚…と記録が増えるたびに新しい分析が届きます。
          </div>
        </Card>
      ) : (
        <div>
          {analyses.map((a, i) => (
            <div key={a.id}
              style={{
                marginBottom:12,
                borderRadius:14,
                backgroundColor: a.is_read ? C.card : C.accentGlow,
                border: `1.5px solid ${a.is_read ? C.border : C.accentLight + "66"}`,
                overflow:"hidden",
              }}
            >
              {/* カードヘッダー */}
              <div
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                style={{ padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{
                    width:36, height:36, borderRadius:10,
                    backgroundColor: C.accentLight + "22",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:16, flexShrink:0,
                  }}>
                    {a.report_count === 0 ? "📋" : "🧠"}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color:C.text }}>
                      {a.report_count === 0
                        ? (() => {
                            // content の1行目から期間を取得: "[締め期間振り返り YYYY-MM-DD〜YYYY-MM-DD]"
                            const m = a.content?.match(/\[締め期間振り返り (.+?)〜(.+?)\]/);
                            return m ? `${m[1]}〜${m[2]} 締め期間振り返り` : "締め期間の振り返り";
                          })()
                        : `${a.report_count}枚目時点の分析`}
                      {!a.is_read && (
                        <span style={{ marginLeft:8, fontSize:9, backgroundColor:C.accentLight, color:"#fff", borderRadius:99, padding:"2px 7px", fontWeight:700 }}>NEW</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{fmtDate(a.created_at)}</div>
                  </div>
                </div>
                <span style={{ color:C.muted, fontSize:14, flexShrink:0 }}>{expanded === a.id ? "▲" : "▼"}</span>
              </div>

              {/* 展開コンテンツ */}
              {expanded === a.id && (
                <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:13, color:C.text, lineHeight:1.9, whiteSpace:"pre-wrap", marginTop:14 }}>
                    {a.content}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{ textAlign:"center", marginTop:24, fontSize:12, color:C.muted }}>
            {(() => {
              const latestMilestone = analyses.find(a => a.report_count > 0);
              const nextCount = latestMilestone ? Math.ceil(latestMilestone.report_count / 5) * 5 + 5 : 5;
              return `次の分析は${nextCount}枚目 または 締め期間終了後に届きます`;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
