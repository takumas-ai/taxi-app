import { useState, useRef } from "react";
import { C, fmt, occ, dow, hourly, FREE_LIMIT } from "../lib/constants";
import { generateReportComment, runReportOCR } from "../lib/ai";
import { Card, Btn, ProgressBar } from "../components/UI";
import { WORK_AREAS_BY_PARENT } from "../data/mockData";
import { supabase } from "../lib/supabase";
import { validateImageFile, validateReportForm, sanitizeReportData } from "../lib/validate";

const OCR_SEQ = ["画像を解析中...","日付・勤務時間を読み取り中...","売上データを抽出中...","営業回数・走行距離を確認中...","フォーマット差異を吸収中...","読み取り完了 ✓"];
const EMPTY = { date:new Date().toISOString().slice(0,10), gross_sales:"", cash_sales:"", card_sales:"", app_sales:"", ride_count:"", total_distance:"", occupied_distance:"", work_hours:"", break_hours:"1.0", highway_fee:"0", trouble_note:"", work_area:"" };

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

export default function UploadScreen({ uploadCount, onSave, reports }) {
  const [step, setStep]     = useState("select");
  const [isManual, setIsManual] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [ocrLines, setOcrLines] = useState([]);
  const [ocrProg, setOcrProg]   = useState(0);
  const [ocrError, setOcrError] = useState("");
  const fileInputRef = useRef(null);
  const remaining = FREE_LIMIT - uploadCount;

  // ガイドモーダルの「進む」→ファイルピッカーを開く
  const handleOCR = () => {
    setShowGuide(false);
    fileInputRef.current?.click();
  };

  // ファイル選択後にOCR実行
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // リセット
    e.target.value = "";

    // ファイルバリデーション
    const fileCheck = validateImageFile(file);
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
      // 画像を圧縮してbase64変換（スマホ写真はサイズ大のため）
      addLine("画像を読み込み中...", 15);
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

      addLine("AIに画像を送信中...", 35);
      await new Promise(r => setTimeout(r, 300));
      addLine("日付・売上データを抽出中...", 55);

      // claude-proxy経由でOCR（work_area対応プロンプトを使用）
      const result = await runReportOCR(base64, "image/jpeg");
      if (!result) throw new Error("OCRエラー");

      addLine("走行距離・乗務時間を確認中...", 80);
      await new Promise(r => setTimeout(r, 300));
      addLine("読み取り完了 ✓", 100);
      await new Promise(r => setTimeout(r, 400));

      const f = result?.fields ?? {};
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        date:               f.report_date ?? f.date ?? today,
        gross_sales:        f.gross_sales        != null ? String(f.gross_sales)        : "",
        cash_sales:         f.cash_sales         != null ? String(f.cash_sales)         : "",
        card_sales:         f.card_sales         != null ? String(f.card_sales)         : "",
        app_sales:          f.app_sales          != null ? String(f.app_sales)          : "",
        ride_count:         f.ride_count         != null ? String(f.ride_count)         : "",
        total_distance:     f.total_distance     != null ? String(f.total_distance)     : "",
        occupied_distance:  f.occupied_distance  != null ? String(f.occupied_distance)  : "",
        work_hours:         f.work_hours         != null ? String(f.work_hours)         : "",
        break_hours:        f.break_hours        != null ? String(f.break_hours)        : "1.0",
        highway_fee:        f.highway_fee        != null ? String(f.highway_fee)        : "0",
        trouble_note:       "",
        work_area:          f.work_area          ?? "",
      });
      setStep("confirm");
    } catch (err) {
      console.error("[OCR]", err);
      setOcrError(err.message || "読み取りに失敗しました");
      setStep("ocr_error");
    }
  };

  const handleSave = async () => {
    // バリデーション（強化版）
    const { errors: validationErrors, isValid } = validateReportForm(form);
    if (!isValid) { setErrors(validationErrors); return; }

    setSaving(true);
    // サニタイズ（XSS対策・値のクランプ）
    const data = { id: Date.now(), ...sanitizeReportData(form) };
    // 3回以上記録が溜まってからAIコメント生成（データ不足での的外れコメントを防ぐ）
    const comment = reports.length >= 2 ? await generateReportComment(data, reports) : "";
    data.ai_comment = comment;
    setSaving(false); onSave(data); setForm(EMPTY); setIsManual(false); setStep("done");
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
        <div style={{ textAlign:"center", marginBottom:24 }}><div style={{ fontSize:36, marginBottom:10 }}>🤖</div><div style={{ fontSize:15, fontWeight:700 }}>AIが読み取り中...</div></div>
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
        <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{isManual ? "📝 日報を入力してください" : "📋 読み取り結果を確認・修正してください"}</div>
        <Card>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {F({label:"日付", fk:"date", type:"date", required:true, span:2})}
            {F({label:"総売上（円）", fk:"gross_sales", required:true, ph:"62000"})}
            {F({label:"営業回数（回）", fk:"ride_count", ph:"30"})}
            {F({label:"現金売上（円）", fk:"cash_sales", ph:"37000"})}
            {F({label:"カード売上（円）", fk:"card_sales", ph:"18000"})}
            {F({label:"配車アプリ（円）", fk:"app_sales", ph:"7000", span:2})}
            {F({label:"走行距離（km）", fk:"total_distance", ph:"300"})}
            {F({label:"実車距離（km）", fk:"occupied_distance", ph:"155"})}
            {F({label:"勤務時間（h）", fk:"work_hours", ph:"13.5"})}
            {F({label:"休憩時間（h）", fk:"break_hours", ph:"1.0"})}
            {F({label:"高速料金（円）", fk:"highway_fee", ph:"800", span:2})}
          </div>
          {/* 営業エリア選択（統計データ収集用） */}
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>📍 今日のメインエリア（統計に使用）</div>
            <select value={form.work_area} onChange={e=>setForm(p=>({...p,work_area:e.target.value}))} style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:form.work_area?C.text:C.muted, fontSize:14, outline:"none" }}>
              <option value="">選択してください（任意）</option>
              {Object.entries(WORK_AREAS_BY_PARENT).map(([parent, areas]) => (
                <optgroup key={parent} label={parent}>
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              ))}
            </select>
            <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>入力すると「エリア別単価ランキング」に反映されます</div>
          </div>
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>事故・トラブル備考</div>
            <textarea value={form.trouble_note} onChange={e=>setForm(p=>({...p,trouble_note:e.target.value}))} placeholder="特記事項があれば（任意）" rows={2} style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:13, outline:"none", resize:"none" }}/>
          </div>
        </Card>
        {form.total_distance && form.occupied_distance && parseInt(form.total_distance)>0 && (
          <Card style={{ padding:12, textAlign:"center" }}><span style={{ fontSize:12, color:C.muted }}>実車率（自動計算）: </span><span style={{ fontSize:16, fontWeight:700, color:C.green }}>{Math.round(parseInt(form.occupied_distance)/parseInt(form.total_distance)*100)}%</span></Card>
        )}
        <Btn onClick={handleSave} disabled={saving}>{saving?"保存中...":"保存する"}</Btn>
        <Btn onClick={()=>{ setIsManual(false); setStep("select"); }} variant="ghost" style={{ marginTop:10 }}>戻る</Btn>
      </div>
    );
  }

  // 選択画面
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ backgroundColor:C.goldGlow, border:`1px solid ${C.gold}44`, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:13, color:C.sub }}>今月残り <strong style={{ color:C.gold }}>{remaining}件</strong> 無料</span>
        <span style={{ fontSize:11, color:C.muted }}>無制限は月額480円</span>
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

      {/* 撮影ボタン（タップ→ガイドモーダル） */}
      <div
        onClick={() => setShowGuide(true)}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.accentLight}
        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
        style={{ border:`2px dashed ${C.border}`, borderRadius:14, padding:"32px 24px", textAlign:"center", cursor:"pointer", marginBottom:14, transition:"border-color 0.2s" }}
      >
        <div style={{ fontSize:44, marginBottom:12 }}>📄</div>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>日報を撮影・選択</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>JPEG / PNG / PDF 対応</div>
        <div style={{ display:"inline-block", backgroundColor:C.accentLight+"22", color:C.accentLight, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:99 }}>タップして撮影ガイドを確認 →</div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0" }}>
        <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
        <span style={{ fontSize:11, color:C.muted }}>または</span>
        <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
      </div>
      <Btn onClick={()=>{ setIsManual(true); setForm(EMPTY); setStep("confirm"); }} variant="secondary">✏️ 手動で入力する</Btn>

      {/* 撮影ガイドモーダル */}
      {showGuide && <ShotGuideModal onShoot={handleOCR} onCancel={()=>setShowGuide(false)}/>}

      {/* hidden file input（カメラ or ギャラリー選択） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display:"none" }}
      />
    </div>
  );
}
