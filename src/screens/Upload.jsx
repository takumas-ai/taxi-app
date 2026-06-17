import { useState, useRef, useEffect } from "react";
import { C, fmt, occ, dow, hourly, FREE_LIMIT } from "../lib/constants";
import { generateReportComment, runReportOCR, runReportOCRP2 } from "../lib/ai";
import { Card, Btn, ProgressBar } from "../components/UI";
import { RideMatchModal } from "../components/RideMatchModal";
import { ZONE_AREAS } from "../data/trafficZones";
import { supabase } from "../lib/supabase";
import { validateImageFile, validateReportForm, sanitizeReportData } from "../lib/validate";

const OCR_SEQ = ["画像を解析中...","日付・勤務時間を読み取り中...","売上データを抽出中...","営業回数・走行距離を確認中...","フォーマット差異を吸収中...","読み取り完了 ✓"];
const EMPTY = { date:new Date().toISOString().slice(0,10), gross_sales:"", cash_sales:"", card_sales:"", app_sales:"", ride_count:"", total_distance:"", occupied_distance:"", work_hours:"", break_hours:"1.0", highway_fee:"0", trouble_note:"", work_area:"", rides:[], break_times:[] };

// HEIC/HEIFをJPEG Blobに変換（heic2any CDN経由）
async function convertHeicToJpeg(file) {
  // heic2anyをCDNから動的ロード（初回のみ）
  if (!window._heic2any) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window._heic2any = window.heic2any;
  }
  const blob = await window._heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(blob) ? blob[0] : blob;
}

// 画像をリサイズしてbase64変換
async function imageToBase64(file) {
  // HEIC/HEIFはブラウザがデコードできないので先にJPEGへ変換
  const isHeic = file.type === "image/heic" || file.type === "image/heif"
    || file.name?.toLowerCase().endsWith(".heic")
    || file.name?.toLowerCase().endsWith(".heif");
  const src = isHeic ? await convertHeicToJpeg(file) : file;

  return new Promise((resolve, reject) => {
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
    reader.readAsDataURL(src);
  });
}

// break_times から break_hours を計算
function calcBreakHours(breakTimes) {
  if (!breakTimes || breakTimes.length === 0) return "1.0";
  const total = breakTimes.reduce((sum, bt) => {
    const [sh, sm] = bt.start.split(":").map(Number);
    const [eh, em] = bt.end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // 日付またぎ
    return sum + diff;
  }, 0);
  return String(Math.round(total / 60 * 10) / 10);
}

// ━━━ 乗車記録編集モーダル ━━━━━━━━━━━━━━━━━━━━━━━━
const PAYMENT_OPTIONS = ["現金", "カード", "GO", "S.RIDE", "DiDi", "Uber", "未収", "その他"];
const EMPTY_RIDE = { pickup_time:"", dropoff_time:"", pickup_area:"", dropoff_area:"", amount:"", passengers:1, payment:"現金", note:"" };

