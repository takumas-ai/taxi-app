import { useState, useRef } from "react";
import { C, fmt, occ, dow, hourly } from "../lib/constants";
import { Card, Badge, Btn } from "../components/UI";
import { WORK_AREAS_BY_PARENT } from "../data/mockData";
import { validateReportForm, sanitizeReportData } from "../lib/validate";

// ─── 編集フォームの1フィールド ───
function Field({ label, fk, form, setForm, errors, type="number", ph="", span=1 }) {
  return (
    <div style={{ gridColumn:`span ${span}` }}>
      <div style={{ fontSize:11, color:errors[fk]?C.red:C.muted, marginBottom:4 }}>
        {label}{errors[fk]&&<span style={{ marginLeft:4, color:C.red }}>{errors[fk]}</span>}
      </div>
      <input
        type={type}
        value={form[fk]}
        placeholder={ph}
        onChange={e => { setForm(p=>({...p,[fk]:e.target.value})); }}
        style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${errors[fk]?C.red:C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:14, outline:"none" }}
      />
    </div>
  );
}

// フォームの初期値を生成
function buildForm(report) {
  return {
    date:               report.date || "",
    gross_sales:        report.gross_sales        != null ? String(report.gross_sales)        : "",
    cash_sales:         report.cash_sales         != null ? String(report.cash_sales)         : "",
    card_sales:         report.card_sales         != null ? String(report.card_sales)         : "",
    app_sales:          report.app_sales          != null ? String(report.app_sales)          : "",
    highway_fee:        report.highway_fee        != null ? String(report.highway_fee)        : "0",
    ride_count:         report.ride_count         != null ? String(report.ride_count)         : "",
    total_distance:     report.total_distance     != null ? String(report.total_distance)     : "",
    occupied_distance:  report.occupied_distance  != null ? String(report.occupied_distance)  : "",
    work_hours:         report.work_hours         != null ? String(report.work_hours)         : "",
    break_hours:        report.break_hours        != null ? String(report.break_hours)        : "1.0",
    trouble_note:       report.trouble_note || "",
    work_area:          report.work_area   || "",
  };
}

