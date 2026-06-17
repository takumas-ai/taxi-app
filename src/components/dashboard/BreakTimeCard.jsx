import { useState } from "react";
import { C, dow } from "../../lib/constants";
import { Card } from "../UI";

export default function BreakTimeCard({ reports, onUpdateReport }) {
  const [showInput,  setShowInput]  = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [collapsed,  setCollapsed]  = useState(true);
  const [inputDate,  setInputDate]  = useState(() => new Date().toISOString().slice(0,10));
  const [inputVal,   setInputVal]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: collapsed ? 0 : 12 }}>
          <div onClick={() => setCollapsed(p => !p)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.text }}>☕ 休憩時間</div>
            {withBreak.length > 0 && !collapsed && <span style={{ fontSize:10, color:C.muted }}>計 {totalBreak}h</span>}
            <span style={{ fontSize:11, color:C.muted, marginLeft:2 }}>{collapsed ? "▼" : "▲"}</span>
          </div>
          {!collapsed && (
            <button onClick={() => setShowInput(p => !p)}
              style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {showInput ? "閉じる" : "＋ 記録する"}
            </button>
          )}
        </div>

        {!collapsed && <>
          {showInput && (
            <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ marginBottom:8 }}>
                <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                  style={{ ...inp, width:"100%", boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="number" step="0.5" min="0" max="24" value={inputVal}
                  onChange={e => setInputVal(e.target.value)} placeholder="例) 1.0" style={{ ...inp, flex:1 }} />
                <span style={{ fontSize:13, color:C.muted }}>h</span>
                <button onClick={handleSave} disabled={saving || !inputVal}
                  style={{ padding:"9px 18px", borderRadius:9, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", opacity:(saving||!inputVal)?0.5:1 }}>
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          )}

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
            {withBreak.map(r => <BreakRow key={r.id} r={r} compact={false} />)}
          </div>
        </div>
      )}
    </>
  );
}
