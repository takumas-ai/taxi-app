import { useState, useRef, useEffect } from "react";
import { C, fmt, occ, dow, hourly, loadS, getClosingPeriod } from "../lib/constants";
import { Card, Badge, Btn } from "../components/UI";
import { WORK_AREAS_BY_PARENT } from "../data/mockData";
import { validateReportForm, sanitizeReportData } from "../lib/validate";
import { toggleShareReport } from "../lib/supabase";

// ─── 編集フォームの1フィールド ───
function Field({ label, fk, form, setForm, errors, type="number", ph="", span=1 }) {
  return (
    <div style={{ gridColumn:`span ${span}` }}>
      <div style={{ fontSize:13, fontWeight:600, color:errors[fk]?C.red:C.muted, marginBottom:7 }}>
        {label}{errors[fk]&&<span style={{ marginLeft:4, color:C.red }}>{errors[fk]}</span>}
      </div>
      <input
        type={type}
        value={form[fk]}
        placeholder={ph}
        onChange={e => { setForm(p=>({...p,[fk]:e.target.value})); }}
        style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${errors[fk]?C.red:C.border}`, borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none" }}
      />
    </div>
  );
}

// ━━━ 調整欄（±切替） ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AdjustmentInput({ value, onChange }) {
  const num = parseInt(value) || 0;
  const isNeg = num < 0;
  const absVal = Math.abs(num);
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:7 }}>調整（±円）</div>
      <div style={{ display:"flex", gap:8 }}>
        <div style={{ display:"flex", borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden", flexShrink:0 }}>
          <button onClick={() => onChange(String(absVal))} style={{ padding:"0 22px", fontSize:20, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:!isNeg?C.accentLight+"33":"transparent", color:!isNeg?C.accentLight:C.muted }}>＋</button>
          <button onClick={() => onChange(String(-absVal))} style={{ padding:"0 22px", fontSize:20, fontWeight:700, cursor:"pointer", border:"none", borderLeft:`1px solid ${C.border}`, backgroundColor:isNeg?C.red+"33":"transparent", color:isNeg?C.red:C.muted }}>－</button>
        </div>
        <input type="number" value={absVal} min="0" placeholder="0" onChange={e=>onChange(String(isNeg?-(parseInt(e.target.value)||0):(parseInt(e.target.value)||0)))}
          style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none", boxSizing:"border-box" }}/>
      </div>
      {num!==0&&<div style={{ fontSize:13, color:num>0?C.green:C.red, marginTop:6, textAlign:"right", fontWeight:700 }}>{num>0?"+":""}{num.toLocaleString()}円</div>}
    </div>
  );
}

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

// フォームの初期値を生成
function buildForm(report) {
  return {
    date:               report.date || "",
    gross_sales:        report.gross_sales        != null ? String(report.gross_sales)        : "",
    // 旧データ互換：net_salesにadjustmentを加算して表示、adjustmentは0にリセット（#54/#65）
    net_sales:          (() => {
      const storedNet = report.net_sales != null ? report.net_sales
        : (report.gross_sales ? Math.round(Math.round(report.gross_sales / 1.1) / 10) * 10 : null);
      const adj = report.adjustment || 0;
      const effective = storedNet !== null ? storedNet + adj : null;
      return effective !== null ? String(effective) : "";
    })(),
    cash_sales:         report.cash_sales         != null ? String(report.cash_sales)         : "",
    card_sales:         report.card_sales         != null ? String(report.card_sales)         : "",
    app_sales:          report.app_sales          != null ? String(report.app_sales)          : "",
    emoney_sales:       report.emoney_sales       != null ? String(report.emoney_sales)       : "",
    ticket_sales:       report.ticket_sales       != null ? String(report.ticket_sales)       : "",
    highway_fee:        report.highway_fee        != null ? String(report.highway_fee)        : "0",
    adjustment:         "0",  // net_salesに組み込み済み
    ride_count:         report.ride_count         != null ? String(report.ride_count)         : "",
    total_distance:     report.total_distance     != null ? String(report.total_distance)     : "",
    occupied_distance:  report.occupied_distance  != null ? String(report.occupied_distance)  : "",
    work_hours:         report.work_hours         != null ? String(report.work_hours)         : "",
    break_hours:        report.break_hours        != null ? String(report.break_hours)        : "",
    tip_amount:         report.tip_amount         != null ? String(report.tip_amount)         : "",
    trouble_note:       report.trouble_note || "",
    work_area:          report.work_area   || "",
    dispatch_type:      report.dispatch_type || "",
  };
}

// ─── 日報詳細 / 編集モーダル ───
export function ReportModal({ report, onClose, onUpdate, onDelete, startInEdit = false }) {
  const [mode, setMode] = useState(startInEdit ? "edit" : "view");
  const [form, setForm] = useState(() => startInEdit && report ? buildForm(report) : {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // OCR抽出の乗車記録（report.rides）
  const [rides, setRides] = useState(() => Array.isArray(report?.rides) ? report.rides : []);
  const [editingRideIdx, setEditingRideIdx] = useState(null);
  const [ridePointInput, setRidePointInput] = useState("");
  const [showRides, setShowRides] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // SalesPointCard の手動乗車記録（localStorageから日付でフィルタ）
  const salesRecs = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]");
      return all.filter(r => (r.workDate || (r.timestamp ? r.timestamp.slice(0,10) : "")) === report?.date);
    } catch { return []; }
  })();
  const [showSalesRecs, setShowSalesRecs] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  if (!report || !report.gross_sales) return null;

  const or = occ(report);
  const oc = or >= 55 ? C.green : or >= 45 ? C.gold : C.red;

  const startEdit = () => {
    setForm(buildForm(report));
    setErrors({});
    setMode("edit");
  };

  const handleSave = async () => {
    const { errors: ve, isValid } = validateReportForm(form);
    if (!isValid) { setErrors(ve); return; }
    setSaving(true);
    const sanitized = sanitizeReportData(form);
    const updated = { ...report, ...sanitized, rides };
    await onUpdate?.(updated);
    setSaving(false);
    setMode("view");
    onClose();
  };

  const baseSheet = {
    backgroundColor: C.surface,
    borderRadius: "20px 20px 0 0",
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    maxHeight: "92vh",
    overflowY: "auto",
    padding: 24,
    paddingBottom: 40,
    position: "relative",
  };

  // ── 閲覧モード ──
  if (mode === "view") {
    return (
      <>
      {/* 写真フルスクリーン */}
      {showPhoto && report.image_url && (
        <div onClick={() => setShowPhoto(false)}
          style={{ position:"fixed", inset:0, backgroundColor:"#000000ee", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <button onClick={() => setShowPhoto(false)}
            style={{ position:"absolute", top:16, right:16, background:"none", border:"none", color:"#fff", fontSize:28, cursor:"pointer", lineHeight:1 }}>×</button>
          <img src={report.image_url} alt="日報写真"
            style={{ maxWidth:"95vw", maxHeight:"90vh", objectFit:"contain", borderRadius:8 }}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
      <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
        <div onClick={e=>e.stopPropagation()} style={baseSheet}>
          <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
          <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, color:C.muted }}>{report.date}（{dow(report.date)}）</div>
              <div style={{ fontSize:28, fontWeight:800 }}>{fmt(report.net_sales || Math.round(report.gross_sales / 1.1))}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span></div>
              <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>税抜 ／ 税込 {fmt(report.gross_sales)}円</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
              <Badge color={oc} size={11}>実車率 {or}%</Badge>
              <div style={{ display:"flex", gap:8 }}>
                {report.image_url && (
                  <button onClick={() => setShowPhoto(true)} style={{ fontSize:14, fontWeight:700, color:C.muted, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 14px", cursor:"pointer" }}>
                    📷
                  </button>
                )}
                {onUpdate && (
                  <button onClick={startEdit} style={{ fontSize:14, fontWeight:700, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}66`, borderRadius:10, padding:"8px 18px", cursor:"pointer" }}>
                    ✏️ 編集
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>売上内訳</div>
          {[{l:"現金",v:report.cash_sales,c:C.gold},{l:"カード",v:report.card_sales,c:C.accentLight},{l:"配車アプリ",v:report.app_sales,c:C.green}].map(({l,v,c})=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", backgroundColor:c }}/>
                <span style={{ fontSize:13, color:C.sub }}>{l}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:72, backgroundColor:C.border, borderRadius:99, height:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.round((v||0)/report.gross_sales*100)}%`, backgroundColor:c, borderRadius:99 }}/>
                </div>
                <span style={{ fontSize:13, color:C.text, minWidth:64, textAlign:"right" }}>{fmt(v)}円</span>
              </div>
            </div>
          ))}

          {(Number(report.tip_amount) > 0) && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, padding:"8px 12px", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:9 }}>
              <span style={{ fontSize:13, color:C.muted }}>💰 チップ</span>
              <span style={{ fontSize:14, fontWeight:800, color:C.accentLight }}>¥{fmt(Number(report.tip_amount))}</span>
            </div>
          )}

          <div style={{ height:1, backgroundColor:C.border, margin:"12px 0" }}/>

          {report.trouble_note && (
            <div style={{ backgroundColor:C.orangeGlow, border:`1px solid ${C.orange}44`, borderRadius:10, padding:12, marginBottom:10, fontSize:13, color:C.orange }}>
              ⚠️ {report.trouble_note}
            </div>
          )}
          {report.ai_comment && (
            <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:14, fontSize:13, color:C.sub, lineHeight:1.7 }}>
              💬 {report.ai_comment}
            </div>
          )}

          {/* 乗車記録セクション */}
          {rides.length > 0 && (
            <div style={{ marginTop:14 }}>
              <div onClick={() => setShowRides(p => !p)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>🚕 乗車記録（{rides.length}件）</span>
                <span style={{ fontSize:11, color:C.muted }}>{showRides ? "▲ 閉じる" : "▼ 開く"}</span>
              </div>
              {showRides && (
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
                  {rides.map((r, i) => (
                    <div key={i} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>
                            {r.pickup_time}{r.dropoff_time ? ` → ${r.dropoff_time}` : ""}
                            {r.km ? `  ${r.km}km` : ""}
                          </div>
                          <div style={{ fontSize:12, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {r.pickup_area || "—"} → {r.dropoff_area || "—"}
                          </div>
                          {/* ポイント名 */}
                          {editingRideIdx === i ? (
                            <div style={{ display:"flex", gap:6, marginTop:6 }}>
                              <input
                                autoFocus
                                value={ridePointInput}
                                onChange={e => setRidePointInput(e.target.value)}
                                placeholder="ポイント名（例: 六本木ヒルズ）"
                                style={{ flex:1, fontSize:12, padding:"5px 8px", borderRadius:7, border:`1px solid ${C.accentLight}`, backgroundColor:C.bg, color:C.text, outline:"none" }}
                              />
                              <button onClick={async () => {
                                const updated = rides.map((ride, j) =>
                                  j === i ? { ...ride, point_name: ridePointInput.trim() || null } : ride
                                );
                                setRides(updated);
                                setEditingRideIdx(null);
                                if (onUpdate) await onUpdate({ ...report, rides: updated });
                              }} style={{ fontSize:12, padding:"5px 10px", borderRadius:7, backgroundColor:C.accentLight, color:"#fff", border:"none", cursor:"pointer", fontWeight:700 }}>保存</button>
                              <button onClick={() => setEditingRideIdx(null)}
                                style={{ fontSize:12, padding:"5px 8px", borderRadius:7, border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                              <span style={{ fontSize:12, color: r.point_name ? C.accentLight : C.muted, fontWeight: r.point_name ? 700 : 400 }}>
                                {r.point_name || "ポイント名未設定"}
                              </span>
                              <button onClick={() => { setEditingRideIdx(i); setRidePointInput(r.point_name || ""); }}
                                style={{ fontSize:10, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"2px 8px", cursor:"pointer" }}>
                                編集
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap" }}>
                          {(r.amount||0).toLocaleString()}円
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SalesPointCard 手動乗車記録 */}
          {salesRecs.length > 0 && (
            <div style={{ marginTop:14 }}>
              <div onClick={() => setShowSalesRecs(p => !p)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>📝 手動乗車記録（{salesRecs.length}件）</span>
                <span style={{ fontSize:11, color:C.muted }}>{showSalesRecs ? "▲ 閉じる" : "▼ 開く"}</span>
              </div>
              {showSalesRecs && (
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
                  {[...salesRecs].sort((a,b) => (a.boardingTime||a.timestamp||"").localeCompare(b.boardingTime||b.timestamp||"")).map((r, i) => (
                    <div key={r.id || i} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>
                            {r.boardingTime ? new Date(r.boardingTime).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}) : "—"}
                            {r.dropoffTime  ? ` → ${new Date(r.dropoffTime).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}` : ""}
                          </div>
                          <div style={{ fontSize:13, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {r.pickupLocation || "—"}
                            {r.dropoffLocation ? <span style={{ color:C.muted, fontWeight:400 }}> → {r.dropoffLocation}</span> : ""}
                          </div>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap", fontSize:11, color:C.muted, marginTop:3 }}>
                            {r.boardingMethod && <span>{r.boardingMethod}</span>}
                            {r.paymentMethod  && <span>· {r.paymentMethod}</span>}
                            {r.passengers     && <span>· {r.passengers}人</span>}
                            {r.highwayFee > 0 && <span>· 高速 {fmt(r.highwayFee)}円</span>}
                          </div>
                          {r.memo && <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>📝 {r.memo}</div>}
                        </div>
                        <div style={{ fontSize:15, fontWeight:900, color:C.gold, whiteSpace:"nowrap" }}>
                          {(r.fare || r.amount) ? `${fmt(r.fare || r.amount)}円` : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:C.muted, textAlign:"right", marginTop:4 }}>
                    合計: {fmt(salesRecs.reduce((s,r) => s + (r.fare || r.amount || 0), 0))}円
                  </div>
                </div>
              )}
            </div>
          )}

          {!confirmDelete ? (
            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              {onDelete && (
                <button onClick={() => setConfirmDelete(true)} style={{ flex:1, padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.red}66`, backgroundColor:"transparent", color:C.red }}>
                  🗑 削除
                </button>
              )}
              <button onClick={onClose} style={{ flex:2, padding:"14px 0", borderRadius:11, fontSize:15, fontWeight:800, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}>
                ✕ 閉じる
              </button>
            </div>
          ) : (
            <div style={{ marginTop:18, backgroundColor:`${C.red}18`, border:`1px solid ${C.red}44`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.red, marginBottom:4 }}>本当に削除しますか？</div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>削除した日報は元に戻せません</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex:1, padding:"12px 0", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted }}>
                  キャンセル
                </button>
                <button onClick={() => onDelete?.(report.id)} style={{ flex:1, padding:"12px 0", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", border:"none", backgroundColor:C.red, color:"#fff" }}>
                  削除する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── 編集モード ──
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={()=>setMode("view")}>
      <div onClick={e=>e.stopPropagation()} style={baseSheet}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 14px" }}/>
        <span onClick={()=>setMode("view")} style={{ fontSize:12, color:C.muted, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3, display:"inline-block", marginBottom:12 }}>← 閲覧に戻る</span>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:18 }}>日報を編集</div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Field label="日付" fk="date" form={form} setForm={setForm} errors={errors} type="date"/>
          <Field label="営業回数（回）" fk="ride_count" form={form} setForm={setForm} errors={errors} ph="30"/>
          <Field label="売上（税込）（円）" fk="gross_sales" form={form} setForm={setForm} errors={errors} ph="62000"/>
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
          <Field label="高速料金（円）" fk="highway_fee" form={form} setForm={setForm} errors={errors} ph="800"/>
          <AdjustmentInput value={form.adjustment} onChange={v=>setForm(p=>({...p,adjustment:v}))} />
          <Field label="現金売上（円）" fk="cash_sales" form={form} setForm={setForm} errors={errors} ph="37000"/>
          <Field label="アプリ決済（円）" fk="app_sales" form={form} setForm={setForm} errors={errors} ph="7000"/>
          <Field label="クレジットカード（円）" fk="card_sales" form={form} setForm={setForm} errors={errors} ph="18000"/>
          <Field label="電子マネー（円）" fk="emoney_sales" form={form} setForm={setForm} errors={errors} ph="0"/>
          <Field label="タクシーチケット（円）" fk="ticket_sales" form={form} setForm={setForm} errors={errors} ph="0"/>
          <Field label="走行距離（km）" fk="total_distance" form={form} setForm={setForm} errors={errors} ph="300"/>
          <Field label="実車距離（km）" fk="occupied_distance" form={form} setForm={setForm} errors={errors} ph="155"/>
          <WorkHoursPicker value={form.work_hours} onChange={v=>setForm(p=>({...p,work_hours:v}))} />
          <WorkHoursPicker label="休憩時間" maxHours={8} value={form.break_hours} onChange={v=>setForm(p=>({...p,break_hours:v}))} />
          <Field label="チップ（円）" fk="tip_amount" form={form} setForm={setForm} errors={errors} ph="0"/>
        </div>

        {/* 備考 */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.muted, marginBottom:7 }}>事故・トラブル備考</div>
          <textarea
            value={form.trouble_note}
            onChange={e=>setForm(p=>({...p,trouble_note:e.target.value}))}
            placeholder="特記事項があれば（任意）"
            rows={2}
            style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"15px 16px", color:C.text, fontSize:17, outline:"none", resize:"none" }}
          />
        </div>

        {/* 乗車記録（読み取り専用表示） */}
        {rides.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div onClick={() => setShowRides(p => !p)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>🚕 乗車記録（{rides.length}件）</span>
              <span style={{ fontSize:11, color:C.muted }}>{showRides ? "▲ 閉じる" : "▼ 開く"}</span>
            </div>
            {showRides && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
                {rides.map((r, i) => (
                  <div key={i} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>
                          {r.pickup_time}{r.dropoff_time ? ` → ${r.dropoff_time}` : ""}
                        </div>
                        <div style={{ fontSize:12, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.pickup_area || "—"} → {r.dropoff_area || "—"}
                        </div>
                      </div>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap" }}>
                        {(r.amount||0).toLocaleString()}円
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:16, display:"flex", gap:10 }}>
          <Btn onClick={()=>setMode("view")} variant="ghost" style={{ flex:1 }}>キャンセル</Btn>
          <Btn onClick={handleSave} disabled={saving} style={{ flex:2 }}>
            {saving ? "保存中..." : "保存する"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── 月別統計ページ ───
function MonthlyStats({ reports }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // 全データから年一覧を生成
  const years = [...new Set(reports.map(r => r.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
  if (!years.includes(String(selectedYear))) years.unshift(String(selectedYear));

  // 選択年の12ヶ月分集計
  const monthlyData = Array.from({length:12}, (_,i) => {
    const month = String(i+1).padStart(2,"0");
    const key = `${selectedYear}-${month}`;
    const reps = reports.filter(r => r.date?.startsWith(key) && r.gross_sales > 0);
    const totalSales = reps.reduce((s,r)=>s+(r.gross_sales||0),0);
    const totalRides = reps.reduce((s,r)=>s+(r.ride_count||0),0);
    const avgOcc = reps.length ? Math.round(reps.reduce((s,r)=>s+occ(r),0)/reps.length) : 0;
    return { month:i+1, label:`${i+1}月`, reps:reps.length, totalSales, totalRides, avgOcc };
  });

  const maxSales = Math.max(...monthlyData.map(d=>d.totalSales), 1);
  const isCurrentYear = selectedYear === now.getFullYear();
  const yearTotal = monthlyData.reduce((s,d)=>s+d.totalSales,0);
  const yearRides = monthlyData.reduce((s,d)=>s+d.reps,0);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const detail = selectedMonth != null ? monthlyData[selectedMonth-1] : null;

  return (
    <div>
      {/* 年選択 */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center" }}>
        <span style={{ fontSize:12, color:C.muted }}>年：</span>
        {[...new Set([...years, String(now.getFullYear())])].slice(0,4).map(y=>(
          <div key={y} onClick={()=>{ setSelectedYear(Number(y)); setSelectedMonth(null); }}
            style={{ padding:"5px 14px", borderRadius:99, fontSize:12, fontWeight:selectedYear===Number(y)?700:400, backgroundColor:selectedYear===Number(y)?C.accentLight+"22":C.card, color:selectedYear===Number(y)?C.accentLight:C.muted, border:`1px solid ${selectedYear===Number(y)?C.accentLight+"44":C.border}`, cursor:"pointer" }}>
            {y}年
          </div>
        ))}
      </div>

      {/* 年間サマリー */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px" }}>
          <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{selectedYear}年 年間売上</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.accentLight }}>{yearTotal>0?fmt(yearTotal):"—"}<span style={{ fontSize:10, marginLeft:2, color:C.muted }}>円</span></div>
        </div>
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px" }}>
          <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{selectedYear}年 出番回数</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.gold }}>{yearRides>0?yearRides:"—"}<span style={{ fontSize:10, marginLeft:2, color:C.muted }}>回</span></div>
        </div>
      </div>

      {/* 12ヶ月棒グラフ */}
      <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 12px", marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:12 }}>月別売上グラフ</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:90 }}>
          {monthlyData.map((d,i) => {
            const isFuture = isCurrentYear && d.month > now.getMonth()+1;
            const barH = d.totalSales > 0 ? Math.max(8, Math.round((d.totalSales / maxSales) * 70)) : 0;
            const isSelected = selectedMonth === d.month;
            const isCurrent = isCurrentYear && d.month === now.getMonth()+1;
            const color = isCurrent ? C.accentLight : isSelected ? C.gold : C.accentLight+"88";
            return (
              <div key={d.month} onClick={()=>setSelectedMonth(selectedMonth===d.month?null:d.month)}
                style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer" }}>
                <div style={{ width:"100%", height:barH, backgroundColor:isFuture?"transparent":color, borderRadius:"4px 4px 0 0", border:isSelected?`2px solid ${C.gold}`:"none", transition:"height 0.2s" }}/>
                <div style={{ fontSize:8, color:isCurrent?C.accentLight:isSelected?C.gold:C.muted, marginTop:3, fontWeight:isSelected||isCurrent?700:400 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 月詳細 */}
      {detail ? (
        <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:14, padding:"16px" }}>
          <div style={{ fontSize:13, fontWeight:800, marginBottom:12 }}>{selectedYear}年{detail.month}月の詳細</div>
          {detail.reps === 0 ? (
            <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"12px 0" }}>この月のデータはありません</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"月間売上", value:`${fmt(detail.totalSales)}円`, color:C.accentLight },
                { label:"出番回数", value:`${detail.reps}回`, color:C.gold },
                { label:"総営業回数", value:`${detail.totalRides}回`, color:C.green },
                { label:"日平均売上", value:`${fmt(Math.round(detail.totalSales/detail.reps))}円`, color:C.text },
                { label:"平均実車率", value:`${detail.avgOcc}%`, color:detail.avgOcc>=55?C.green:detail.avgOcc>=45?C.gold:C.red },
              ].map(({label,value,color})=>(
                <div key={label} style={{ backgroundColor:C.surface, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:13, fontWeight:800, color }}>{value}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px", textAlign:"center" }}>
          <div style={{ fontSize:13, color:C.muted }}>月を選択すると詳細が表示されます</div>
        </div>
      )}
    </div>
  );
}

// ─── 日報一覧 ───
// ─── 営業ポイント分析ビュー ───
function SalesPointAnalysis() {
  const records = (() => {
    try { return JSON.parse(localStorage.getItem("taxi_sales_records") || "[]"); } catch { return []; }
  })();

  if (records.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"40px 16px", color:C.muted }}>
        <div style={{ fontSize:36, marginBottom:12 }}>📍</div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>まだ記録がありません</div>
        <div style={{ fontSize:13 }}>ホーム画面の「営業ポイント」から記録を追加すると、ここに統計が表示されます。</div>
      </div>
    );
  }

  // ポイント別集計
  const spotMap = {};
  records.forEach(r => {
    const k = r.spotName || "不明";
    if (!spotMap[k]) spotMap[k] = { count: 0, total: 0, records: [] };
    spotMap[k].count++;
    spotMap[k].total += r.amount || 0;
    spotMap[k].records.push(r);
  });
  const spots = Object.entries(spotMap)
    .map(([name, s]) => ({ name, count: s.count, total: s.total, avg: Math.round(s.total / s.count), records: s.records }))
    .sort((a, b) => b.total - a.total);

  const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
  const totalCount  = records.length;

  return (
    <div>
      {/* サマリー */}
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        {[
          { label:"総記録数", value:`${totalCount}件`, color:C.text },
          { label:"累計金額", value:`${fmt(totalAmount)}円`, color:C.gold },
          { label:"ポイント数", value:`${spots.length}箇所`, color:C.accentLight },
        ].map(s => (
          <div key={s.label} style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:15, fontWeight:900, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ポイント別ランキング */}
      <div style={{ fontSize:13, fontWeight:800, color:C.sub, marginBottom:10 }}>📍 営業ポイント別 稼ぎランキング</div>
      {spots.map((s, i) => (
        <div key={s.name} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <div style={{ fontSize:18, fontWeight:900, color: i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":C.muted, width:28, textAlign:"center" }}>
              #{i+1}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.name}</div>
              <div style={{ fontSize:11, color:C.muted }}>{s.count}回記録</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.gold }}>{fmt(s.avg)}<span style={{ fontSize:10, color:C.muted }}>円/回</span></div>
              <div style={{ fontSize:10, color:C.muted }}>合計 {fmt(s.total)}円</div>
            </div>
          </div>
          {/* バー */}
          <div style={{ height:4, backgroundColor:C.bg, borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.round(s.total / spots[0].total * 100)}%`, backgroundColor: i===0?C.gold:C.accentLight, borderRadius:99 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

const DISPATCH_OPTIONS = ["GO（ゴー）","S.RIDE（エスライド）","DiDi（ディディ）","Uber Taxi","NearMe","全日本無線","東京無線","その他"];

export default function ReportList({ reports, onSelect, onEdit, onUpdate, user }) {
  const [view, setView]   = useState("list");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date");

  // 共有済み管理（ローカル反映）
  const [sharedIds, setSharedIds] = useState(() => new Set(reports.filter(r => r.is_shared).map(r => r.id)));
  const [shareLoading, setShareLoading] = useState(null);

  const handleToggleShare = async (e, reportId) => {
    e.stopPropagation();
    if (!reportId) return;
    const next = !sharedIds.has(reportId);
    setShareLoading(reportId);
    const { error } = await toggleShareReport(reportId, next);
    if (!error) {
      setSharedIds(prev => {
        const s = new Set(prev);
        next ? s.add(reportId) : s.delete(reportId);
        return s;
      });
    }
    setShareLoading(null);
  };

  // ─── 一括選択・編集 ────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDispatch, setBulkDispatch] = useState("");
  const [bulkArea, setBulkArea] = useState("");
  const [undoStack, setUndoStack] = useState([]); // [{ ids, prevReports }]
  const [undoMsg, setUndoMsg] = useState("");

  // 平均・目標比は税抜ベースで統一（user.target も税抜で保存されている）
  const avg = reports.length ? Math.round(reports.reduce((s,r)=>s+(r.net_sales||Math.round(r.gross_sales/1.1)),0)/reports.length) : 0;

  // 目標比: 勤務当日の「働き出す前の残り目標 ÷ 残りシフト数」を1日の基準とする
  // → 各日報ごとに動的計算するための下準備
  const { start: periodStart, end: periodEnd } = getClosingPeriod(user?.closing_day ?? 0);
  const periodAllShifts = loadS("taxi_shifts", []);
  const periodShifts = periodAllShifts.filter(s => s.date >= periodStart && s.date <= periodEnd);
  // 締め期間内の日報を日付昇順でソート
  const sortedPeriodReports = [...reports]
    .filter(r => r.gross_sales && r.date >= periodStart && r.date <= periodEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 1日分の目標を計算（当日の働き始め前の視点）
  // 残り目標 = 月間目標 - 当日より前の累計税抜売上
  // 残りシフト数 = 当日以降（当日含む）のシフト数
  const getDailyTarget = (r) => {
    if (!user?.target) return avg;
    const monthlyTarget = Number(user.target);
    const cumBefore = sortedPeriodReports
      .filter(p => p.date < r.date)
      .reduce((s, p) => s + (p.net_sales || Math.round(p.gross_sales / 1.1)), 0);
    const remainingShiftCount = periodShifts.filter(s => s.date >= r.date).length;
    // シフト未登録の場合はfallback
    if (remainingShiftCount < 1) return Math.round(monthlyTarget / 15);
    return Math.round((monthlyTarget - cumBefore) / remainingShiftCount);
  };

  const diffLabel = user?.target ? "目標比" : "平均比";
  const filtered = reports
    .filter(r => r && r.gross_sales)
    .filter(r => filter==="high"?r.gross_sales>=65000:filter==="low"?r.gross_sales<58000:true)
    .sort((a,b) => sort==="sales"?b.gross_sales-a.gross_sales:sort==="occ"?occ(b)-occ(a):b.date.localeCompare(a.date));

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  function applyBulk() {
    if (selectedIds.size === 0 || (!bulkDispatch && !bulkArea)) return;
    // undoスタックに現在の状態を積む
    const targets = reports.filter(r => selectedIds.has(r.id));
    setUndoStack(prev => [...prev.slice(-4), { ids: [...selectedIds], prevReports: targets.map(r => ({ ...r })) }]);
    // 一括更新
    targets.forEach(r => {
      const updated = { ...r };
      if (bulkDispatch) updated.dispatch_type = bulkDispatch;
      if (bulkArea)     updated.work_area     = bulkArea;
      onUpdate?.(updated);
    });
    setUndoMsg(`${targets.length}件を更新しました`);
    setTimeout(() => setUndoMsg(""), 4000);
    setSelectedIds(new Set());
    setBulkDispatch("");
    setBulkArea("");
  }

  function handleUndo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    last.prevReports.forEach(r => onUpdate?.(r));
    setUndoStack(prev => prev.slice(0, -1));
    setUndoMsg("変更を元に戻しました");
    setTimeout(() => setUndoMsg(""), 3000);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkDispatch("");
    setBulkArea("");
  }

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 140px" }}>
      {/* ビュー切り替えタブ */}
      <div style={{ display:"flex", gap:6, marginBottom:14, backgroundColor:C.card, borderRadius:12, padding:4, border:`1px solid ${C.border}` }}>
        {[["list","📋 日報一覧"],["monthly","📅 月別統計"]].map(([v,l])=>(
          <div key={v} onClick={()=>setView(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:9, fontSize:12, fontWeight:view===v?700:400, backgroundColor:view===v?C.accentLight:C.surface, color:view===v?"#fff":C.muted, cursor:"pointer", transition:"all 0.15s" }}>{l}</div>
        ))}
      </div>

      {view === "monthly" && <MonthlyStats reports={reports}/>}

      {view === "list" && <>
        {/* フィルター行 + 選択ボタン */}
        <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
          {!selectMode ? (
            <>
              {[["all","すべて"],["high","高売上"],["low","要改善"]].map(([v,l])=>(
                <div key={v} onClick={()=>setFilter(v)} style={{ padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:filter===v?700:400, backgroundColor:filter===v?C.accentLight+"22":C.card, color:filter===v?C.accentLight:C.muted, border:`1px solid ${filter===v?C.accentLight+"44":C.border}`, cursor:"pointer" }}>{l}</div>
              ))}
              <div style={{ flex:1 }}/>
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", color:C.sub, fontSize:12, outline:"none" }}>
                <option value="date">日付順</option><option value="sales">売上順</option><option value="occ">実車率順</option>
              </select>
              {onEdit && (
                <button onClick={() => setSelectMode(true)}
                  style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:`1px solid ${C.border}`, backgroundColor:C.card, color:C.muted, cursor:"pointer" }}>
                  選択
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={toggleSelectAll}
                style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:`1px solid ${C.accentLight}`, backgroundColor:C.accentGlow, color:C.accentLight, cursor:"pointer" }}>
                {selectedIds.size === filtered.length ? "全解除" : "全選択"}
              </button>
              <span style={{ fontSize:12, color:C.muted }}>{selectedIds.size}件選択</span>
              <div style={{ flex:1 }}/>
              <button onClick={exitSelectMode}
                style={{ padding:"6px 12px", borderRadius:8, fontSize:12, border:"none", backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>
                ✕ キャンセル
              </button>
            </>
          )}
        </div>

        {/* 一括設定パネル（選択モード時） */}
        {selectMode && (
          <div style={{ backgroundColor:C.card, border:`1px solid ${C.accentLight}44`, borderRadius:12, padding:"14px", marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.accentLight, marginBottom:10 }}>✏️ 一括設定（選択した{selectedIds.size}件）</div>
            {/* 配車アプリ */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>配車アプリ・無線</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {DISPATCH_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setBulkDispatch(d => d === opt ? "" : opt)}
                    style={{ padding:"5px 10px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
                      border:`1.5px solid ${bulkDispatch === opt ? C.accentLight : C.border}`,
                      backgroundColor: bulkDispatch === opt ? C.accentLight+"22" : "transparent",
                      color: bulkDispatch === opt ? C.accentLight : C.muted }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            {/* エリア */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>エリア</div>
              <select value={bulkArea} onChange={e => setBulkArea(e.target.value)}
                style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 12px", color:bulkArea?C.text:C.muted, fontSize:13, outline:"none" }}>
                <option value="">（変更しない）</option>
                {Object.entries(WORK_AREAS_BY_PARENT).map(([parent, areas]) => (
                  <optgroup key={parent} label={parent}>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={applyBulk} disabled={selectedIds.size === 0 || (!bulkDispatch && !bulkArea)}
                style={{ flex:2, padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:800, cursor:selectedIds.size > 0 && (bulkDispatch || bulkArea)?"pointer":"not-allowed",
                  border:"none", backgroundColor: selectedIds.size > 0 && (bulkDispatch || bulkArea) ? C.accentLight : C.border,
                  color:"#fff", opacity: selectedIds.size > 0 && (bulkDispatch || bulkArea) ? 1 : 0.5 }}>
                {selectedIds.size > 0 ? `${selectedIds.size}件に適用` : "日報を選択してください"}
              </button>
              {undoStack.length > 0 && (
                <button onClick={handleUndo}
                  style={{ flex:1, padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", border:`1px solid ${C.orange}`, backgroundColor:"transparent", color:C.orange }}>
                  ↩ 戻す
                </button>
              )}
            </div>
            {undoMsg && (
              <div style={{ marginTop:8, fontSize:12, color: undoMsg.includes("戻") ? C.orange : C.green, textAlign:"center" }}>
                {undoMsg}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{filtered.length}件</div>

        {(() => {
          let lastMonth = "";
          const elems = [];
          filtered.forEach(r => {
            const [y, m] = r.date.split("-");
            const monthKey = `${y}-${m}`;
            if (monthKey !== lastMonth) {
              lastMonth = monthKey;
              elems.push(
                <div key={`divider-${monthKey}`} style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0 8px" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.sub, whiteSpace:"nowrap" }}>{Number(y)}年 {Number(m)}月</div>
                  <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
                </div>
              );
            }
            const or=occ(r), oc=or>=55?C.green:or>=45?C.gold:C.red;
            const netSales = r.net_sales || Math.round(r.gross_sales / 1.1);
            const diff = netSales - getDailyTarget(r);
            const isSelected = selectedIds.has(r.id);
            elems.push(
              <div key={r.id} style={{ position:"relative" }}>
                {selectMode && (
                  <div
                    onClick={() => toggleSelect(r.id)}
                    style={{
                      position:"absolute", left:-4, top:"50%", transform:"translateY(-50%)", zIndex:10,
                      width:22, height:22, borderRadius:6,
                      border:`2px solid ${isSelected ? C.accentLight : C.border}`,
                      backgroundColor: isSelected ? C.accentLight : C.bg,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      cursor:"pointer", flexShrink:0,
                    }}>
                    {isSelected && <span style={{ color:"#fff", fontSize:13, fontWeight:900, lineHeight:1 }}>✓</span>}
                  </div>
                )}
                <Card onClick={() => selectMode ? toggleSelect(r.id) : onSelect(r)}
                  style={{ padding:"14px", marginLeft: selectMode ? 26 : 0,
                    border: isSelected ? `1.5px solid ${C.accentLight}` : undefined,
                    backgroundColor: isSelected ? C.accentGlow : undefined }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>{r.date}（{dow(r.date)}）</div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:14, flexWrap:"wrap" }}>
                      <div style={{ fontSize:26, fontWeight:900, color:C.text, lineHeight:1.1, minWidth:150 }}>
                        {fmt(netSales)}<span style={{ fontSize:12, color:C.muted, marginLeft:3, fontWeight:400 }}>円</span>
                      </div>
                      <div style={{ paddingBottom:2 }}>
                        <div style={{ fontSize:10, color:diff>=0?C.green:C.red, fontWeight:600, lineHeight:1.3 }}>{diffLabel}</div>
                        <div style={{ fontSize:15, fontWeight:800, color:diff>=0?C.green:C.red, lineHeight:1.2 }}>{diff>=0?"+":""}{fmt(diff)}<span style={{ fontSize:11, marginLeft:1 }}>円</span></div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                    <Badge color={oc}>実車率 {or}%</Badge>
                    {!selectMode && (
                      <div style={{ display:"flex", gap:6 }}>
                        {r.id && (
                          <button
                            onClick={e => handleToggleShare(e, r.id)}
                            disabled={shareLoading === r.id}
                            title={sharedIds.has(r.id) ? "共有中（タップで解除）" : "フレンドに共有"}
                            style={{ fontSize:12, color:sharedIds.has(r.id)?C.accentLight:C.muted, background:"none", border:`1px solid ${sharedIds.has(r.id)?C.accentLight+"66":C.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", opacity:shareLoading===r.id?0.5:1, fontWeight:sharedIds.has(r.id)?700:400 }}
                          >{shareLoading===r.id?"…":sharedIds.has(r.id)?"✓共有":"共有"}</button>
                        )}
                        {onEdit && (
                          <button
                            onClick={e=>{ e.stopPropagation(); onEdit(r); }}
                            style={{ fontSize:12, color:C.accentLight, background:"none", border:`1px solid ${C.accentLight}66`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontWeight:700 }}
                          >✏️</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, fontSize:11, color:C.muted, flexWrap:"wrap" }}>
                  <span>🚗 {r.ride_count}回</span>
                  <span>📍 {r.total_distance}km</span>
                  <span>⏱ {fmt(hourly(r))}円/h</span>
                  {r.dispatch_type && <span>📱 {r.dispatch_type}</span>}
                  {r.work_area && <span>📌 {r.work_area}</span>}
                  {r.trouble_note&&<span style={{ color:C.red }}>⚠️</span>}
                </div>
                {r.ai_comment && (
                  <div style={{ marginTop:10, fontSize:12, color:C.sub, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", borderLeft:`3px solid ${C.accentLight}`, lineHeight:1.6 }}>
                    💬 {r.ai_comment.slice(0,70)}...
                  </div>
                )}
                </Card>
              </div>
            );
          });
          return elems;
        })()}
      </>}
    </div>
  );
}