// ─── 日報詳細 / 編集モーダル ───
export function ReportModal({ report, onClose, onUpdate, startInEdit = false }) {
  const [mode, setMode] = useState(startInEdit ? "edit" : "view");
  const [form, setForm] = useState(() => startInEdit && report ? buildForm(report) : {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // 乗車記録のポイント名編集
  const [rides, setRides] = useState(() => Array.isArray(report?.rides) ? report.rides : []);
  const [editingRideIdx, setEditingRideIdx] = useState(null);
  const [ridePointInput, setRidePointInput] = useState("");
  // スワイプで閉じる（native event listener + scrollTop check）
  const touchStartY = useRef(null);
  const sheetRef    = useRef(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onStart = (e) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd   = (e) => {
      if (touchStartY.current === null) return;
      // スクロール中でない（シートが最上部）の時だけ閉じる
      if (el.scrollTop > 0) { touchStartY.current = null; return; }
      const delta = e.changedTouches[0].clientY - touchStartY.current;
      if (delta > 80) onClose();
      touchStartY.current = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend",   onEnd);
    };
  }, [onClose]);
  const [showRides, setShowRides] = useState(false);

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
    const updated = { ...report, ...sanitized };
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
  };

  // ── 閲覧モード ──
  if (mode === "view") {
    return (
      <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
        <div ref={sheetRef} onClick={e=>e.stopPropagation()} style={baseSheet}>
          <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, color:C.muted }}>{report.date}（{dow(report.date)}）</div>
              <div style={{ fontSize:28, fontWeight:800 }}>{fmt(report.gross_sales)}<span style={{ fontSize:13, color:C.muted, marginLeft:4 }}>円</span></div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
              <Badge color={oc} size={11}>実車率 {or}%</Badge>
              {onUpdate && (
                <button onClick={startEdit} style={{ fontSize:14, fontWeight:700, color:C.accentLight, background:C.accentGlow, border:`1px solid ${C.accentLight}66`, borderRadius:10, padding:"8px 18px", cursor:"pointer" }}>
                  ✏️ 編集
                </button>
              )}
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

          <button onClick={onClose} style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub, marginTop:18 }}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ── 編集モード ──
  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:100, display:"flex", alignItems:"flex-end" }} onClick={()=>setMode("view")}>
      <div onClick={e=>e.stopPropagation()} style={baseSheet}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 14px" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
          <button onClick={()=>setMode("view")} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:0, lineHeight:1 }}>‹</button>
          <div style={{ fontSize:16, fontWeight:800 }}>日報を編集</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="日付" fk="date" form={form} setForm={setForm} errors={errors} type="date" span={2}/>
          <Field label="総売上（円）" fk="gross_sales" form={form} setForm={setForm} errors={errors} ph="62000"/>
          <Field label="営業回数（回）" fk="ride_count" form={form} setForm={setForm} errors={errors} ph="30"/>
          <Field label="現金売上（円）" fk="cash_sales" form={form} setForm={setForm} errors={errors} ph="37000"/>
          <Field label="カード売上（円）" fk="card_sales" form={form} setForm={setForm} errors={errors} ph="18000"/>
          <Field label="配車アプリ（円）" fk="app_sales" form={form} setForm={setForm} errors={errors} ph="7000" span={2}/>
          <Field label="走行距離（km）" fk="total_distance" form={form} setForm={setForm} errors={errors} ph="300"/>
          <Field label="実車距離（km）" fk="occupied_distance" form={form} setForm={setForm} errors={errors} ph="155"/>
          <Field label="勤務時間（h）" fk="work_hours" form={form} setForm={setForm} errors={errors} ph="13.5"/>
          <Field label="休憩時間（h）" fk="break_hours" form={form} setForm={setForm} errors={errors} ph="1.0"/>
          <Field label="高速料金（円）" fk="highway_fee" form={form} setForm={setForm} errors={errors} ph="800" span={2}/>
        </div>

        {/* エリア */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>📍 メインエリア</div>
          <select
            value={form.work_area}
            onChange={e=>setForm(p=>({...p,work_area:e.target.value}))}
            style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:form.work_area?C.text:C.muted, fontSize:14, outline:"none" }}
          >
            <option value="">選択してください（任意）</option>
            {Object.entries(WORK_AREAS_BY_PARENT).map(([parent, areas]) => (
              <optgroup key={parent} label={parent}>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 備考 */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>事故・トラブル備考</div>
          <textarea
            value={form.trouble_note}
            onChange={e=>setForm(p=>({...p,trouble_note:e.target.value}))}
            placeholder="特記事項があれば（任意）"
            rows={2}
            style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:13, outline:"none", resize:"none" }}
          />
        </div>

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

export default function ReportList({ reports, onSelect, onEdit }) {
  const [view, setView]   = useState("list"); // "list" | "monthly" | "spotAnalysis"
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date");
  const avg = reports.length ? Math.round(reports.reduce((s,r)=>s+r.gross_sales,0)/reports.length) : 0;
  const filtered = reports
    .filter(r => r && r.gross_sales)
    .filter(r => filter==="high"?r.gross_sales>=65000:filter==="low"?r.gross_sales<58000:true)
    .sort((a,b) => sort==="sales"?b.gross_sales-a.gross_sales:sort==="occ"?occ(b)-occ(a):b.date.localeCompare(a.date));
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      {/* ビュー切り替えタブ */}
      <div style={{ display:"flex", gap:6, marginBottom:14, backgroundColor:C.card, borderRadius:12, padding:4, border:`1px solid ${C.border}` }}>
        {[["list","📋 日報一覧"],["monthly","📅 月別統計"],["spotAnalysis","📊 分析"]].map(([v,l])=>(
          <div key={v} onClick={()=>setView(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:9, fontSize:12, fontWeight:view===v?700:400, backgroundColor:view===v?C.accentLight:C.surface, color:view===v?"#fff":C.muted, cursor:"pointer", transition:"all 0.15s" }}>{l}</div>
        ))}
      </div>

      {/* 月別統計ビュー */}
      {view === "monthly" && <MonthlyStats reports={reports}/>}

      {/* 営業ポイント分析ビュー */}
      {view === "spotAnalysis" && <SalesPointAnalysis />}

      {/* 日報一覧ビュー */}
      {view === "list" && <>
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        {[["all","すべて"],["high","高売上"],["low","要改善"]].map(([v,l])=>(
          <div key={v} onClick={()=>setFilter(v)} style={{ padding:"6px 12px", borderRadius:99, fontSize:12, fontWeight:filter===v?700:400, backgroundColor:filter===v?C.accentLight+"22":C.card, color:filter===v?C.accentLight:C.muted, border:`1px solid ${filter===v?C.accentLight+"44":C.border}`, cursor:"pointer" }}>{l}</div>
        ))}
        <div style={{ flex:1 }}/>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", color:C.sub, fontSize:12, outline:"none" }}>
          <option value="date">日付順</option><option value="sales">売上順</option><option value="occ">実車率順</option>
        </select>
      </div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{filtered.length}件</div>
      {filtered.map(r => {
        const or=occ(r), oc=or>=55?C.green:or>=45?C.gold:C.red, diff=r.gross_sales-avg;
        return (
          <Card key={r.id} onClick={()=>onSelect(r)} style={{ padding:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:11, color:C.muted }}>{r.date}（{dow(r.date)}）</div>
                <div style={{ fontSize:22, fontWeight:800, marginTop:2 }}>{fmt(r.gross_sales)}<span style={{ fontSize:11, color:C.muted, marginLeft:3 }}>円</span></div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                <Badge color={oc}>実車率 {or}%</Badge>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:11, color:diff>=0?C.green:C.red, fontWeight:700 }}>{diff>=0?"+":""}{fmt(diff)}円</div>
                  {onEdit && (
                    <button
                      onClick={e=>{ e.stopPropagation(); onEdit(r); }}
                      style={{ fontSize:11, color:C.accentLight, background:"none", border:`1px solid ${C.accentLight}44`, borderRadius:6, padding:"2px 8px", cursor:"pointer" }}
                    >✏️</button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:12, fontSize:11, color:C.muted }}>
              <span>🚗 {r.ride_count}回</span>
              <span>📍 {r.total_distance}km</span>
              <span>⏱ {fmt(hourly(r))}円/h</span>
              {r.trouble_note&&<span style={{ color:C.red }}>⚠️</span>}
            </div>
            {r.ai_comment && (
              <div style={{ marginTop:10, fontSize:12, color:C.sub, backgroundColor:C.bg, borderRadius:8, padding:"8px 10px", borderLeft:`3px solid ${C.accentLight}`, lineHeight:1.6 }}>
                💬 {r.ai_comment.slice(0,70)}...
              </div>
            )}
          </Card>
        );
      })}
      </>}
    </div>
  );
}
