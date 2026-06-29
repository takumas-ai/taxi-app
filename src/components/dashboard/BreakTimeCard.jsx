import { useState, useEffect, useRef } from "react";
import { C, dow } from "../../lib/constants";
import { Card } from "../UI";

// ローカル日付文字列 YYYY-MM-DD
function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function BreakTimeCard({ reports, onUpdateReport }) {
  const [showDetail, setShowDetail] = useState(false);
  const [collapsed,  setCollapsed]  = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [editVal,    setEditVal]    = useState("");

  // 入力モード: "timer" | "manual"
  const [inputMode,  setInputMode]  = useState(null); // null=非表示

  // ── 手入力モード ──
  const [inputDate, setInputDate] = useState(localDateStr);
  const [inputH,    setInputH]    = useState(1);   // 時間
  const [inputM,    setInputM]    = useState(0);   // 分（0/15/30/45）

  // ── タイマーモード ──
  const [timerState,   setTimerState]   = useState("idle"); // idle|running|paused|done
  const [timerBase,    setTimerBase]    = useState(0);      // 累計ms（現在の実行前分）
  const [timerStart,   setTimerStart]   = useState(null);   // 現在の開始timestamp
  const [timerDisplay, setTimerDisplay] = useState(0);      // 表示用ms（interval更新）
  const [timerEdit,    setTimerEdit]    = useState("");      // 停止後に編集できる分数
  const intervalRef = useRef(null);

  useEffect(() => {
    if (timerState === "running") {
      intervalRef.current = setInterval(() => setTimerDisplay(Date.now()), 500);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerState]);

  const elapsedMs = timerState === "running"
    ? timerBase + (timerDisplay - timerStart)
    : timerBase;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);

  const withBreak = [...reports]
    .filter(r => r.break_hours != null && r.break_hours !== "" && r.date)
    .sort((a, b) => (b.date||"").localeCompare(a.date||""));

  const totalBreak = Math.round(withBreak.reduce((s, r) => s + parseFloat(r.break_hours || 0), 0) * 10) / 10;
  const inp = { padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, backgroundColor:C.card, color:C.text, fontSize:13 };

  // ── 手入力保存 ──
  const handleManualSave = async () => {
    const val = Math.round((inputH + inputM / 60) * 100) / 100;
    if (val < 0) return;
    const target = reports.find(r => r.date === inputDate);
    if (!target) { alert("その日の日報がありません。先に日報を登録してください。"); return; }
    setSaving(true);
    await onUpdateReport?.({ ...target, break_hours: val });
    setSaving(false);
    setInputMode(null);
    setInputH(1);
    setInputM(0);
  };

  // ── タイマー操作 ──
  const timerStart_ = () => {
    const now = Date.now();
    setTimerStart(now);
    setTimerDisplay(now);
    setTimerState("running");
  };
  const timerPause = () => {
    setTimerBase(b => b + (Date.now() - timerStart));
    setTimerState("paused");
  };
  const timerResume = () => {
    const now = Date.now();
    setTimerStart(now);
    setTimerDisplay(now);
    setTimerState("running");
  };
  const timerStop = () => {
    const total = timerBase + (timerState === "running" ? Date.now() - timerStart : 0);
    setTimerBase(total);
    setTimerState("done");
    setTimerEdit(String(Math.round(total / 60000)));
  };
  const timerReset = () => {
    setTimerState("idle");
    setTimerBase(0);
    setTimerStart(null);
    setTimerEdit("");
  };

  // ── タイマー結果を保存 ──
  const handleTimerSave = async () => {
    const mins = parseInt(timerEdit, 10);
    if (isNaN(mins) || mins <= 0) return;
    const addHours = Math.round(mins * 100 / 60) / 100;
    const todayStr = localDateStr();
    const target = reports.find(r => r.date === todayStr);
    if (!target) { alert("今日の日報がありません。先に日報を登録してください。"); return; }
    const existing = parseFloat(target.break_hours || 0);
    const newVal   = Math.round((existing + addHours) * 100) / 100;
    setSaving(true);
    await onUpdateReport?.({ ...target, break_hours: newVal });
    setSaving(false);
    timerReset();
    setInputMode(null);
  };

  // ── 既存記録の編集・削除 ──
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

  const handleModeSelect = (mode) => {
    if (inputMode === mode) { setInputMode(null); return; }
    setInputMode(mode);
    if (mode === "manual") {
      setInputDate(localDateStr());
      setInputH(1);
      setInputM(0);
    }
  };

  const BreakRow = ({ r, compact }) => {
    const isEditing = editingId === r.id;
    return (
      <div style={{ backgroundColor: compact ? "transparent" : C.bg, borderRadius: compact ? 0 : 12, padding: compact ? "9px 0" : "12px 14px", marginBottom: compact ? 0 : 10, borderBottom: compact ? `1px solid ${C.border}` : "none" }}>
        {isEditing ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="number" step="0.5" min="0" max="24" value={editVal}
              onChange={e => setEditVal(e.target.value)} autoFocus style={{ ...inp, flex:1 }} />
            <span style={{ fontSize:12, color:C.muted }}>h</span>
            <button onClick={() => handleEdit(r)} disabled={saving || !editVal}
              style={{ padding:"7px 14px", borderRadius:8, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer", opacity:(saving||!editVal)?0.5:1 }}>
              {saving ? "…" : "保存"}
            </button>
            <button onClick={() => setEditingId(null)}
              style={{ padding:"7px 10px", borderRadius:8, backgroundColor:"transparent", border:`1px solid ${C.border}`, fontSize:12, color:C.muted, cursor:"pointer" }}>✕</button>
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
                  style={{ fontSize:11, color:C.accentLight, background:C.accentGlow||"transparent", border:`1px solid ${C.accentLight}44`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>編集</button>
                <button onClick={() => handleDelete(r)}
                  style={{ fontSize:11, color:C.red, background:"transparent", border:`1px solid ${C.red}44`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>削除</button>
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
            {withBreak.length > 0 && !collapsed && <span style={{ fontSize:10, color:C.muted }}>計 {totalBreak}h</span>}
            <span style={{ fontSize:11, color:C.muted, marginLeft:2 }}>{collapsed ? "▼" : "▲"}</span>
          </div>
          {/* タイマー動作中はヘッダーに経過時間を表示 */}
          {(timerState === "running" || timerState === "paused") && (
            <span style={{ fontSize:13, fontWeight:800, color: timerState==="running" ? C.accentLight : C.muted, fontVariantNumeric:"tabular-nums" }}>
              ⏱ {String(Math.floor(elapsedMs/3600000)).padStart(2,"0")}:{String(elapsedMin%60).padStart(2,"0")}:{String(elapsedSec).padStart(2,"0")}
            </span>
          )}
        </div>

        {!collapsed && <>
          {/* 記録方法の選択ボタン */}
          {timerState === "idle" && (
            <div style={{ display:"flex", gap:8, marginBottom: inputMode ? 12 : 0 }}>
              <button
                onClick={() => handleModeSelect("timer")}
                style={{ flex:1, padding:"9px 0", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer",
                  backgroundColor: inputMode==="timer" ? C.accentLight : "transparent",
                  color: inputMode==="timer" ? "#fff" : C.accentLight,
                  border: `1.5px solid ${C.accentLight}` }}>
                ⏱ タイマー計測
              </button>
              <button
                onClick={() => handleModeSelect("manual")}
                style={{ flex:1, padding:"9px 0", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer",
                  backgroundColor: inputMode==="manual" ? C.accentLight : "transparent",
                  color: inputMode==="manual" ? "#fff" : C.accentLight,
                  border: `1.5px solid ${C.accentLight}` }}>
                ✏️ 手入力
              </button>
            </div>
          )}

          {/* ── タイマーUI ── */}
          {inputMode === "timer" && timerState === "idle" && (
            <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"16px 14px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>休憩を開始したらボタンを押してください</div>
              <button onClick={timerStart_}
                style={{ padding:"12px 32px", borderRadius:12, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:15, fontWeight:800, cursor:"pointer" }}>
                ▶ 開始
              </button>
            </div>
          )}

          {(timerState === "running" || timerState === "paused") && (
            <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"16px 14px", marginBottom:12, textAlign:"center" }}>
              <div style={{ fontSize:40, fontWeight:900, color:C.text, fontVariantNumeric:"tabular-nums", letterSpacing:2, marginBottom:14 }}>
                {String(Math.floor(elapsedMs/3600000)).padStart(2,"0")}:{String(elapsedMin%60).padStart(2,"0")}:{String(elapsedSec).padStart(2,"0")}
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                {timerState === "running" ? (
                  <button onClick={timerPause}
                    style={{ padding:"10px 24px", borderRadius:10, backgroundColor:C.gold, color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    ⏸ 一時停止
                  </button>
                ) : (
                  <button onClick={timerResume}
                    style={{ padding:"10px 24px", borderRadius:10, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                    ▶ 再開
                  </button>
                )}
                <button onClick={timerStop}
                  style={{ padding:"10px 24px", borderRadius:10, backgroundColor:C.red||"#ef4444", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  ⏹ 終了
                </button>
              </div>
            </div>
          )}

          {timerState === "done" && (
            <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"16px 14px", marginBottom:12 }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>計測時間（分）を確認・修正して保存</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
                <input type="number" min="0" value={timerEdit}
                  onChange={e => setTimerEdit(e.target.value)}
                  style={{ ...inp, flex:1, fontSize:18, fontWeight:700, textAlign:"center" }} />
                <span style={{ fontSize:13, color:C.muted }}>分</span>
              </div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:12, textAlign:"center" }}>
                ≈ {timerEdit ? (Math.round(parseInt(timerEdit||0)*100/60)/100).toFixed(2) : "0.00"}h　今日の日報に加算されます
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleTimerSave} disabled={saving || !timerEdit}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:14, fontWeight:800, cursor:"pointer", opacity:(saving||!timerEdit)?0.5:1 }}>
                  {saving ? "保存中..." : "💾 保存"}
                </button>
                <button onClick={timerReset}
                  style={{ padding:"10px 18px", borderRadius:10, backgroundColor:"transparent", border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:"pointer" }}>
                  リセット
                </button>
              </div>
            </div>
          )}

          {/* ── 手入力UI ── */}
          {inputMode === "manual" && timerState === "idle" && (
            <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ marginBottom:10 }}>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                  style={{ ...inp, width:"100%", boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <div style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
                  <select value={inputH} onChange={e => setInputH(Number(e.target.value))}
                    style={{ width:"100%", backgroundColor:"transparent", border:"none", padding:"13px 12px", color:C.text, fontSize:16, outline:"none" }}>
                    {Array.from({length:9},(_,i)=>i).map(h => <option key={h} value={h}>{h}時間</option>)}
                  </select>
                </div>
                <div style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
                  <select value={inputM} onChange={e => setInputM(Number(e.target.value))}
                    style={{ width:"100%", backgroundColor:"transparent", border:"none", padding:"13px 12px", color:C.text, fontSize:16, outline:"none" }}>
                    {[0,15,30,45].map(m => <option key={m} value={m}>{String(m).padStart(2,"0")}分</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleManualSave} disabled={saving}
                style={{ width:"100%", padding:"10px 0", borderRadius:9, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", opacity:saving?0.5:1 }}>
                {saving ? "保存中..." : "保存"}
              </button>
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
        </>}
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
            {withBreak.length > 0 && (() => {
              const avg   = Math.round(withBreak.reduce((s,r) => s + parseFloat(r.break_hours), 0) / withBreak.length * 10) / 10;
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
            {withBreak.map(r => <BreakRow key={r.id} r={r} compact={false} />)}
          </div>
        </div>
      )}
    </>
  );
}
