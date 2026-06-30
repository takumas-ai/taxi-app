import { useState, useRef, useEffect } from "react";
import { C, fmt, occ, dow, hourly, PLAN_OCR_LIMITS, PLAN_LABELS } from "../lib/constants";
import { runReportOCR, runReportOCRP2 } from "../lib/ai";
import { Card, Btn, ProgressBar } from "../components/UI";
import { RideMatchModal } from "../components/RideMatchModal";
import { ZONE_AREAS } from "../data/trafficZones";
import { supabase, uploadReportImage } from "../lib/supabase";
import { validateImageFile, validateReportForm, sanitizeReportData } from "../lib/validate";

const OCR_SEQ = ["画像を解析中...","日付・勤務時間を読み取り中...","売上データを抽出中...","営業回数・走行距離を確認中...","フォーマット差異を吸収中...","読み取り完了 ✓"];
const EMPTY = { date:new Date().toISOString().slice(0,10), gross_sales:"", net_sales:"", cash_sales:"", card_sales:"", app_sales:"", emoney_sales:"", ticket_sales:"", ride_count:"", total_distance:"", occupied_distance:"", work_hours:"", break_hours:"", highway_fee:"", adjustment:"", tip_amount:"", trouble_note:"", work_area:"", rides:[], break_times:[] };

// デフォルト略語辞書（タクシー業界共通の略語）
const DEFAULT_MEMO_DICT = {
  "障":    "障害者手帳あり",
  "迎S":   "アプリ配車（S.RIDE）ネット決済",
  "迎Sネ": "アプリ配車（S.RIDE）ネット決済",
  "迎高S": "アプリ配車（S.RIDE）高速利用ネット決済",
  "迎G":   "アプリ配車（GO）ネット決済",
  "迎D":   "アプリ配車（DiDi）ネット決済",
  "迎U":   "アプリ配車（Uber）ネット決済",
};

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

// ━━━ 調整欄（±切替） ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AdjustmentInput({ value, onChange }) {
  const num = parseInt(value) || 0;
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  // 入力中の生テキストを保持（"" のまま入力できるよう）
  const [raw, setRaw] = useState(absVal > 0 ? String(absVal) : "");
  useEffect(() => { setRaw(absVal > 0 ? String(absVal) : ""); }, [absVal]);
  const handleChange = (e) => {
    const v = e.target.value;
    setRaw(v);
    const n = parseInt(v) || 0;
    onChange(String(isNeg ? -n : n));
  };
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:7 }}>調整（±円）</div>
      <div style={{ display:"flex", gap:8 }}>
        <div style={{ display:"flex", borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden", flexShrink:0 }}>
          <button onClick={() => onChange(String(absVal))} style={{ padding:"0 22px", fontSize:20, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:!isNeg?C.accentLight+"33":"transparent", color:!isNeg?C.accentLight:C.muted }}>＋</button>
          <button onClick={() => onChange(String(-absVal))} style={{ padding:"0 22px", fontSize:20, fontWeight:700, cursor:"pointer", border:"none", borderLeft:`1px solid ${C.border}`, backgroundColor:isNeg?C.red+"33":"transparent", color:isNeg?C.red:C.muted }}>－</button>
        </div>
        <input type="number" value={raw} min="0" placeholder="0" onChange={handleChange}
          style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none", boxSizing:"border-box" }}/>
      </div>
      {num!==0&&<div style={{ fontSize:13, color:num>0?C.green:C.red, marginTop:6, textAlign:"right", fontWeight:700 }}>{num>0?"+":""}{num.toLocaleString()}円</div>}
    </div>
  );
}

