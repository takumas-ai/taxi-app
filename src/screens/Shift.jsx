// シフト管理画面
import { useState, useEffect, useRef } from "react";
import { C, TODAY, THIS_YEAR, THIS_MONTH, loadS, saveS, fmt, dow } from "../lib/constants";
import { Card, Btn, ProgressBar, Badge, KpiCard } from "../components/UI";
import { MOCK_SHIFTS } from "../data/mockData";
import { runShiftOCR } from "../lib/ai";
import { fetchShifts, upsertShifts, deleteShift } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const MONTH_DAYS = (y,m) => new Date(y,m,0).getDate();

function BackBar({ onBack }) {
  if (!onBack) return null;
  return (
    <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,fontWeight:600,cursor:"pointer",padding:"0 0 12px",marginLeft:-2}}>
      <span style={{fontSize:16}}>‹</span> ホームに戻る
    </button>
  );
}
const OCR_LINES = ["画像を読み込み中...","AIに送信中...","出勤日を検出中...","出庫・帰庫時刻を読み取り中...","読み取り完了 ✓"];

function ShiftCalendar({ year, month, shifts, reports, onSelectDay }) {
  const totalDays = MONTH_DAYS(year, month);
  const firstDow  = new Date(year, month-1, 1).getDay();
  const shiftMap  = Object.fromEntries(shifts.map(s=>[s.date,s]));
  const reportMap = Object.fromEntries(reports.map(r=>[r.date,r]));
  const cells = [];
  for (let i=0;i<firstDow;i++) cells.push(null);
  for (let d=1;d<=totalDays;d++) cells.push(d);
  const dateStr = d => `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {["日","月","火","水","木","金","土"].map((d,i)=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:i===0?C.red:i===6?C.accentLight:C.muted, padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {cells.map((d,i)=>{
          if (!d) return <div key={`e${i}`}/>;
          const ds=dateStr(d), shift=shiftMap[ds], rep=reportMap[ds], isToday=ds===TODAY, isPast=ds<TODAY, wi=i%7;
          let bg=C.card, border=C.border;
          if (isToday)    { bg=C.accentLight+"33"; border=C.accentLight; }
          if (shift&&rep) { bg=C.green+"25"; border=C.green; }
          else if (shift) { bg=C.green+"18"; border=C.green+"66"; }
          else if (rep)   { border=C.gold; }
          return (
            <div key={ds} onClick={()=>onSelectDay(ds,shift,rep)} style={{ backgroundColor:bg, border:`1.5px solid ${border}`, borderRadius:8, padding:"4px 2px", minHeight:44, cursor:"pointer" }}>
              <div style={{ textAlign:"center", fontSize:11, fontWeight:isToday?900:wi===0?700:400, color:isToday?C.accentLight:wi===0?C.red:wi===6?C.accentLight:C.text }}>{d}</div>
              {shift&&<div style={{ textAlign:"center", fontSize:8, color:C.green, marginTop:1 }}>出{shift.clockIn}</div>}
              {rep&&<div style={{ textAlign:"center", fontSize:8, marginTop:1 }}>💴</div>}
              {shift&&!rep&&isPast&&<div style={{ textAlign:"center", fontSize:8, color:C.orange, marginTop:1 }}>未入力</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
        {[{color:C.green,label:"出勤予定"},{color:C.gold,label:"日報入力済"},{color:C.accentLight,label:"今日"}].map(({color,label})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:8, height:8, borderRadius:2, backgroundColor:color }}/><span style={{ fontSize:10, color:C.muted }}>{label}</span></div>
        ))}
      </div>
    </div>
  );
}

function DayDetailModal({ dateStr, shift, report, onClose, onDeleteShift, onGoUpload, onSaveShift }) {
  const d = new Date(dateStr), wd = ["日","月","火","水","木","金","土"][d.getDay()], isPast = dateStr < TODAY;
  const [editing, setEditing] = useState(!shift); // シフトなし → すぐ入力フォーム
  const [form, setForm]       = useState({ clockIn: shift?.clockIn||"", clockOut: shift?.clockOut||"", note: shift?.note||"" });
  const [saving, setSaving]   = useState(false);

  const inp = { backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 11px", color:C.text, fontSize:14, outline:"none", width:"100%", boxSizing:"border-box" };

  const handleSave = async () => {
    setSaving(true);
    await onSaveShift({
      id:       shift?.id || ("manual_" + Date.now()),
      date:     dateStr,
      clockIn:  form.clockIn,
      clockOut: form.clockOut,
      isNight:  false,
      note:     form.note,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:150, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:36, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>{dateStr}（{wd}）</div>

        {/* シフト入力・編集フォーム */}
        {editing ? (
          <div style={{ backgroundColor:C.green+"12", border:`1px solid ${C.green}44`, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.green, fontWeight:700, marginBottom:12 }}>📅 {shift ? "シフトを編集" : "シフトを追加"}</div>
            <div style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>出庫時刻</div>
                <input value={form.clockIn} onChange={e=>setForm(p=>({...p,clockIn:e.target.value}))} placeholder="例: 07:00" style={inp}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>帰庫時刻</div>
                <input value={form.clockOut} onChange={e=>setForm(p=>({...p,clockOut:e.target.value}))} placeholder="例: 20:00" style={inp}/>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>メモ（任意）</div>
              <textarea
                value={form.note}
                onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                placeholder={"急な変更・当番など自由に\n複数行OK"}
                rows={3}
                style={{ ...inp, resize:"vertical", lineHeight:1.6 }}
              />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex:1, backgroundColor:C.green, color:"#fff", border:"none", borderRadius:9, padding:"11px 0", fontSize:14, fontWeight:700, cursor:saving?"not-allowed":"pointer", opacity:saving?0.6:1 }}>
                {saving ? "保存中..." : shift ? "更新する" : "追加する"}
              </button>
              {shift && <button onClick={()=>setEditing(false)} style={{ flex:1, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 0", fontSize:13, color:C.muted, cursor:"pointer" }}>キャンセル</button>}
            </div>
          </div>
        ) : shift ? (
          <div style={{ backgroundColor:C.green+"18", border:`1px solid ${C.green}44`, borderRadius:10, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:12, color:C.green, fontWeight:700 }}>📅 出勤予定</div>
              <button onClick={()=>setEditing(true)} style={{ fontSize:11, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontWeight:600 }}>編集</button>
            </div>
            <div style={{ display:"flex", gap:20, marginBottom: shift.note ? 8 : 0 }}>
              <div><div style={{ fontSize:10, color:C.muted }}>出庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockIn||"—"}</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>帰庫</div><div style={{ fontSize:16, fontWeight:700 }}>{shift.clockOut||"—"}</div></div>
            </div>
            {shift.note && <div style={{ fontSize:12, color:C.sub, whiteSpace:"pre-wrap", backgroundColor:C.bg, borderRadius:7, padding:"8px 10px" }}>📝 {shift.note}</div>}
            <button onClick={()=>onDeleteShift(shift)} style={{ marginTop:10, backgroundColor:"transparent", border:`1px solid ${C.red}44`, borderRadius:8, padding:"6px 14px", fontSize:11, color:C.red, cursor:"pointer", fontWeight:600 }}>このシフトを削除</button>
          </div>
        ) : null}

        {/* 日報 */}
        {report ? (
          <div style={{ backgroundColor:C.goldGlow, border:`1px solid ${C.gold}44`, borderRadius:10, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.gold, fontWeight:700, marginBottom:6 }}>💴 日報入力済み</div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div><div style={{ fontSize:10, color:C.muted }}>総売上（税抜）</div><div style={{ fontSize:18, fontWeight:800, color:C.gold }}>{fmt(report.gross_sales)}円</div></div>
              <div><div style={{ fontSize:10, color:C.muted }}>営業回数</div><div style={{ fontSize:18, fontWeight:800 }}>{report.ride_count}回</div></div>
            </div>
          </div>
        ) : shift && isPast && !editing ? (
          <div style={{ backgroundColor:C.orangeGlow, border:`1px solid ${C.orange}44`, borderRadius:10, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:12, color:C.orange, fontWeight:700, marginBottom:4 }}>⚠️ 日報が未入力です</div>
            <button onClick={onGoUpload} style={{ width:"100%", backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:9, padding:"10px 0", fontSize:13, fontWeight:700, cursor:"pointer" }}>日報をアップロードする →</button>
          </div>
        ) : null}

        <button onClick={onClose} style={{ width:"100%", backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:11, padding:"13px 0", fontSize:14, fontWeight:600, color:C.muted, cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

// SupabaseのDBレコード → ローカル形式に変換
const dbToLocal = (row) => ({
  id:       row.id,
  date:     row.shift_date,
  clockIn:  row.clock_in  || "",
  clockOut: row.clock_out || "",
  isNight:  row.is_night  || false,
  note:     row.note      || "",
});

export default function ShiftScreen({ reports, onGoUpload, user, onBack }) {
  // Supabase使用時はlocalStorageを初期値に使わない（古いデータが残る原因）
  const [shifts, setShifts]         = useState(SUPABASE_READY ? [] : ()=>loadS("taxi_shifts",[]));
  const [loading, setLoading]       = useState(SUPABASE_READY);
  const [viewMonth, setViewMonth]   = useState({year:THIS_YEAR,month:THIS_MONTH});
  const [ocrStep, setOcrStep]       = useState("idle");
  const [ocrResult, setOcrResult]   = useState(null);
  const [ocrLines, setOcrLines]     = useState([]);
  const [ocrError, setOcrError]     = useState("");
  const [editShifts, setEditShifts] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayShift, setDayShift]     = useState(null);
  const [dayReport, setDayReport]   = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const ocrRunningRef = useRef(false); // 二重実行防止

  // Supabaseからシフトを読み込む
  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) { setLoading(false); return; }
    fetchShifts(user.id).then(({ data }) => {
      const local = (data ?? []).map(dbToLocal);
      setShifts(local);
      saveS("taxi_shifts", local);
      setLoading(false);
    });
  }, [user?.id]);

  // ローカルにも保存（オフライン時のキャッシュ）
  useEffect(()=>{ if(!loading) saveS("taxi_shifts",shifts); },[shifts, loading]);

  const monthShifts     = shifts.filter(s=>{const d=new Date(s.date);return d.getFullYear()===viewMonth.year&&d.getMonth()+1===viewMonth.month;});
  const monthReports    = reports.filter(r=>{const d=new Date(r.date);return d.getFullYear()===viewMonth.year&&d.getMonth()+1===viewMonth.month;});
  const remainingShifts = monthShifts.filter(s=>s.date>=TODAY).length;
  const reportMap       = Object.fromEntries(reports.map(r=>[r.date,r]));
  const missing         = monthShifts.filter(s=>s.date<TODAY&&!reportMap[s.date]);

  // ファイルピッカーを開く（label htmlFor で直接トリガー）

  // ドラッグ&ドロップ
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop      = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect({ target: { files: [file], value: "" } });
    }
  };

  // ファイル選択後にOCR実行
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (ocrRunningRef.current) return; // 二重実行防止
    ocrRunningRef.current = true;
    e.target.value = "";
    setOcrError("");
    setOcrStep("reading");
    setOcrLines([]);

    const addLine = (text) => setOcrLines(prev => [...prev, text]);

    try {
      addLine("画像を読み込み中...");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (ev) => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const MAX = 1600;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
              if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
              else { width = Math.round(width * MAX / height); height = MAX; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width; canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });

      addLine("AIに送信中...");
      addLine("出勤日を検出中...");

      const data = await runShiftOCR(base64, "image/jpeg");
      if (!data) throw new Error("OCRエラー（claude-proxy）");

      addLine("出庫・帰庫時刻を読み取り中...");
      await new Promise(r => setTimeout(r, 300));
      addLine("読み取り完了 ✓");
      await new Promise(r => setTimeout(r, 400));

      const f = data?.fields ?? {};
      const parsedShifts = Array.isArray(f.shifts) ? f.shifts : [];
      // dateFrom/dateTo がある場合はそちらを使う（2ヶ月またぎ対応）
      const dateFrom = f.dateFrom ?? null;
      const dateTo   = f.dateTo   ?? null;
      // year/month は後方互換のため dateFrom から取得
      const startDate = dateFrom ? new Date(dateFrom) : new Date();
      const result = {
        year:     f.year  ?? startDate.getFullYear(),
        month:    f.month ?? (startDate.getMonth() + 1),
        dateFrom,
        dateTo,
        shifts: parsedShifts,
        confidence: f.confidence ?? 80,
        notes: f.notes ?? "",
      };
      setOcrResult(result);
      setEditShifts(result.shifts.map((s, i) => ({ ...s, id: "ocr_" + i })));
      setOcrStep("confirm");
    } catch (err) {
      console.error("[ShiftOCR]", err);
      setOcrError(err.message || "読み取りに失敗しました");
      setOcrStep("ocr_error");
      ocrRunningRef.current = false; // エラー時のみリセット（再試行を許可）
    }
    // ※ 成功時は confirm/done 表示中に onChange が再発火しても OCR が走らないよう
    //    ocrRunningRef.current = true のままにする。「やり直す」押下時にリセット。
  };

  const handleSaveShifts = async () => {
    // dateFrom/dateTo があればその期間を削除、なければ year/month で削除
    const others = shifts.filter(s => {
      if (ocrResult.dateFrom && ocrResult.dateTo) {
        return s.date < ocrResult.dateFrom || s.date > ocrResult.dateTo;
      }
      const d = new Date(s.date);
      return !(d.getFullYear() === ocrResult.year && d.getMonth() + 1 === ocrResult.month);
    });
    const next = [...others, ...editShifts];
    setShifts(next);
    setViewMonth({year:ocrResult.year, month:ocrResult.month});
    setOcrStep("done");
    // Supabaseに保存
    if (SUPABASE_READY && user?.id) {
      await upsertShifts(user.id, editShifts);
    }
  };

  const prevMonth = () => setViewMonth(v=>v.month===1?{year:v.year-1,month:12}:{year:v.year,month:v.month-1});
  const nextMonth = () => setViewMonth(v=>v.month===12?{year:v.year+1,month:1}:{year:v.year,month:v.month+1});

  if (loading) {
    return <div style={{maxWidth:480,margin:"0 auto",padding:"60px 16px",textAlign:"center",color:C.muted}}>シフトを読み込み中...</div>;
  }

  if (ocrStep==="ocr_error") {
    return (
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px",textAlign:"center"}}>
        <BackBar onBack={onBack}/>
        <Card style={{padding:32}}>
          <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>読み取りに失敗しました</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:20}}>{ocrError || "もう一度試してください"}</div>
          <Btn onClick={()=>{ ocrRunningRef.current = false; fileInputRef.current?.click(); }} style={{marginBottom:10}}>もう一度撮影する</Btn>
          <Btn onClick={()=>{ ocrRunningRef.current = false; setOcrStep("idle"); }} variant="ghost">キャンセル</Btn>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{display:"none"}}/>
        </Card>
      </div>
    );
  }

  if (ocrStep==="reading") {
    return (
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
        <BackBar onBack={onBack}/>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:36,marginBottom:10}}>🤖</div><div style={{fontSize:15,fontWeight:700}}>シフト表を読み取り中...</div></div>
        <Card><ProgressBar value={ocrLines.length} max={OCR_LINES.length} color={C.accentLight} height={6}/><div style={{marginTop:14}}>{ocrLines.map((l,i)=><div key={i} style={{fontSize:13,color:i===ocrLines.length-1?C.text:C.muted,padding:"5px 0",borderBottom:i<ocrLines.length-1?`1px solid ${C.border}`:"none"}}>{l}</div>)}</div></Card>
      </div>
    );
  }

  if (ocrStep==="confirm") {
    // 月ごとにグループ化
    const sorted = [...editShifts].sort((a,b)=>a.date.localeCompare(b.date));
    const byMonth = {};
    sorted.forEach((s,idx)=>{
      const m = s.date.slice(0,7);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push({...s, _idx: editShifts.indexOf(s)});
    });
    const monthKeys = Object.keys(byMonth).sort();

    return (
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
        <BackBar onBack={onBack}/>
        <div style={{fontSize:13,color:C.muted,marginBottom:4}}>📅 読み取り結果を確認してください</div>
        <div style={{fontSize:11,color:C.sub,marginBottom:12}}>
          {ocrResult?.dateFrom && ocrResult?.dateTo
            ? `${ocrResult.dateFrom} 〜 ${ocrResult.dateTo}`
            : `${ocrResult?.year}年${ocrResult?.month}月`}
          {` / 信頼度 ${ocrResult?.confidence}% / ${editShifts.length}出勤日`}
        </div>
        {ocrResult?.notes&&<Card style={{padding:12,marginBottom:12}}><div style={{fontSize:11,color:C.muted}}>🤖 {ocrResult.notes}</div></Card>}
        {monthKeys.map(mk=>{
          const [y,m] = mk.split("-");
          return (
            <div key={mk}>
              <div style={{fontSize:12,fontWeight:700,color:C.accentLight,marginBottom:8,marginTop:monthKeys.indexOf(mk)>0?16:0}}>
                {parseInt(y)}年{parseInt(m)}月
              </div>
              {byMonth[mk].map((s)=>{
                const idx = s._idx;
                const wd=["日","月","火","水","木","金","土"][new Date(s.date).getDay()];
                return (
                  <div key={s.id} style={{backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{minWidth:70}}><div style={{fontSize:13,fontWeight:700}}>{s.date.slice(5)}</div><div style={{fontSize:10,color:C.muted}}>（{wd}）</div></div>
                    <div style={{display:"flex",gap:12,flex:1}}>
                      <div><div style={{fontSize:9,color:C.muted}}>出庫</div><input value={s.clockIn} onChange={e=>setEditShifts(prev=>prev.map((x,j)=>j===idx?{...x,clockIn:e.target.value}:x))} style={{backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:13,width:60,outline:"none"}}/></div>
                      <div><div style={{fontSize:9,color:C.muted}}>帰庫</div><input value={s.clockOut} onChange={e=>setEditShifts(prev=>prev.map((x,j)=>j===idx?{...x,clockOut:e.target.value}:x))} style={{backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:13,width:72,outline:"none"}}/></div>
                    </div>
                    <button onClick={()=>setEditShifts(prev=>prev.filter((_,j)=>j!==idx))} style={{backgroundColor:"transparent",border:"none",color:C.red,fontSize:16,cursor:"pointer"}}>×</button>
                  </div>
                );
              })}
            </div>
          );
        })}
        <Btn onClick={handleSaveShifts}>{editShifts.length}日分のシフトを保存する</Btn>
        <Btn onClick={()=>{ ocrRunningRef.current = false; setOcrStep("idle"); }} variant="ghost" style={{marginTop:10}}>やり直す</Btn>
      </div>
    );
  }

  if (ocrStep==="done") {
    return (
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px",textAlign:"center"}}>
        <BackBar onBack={onBack}/>
        <Card style={{padding:32}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>シフトを保存しました</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:20}}>{editShifts.length}日分の出勤予定が登録されました</div>
          <Btn onClick={()=>{ ocrRunningRef.current = false; setOcrStep("idle"); }}>カレンダーを確認する</Btn>
        </Card>
      </div>
    );
  }

  // 月跨ぎ検出: viewMonth の翌月にもシフトがあれば2ヶ月表示
  const nextM = viewMonth.month===12?{year:viewMonth.year+1,month:1}:{year:viewMonth.year,month:viewMonth.month+1};
  const nextMonthShifts  = shifts.filter(s=>{const d=new Date(s.date);return d.getFullYear()===nextM.year&&d.getMonth()+1===nextM.month;});
  const nextMonthReports = reports.filter(r=>{const d=new Date(r.date);return d.getFullYear()===nextM.year&&d.getMonth()+1===nextM.month;});
  const showTwoMonths = nextMonthShifts.length > 0;

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
      <BackBar onBack={onBack}/>
      {missing.length>0&&(
        <div style={{backgroundColor:C.orangeGlow,border:`1px solid ${C.orange}44`,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontSize:11,color:C.orange,fontWeight:700,marginBottom:4}}>📝 日報が未入力の出勤日があります</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{missing.map(s=><span key={s.id} onClick={onGoUpload} style={{fontSize:11,backgroundColor:C.orange+"22",color:C.orange,padding:"3px 8px",borderRadius:99,cursor:"pointer",fontWeight:600}}>{s.date.slice(5)}</span>)}</div>
        </div>
      )}
      {/* カレンダーはホーム画面（統合カレンダー）で確認できます */}
      <div style={{fontSize:11,color:C.muted,backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",marginBottom:14,textAlign:"center"}}>
        📅 カレンダーはホーム画面で確認・編集できます
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <KpiCard label="今月出勤数" value={monthShifts.length} unit="日" accent={C.green}/>
        <KpiCard label="残り出勤" value={remainingShifts} unit="日" accent={remainingShifts<=3?C.red:C.accentLight}/>
        <KpiCard label="日報入力済" value={monthReports.length} unit="日" accent={C.gold}/>
      </div>
      {/* ドラッグ&ドロップゾーン */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{border:`2px dashed ${isDragOver ? C.accentLight : C.border}`,borderRadius:14,padding:"16px 24px",textAlign:"center",marginBottom:8,transition:"border-color 0.2s, background-color 0.2s",backgroundColor:isDragOver ? C.accentLight+"18" : "transparent"}}
      >
        <div style={{fontSize:32,marginBottom:4}}>{isDragOver ? "📂" : "📋"}</div>
        <div style={{fontSize:12,color:C.muted}}>画像をここにドラッグ＆ドロップ</div>
      </div>
      {/* ファイル選択ボタン（label+input: MetaMask SES対応・JS不要） */}
      <label
        htmlFor="shift-ocr-btn"
        style={{display:"block",backgroundColor:C.accentLight,color:"#fff",borderRadius:11,padding:"13px 0",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"center",marginBottom:12}}
      >
        📂 シフト表ファイルを選択する
      </label>
      {/* display:noneをやめてオフスクリーン配置（MetaMask SESが.click()をブロックするため） */}
      <input
        id="shift-ocr-btn"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{position:"fixed",top:"-9999px",left:"-9999px",width:"1px",height:"1px"}}
      />
      {monthShifts.length>0&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>今月の出勤予定</div>
          {[...monthShifts].sort((a,b)=>a.date.localeCompare(b.date)).map(s=>{
            const wd=["日","月","火","水","木","金","土"][new Date(s.date).getDay()], rep=reportMap[s.date], isPast=s.date<TODAY;
            return <div key={s.id} onClick={()=>{setSelectedDay(s.date);setDayShift(s);setDayReport(rep||null);}} style={{backgroundColor:C.card,border:`1px solid ${rep?C.gold:C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
              <div style={{minWidth:52,textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:s.date===TODAY?C.accentLight:C.text}}>{s.date.slice(8)}</div><div style={{fontSize:10,color:C.muted}}>（{wd}）</div></div>
              <div style={{flex:1}}><div style={{fontSize:12,color:C.sub}}>{s.clockIn} 〜 {s.clockOut}</div>{s.note&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>📝 {s.note}</div>}</div>
              {rep&&<Badge color={C.gold}>日報済</Badge>}{!rep&&isPast&&<Badge color={C.orange}>未入力</Badge>}{!rep&&!isPast&&<Badge color={C.green}>予定</Badge>}
            </div>;
          })}
        </>
      )}
      {selectedDay&&<DayDetailModal
        dateStr={selectedDay}
        shift={dayShift}
        report={dayReport}
        onClose={()=>setSelectedDay(null)}
        onDeleteShift={async sh=>{setShifts(prev=>prev.filter(x=>x.id!==sh.id));setSelectedDay(null);if(SUPABASE_READY&&user?.id)await deleteShift(user.id,sh.date);}}
        onGoUpload={()=>{setSelectedDay(null);onGoUpload();}}
        onSaveShift={async s=>{
          setShifts(prev=>{
            const idx=prev.findIndex(x=>x.date===s.date);
            return idx>=0 ? prev.map((x,i)=>i===idx?s:x) : [...prev,s];
          });
          if(SUPABASE_READY&&user?.id) await upsertShifts(user.id,[s]);
        }}
      />}

    </div>
  );
}