function RideEditModal({ ride, index, onSave, onDelete, onClose }) {
  const [r, setR] = useState({
    pickup_time:  ride.pickup_time  ?? "",
    dropoff_time: ride.dropoff_time ?? "",
    pickup_area:  ride.pickup_area  ?? "",
    dropoff_area: ride.dropoff_area ?? "",
    amount:       ride.amount       != null ? String(ride.amount) : "",
    passengers:   ride.passengers   ?? 1,
    payment:      ride.payment ?? (ride.cash != null ? "現金" : ride.note?.includes("カード") ? "カード" : "現金"),
    note:         ride.note         ?? "",
  });
  const set = (k, v) => setR(p => ({ ...p, [k]: v }));
  const isNew = index === -1;

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000bb", zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"20px 20px 40px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:16, color:C.text }}>
          {isNew ? "🚕 乗車記録を追加" : `🚕 乗車記録 #${index + 1} を編集`}
        </div>

        {/* 時刻 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          {[["乗車時刻","pickup_time"],["降車時刻","dropoff_time"]].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{label}</div>
              <input type="time" value={r[key]} onChange={e=>set(key,e.target.value)}
                style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
            </div>
          ))}
        </div>

        {/* 乗車地・降車地 */}
        {[["乗車地","pickup_area","例: 新宿区新宿3丁目"],["降車地","dropoff_area","例: 渋谷区道玄坂1丁目"]].map(([label,key,ph]) => (
          <div key={key} style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{label}</div>
            <input type="text" value={r[key]} onChange={e=>set(key,e.target.value)} placeholder={ph}
              style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
          </div>
        ))}

        {/* 金額・人数 */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>運賃（円）</div>
            <input type="number" value={r.amount} onChange={e=>set("amount",e.target.value)} placeholder="1800"
              style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>人数</div>
            <input type="number" min="1" max="9" value={r.passengers} onChange={e=>set("passengers",parseInt(e.target.value)||1)}
              style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
          </div>
        </div>

        {/* 支払い方法 */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>支払い方法</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {PAYMENT_OPTIONS.map(opt => (
              <div key={opt} onClick={()=>set("payment",opt)} style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:`1.5px solid ${r.payment===opt?C.accentLight:C.border}`, backgroundColor:r.payment===opt?C.accentLight+"22":"transparent", color:r.payment===opt?C.accentLight:C.muted, transition:"all 0.15s" }}>{opt}</div>
            ))}
          </div>
        </div>

        {/* 備考 */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>備考（任意）</div>
          <input type="text" value={r.note} onChange={e=>set("note",e.target.value)} placeholder="高速使用など"
            style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
        </div>

        <button onClick={()=>onSave({ ...r, amount: parseInt(r.amount)||0, passengers: parseInt(r.passengers)||1 })}
          style={{ width:"100%", padding:"14px 0", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff", marginBottom:10 }}>
          {isNew ? "追加する" : "保存する"}
        </button>
        {!isNew && (
          <button onClick={onDelete}
            style={{ width:"100%", padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", border:`1px solid ${C.red}44`, backgroundColor:"transparent", color:C.red, marginBottom:10 }}>
            この記録を削除する
          </button>
        )}
        <button onClick={onClose}
          style={{ width:"100%", padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

// 撮影ガイドのチェックリスト
const SHOT_GUIDE = [
  { icon:"📄", ok:"平らな場所に置く",            ng:"手で持ったまま撮らない"         },
  { icon:"☀️", ok:"明るさが均一な場所で撮る",     ng:"蛍光灯が片側だけに当たらないように" },
  { icon:"🔲", ok:"日報全体が枠内に収まるように", ng:"端が切れないようにする"           },
  { icon:"👆", ok:"真上から垂直に撮る",           ng:"斜めにならないように"             },
  { icon:"🚫", ok:"影が入らないようにする",        ng:"自分や手の影が映り込まないように"  },
];

// 撮影ガイドモーダル
function ShotGuideModal({ onShoot, onCancel }) {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000aa", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:40 }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>

        {/* タイトル */}
        <div style={{ fontSize:17, fontWeight:800, marginBottom:4 }}>📸 撮影前に確認してください</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:18 }}>この5点を守ると読み取り精度が大幅に上がります</div>

        {/* チェックリスト */}
        <div style={{ marginBottom:20 }}>
          {SHOT_GUIDE.map((g, i) => (
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 0", borderBottom:i<SHOT_GUIDE.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{g.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:3 }}>✅ {g.ok}</div>
                <div style={{ fontSize:11, color:C.muted }}>❌ {g.ng}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 確認チェックボックス */}
        <div onClick={()=>setChecked(p=>!p)} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:10, border:`1px solid ${checked?C.green+"66":C.border}`, backgroundColor:checked?C.green+"10":"transparent", cursor:"pointer", marginBottom:16 }}>
          <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?C.green:C.border}`, backgroundColor:checked?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
            {checked && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
          </div>
          <span style={{ fontSize:13, color:checked?C.green:C.sub, fontWeight:checked?700:400 }}>上記5点を確認しました</span>
        </div>

        <Btn onClick={onShoot} disabled={!checked}>
          {checked ? "撮影・ファイル選択に進む →" : "チェックを入れてから進んでください"}
        </Btn>
        <Btn onClick={onCancel} variant="ghost" style={{ marginTop:10 }}>キャンセル</Btn>
      </div>
    </div>
  );
}

// OCR結果をlocalStorageに保存・復元（タブ切り替えで消えないように）
const OCR_DRAFT_KEY = "taxi_ocr_draft";
function saveDraft(step, form, ocrLines) {
  if (step === "select" || step === "ocring") {
    localStorage.removeItem(OCR_DRAFT_KEY);
  } else {
    try { localStorage.setItem(OCR_DRAFT_KEY, JSON.stringify({ step, form, ocrLines })); } catch {}
  }
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(OCR_DRAFT_KEY) || "null"); } catch { return null; }
}

export default function UploadScreen({ uploadCount, onSave, reports, user }) {
  const draft = loadDraft();
  const [step, setStep]     = useState(draft?.step || "select");
  const [isManual, setIsManual] = useState(false);
  const [isClosure, setIsClosure] = useState(false);
  const [closureDate, setClosureDate] = useState(() => new Date().toISOString().slice(0,10));
  const [closureCount, setClosureCount] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm]     = useState(draft?.form || EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [ocrLines, setOcrLines] = useState(draft?.ocrLines || []);
  const [editingRideIdx, setEditingRideIdx] = useState(null); // null=非表示, -1=新規追加, 0以上=編集
  const [ocrProg, setOcrProg]   = useState(0);
  const [ocrError, setOcrError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [matchData, setMatchData] = useState(null); // { ocrRides, manualRecords }

  // step/form/ocrLines が変わったらlocalStorageに保存
  useEffect(() => { saveDraft(step, form, ocrLines); }, [step, form, ocrLines]);
  const fileInputRef = useRef(null);
  const remaining = FREE_LIMIT - uploadCount;

  // ━━ ドラッグ＆ドロップ: window レベルで直接拾う（React合成イベントを迂回）━━
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    const onDragOver = (e) => {
      e.preventDefault();
      if (stepRef.current === "select") setIsDragOver(true);
    };
    const onDragLeave = (e) => {
      // ウィンドウ外に出たときだけ解除
      if (e.clientX === 0 && e.clientY === 0) setIsDragOver(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      setIsDragOver(false);
      if (stepRef.current !== "select") return;
      const fileArr = Array.from(e.dataTransfer?.files || []);
      if (fileArr.length > 0) handleFileSelect({ target: { files: fileArr } });
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ガイドモーダルの「進む」→ファイルピッカーを開く
  const handleOCR = () => {
    setShowGuide(false);
    fileInputRef.current?.click();
  };

  // ファイル選択後にOCR実行（最大2枚）
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    if (files.length === 0) return;
    e.target.value = "";

    // 1枚目のバリデーション
    const fileCheck = validateImageFile(files[0]);
    if (!fileCheck.ok) {
      setOcrError(fileCheck.error);
      setStep("ocr_error");
      return;
    }
    setOcrError("");
    setStep("ocring");
    setOcrLines([]);
    setOcrProg(0);

    const addLine = (text, prog) => {
      setOcrLines(prev => [...prev, text]);
      setOcrProg(prog);
    };

    try {
      // ── 1枚目 ──
      addLine(files.length > 1 ? "1枚目を読み込み中..." : "画像を読み込み中...", 10);
      const base64_1 = await imageToBase64(files[0]);

      addLine("AIに送信中（1枚目）...", 25);
      await new Promise(r => setTimeout(r, 200));
      addLine("日付・売上データを抽出中...", 40);

      const result1 = await runReportOCR(base64_1, "image/jpeg");
      if (result1?.error === "monthly_limit_exceeded") {
        setStep("select"); // 選択画面に戻す（remaining<=0 の表示を出すため）
        return;
      }
      if (!result1) throw new Error("1枚目のOCRに失敗しました");

      const f = result1?.fields ?? {};
      let rides = Array.isArray(f.rides) ? f.rides : [];
      let breakTimes = Array.isArray(f.break_times) ? f.break_times : [];

      // ── 2枚目（乗車記録の続き）──
      if (files.length > 1) {
        addLine("2枚目を読み込み中（乗車記録の続き）...", 60);
        const base64_2 = await imageToBase64(files[1]);
        addLine("2枚目の乗車記録を抽出中...", 75);
        const result2 = await runReportOCRP2(base64_2, "image/jpeg");
        const f2 = result2?.fields ?? {};
        if (Array.isArray(f2.rides)) rides = [...rides, ...f2.rides];
        if (Array.isArray(f2.break_times)) breakTimes = [...breakTimes, ...f2.break_times];
      }

      addLine("走行距離・乗務時間を確認中...", 88);
      await new Promise(r => setTimeout(r, 300));
      addLine(`読み取り完了 ✓（乗車${rides.length}件）`, 100);
      await new Promise(r => setTimeout(r, 400));
      // ↓ matchDataがセットされた場合は照合モーダルが先に出るのでconfirmに飛ばさない
      let hasMatch = false;

      const today = new Date().toISOString().slice(0, 10);
      // break_hoursはbreak_timesから計算、なければOCR値かデフォルト
      const computedBreakHours = breakTimes.length > 0
        ? calcBreakHours(breakTimes)
        : (f.break_hours != null ? String(f.break_hours) : "1.0");

      const reportDate = f.report_date ?? f.date ?? today;

      // 同じ日の手入力乗車記録を照合候補として取得
      try {
        const allManual = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]");
        const sameDay = allManual.filter(r => (r.workDate || r.boardingTime?.slice(0,10)) === reportDate);
        if (sameDay.length > 0 && rides.length > 0) {
          setMatchData({ ocrRides: rides, manualRecords: sameDay });
          hasMatch = true;
        }
      } catch { /* ignore */ }

      setForm({
        date:               reportDate,
        gross_sales:        f.gross_sales        != null ? String(f.gross_sales)        : "",
        cash_sales:         f.cash_sales         != null ? String(f.cash_sales)         : "",
        card_sales:         f.card_sales         != null ? String(f.card_sales)         : "",
        app_sales:          f.app_sales          != null ? String(f.app_sales)          : "",
        ride_count:         f.ride_count         != null ? String(f.ride_count)         : rides.length > 0 ? String(rides.length) : "",
        total_distance:     f.total_distance     != null ? String(f.total_distance)     : "",
        occupied_distance:  f.occupied_distance  != null ? String(f.occupied_distance)
                          : rides.length > 0 ? String(Math.round(rides.reduce((s,r)=>s+(r.km||0),0)))
                          : "",
        work_hours:         f.work_hours         != null ? String(f.work_hours)         : "",
        break_hours:        computedBreakHours,
        highway_fee:        f.highway_fee        != null ? String(f.highway_fee)        : "0",
        trouble_note:       "",
        work_area:          f.work_area          ?? "",
        rides,
        break_times:        breakTimes,
      });
      setStep(hasMatch ? "select" : "confirm");
    } catch (err) {
      console.error("[OCR]", err);
      setOcrError(err.message || "読み取りに失敗しました");
      setStep("ocr_error");
    }
  };

  // 締め作業: 選択日の乗車記録を集計してconfirmへ
  const handleClosureLoad = () => {
    const allRecords = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]");
    const dayRecords = allRecords.filter(r =>
      (r.workDate || r.boardingTime?.slice(0,10)) === closureDate
    );
    if (dayRecords.length === 0) {
      alert("この日の乗車記録がありません\n先にホーム画面から乗車を記録してください");
      return;
    }
    const sum = (arr, fn) => arr.reduce((s, r) => s + (fn(r) || 0), 0);
    const grossSales   = sum(dayRecords, r => r.fare);
    const cashSales    = sum(dayRecords.filter(r => r.paymentMethod === "現金"), r => r.fare);
    const cardSales    = sum(dayRecords.filter(r => r.paymentMethod === "カード"), r => r.fare);
    const appSales     = sum(dayRecords.filter(r => ["配車アプリ","アプリ"].includes(r.paymentMethod)), r => r.fare);
    const highwayFee   = sum(dayRecords, r => r.highwayFee);
    const rides = dayRecords.map((r, i) => ({
      no:           i + 1,
      pickup_time:  r.boardingTime  ? r.boardingTime.slice(11,16)  : null,
      dropoff_time: r.dropoffTime   ? r.dropoffTime.slice(11,16)   : null,
      pickup_area:  r.pickupLocation  || r.spotName || null,
      dropoff_area: r.dropoffLocation || null,
      amount:       r.fare || 0,
      km:           null,
      point_name:   r.pickupLocation  || r.spotName || null,
      source:       "manual",
    }));
    setClosureCount(dayRecords.length);
    setForm({
      ...EMPTY,
      date:         closureDate,
      gross_sales:  String(grossSales),
      cash_sales:   cashSales  > 0 ? String(cashSales)  : "",
      card_sales:   cardSales  > 0 ? String(cardSales)  : "",
      app_sales:    appSales   > 0 ? String(appSales)   : "",
      ride_count:   String(dayRecords.length),
      highway_fee:  String(highwayFee),
      rides,
    });
    setIsManual(false);
    setIsClosure(true);
    setStep("confirm");
  };

  const [wantAiAdvice, setWantAiAdvice] = useState(false);

  const handleSave = async () => {
    // バリデーション（強化版）
    const { errors: validationErrors, isValid } = validateReportForm(form);
    if (!isValid) { setErrors(validationErrors); return; }

    setSaving(true);
    // サニタイズ（XSS対策・値のクランプ）
    const data = { id: Date.now(), ...sanitizeReportData(form), rides: form.rides ?? [], break_times: form.break_times ?? [] };
    // ユーザーがリクエストした場合のみAIコメント生成
    const comment = wantAiAdvice ? await generateReportComment(data, reports) : "";
    data.ai_comment = comment;
    setSaving(false); onSave(data); setForm(EMPTY); setIsManual(false); setWantAiAdvice(false);
    localStorage.removeItem(OCR_DRAFT_KEY); // 保存完了でdraftクリア
    setStep("done");
  };

  const F = ({label,fk,type="number",ph="",required=false,span=1}) => (
    <div style={{ gridColumn:`span ${span}` }}>
      <div style={{ fontSize:11, color:errors[fk]?C.red:C.muted, marginBottom:5 }}>{label}{required&&<span style={{color:C.red}}> *</span>}{errors[fk]&&<span style={{marginLeft:4}}>{errors[fk]}</span>}</div>
      <input type={type} value={form[fk]} placeholder={ph} onChange={e=>{setForm(p=>({...p,[fk]:e.target.value}));setErrors(p=>({...p,[fk]:""}));}} style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${errors[fk]?C.red:C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:15, outline:"none" }}/>
    </div>
  );

  if (remaining <= 0) {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px 100px" }}>
        <Card style={{ textAlign:"center", padding:32 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>今月の無料枠を使い切りました</div>
          <Btn variant="gold">月額480円で続ける</Btn>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px 100px", textAlign:"center" }}>
        <Card style={{ padding:32 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>保存しました</div>
          <div style={{ fontSize:13, color:C.sub, marginBottom:20 }}>日報を記録しました</div>
          <Btn onClick={()=>setStep("select")} variant="ghost">続けてアップロード</Btn>
        </Card>
      </div>
    );
  }

  if (step === "ocring") {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"40px 16px 100px" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}><div style={{ fontSize:36, marginBottom:10 }}>🦉</div><div style={{ fontSize:15, fontWeight:700 }}>タクローが読み取り中...</div></div>
        <Card>
          <ProgressBar value={ocrProg} max={100} color={C.accentLight} height={6}/>
          <div style={{ marginTop:14 }}>
            {ocrLines.map((l,i) => <div key={i} style={{ fontSize:13, color:i===ocrLines.length-1?C.text:C.muted, padding:"5px 0", borderBottom:i<ocrLines.length-1?`1px solid ${C.border}`:"none" }}>{l}</div>)}
          </div>
        </Card>
      </div>
    );
  }

  if (step === "ocr_error") {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"40px 16px 100px", textAlign:"center" }}>
        <Card style={{ padding:32 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>読み取りに失敗しました</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>{ocrError || "もう一度試すか、手動で入力してください"}</div>
          <Btn onClick={() => fileInputRef.current?.click()} style={{ marginBottom:10 }}>もう一度撮影する</Btn>
          <Btn onClick={() => { setIsManual(true); setForm(EMPTY); setStep("confirm"); }} variant="ghost">手動で入力する</Btn>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display:"none" }}/>
        </Card>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
        <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
          {isClosure ? `🚕 乗車記録 ${closureCount}件から自動集計 — 勤務時間を入力して保存` : isManual ? "📝 日報を入力してください" : "📋 読み取り結果を確認・修正してください"}
        </div>
        <Card>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {F({label:"日付", fk:"date", type:"date", required:true, span:2})}
            {F({label:"売上（税込）（円）", fk:"gross_sales", required:true, ph:"62000"})}
            {F({label:"営業回数（回）", fk:"ride_count", ph:"30"})}
            {F({label:"売上（税抜）（円）", fk:"cash_sales", ph:"37000"})}
            {F({label:"カード売上（円）", fk:"card_sales", ph:"18000"})}
            {F({label:"配車アプリ（円）", fk:"app_sales", ph:"7000", span:2})}
            {F({label:"走行距離（km）", fk:"total_distance", ph:"300"})}
            {F({label:"実車距離（km）", fk:"occupied_distance", ph:"155"})}
            {F({label:"勤務時間（h）", fk:"work_hours", ph:"13.5"})}
            {F({label:"休憩時間（h）", fk:"break_hours", ph:"1.0"})}
            {F({label:"高速料金（円）", fk:"highway_fee", ph:"800", span:2})}
          </div>
          {/* 営業エリア選択（所属交通圏でフィルタ） */}
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📍 今日のメインエリア（統計に使用）</div>
            <select value={form.work_area} onChange={e=>setForm(p=>({...p,work_area:e.target.value}))} style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:form.work_area?C.text:C.muted, fontSize:14, outline:"none" }}>
              <option value="">選択してください（任意）</option>
              {(() => {
                const userZones = user?.areas || [];
                // 所属交通圏が設定済みならその圏内エリアのみ表示
                // 未設定なら全交通圏を表示
                const zonesToShow = userZones.length > 0
                  ? userZones.filter(z => ZONE_AREAS[z])
                  : Object.keys(ZONE_AREAS);
                return zonesToShow.map(zone => (
                  <optgroup key={zone} label={zone}>
                    {(ZONE_AREAS[zone] || []).map(a => <option key={a} value={a}>{a}</option>)}
                  </optgroup>
                ));
              })()}
            </select>
            <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>入力すると「エリア別単価ランキング」に反映されます</div>
          </div>
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>事故・トラブル備考</div>
            <textarea value={form.trouble_note} onChange={e=>setForm(p=>({...p,trouble_note:e.target.value}))} placeholder="特記事項があれば（任意）" rows={2} style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:13, outline:"none", resize:"none" }}/>
          </div>
        </Card>
        {/* 乗車記録 — 編集・削除・追加 */}
        <Card style={{ marginTop:10, padding:"10px 12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:12, color:C.accentLight, fontWeight:700 }}>
              🚕 乗車記録 {(form.rides||[]).length}件
            </div>
            <button onClick={()=>setEditingRideIdx(-1)}
              style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer", border:`1.5px solid ${C.accentLight}`, backgroundColor:`${C.accentLight}22`, color:C.accentLight }}>
              ＋ 追加
            </button>
          </div>
          {(form.rides||[]).length === 0 ? (
            <div style={{ textAlign:"center", padding:"16px 0", color:C.muted, fontSize:12 }}>乗車記録なし（＋追加で手動入力できます）</div>
          ) : (
            <div>
              {(form.rides||[]).map((r, i) => (
                <div key={i} onClick={()=>setEditingRideIdx(i)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:i<form.rides.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}>
                  <span style={{ color:C.muted, fontSize:10, width:20, flexShrink:0 }}>#{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.pickup_area || "?"} → {r.dropoff_area || "?"}
                    </div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                      {r.pickup_time && r.dropoff_time ? `${r.pickup_time}〜${r.dropoff_time}` : ""}
                      {r.payment ? `　${r.payment}` : ""}
                    </div>
                  </div>
                  <span style={{ color:C.green, fontWeight:700, fontSize:13, flexShrink:0 }}>¥{(r.amount ?? 0).toLocaleString()}</span>
                  <span style={{ color:C.muted, fontSize:16, paddingLeft:4 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        {/* 乗車記録編集モーダル */}
        {editingRideIdx !== null && (
          <RideEditModal
            ride={editingRideIdx === -1 ? EMPTY_RIDE : (form.rides||[])[editingRideIdx]}
            index={editingRideIdx}
            onSave={saved => {
              setForm(p => {
                const rides = [...(p.rides||[])];
                if (editingRideIdx === -1) {
                  rides.push({ ...saved, no: rides.length + 1 });
                } else {
                  rides[editingRideIdx] = { ...rides[editingRideIdx], ...saved };
                }
                return { ...p, rides };
              });
              setEditingRideIdx(null);
            }}
            onDelete={() => {
              setForm(p => {
                const rides = (p.rides||[]).filter((_,i) => i !== editingRideIdx)
                  .map((r,i) => ({ ...r, no: i+1 }));
                return { ...p, rides };
              });
              setEditingRideIdx(null);
            }}
            onClose={() => setEditingRideIdx(null)}
          />
        )}
        {form.total_distance && form.occupied_distance && parseInt(form.total_distance)>0 && (
          <Card style={{ padding:12, textAlign:"center" }}><span style={{ fontSize:12, color:C.muted }}>実車率（自動計算）: </span><span style={{ fontSize:16, fontWeight:700, color:C.green }}>{Math.round(parseInt(form.occupied_distance)/parseInt(form.total_distance)*100)}%</span></Card>
        )}
        {/* AIアドバイス オプトイン */}
        <div
          onClick={() => setWantAiAdvice(p => !p)}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderRadius:12, border:`1.5px solid ${wantAiAdvice ? C.accentLight : C.border}`, backgroundColor: wantAiAdvice ? C.accentLight+"11" : C.surface, cursor:"pointer", marginBottom:10 }}
        >
          <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${wantAiAdvice ? C.accentLight : C.border}`, backgroundColor: wantAiAdvice ? C.accentLight : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {wantAiAdvice && <span style={{ color:"#fff", fontSize:13, fontWeight:900, lineHeight:1 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: wantAiAdvice ? C.accentLight : C.text }}>🦉 AIアドバイスをもらう</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>データを分析して今後のヒントをお届け（任意）</div>
          </div>
        </div>
        <Btn onClick={handleSave} disabled={saving}>{saving ? (wantAiAdvice ? "AI分析中..." : "保存中...") : "保存する"}</Btn>
        <Btn onClick={()=>{ setIsManual(false); setIsClosure(false); setStep("select"); }} variant="ghost" style={{ marginTop:10 }}>戻る</Btn>
      </div>
    );
  }

  // 選択画面（画面全体をドロップゾーンにする）
  const handlePageDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const fileArr = Array.from(e.dataTransfer?.files || []);
    if (fileArr.length > 0) handleFileSelect({ target: { files: fileArr } });
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
      onDrop={handlePageDrop}
      style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px", position:"relative" }}
    >
      {/* ドラッグ中オーバーレイ */}
      {isDragOver && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          backgroundColor: C.accentLight + "22",
          border: `3px dashed ${C.accentLight}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          pointerEvents:"none",
        }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:64, marginBottom:12 }}>📥</div>
            <div style={{ fontSize:20, fontWeight:800, color:C.accentLight }}>ここにドロップ</div>
          </div>
        </div>
      )}
      <div style={{ backgroundColor:C.goldGlow, border:`1px solid ${C.gold}44`, borderRadius:12, padding:"10px 14px", marginBottom:14 }}>
        <span style={{ fontSize:13, color:C.sub }}>今月残り <strong style={{ color:C.gold }}>{remaining}件</strong> 無料</span>
      </div>

      {/* 撮影ガイドの簡易プレビュー（常時表示） */}
      <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
        <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginBottom:8 }}>📸 きれいに撮るための3つのポイント</div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {[
            ["📄","平らな場所に置いて、真上から撮影"],
            ["☀️","明るさが均一になるよう蛍光灯に近い場所で"],
            ["🚫","影や反射が入らないようにする"],
          ].map(([icon,text]) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ fontSize:12, color:C.sub }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 撮影ボタン（タップ→ガイドモーダル、ドラッグ＆ドロップ対応） */}
      <div
        onClick={() => setShowGuide(true)}
        onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.borderColor = C.accentLight; }}
        onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.borderColor = C.border; }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
        onDragLeave={e => {
          e.preventDefault();
          // 子要素への移動では false にしない（真にゾーン外に出たときだけ）
          if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          // dataTransfer.files はイベント後に消えるので先に配列化
          const fileArr = Array.from(e.dataTransfer.files || []);
          if (fileArr.length > 0) {
            handleFileSelect({ target: { files: fileArr } });
          }
        }}
        style={{
          border: `2px dashed ${isDragOver ? C.accentLight : C.border}`,
          borderRadius: 14,
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 14,
          transition: "border-color 0.2s",
          backgroundColor: isDragOver ? C.accentLight + "11" : "transparent",
        }}
      >
        <div style={{ fontSize:44, marginBottom:12 }}>{isDragOver ? "📥" : "📄"}</div>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>日報を撮影・選択</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>JPEG / PNG / PDF 対応 ・ ドラッグ＆ドロップ可</div>
        <div style={{ display:"inline-block", backgroundColor:C.accentLight+"22", color:C.accentLight, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:99 }}>
          {isDragOver ? "ここにドロップ" : "タップして撮影ガイドを確認 →"}
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0" }}>
        <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
        <span style={{ fontSize:11, color:C.muted }}>または</span>
        <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
      </div>
      <Btn onClick={()=>{ setIsManual(true); setForm(EMPTY); setStep("confirm"); }} variant="secondary">✏️ 手動で入力する</Btn>

      {/* 個タク・締め作業 */}
      <div style={{ marginTop:14, backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 16px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:4 }}>🚕 乗車記録から締める</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>個人タクシー・手入力オンリーの方向け。乗車記録を集計して日報を作成します。</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input
            type="date"
            value={closureDate}
            onChange={e => setClosureDate(e.target.value)}
            style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}
          />
          <button
            onClick={handleClosureLoad}
            style={{ flexShrink:0, padding:"10px 18px", borderRadius:9, backgroundColor:C.accentLight, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            締める
          </button>
        </div>
      </div>

      {/* 撮影ガイドモーダル */}
      {showGuide && <ShotGuideModal onShoot={handleOCR} onCancel={()=>setShowGuide(false)}/>}

      {/* 乗車記録照合モーダル */}
      {matchData && (
        <RideMatchModal
          ocrRides={matchData.ocrRides}
          manualRecords={matchData.manualRecords}
          onConfirm={mergedRides => {
            setForm(f => ({ ...f, rides: mergedRides }));
            setMatchData(null);
            setStep("confirm");
          }}
          onSkip={() => {
            setMatchData(null);
            setStep("confirm");
          }}
        />
      )}

      {/* hidden file input（カメラ or ギャラリー選択、最大2枚） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display:"none" }}
      />
    </div>
  );
}