// ━━━ 勤務時間ドラムロール ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━ 勤務時間ドロップダウン ━━━━━━━━━━━━━━━━━━━━━━━━━━━
function WorkHoursPicker({ value, onChange, label = "勤務時間", maxHours = 20 }) {
  const totalMin = Math.round((parseFloat(value) || 0) * 60);
  const selH = Math.min(maxHours, Math.max(0, Math.floor(totalMin / 60)));
  const selM = [0,15,30,45].reduce((a,b) => Math.abs(b-(totalMin%60))<Math.abs(a-(totalMin%60))?b:a, 0);
  const update = (h, m) => onChange(String(parseFloat((h + m/60).toFixed(4))));
  const wrap = { flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" };
  const sel  = { width:"100%", backgroundColor:"transparent", border:"none", padding:"15px 16px", color:C.text, fontSize:17, outline:"none" };
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:7 }}>{label}</div>
      <div style={{ display:"flex", gap:8 }}>
        <div style={wrap}>
          <select value={selH} onChange={e => update(Number(e.target.value), selM)} style={sel}>
            {Array.from({length:maxHours+1},(_,i)=>i).map(h => <option key={h} value={h}>{h}時間</option>)}
          </select>
        </div>
        <div style={wrap}>
          <select value={selM} onChange={e => update(selH, Number(e.target.value))} style={sel}>
            {[0,15,30,45].map(m => <option key={m} value={m}>{String(m).padStart(2,"0")}分</option>)}
          </select>
        </div>
      </div>
    </div>
  );
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

// ━━━ 乗車方法・支払い選択肢 ━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BOARDING_METHOD_OPTIONS = ["流し", "付け待ち", "アプリ配車", "自社無線", "その他"];
const APP_TYPE_OPTIONS        = ["GO", "S.RIDE", "DiDi", "Uber", "その他"];
const RIDE_PAYMENT_OPTIONS    = ["現金", "カード", "電子マネー", "QR", "ネット決済", "チケット", "その他"];
const APP_BOARDING_METHODS    = ["アプリ配車"]; // これを選んだ時にネット決済を自動セット

// ━━━ 備考略語辞書 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PAYMENT_FROM_MEANING = {
  "電子マネー": "電子マネー",
  "カード":    "カード",
  "QR":       "QR",
  "ネット決済": "ネット決済",
  "現金":     "現金",
  "チケット":  "チケット",
};

/** 入力された意味がアプリの対応フィールドにマッピングできるか判定 */
function isKnownMeaning(text) {
  if (!text || text === "skip") return true; // スキップは除外
  const t = text;
  if (Object.keys(PAYMENT_FROM_MEANING).some(k => t.includes(k))) return true;
  if (["アプリ配車", "GO", "S.RIDE", "DiDi", "Uber"].some(k => t.includes(k))) return true;
  if (t.includes("障害者手帳")) return true;
  if (t.includes("高速")) return true;
  if (t.includes("キャンセル") || t.includes("スキップ")) return true;
  return false;
}

function applyMemoDict(rides, dict) {
  return rides.map(r => {
    const raw = r.note?.trim();
    if (!raw || !dict[raw] || dict[raw] === "skip") return r;
    const meaning = dict[raw];
    // 支払い方法（意味テキストに含まれるキーワードで判定）
    const paymentKey = Object.keys(PAYMENT_FROM_MEANING).find(k => meaning.includes(k));
    const payment = paymentKey ? PAYMENT_FROM_MEANING[paymentKey] : (r.payment || "現金");
    // 乗車方法
    let boarding_method = r.boarding_method || "";
    let app_type = r.app_type || "";
    if (meaning.includes("アプリ配車") || ["GO","S.RIDE","DiDi","Uber"].some(a => meaning.includes(a))) {
      boarding_method = "アプリ配車";
      const found = APP_TYPE_OPTIONS.find(a => meaning.includes(a));
      if (found && found !== "その他") app_type = found;
    }
    const has_disability_card = r.has_disability_card || meaning.includes("障害者手帳");
    const highway = r.highway || meaning.includes("高速");
    return { ...r, note: meaning, payment, boarding_method, app_type, has_disability_card, highway };
  });
}

