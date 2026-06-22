import { useState, useEffect } from "react";
import { C, fmt, loadS, saveS } from "../../lib/constants";
import { Card } from "../UI";
import { upsertShifts, deleteShift, fetchShifts } from "../../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DAYS = ["日","月","火","水","木","金","土"];

// ━━━ 日付詳細モーダル ━━━━━━━━━━━━━━━━━━━━━━━
function UnifiedDayModal({ dateStr, shift, report, onClose, onSaveShift, onDeleteShift, onOpenReport }) {
  const d = new Date(dateStr);
  const wd = DAYS[d.getDay()];
  const todayStr = new Date().toISOString().slice(0,10);
  const isPast = dateStr < todayStr;

  const [editing, setEditing] = useState(!shift);
  const [form, setForm] = useState({ clockIn:shift?.clockIn||"", clockOut:shift?.clockOut||"", note:shift?.note||"" });
  const [saving, setSaving] = useState(false);

  const inp = { backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 11px", color:C.text, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" };

  const handleSave = async () => {
    setSaving(true);
    await onSaveShift({ id:shift?.id||("manual_"+Date.now()), date:dateStr, clockIn:form.clockIn, clockOut:form.clockOut, isNight:false, note:form.note });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:36, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>{dateStr}（{wd}）</div>

        {editing ? (
          <div style={{ backgroundColor:C.accentLight+"12", border:`1px solid ${C.accentLight}33`, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginBottom:12 }}>📅 {shift?"シフトを編集":"シフトを追加"}</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>出庫</div><input value={form.clockIn} onChange={e=>setForm(p=>({...p,clockIn:e.target.value}))} placeholder="07:00" style={inp}/></div>
              <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>帰庫</div><input value={form.clockOut} onChange={e=>setForm(p=>({...p,clockOut:e.target.value}))} placeholder="20:00" style={inp}/></div>
            </div>
            <div style={{ marginBottom:12 }}><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>メモ</div><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} rows={2} placeholder="急な変更など" style={{ ...inp, resize:"vertical" }}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex:1, backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:9, padding:"11px 0", fontSize:13, fontWeight:700, cursor:"pointer", opacity:saving?0.6:1 }}>{saving?"保存中...":shift?"更新する":"追加する"}</button>
              {shift && <button onClick={()=>setEditing(false)} style={{ flex:1, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 0", fontSize:13, color:C.muted, cursor:"pointer" }}>キャンセル</button>}
            </div>
          </div>
        ) : shift ? (
          <div style={{ backgroundColor:C.green+"12", border:`1px solid ${C.green}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, color:C.green, fontWeight:700 }}>📅 出勤予定</div>
              <button onClick={()=>setEditing(true)} style={{ fontSize:11, color:C.accentLight, background:"transparent", border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontWeight:600 }}>編集</button>
            </div>
            <div style={{ display:"flex", gap:20, marginBottom:shift.note?8:0 }}>
              <div><div style={{ fontSize:10, color:C.muted }}>出庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockIn||"—"}</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>帰庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockOut||"—"}</div></div>
            </div>
            {shift.note && <div style={{ fontSize:12, color:C.sub, whiteSpace:"pre-wrap", backgroundColor:C.bg, borderRadius:7, padding:"8px 10px" }}>📝 {shift.note}</div>}
            <button onClick={()=>onDeleteShift(shift)} style={{ marginTop:10, background:"transparent", border:`1px solid ${C.red}44`, borderRadius:8, padding:"6px 14px", fontSize:11, color:C.red, cursor:"pointer", fontWeight:600 }}>削除</button>
          </div>
        ) : (
          <div style={{ backgroundColor:C.border+"33", borderRadius:10, padding:"10px 14px", marginBottom:12, textAlign:"center", fontSize:12, color:C.muted }}>出勤予定なし</div>
        )}

        {report ? (
          <div style={{ backgroundColor:C.goldGlow||C.gold+"12", border:`1px solid ${C.gold}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:8 }}>💴 日報入力済み</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:10, color:C.muted }}>総売上（税抜）</div><div style={{ fontSize:22, fontWeight:900, color:C.gold }}>{fmt(report.gross_sales)}円</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>営業回数</div><div style={{ fontSize:22, fontWeight:900 }}>{report.ride_count}回</div></div>
            </div>
            <button onClick={()=>{ onOpenReport(report); onClose(); }} style={{ marginTop:10, width:"100%", backgroundColor:C.gold+"22", color:C.gold, border:`1px solid ${C.gold}44`, borderRadius:9, padding:"9px 0", fontSize:12, fontWeight:700, cursor:"pointer" }}>日報の詳細を見る →</button>
          </div>
        ) : isPast && shift ? (
          <div style={{ backgroundColor:C.orange+"12", border:`1px solid ${C.orange}44`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.orange, fontWeight:700, marginBottom:4 }}>⚠️ 日報が未入力です</div>
            <div style={{ fontSize:11, color:C.muted }}>「記録する（＋）」から日報を登録してください</div>
          </div>
        ) : null}

        <button onClick={onClose} style={{ width:"100%", backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:11, padding:"13px 0", fontSize:14, fontWeight:600, color:C.muted, cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

// ━━━ カレンダー本体 ━━━━━━━━━━━━━━━━━━━━━━━━━
function UnifiedCalendar({ reports, monthTarget, user, onOpenReport, noCard = false }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const [viewYear,    setViewYear]    = useState(today.getFullYear());
  const [viewMonth,   setViewMonth]   = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayShift,    setDayShift]    = useState(null);
  const [dayReport,   setDayReport]   = useState(null);
  const [shifts,      setShifts]      = useState(() => loadS("taxi_shifts", []));

  // Supabaseからシフトを取得してlocalStorageと同期（デバイス間共有）
  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) return;
    fetchShifts(user.id).then(({ data }) => {
      if (!data?.length) return;
      const mapped = data.map(s => ({
        id:       s.id || ("sb_" + s.shift_date),
        date:     s.shift_date,
        clockIn:  s.clock_in  || "",
        clockOut: s.clock_out || "",
        isNight:  s.is_night  || false,
        note:     s.note      || "",
      }));
      setShifts(mapped);
      saveS("taxi_shifts", mapped);
    });
  }, [user?.id]);

  const ym = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;
  const monthReports = reports.filter(r => r.date?.startsWith(ym));
  const monthShifts  = shifts.filter(s => s.date?.startsWith(ym));

  const reportByDate = {};  monthReports.forEach(r => { reportByDate[r.date] = r; });
  const shiftByDate  = {};  monthShifts.forEach(s  => { shiftByDate[s.date]  = s; });

  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => viewMonth===0 ? (setViewYear(y=>y-1), setViewMonth(11)) : setViewMonth(m=>m-1);
  const nextMonth = () => viewMonth===11? (setViewYear(y=>y+1), setViewMonth(0))  : setViewMonth(m=>m+1);

  const handleSaveShift = async (s) => {
    const next = (() => {
      const idx = shifts.findIndex(x => x.date === s.date);
      return idx >= 0 ? shifts.map((x,i) => i===idx?s:x) : [...shifts, s];
    })();
    setShifts(next);
    saveS("taxi_shifts", next);
    if (SUPABASE_READY && user?.id) await upsertShifts(user.id, [s]);
  };

  const handleDeleteShift = async (sh) => {
    const next = shifts.filter(x => x.id !== sh.id);
    setShifts(next);
    saveS("taxi_shifts", next);
    if (SUPABASE_READY && user?.id) await deleteShift(user.id, sh.date);
    setSelectedDay(null);
  };

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const calendarBody = (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", color:C.sub, cursor:"pointer", fontSize:15 }}>‹</button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:800 }}>📅 {viewYear}年{viewMonth+1}月</div>
          <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>出勤 {monthShifts.length}日 · 日報 {monthReports.length}件</div>
        </div>
        <button onClick={nextMonth} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", color:C.sub, cursor:"pointer", fontSize:15 }}>›</button>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {[{color:C.green,label:"出勤+日報済"},{color:C.orange,label:"日報未入力"},{color:C.accentLight,label:"出勤予定"},{color:C.gold,label:"日報のみ"}].map(({color,label}) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:3 }}>
            <div style={{ width:8, height:8, borderRadius:2, backgroundColor:color }}/>
            <span style={{ fontSize:9, color:C.muted }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
        {DAYS.map((d,i) => (
          <div key={d} style={{ textAlign:"center", fontSize:9, color:i===0?C.red:i===6?C.accentLight:C.muted, fontWeight:700, paddingBottom:3 }}>{d}</div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i}/>;
          const dateStr  = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const shift    = shiftByDate[dateStr];
          const report   = reportByDate[dateStr];
          const isFuture = dateStr > todayStr;
          const isToday  = dateStr === todayStr;
          const isPast   = dateStr < todayStr;
          let bg = null;
          if (shift && report)      bg = C.green;
          else if (shift && isPast) bg = C.orange;
          else if (shift)           bg = C.accentLight;
          else if (report)          bg = C.gold;
          return (
            <div key={i}
              onClick={() => { setSelectedDay(dateStr); setDayShift(shift||null); setDayReport(report||null); }}
              style={{ borderRadius:6, padding:"4px 2px", textAlign:"center", cursor:"pointer", backgroundColor:bg?bg+"22":isFuture?"transparent":C.surface, border:isToday?`2px solid ${C.accentLight}`:`1px solid ${bg?bg+"55":C.border}`, minHeight:54, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", gap:1, opacity:isFuture&&!shift?0.4:1 }}>
              <div style={{ fontSize:10, color:isToday?C.accentLight:C.text, fontWeight:isToday?800:400 }}>{d}</div>
              {shift && <div style={{ fontSize:7, color:bg||C.muted, fontWeight:600, lineHeight:1.3 }}>{shift.clockIn&&shift.clockIn.slice(0,5)}<br/>{shift.clockOut&&shift.clockOut.slice(0,5)}</div>}
              {report && <div style={{ fontSize:8, color:C.gold, fontWeight:700, marginTop:1 }}>{(report.gross_sales/10000).toFixed(1)}万</div>}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <UnifiedDayModal
          dateStr={selectedDay} shift={dayShift} report={dayReport}
          onClose={()=>setSelectedDay(null)}
          onSaveShift={handleSaveShift} onDeleteShift={handleDeleteShift} onOpenReport={onOpenReport}
        />
      )}
    </>
  );

  if (noCard) return <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>{calendarBody}</div>;
  return <Card style={{ marginBottom:14, padding:"12px 14px" }}>{calendarBody}</Card>;
}

// ━━━ シフトサマリーカード（折りたたみ式カレンダー） ━━━
export function ShiftSummaryCard({ reports = [], user, onOpenReport, monthTarget = 0, onGoShift }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth() + 1;
  const todayStr = `${y}-${String(m).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const allShifts = loadS("taxi_shifts", []);
  const monthShifts = allShifts.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });
  const remaining = monthShifts.filter(s => s.date >= todayStr).length;
  const todayShift = monthShifts.find(s => s.date === todayStr);

  return (
    <Card style={{ marginBottom:14, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div onClick={() => setOpen(p=>!p)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
          <span style={{ fontSize:13, fontWeight:700 }}>📅 カレンダー</span>
          {todayShift && <span style={{ fontSize:10, backgroundColor:C.green+"22", color:C.green, fontWeight:700, padding:"2px 7px", borderRadius:99, textAlign:"center", lineHeight:1.3 }}>本日<br/>出勤</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={e=>{ e.stopPropagation(); onGoShift?.(); }}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:8, border:`1px solid ${C.accentLight}55`, backgroundColor:C.accentLight+"18", color:C.accentLight, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
            📷 シフトを読み取る
          </button>
          <div onClick={() => setOpen(p=>!p)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
            {monthShifts.length > 0
              ? <span style={{ fontSize:11, color:C.muted }}>残り{remaining}勤</span>
              : <span style={{ fontSize:11, color:C.red }}>未登録</span>}
            <span style={{ fontSize:11, color:C.muted }}>{open?"▲":"▼"}</span>
          </div>
        </div>
      </div>
      {open && <UnifiedCalendar reports={reports} monthTarget={monthTarget} user={user} onOpenReport={onOpenReport} noCard />}
    </Card>
  );
}

// デフォルトエクスポートはカレンダー単体（外部からの直接利用用）
export default UnifiedCalendar;