function MemoDictModal({ unknownMemos, onSave, onSkip }) {
  // unknownMemos: { word: string, rideNum: number }[]
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
    const init = {};
    unknownMemos.forEach(m => { init[m.word] = ""; });
    return init;
  });

  const current = unknownMemos[index]; // { word, rideNum }
  const total   = unknownMemos.length;
  const isLast  = index === total - 1;

  const advance = (meaning) => {
    const next = { ...answers, [current.word]: meaning ?? answers[current.word] };
    setAnswers(next);
    if (isLast) {
      const result = {};
      unknownMemos.forEach(orig => {
        const m = next[orig.word];
        if (m && m !== "skip") result[orig.word] = m;
      });
      onSave(result);
    } else {
      setIndex(i => i + 1);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000bb", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"24px 20px 40px", position:"relative" }}>
        <button onClick={onSkip} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }}/>

        {/* ステップ表示 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800 }}>📝 備考の確認</div>
          <div style={{ fontSize:12, color:C.muted, backgroundColor:C.bg, borderRadius:99, padding:"3px 10px" }}>
            {index + 1} / {total}
          </div>
        </div>

        {/* プログレスバー */}
        <div style={{ height:3, backgroundColor:C.border, borderRadius:99, marginBottom:20 }}>
          <div style={{ height:"100%", width:`${((index + 1) / total) * 100}%`, backgroundColor:C.accentLight, borderRadius:99, transition:"width 0.3s" }}/>
        </div>

        {/* 略語表示 */}
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>乗車記録 #{current.rideNum} の備考</div>
          <div style={{ fontSize:26, fontWeight:900, color:C.accentLight, letterSpacing:2 }}>「{current.word}」</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>これは何の意味ですか？</div>
        </div>

        {/* 自由テキスト入力 */}
        <input
          autoFocus
          value={answers[current.word]}
          onChange={e => setAnswers(p => ({ ...p, [current.word]: e.target.value }))}
          placeholder="例: アプリ配車、キャンセル、無線など"
          style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg,
            border:`1.5px solid ${answers[current.word] ? C.accentLight : C.border}`,
            borderRadius:12, padding:"14px 16px", fontSize:16, color:C.text, outline:"none",
            marginBottom:12, transition:"border-color 0.15s" }}
        />

        {/* 未対応項目の通知 */}
        {answers[current.word] && !isKnownMeaning(answers[current.word]) && (
          <div style={{ backgroundColor:"#F59E0B18", border:"1px solid #F59E0B44",
            borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#F59E0B",
            lineHeight:1.6 }}>
            💡 この項目はまだタクローに対応フィールドがありません。<br/>
            入力内容は記録しておくので、要望が多ければ今後追加します。
          </div>
        )}

        {/* 次へ / 完了 */}
        <Btn onClick={() => advance()} disabled={!answers[current.word]} style={{ marginBottom:10 }}>
          {isLast ? "完了して保存 ✓" : "次へ →"}
        </Btn>

        {/* 略語ではない（スキップ） */}
        <button onClick={() => advance("skip")}
          style={{ width:"100%", padding:"13px 0", borderRadius:12, fontSize:14, fontWeight:600,
            cursor:"pointer", border:`1px solid #EF444444`, backgroundColor:"#EF444410",
            color:"#EF4444", marginBottom:10 }}>
          ✕ 略語ではない（スキップ）
        </button>

        <Btn onClick={onSkip} variant="ghost">全てスキップ</Btn>
      </div>
    </div>
  );
}

// ━━━ 乗車記録編集モーダル ━━━━━━━━━━━━━━━━━━━━━━━━
const EMPTY_RIDE = { pickup_time:"", dropoff_time:"", pickup_area:"", dropoff_area:"", amount:"", passengers:1, boarding_method:"", app_type:"", payment:"現金", note:"", has_disability_card:false, highway:false };

function RideEditModal({ ride, index, onSave, onDelete, onClose }) {
  const [r, setR] = useState({
    pickup_time:         ride.pickup_time         ?? "",
    dropoff_time:        ride.dropoff_time        ?? "",
    pickup_area:         ride.pickup_area         ?? "",
    dropoff_area:        ride.dropoff_area        ?? "",
    amount:              ride.amount              != null ? String(ride.amount) : "",
    passengers:          ride.passengers          ?? 1,
    boarding_method:     ride.boarding_method     ?? "",
    app_type:            ride.app_type            ?? "",
    payment:             ride.payment             ?? "現金",
    note:                ride.note                ?? "",
    has_disability_card: ride.has_disability_card ?? false,
    highway:             ride.highway             ?? false,
  });
  const set = (k, v) => setR(p => ({ ...p, [k]: v }));
  const isNew = index === -1;

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000bb", zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"20px 20px 40px", maxHeight:"90vh", overflowY:"auto", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
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

        {/* 乗車方法 */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>乗車方法</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {BOARDING_METHOD_OPTIONS.map(opt => (
              <div key={opt} onClick={() => {
                set("boarding_method", opt);
                if (APP_BOARDING_METHODS.includes(opt)) {
                  if (!r.payment || r.payment === "現金") set("payment", "ネット決済");
                }
                if (!APP_BOARDING_METHODS.includes(opt)) set("app_type", "");
              }} style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:`1.5px solid ${r.boarding_method===opt?C.accentLight:C.border}`, backgroundColor:r.boarding_method===opt?C.accentLight+"22":"transparent", color:r.boarding_method===opt?C.accentLight:C.muted, transition:"all 0.15s" }}>{opt}</div>
            ))}
          </div>
        </div>

        {/* アプリ種別（アプリ配車選択時のみ） */}
        {APP_BOARDING_METHODS.includes(r.boarding_method) && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>アプリの種類</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {APP_TYPE_OPTIONS.map(opt => (
                <div key={opt} onClick={() => set("app_type", opt)} style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:`1.5px solid ${r.app_type===opt?C.gold:C.border}`, backgroundColor:r.app_type===opt?C.gold+"22":"transparent", color:r.app_type===opt?C.gold:C.muted, transition:"all 0.15s" }}>{opt}</div>
              ))}
            </div>
          </div>
        )}

        {/* 支払い方法 */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>支払い方法</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {RIDE_PAYMENT_OPTIONS.map(opt => (
              <div key={opt} onClick={()=>set("payment",opt)} style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:`1.5px solid ${r.payment===opt?C.accentLight:C.border}`, backgroundColor:r.payment===opt?C.accentLight+"22":"transparent", color:r.payment===opt?C.accentLight:C.muted, transition:"all 0.15s" }}>{opt}</div>
            ))}
          </div>
        </div>

        {/* 備考 */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>備考（任意）</div>
          <input type="text" value={r.note} onChange={e=>set("note",e.target.value)} placeholder="メモなど"
            style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
        </div>

        {/* 障害者手帳・高速利用 */}
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          {[
            { key:"has_disability_card", emoji:"♿", label:"障害者手帳あり" },
            { key:"highway",             emoji:"🛣️", label:"高速利用あり" },
          ].map(({key, emoji, label}) => (
            <div key={key} onClick={() => set(key, !r[key])}
              style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
                borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${r[key] ? C.accentLight : C.border}`,
                backgroundColor:r[key] ? C.accentLight+"18" : "transparent" }}>
              <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${r[key] ? C.accentLight : C.border}`,
                backgroundColor:r[key] ? C.accentLight : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {r[key] && <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:12, color:r[key] ? C.accentLight : C.muted, fontWeight:r[key]?700:400 }}>{emoji} {label}</span>
            </div>
          ))}
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
const SKIP_GUIDE_KEY = "taxi_skip_shot_guide";

function ShotGuideModal({ onShoot, onCancel }) {
  const [checked, setChecked] = useState(false);
  const [skipGuide, setSkipGuide] = useState(() => localStorage.getItem(SKIP_GUIDE_KEY) === "1");
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000aa", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:24, paddingBottom:40, position:"relative" }}>
        <button onClick={onCancel} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
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

        {/* 次回から表示しない */}
        <div onClick={() => { const n=!skipGuide; setSkipGuide(n); localStorage.setItem(SKIP_GUIDE_KEY, n?"1":"0"); }}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", marginBottom:16, borderRadius:10,
            border:`1px solid ${skipGuide?C.accentLight+"66":C.border}`,
            backgroundColor:skipGuide?C.accentLight+"10":"transparent", cursor:"pointer" }}>
          <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${skipGuide?C.accentLight:C.border}`,
            backgroundColor:skipGuide?C.accentLight:"transparent",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
            {skipGuide && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
          </div>
          <span style={{ fontSize:13, color:skipGuide?C.accentLight:C.sub, fontWeight:skipGuide?700:400 }}>次回から表示しない</span>
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


export default function UploadScreen({ uploadCount, onSave, reports, user, onSaveMemoDict }) {
  const draft = loadDraft();
  const isKoTaku = user?.workType === "個人タクシー";
  const [step, setStep]     = useState(isKoTaku ? "confirm" : (draft?.step || "select"));
  const [isManual, setIsManual] = useState(isKoTaku);
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
  const [ocrImageUrl, setOcrImageUrl] = useState(null); // OCR後の画像プレビュー用URL
  const [ocrFile, setOcrFile]         = useState(null); // Storageアップロード用ファイル
  const [ocrConfidence, setOcrConfidence] = useState(null); // OCR全体の信頼度(0-100)
  const [imgExpanded, setImgExpanded] = useState(true); // 画像拡大表示（確認画面では最初から開く）
  const [unknownMemos, setUnknownMemos] = useState([]); // 未登録の備考略語
  const [pendingFormData, setPendingFormData] = useState(null); // 略語登録待ちのフォームデータ

  // step/form/ocrLines が変わったらlocalStorageに保存
  useEffect(() => { saveDraft(step, form, ocrLines); }, [step, form, ocrLines]);
  const fileInputRef = useRef(null);
  const planKey = user?.plan || "free";
  const planLimit = PLAN_OCR_LIMITS[planKey] ?? PLAN_OCR_LIMITS.free;
  const planLabel = PLAN_LABELS[planKey] ?? "無料プラン";
  const remaining = planLimit - uploadCount;

  // ━━ ドラッグ＆ドロップ: window レベルで直接拾う（React合成イベントを迂回）━━
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // handleFileSelectのrefを持っておく（drag-dropのuseEffectはマウント時のみ登録するためstale回避）
  const handleFileSelectRef = useRef(null);

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
      if (fileArr.length > 0) handleFileSelectRef.current?.({ target: { files: fileArr } });
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
  // ※ handleFileSelectRefに毎レンダー代入し、drag-dropのstale closure問題を回避
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

      // 画像プレビュー用URLを生成（確認画面で日報を見ながら修正できるように）
      setOcrImageUrl(URL.createObjectURL(files[0]));
      setOcrFile(files[0]); // Storageアップロード用に保持

      const result1 = await runReportOCR(base64_1, "image/jpeg");
      if (result1?.error === "monthly_limit_exceeded") {
        setStep("select"); // 選択画面に戻す（remaining<=0 の表示を出すため）
        return;
      }
      if (!result1) throw new Error("1枚目のOCRに失敗しました");

      const f = result1?.fields ?? {};
      setOcrConfidence(f.confidence ?? null);
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
      // break_hoursはbreak_timesから計算、なければOCR値、なければ空欄
      const computedBreakHours = breakTimes.length > 0
        ? calcBreakHours(breakTimes)
        : (f.break_hours != null ? String(f.break_hours) : "");

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

      const pos = (v) => (v != null && Number(v) >= 0) ? String(v) : ""; // マイナス値は除去
      const baseForm = {
        date:               reportDate,
        // gross_salesがなくnet_salesがある場合（グリーンキャブ等）は×1.1で補完
        gross_sales:        pos(f.gross_sales) || (f.net_sales != null ? String(Math.round(f.net_sales * 1.1)) : ""),
        net_sales:          pos(f.net_sales),
        cash_sales:         pos(f.cash_sales),
        card_sales:         pos(f.card_sales),
        app_sales:          pos(f.app_sales),
        ride_count:         f.ride_count         != null ? String(f.ride_count)         : rides.length > 0 ? String(rides.length) : "",
        total_distance:     f.total_distance     != null ? String(f.total_distance)     : "",
        occupied_distance:  f.occupied_distance  != null ? String(f.occupied_distance)
                          : rides.length > 0 ? String(Math.round(rides.reduce((s,r)=>s+(r.km||0),0)))
                          : "",
        work_hours:         f.work_hours         != null ? String(f.work_hours)         : "",
        break_hours:        computedBreakHours,
        highway_fee:        f.highway_fee        != null ? String(f.highway_fee)        : "0",
        adjustment:         "",
        trouble_note:       "",
        work_area:          f.work_area          ?? "",
        rides,
        break_times:        breakTimes,
      };

      // 未登録の備考略語を検出（デフォルト辞書＋ユーザー辞書を統合）
      const existingDict = { ...DEFAULT_MEMO_DICT, ...(user?.memoDict || {}) };
      const splitNote = (note) =>
        note.split(/[.．・、。\s　,，/／\-]+/).map(t => t.trim()).filter(t => t && !/^\d+$/.test(t) && !/\d/.test(t));
      // 各単語に乗車記録番号を紐づける（Task3: どの乗車記録の備考かを表示するため）
      const allWordRides = rides.flatMap((r, i) =>
        r.note?.trim() ? splitNote(r.note.trim()).map(w => ({ word: w, rideNum: r.no ?? i + 1 })) : []
      );
      // 単語ごとに最初の出現番号を記録（重複は最初のrideNumを保持）
      const wordMap = new Map();
      allWordRides.forEach(({ word, rideNum }) => { if (!wordMap.has(word)) wordMap.set(word, rideNum); });
      const unknown = [...wordMap.entries()]
        .filter(([word]) => !(word in existingDict))
        .map(([word, rideNum]) => ({ word, rideNum }));

      if (unknown.length > 0) {
        // 略語登録モーダルへ（hasMatchの場合はRideMatchModal→memo_mapの順）
        setPendingFormData(baseForm);
        setUnknownMemos(unknown);
        if (hasMatch) {
          setMatchData({ ocrRides: rides, manualRecords: [] }); // RideMatchModal先に表示
          setForm({ ...baseForm, rides: applyMemoDict(rides, existingDict) });
          setStep("select");
        } else {
          setStep("memo_map");
        }
      } else {
        // 既存辞書で変換
        const finalForm = { ...baseForm, rides: applyMemoDict(rides, existingDict) };
        setForm(finalForm);
        if (hasMatch) {
          setStep("select");
        } else {
          setStep("confirm");
        }
      }
    } catch (err) {
      console.error("[OCR]", err);
      setOcrError(err.message || "読み取りに失敗しました");
      setStep("ocr_error");
    }
  };
  // refを常に最新のhandleFileSelectに更新（drag-drop stale closure対策）
  handleFileSelectRef.current = handleFileSelect;

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
    const grossSales   = Math.round(sum(dayRecords, r => r.fare) / 10) * 10;
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

  const handleSave = async () => {
    // バリデーション（強化版）
    const { errors: validationErrors, isValid } = validateReportForm(form);
    if (!isValid) { setErrors(validationErrors); return; }

    setSaving(true);
    // サニタイズ（XSS対策・値のクランプ）
    const data = { id: Date.now(), ...sanitizeReportData(form), rides: form.rides ?? [], break_times: form.break_times ?? [] };
    // OCR画像をSupabase Storageに保存
    if (ocrFile && user?.id) {
      const { url } = await uploadReportImage(ocrFile, user.id);
      if (url) data.image_url = url;
    }
    setSaving(false); onSave(data); setForm(EMPTY); setIsManual(false);
    setOcrFile(null);
    localStorage.removeItem(OCR_DRAFT_KEY); // 保存完了でdraftクリア
    setStep("done");
  };

  const isOcrMode = !isManual && !isClosure && ocrImageUrl !== null;
  // 統一スタイル定数
  const FLD_LBL = { fontSize:13, fontWeight:600, marginBottom:7 };
  const FLD_INP = { width:"100%", boxSizing:"border-box", borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none" };
  const F = ({label,fk,type="number",ph="",required=false}) => {
    const uncertain = isOcrMode && form[fk] === "";
    const borderColor = errors[fk] ? C.red : uncertain ? "#f5a623" : C.border;
    const bgColor = uncertain ? "#f5a62318" : C.bg;
    const labelColor = errors[fk] ? C.red : uncertain ? "#f5a623" : C.muted;
    return (
      <div>
        <div style={{ ...FLD_LBL, color:labelColor }}>
          {label}{required&&<span style={{color:C.red}}> *</span>}
          {errors[fk]&&<span style={{marginLeft:4}}>{errors[fk]}</span>}
          {uncertain&&<span style={{marginLeft:4}}>要確認</span>}
        </div>
        <input type={type} value={form[fk]} placeholder={ph} onChange={e=>{
          const v = type === "number" ? e.target.value.replace(/[,，、]/g, ".") : e.target.value;
          setForm(p=>({...p,[fk]:v}));setErrors(p=>({...p,[fk]:""}));
        }} style={{ ...FLD_INP, backgroundColor:bgColor, border:`1px solid ${borderColor}` }}/>
      </div>
    );
  };

  if (remaining <= 0) {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px 100px" }}>
        <Card style={{ textAlign:"center", padding:32 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>今月のOCR上限（{planLimit}回）に達しました</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:8, lineHeight:1.6 }}>
            翌月1日にリセットされます。それまでは手入力でご利用いただけます。
          </div>
          <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
            ※βテスト期間中は全プラン月{planLimit}回まで無料でご利用いただけます
          </div>
        </Card>
      </div>
    );
  }

  if (step === "memo_map") {
    return (
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px 100px" }}>
        <MemoDictModal
          unknownMemos={unknownMemos}
          onSave={async (mappings) => {
            const existingDict = user?.memoDict || {};
            const newDict = { ...existingDict, ...mappings };
            await onSaveMemoDict?.(newDict);
            setForm({ ...pendingFormData, rides: applyMemoDict(pendingFormData.rides, newDict) });
            setPendingFormData(null);
            setUnknownMemos([]);
            setStep("confirm");
          }}
          onSkip={() => {
            setForm({ ...pendingFormData, rides: applyMemoDict(pendingFormData.rides, user?.memoDict || {}) });
            setPendingFormData(null);
            setUnknownMemos([]);
            setStep("confirm");
          }}
        />
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
        <style>{`
          @keyframes takuroBounce {
            0%,100%{transform:translateY(0);}
            50%{transform:translateY(-10px);}
          }
          @keyframes takuroFade {
            0%,100%{opacity:1;}
            50%{opacity:0.5;}
          }
        `}</style>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:52, marginBottom:10, display:"inline-block", animation:"takuroBounce 0.9s ease-in-out infinite" }}>🦉</div>
          <div style={{ fontSize:15, fontWeight:700, animation:"takuroFade 1.4s ease-in-out infinite" }}>タクローが解析中...</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>しばらくお待ちください</div>
        </div>
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:11, color:C.muted }}>読み取り進捗</div>
            <div style={{ fontSize:11, fontWeight:700, color:C.accentLight }}>{ocrProg}%</div>
          </div>
          <ProgressBar value={ocrProg} max={100} color={C.accentLight} height={8}/>
          <div style={{ marginTop:14 }}>
            {ocrLines.map((l,i) => (
              <div key={i} style={{ fontSize:13, color:i===ocrLines.length-1?C.text:C.muted,
                padding:"6px 0", borderBottom:i<ocrLines.length-1?`1px solid ${C.border}`:"none",
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11 }}>{i===ocrLines.length-1?"▶":"✓"}</span>
                {l}
              </div>
            ))}
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

        {/* OCR画像プレビュー（OCRモード時のみ） */}
        {ocrImageUrl && !isManual && !isClosure && (
          <div style={{ marginBottom:12 }}>
            <div
              onClick={() => setImgExpanded(p => !p)}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", backgroundColor:C.surface, borderRadius:12, border:`1px solid ${C.border}`, cursor:"pointer", marginBottom: imgExpanded ? 8 : 0 }}
            >
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14 }}>🖼</span>
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>日報画像を確認</span>
                {ocrConfidence !== null && (
                  <span style={{
                    fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
                    color:    ocrConfidence >= 80 ? C.green : ocrConfidence >= 60 ? "#f5a623" : C.red,
                    backgroundColor: ocrConfidence >= 80 ? C.green+"22" : ocrConfidence >= 60 ? "#f5a62322" : C.red+"22",
                  }}>信頼度 {ocrConfidence}%</span>
                )}
              </div>
              <span style={{ fontSize:13, color:C.muted }}>{imgExpanded ? "▲" : "▼"}</span>
            </div>
            {imgExpanded && (
              <div style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${C.border}` }}>
                <img src={ocrImageUrl} alt="日報" style={{ width:"100%", display:"block" }}/>
              </div>
            )}
            {!imgExpanded && (
              <div style={{ fontSize:11, color:"#f5a623", marginTop:6 }}>
                ⚠ 空欄（オレンジ枠）の項目は画像と見比べて入力してください
              </div>
            )}
          </div>
        )}

        <Card>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {F({label:"日付", fk:"date", type:"date", required:true})}
            {F({label:"営業回数（回）", fk:"ride_count"})}
            {F({label:"売上（税込）（円）", fk:"gross_sales", required:true})}
            {/* 売上（税抜）: OCR読み込みまたは手動入力可 */}
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:4 }}>
                売上（税抜）（円）
                {!form.net_sales && form.gross_sales && (
                  <span
                    onClick={() => setForm(p => ({ ...p, net_sales: String(Math.round(Math.round(parseInt(p.gross_sales) / 1.1) / 10) * 10) }))}
                    style={{ marginLeft:8, fontSize:11, color:C.accentLight, cursor:"pointer", fontWeight:400 }}>
                    税込から計算
                  </span>
                )}
              </div>
              <input
                type="number"
                value={form.net_sales}
                placeholder={form.gross_sales ? String(Math.round(Math.round(parseInt(form.gross_sales) / 1.1) / 10) * 10) : ""}
                onChange={e => setForm(p => ({ ...p, net_sales: e.target.value }))}
                style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none" }}
              />
            </div>
            {F({label:"高速料金（円）", fk:"highway_fee"})}
            <AdjustmentInput value={form.adjustment} onChange={v=>setForm(p=>({...p,adjustment:v}))} />
            {F({label:"現金売上（円）", fk:"cash_sales"})}
            {F({label:"アプリ決済（円）", fk:"app_sales"})}
            {F({label:"クレジットカード（円）", fk:"card_sales"})}
            {F({label:"電子マネー（円）", fk:"emoney_sales"})}
            {F({label:"タクシーチケット（円）", fk:"ticket_sales"})}
            {F({label:"走行距離（km）", fk:"total_distance"})}
            {F({label:"実車距離（km）", fk:"occupied_distance"})}
            <WorkHoursPicker value={form.work_hours} onChange={v=>setForm(p=>({...p,work_hours:v}))} />
            <WorkHoursPicker label="休憩時間" maxHours={8} value={form.break_hours} onChange={v=>setForm(p=>({...p,break_hours:v}))} />
            {F({label:"チップ（円）", fk:"tip_amount"})}
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
                      {r.boarding_method ? `　${r.app_type || r.boarding_method}` : ""}
                      {r.payment ? `　${r.payment}` : ""}
                      {r.has_disability_card ? "　♿" : ""}
                      {r.highway ? "　🛣️" : ""}
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
        <Btn onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存する"}</Btn>
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
        <span style={{ fontSize:13, color:C.sub }}>{planLabel}｜今月残り <strong style={{ color:C.gold }}>{remaining}件</strong>（上限{planLimit}回）</span>
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
        onClick={() => { if (localStorage.getItem(SKIP_GUIDE_KEY) === "1") { fileInputRef.current?.click(); } else { setShowGuide(true); } }}
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
            setMatchData(null);
            if (unknownMemos.length > 0 && pendingFormData) {
              setPendingFormData(f => ({ ...f, rides: mergedRides }));
              setStep("memo_map");
            } else {
              setForm(f => ({ ...f, rides: mergedRides }));
              setStep("confirm");
            }
          }}
          onSkip={() => {
            setMatchData(null);
            if (unknownMemos.length > 0 && pendingFormData) {
              setStep("memo_map");
            } else {
              setStep("confirm");
            }
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
