// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SalesPointCard.jsx — 乗車記録機能（指示書4 #13）
// ホーム画面に設置。GPS自動入力・最新3件表示・全件一覧・統計分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, fmt, loadS } from "../lib/constants";
import { Card } from "../components/UI";
import { fetchRideRecords, upsertRideRecord, deleteRideRecord } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const LS_KEY = "taxi_sales_records";

// ─── ユーティリティ ───────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowDatetime() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fmtDatetime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month:"numeric", day:"numeric", weekday:"short", hour:"2-digit", minute:"2-digit" });
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { year:"numeric", month:"long", day:"numeric", weekday:"short" });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`,
      { headers: { "Accept-Language": "ja" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [a.city || a.town || a.village || a.county, a.suburb || a.neighbourhood, a.road].filter(Boolean);
    return parts.join(" ") || data.display_name?.split(",")[0] || `${lat.toFixed(4)},${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }
}

function getGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("GPS非対応")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}

function saveRecords(recs) {
  localStorage.setItem(LS_KEY, JSON.stringify(recs));
}

const PAYMENT_OPTIONS = ["現金", "カード", "電子マネー", "QR", "ネット決済", "チケット", "その他"];
const BOARDING_OPTIONS = ["流し", "付け待ち", "配車アプリ", "自社無線", "その他"];
const RADIO_TYPE_OPTIONS = ["GO（ゴー）", "S.RIDE（エスライド）", "DiDi（ディディ）", "Uber Taxi", "NearMe（ニアミー）", "全日本無線", "東京無線", "その他"];
const RADIO_BOARDING = ["配車アプリ", "自社無線"]; // 無線種別を表示する乗車方法
const NATIONALITY_OPTIONS = ["日本人", "英語圏", "中国語圏", "韓国語圏", "その他の外国人"];

// ─── 記録モーダル ─────────────────────────────
function RecordModal({ onClose, onSave, editTarget }) {
  const now = nowDatetime();
  const today = todayDate();

  const [workDate,       setWorkDate]       = useState(editTarget?.workDate ?? today);
  const [boardingTime,   setBoardingTime]   = useState(editTarget?.boardingTime ?? now);
  const [pickupLocation, setPickupLocation] = useState(editTarget?.pickupLocation ?? "");
  const [dropoffTime,    setDropoffTime]    = useState(editTarget?.dropoffTime ?? now);
  const [dropoffLocation,setDropoffLocation]= useState(editTarget?.dropoffLocation ?? "");
  const [passengers,     setPassengers]     = useState(editTarget?.passengers ?? "");
  const [fare,           setFare]           = useState(editTarget?.fare ?? editTarget?.amount ?? "");
  const [highwayFee,     setHighwayFee]     = useState(editTarget?.highwayFee ?? "");
  const [paymentMethod,  setPaymentMethod]  = useState(editTarget?.paymentMethod ?? "");
  const [boardingMethod, setBoardingMethod] = useState(editTarget?.boardingMethod ?? "");
  const [radioType,      setRadioType]      = useState(editTarget?.radioType ?? "");
  const [memo,           setMemo]           = useState(editTarget?.memo ?? "");
  const [nationality,    setNationality]    = useState(editTarget?.nationality ?? "");
  const [lat,            setLat]            = useState(editTarget?.lat ?? null);
  const [lng,            setLng]            = useState(editTarget?.lng ?? null);
  const [gpsLoading,       setGpsLoading]       = useState(false);
  const [gpsFor,           setGpsFor]           = useState("");
  const [gpsError,         setGpsError]         = useState("");

  const ua = navigator.userAgent;
  const osType = /iPhone|iPad|iPod/.test(ua) ? "ios"
               : /Android/.test(ua)           ? "android"
               : "pc";
  const [showPickupDrop,   setShowPickupDrop]   = useState(false);
  const [viaLocation,      setViaLocation]      = useState(editTarget?.viaLocation ?? "");
  const [showVia,          setShowVia]          = useState(!!(editTarget?.viaLocation));
  const [myPoint,          setMyPoint]          = useState(editTarget?.myPoint ?? "");

  // 登録済み営業ポイント（ハンバーガーメニュー #19 で管理）
  const bizPoints = (() => {
    try { return JSON.parse(localStorage.getItem("taxi_biz_points") || "[]"); } catch { return []; }
  })();

  // GPS自動取得なし（ボタン押下時のみ取得）

  async function fetchGps(target) {
    setGpsLoading(true);
    setGpsFor(target);
    setGpsError("");
    try {
      const pos = await getGps();
      const addr = await reverseGeocode(pos.lat, pos.lng);
      if (target === "pickup") {
        setLat(pos.lat); setLng(pos.lng);
        if (!pickupLocation) setPickupLocation(addr);
      } else {
        setDropoffLocation(addr);
      }
    } catch (err) {
      const code = err?.code;
      const msg = code === 1 ? "permission"
                : code === 2 ? "位置情報を取得できませんでした（電波・GPS確認）"
                : code === 3 ? "タイムアウト。もう一度試してください"
                : `GPS取得失敗（${err?.message || "不明"}）`;
      setGpsError(msg);
    } finally {
      setGpsLoading(false);
      setGpsFor("");
    }
  }

  function handleSave() {
    const rec = {
      id:              editTarget?.id ?? genId(),
      timestamp:       editTarget?.timestamp ?? new Date().toISOString(),
      workDate,
      boardingTime,
      pickupLocation:  pickupLocation.trim(),
      dropoffTime,
      dropoffLocation: dropoffLocation.trim(),
      passengers:      parseInt(passengers, 10) || null,
      fare:            parseInt(fare, 10) || 0,
      amount:          parseInt(fare, 10) || 0, // 後方互換
      highwayFee:      parseInt(highwayFee, 10) || null,
      paymentMethod,
      boardingMethod,
      radioType:       RADIO_BOARDING.includes(boardingMethod) ? radioType : "",
      memo:            memo.trim(),
      nationality,
      viaLocation:     viaLocation.trim(),
      myPoint:         myPoint.trim(),
      lat,
      lng,
      // 統計用に spotName も残す（乗車場所を代入）
      spotName:        pickupLocation.trim() || "未記入",
    };
    onSave(rec);
    onClose();
  }

  const inputStyle = {
    width:"100%", padding:"11px 12px", borderRadius:10,
    border:`1.5px solid ${C.border}`, backgroundColor:C.bg,
    color:C.text, fontSize:14, outline:"none", boxSizing:"border-box",
  };
  const labelStyle  = { fontSize:11, color:C.muted, marginBottom:4, display:"block" };
  const sectionStyle = { marginBottom:14 };

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480,
                 maxHeight:"92vh", overflowY:"auto", padding:22, paddingBottom:40 }}>
        {/* ハンドル */}
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 14px" }}/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>
            {editTarget ? "✏️ 乗車記録を編集" : "🚕 乗車を記録"}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:C.muted, cursor:"pointer", lineHeight:1, padding:"4px 8px" }}>✕</button>
        </div>

        {/* GPS状態 */}
        {gpsLoading && (
          <div style={{ fontSize:12, color:C.accentLight, marginBottom:12, padding:"8px 12px", backgroundColor:C.accentGlow, borderRadius:9 }}>
            📡 GPS取得中...
          </div>
        )}
        {gpsError === "permission" ? (
          <div style={{ marginBottom:12, padding:"12px 14px", backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>📍 位置情報の許可が必要です</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, marginBottom:8 }}>
              タクローは <strong style={{color:C.text}}>📡ボタンを押した時だけ</strong> 現在地を取得します。<br/>
              常時追跡・バックグラウンド取得は一切行いません。
            </div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.8 }}>
              {osType === "ios" && <>
                <div style={{ marginBottom:4 }}>① 設定 → プライバシーとセキュリティ → 位置情報サービス → Safari Webサイト →「使用中のみ許可」</div>
                <div>② Safariのアドレスバー「AA」→ Webサイトの設定 → 位置情報 →「許可」</div>
              </>}
              {osType === "android" && <>
                <div>ブラウザのアドレスバー左の🔒 → 位置情報 →「許可」</div>
              </>}
              {osType === "pc" && <>
                <div style={{ marginBottom:4 }}>① OSの位置情報設定でブラウザを許可</div>
                <div>② ブラウザのアドレスバー左の🔒 → 位置情報 →「許可」</div>
              </>}
            </div>
          </div>
        ) : gpsError ? (
          <div style={{ fontSize:12, color:"#f87171", marginBottom:12, padding:"8px 12px", backgroundColor:"#f8717122", borderRadius:9 }}>
            ⚠️ {gpsError}
          </div>
        ) : null}

        {/* 乗務日 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>乗務日</label>
          <input type="date" value={workDate} onChange={e=>setWorkDate(e.target.value)} style={inputStyle} />
        </div>

        {/* 乗車日時 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>乗車日時</label>
          <input type="datetime-local" value={boardingTime} onChange={e=>setBoardingTime(e.target.value)} style={inputStyle} />
        </div>

        {/* 乗車場所 */}
        <div style={{ ...sectionStyle, position:"relative" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <label style={{ ...labelStyle, marginBottom:0 }}>乗車場所</label>
            <button onClick={()=>fetchGps("pickup")} disabled={gpsLoading}
              style={{ fontSize:10, color:C.accentLight, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {gpsFor==="pickup" ? "取得中..." : "📡 現在地"}
            </button>
          </div>
          <input
            type="text"
            value={pickupLocation}
            onChange={e=>{ setPickupLocation(e.target.value); setShowPickupDrop(true); }}
            onFocus={()=>{ if(bizPoints.length>0) setShowPickupDrop(true); }}
            onBlur={()=>setTimeout(()=>setShowPickupDrop(false), 150)}
            placeholder="場所を入力 または マイポイントから選択"
            style={{ ...inputStyle, borderColor: showPickupDrop && bizPoints.length>0 ? C.accentLight : C.border }}
          />
          {/* マイポイントのドロップダウン候補 */}
          {showPickupDrop && bizPoints.length > 0 && (
            <div style={{ position:"absolute", left:0, right:0, top:"100%", backgroundColor:C.surface, border:`1.5px solid ${C.accentLight}`, borderRadius:10, zIndex:50, overflow:"hidden", boxShadow:"0 4px 16px #00000033" }}>
              {bizPoints
                .filter(p => {
                  const name = typeof p==="string" ? p : p.name;
                  return !pickupLocation || name.includes(pickupLocation);
                })
                .map((p,i) => {
                  const name = typeof p==="string" ? p : p.name;
                  return (
                    <div key={i}
                      onMouseDown={()=>{ setPickupLocation(name); setShowPickupDrop(false); }}
                      style={{ padding:"11px 14px", fontSize:14, color:C.text, cursor:"pointer", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}
                      onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.accentGlow}
                      onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}
                    >
                      <span style={{ fontSize:16 }}>📍</span>
                      <span>{name}</span>
                    </div>
                  );
                })}
              {bizPoints.length > 0 && (
                <div style={{ padding:"8px 14px", fontSize:11, color:C.muted, backgroundColor:C.bg }}>
                  マイポイントから選択（ハンバーガーメニューで管理）
                </div>
              )}
            </div>
          )}
        </div>

        {/* マイポイント（乗り場タグ） */}
        {bizPoints.length > 0 && (
          <div style={sectionStyle}>
            <label style={labelStyle}>マイポイント <span style={{ fontSize:10, backgroundColor:C.border, color:C.muted, borderRadius:4, padding:"1px 5px", marginLeft:4 }}>任意</span></label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {bizPoints.map((p, i) => {
                const name = typeof p === "string" ? p : p.name;
                const selected = myPoint === name;
                return (
                  <div key={i} onClick={() => setMyPoint(selected ? "" : name)}
                    style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
                      border:`1.5px solid ${selected ? C.accentLight : C.border}`,
                      backgroundColor: selected ? C.accentLight + "22" : "transparent",
                      color: selected ? C.accentLight : C.muted }}>
                    📍 {name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 経由地ボタン＋欄 */}
        {!showVia ? (
          <div style={{ marginBottom:14, textAlign:"center" }}>
            <button onClick={()=>setShowVia(true)}
              style={{ fontSize:12, color:C.accentLight, background:"none", border:`1px dashed ${C.accentLight}44`, borderRadius:8, padding:"6px 16px", cursor:"pointer" }}>
              ＋ 経由地を追加
            </button>
          </div>
        ) : (
          <div style={sectionStyle}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <label style={{ ...labelStyle, marginBottom:0 }}>経由地</label>
              <button onClick={()=>{ setShowVia(false); setViaLocation(""); }}
                style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                ✕ 削除
              </button>
            </div>
            <input type="text" value={viaLocation} onChange={e=>setViaLocation(e.target.value)}
              placeholder="経由した場所を入力"
              style={inputStyle} />
          </div>
        )}

        {/* 降車日時 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>降車日時</label>
          <input type="datetime-local" value={dropoffTime} onChange={e=>setDropoffTime(e.target.value)} style={inputStyle} />
        </div>

        {/* 降車場所 */}
        <div style={sectionStyle}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <label style={{ ...labelStyle, marginBottom:0 }}>降車場所</label>
            <button onClick={()=>fetchGps("dropoff")} disabled={gpsLoading}
              style={{ fontSize:10, color:C.accentLight, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {gpsFor==="dropoff" ? "取得中..." : "📡 現在地"}
            </button>
          </div>
          <input type="text" value={dropoffLocation} onChange={e=>setDropoffLocation(e.target.value)}
            placeholder="場所を入力" style={inputStyle} />
        </div>

        {/* 乗車人数 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>乗車人数</label>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="number" inputMode="numeric" value={passengers} onChange={e=>setPassengers(e.target.value)}
              placeholder="例) 1" style={{ ...inputStyle, flex:1 }} />
            <span style={{ fontSize:14, color:C.muted, flexShrink:0 }}>人</span>
          </div>
        </div>

        {/* 運賃 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>運賃</label>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="number" inputMode="numeric" value={fare} onChange={e=>setFare(e.target.value)}
              placeholder="例) 500" style={{ ...inputStyle, flex:1 }} />
            <span style={{ fontSize:14, color:C.muted, flexShrink:0 }}>円</span>
          </div>
        </div>

        {/* 高速料金（任意） */}
        <div style={sectionStyle}>
          <label style={labelStyle}>高速料金 <span style={{ fontSize:10, backgroundColor:C.border, color:C.muted, borderRadius:4, padding:"1px 5px", marginLeft:4 }}>任意</span></label>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="number" inputMode="numeric" value={highwayFee} onChange={e=>setHighwayFee(e.target.value)}
              placeholder="例) 500" style={{ ...inputStyle, flex:1 }} />
            <span style={{ fontSize:14, color:C.muted, flexShrink:0 }}>円</span>
          </div>
        </div>

        {/* 支払い方法 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>支払い方法</label>
          <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}
            style={{ ...inputStyle, appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
            <option value="">選択してください</option>
            {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* 乗車方法 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>乗車方法</label>
          <select value={boardingMethod} onChange={e=>{
            setBoardingMethod(e.target.value);
            if (e.target.value === "配車アプリ" && !paymentMethod) setPaymentMethod("ネット決済");
          }}
            style={{ ...inputStyle, appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
            <option value="">選択してください</option>
            {BOARDING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* 無線の種類（配車アプリ・無線選択時のみ表示） */}
        {RADIO_BOARDING.includes(boardingMethod) && (
          <div style={sectionStyle}>
            <label style={labelStyle}>無線の種類 <span style={{ fontSize:10, backgroundColor:C.border, color:C.muted, borderRadius:4, padding:"1px 5px", marginLeft:4 }}>任意</span></label>
            <select value={radioType} onChange={e=>setRadioType(e.target.value)}
              style={{ ...inputStyle, appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
              <option value="">選択してください</option>
              {RADIO_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {/* 客の国籍（任意） */}
        <div style={sectionStyle}>
          <label style={labelStyle}>客の国籍 <span style={{ fontSize:10, backgroundColor:C.border, color:C.muted, borderRadius:4, padding:"1px 5px", marginLeft:4 }}>任意</span></label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["", ...NATIONALITY_OPTIONS].map((opt, i) => (
              <div key={i} onClick={() => setNationality(opt === nationality ? "" : opt)}
                style={{ padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  border:`1.5px solid ${nationality===opt && opt!==""?C.accentLight:C.border}`,
                  backgroundColor:nationality===opt && opt!==""?C.accentLight+"22":"transparent",
                  color:nationality===opt && opt!==""?C.accentLight:C.muted,
                  display: opt===""?"none":"block" }}>
                {opt}
              </div>
            ))}
          </div>
          {nationality && (
            <div onClick={() => setNationality("")}
              style={{ marginTop:6, fontSize:11, color:C.muted, cursor:"pointer", textDecoration:"underline" }}>
              選択解除
            </div>
          )}
        </div>

        {/* メモ（任意） */}
        <div style={{ marginBottom:22 }}>
          <label style={labelStyle}>メモ <span style={{ fontSize:10, backgroundColor:C.border, color:C.muted, borderRadius:4, padding:"1px 5px", marginLeft:4 }}>任意</span></label>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)}
            placeholder="例) 空港定額料金適用"
            rows={3}
            style={{ ...inputStyle, resize:"vertical", lineHeight:1.6 }} />
        </div>

        {/* ボタン */}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1.5px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}>
            キャンセル
          </button>
          <button onClick={handleSave}
            style={{ flex:2, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}>
            登録する
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 詳細一覧モーダル ─────────────────────────
function DetailModal({ records, onClose, onEdit, onDelete, onSendToReport }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const sorted = [...records].sort((a,b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"92vh", overflowY:"auto", padding:22, paddingBottom:40 }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }}/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>🚕 乗車記録一覧</div>
          <div style={{ fontSize:12, color:C.muted }}>{records.length}件</div>
        </div>


        {/* 記録一覧 */}
        {sorted.length === 0 ? (
          <div style={{ textAlign:"center", padding:32, color:C.muted }}>記録がありません</div>
        ) : sorted.map(r => (
          <div key={r.id} style={{ backgroundColor:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{r.pickupLocation || r.spotName || "—"}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                  {r.workDate ? fmtDate(r.workDate) : new Date(r.timestamp).toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"})}
                  {r.boardingTime ? " " + new Date(r.boardingTime).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}) : ""}
                </div>
              </div>
              <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>
                {(r.fare || r.amount) ? `${fmt(r.fare || r.amount)}円` : "—"}
              </div>
            </div>
            {r.dropoffLocation && <div style={{ fontSize:11, color:C.sub, marginBottom:4 }}>🏁 → {r.dropoffLocation}</div>}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", fontSize:11, color:C.muted, marginBottom:6 }}>
              {r.passengers && <span>👤 {r.passengers}人</span>}
              {r.highwayFee > 0 && <span>🛣 高速 {fmt(r.highwayFee)}円</span>}
              {r.paymentMethod && <span>💳 {r.paymentMethod}</span>}
              {r.boardingMethod && <span>🚕 {r.boardingMethod}</span>}
              {r.radioType && <span>📡 {r.radioType}</span>}
            </div>
            {r.memo && <div style={{ fontSize:11, color:C.muted, backgroundColor:C.surface, borderRadius:7, padding:"5px 8px", marginBottom:6 }}>📝 {r.memo}</div>}
            {r.lat && r.lng && (
              <a href={`https://maps.google.com/?q=${r.lat},${r.lng}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:10, color:C.accentLight, textDecoration:"none" }}>🗺 マップで見る</a>
            )}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              {onSendToReport && (
                <button onClick={()=>onSendToReport(r)}
                  style={{ fontSize:11, color:C.accentLight, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
                  📋 日報に送る
                </button>
              )}
              <button onClick={()=>onEdit(r)}
                style={{ fontSize:11, color:C.sub, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
                編集
              </button>
              <button onClick={()=>setConfirmDelete(r.id)}
                style={{ fontSize:11, color:"#f87171", backgroundColor:"transparent", border:"1px solid #f8717144", borderRadius:7, padding:"4px 10px", cursor:"pointer", marginLeft:"auto" }}>
                削除
              </button>
            </div>
            {confirmDelete === r.id && (
              <div style={{ marginTop:8, padding:"10px 12px", backgroundColor:"#f8717114", borderRadius:9, display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex:1, fontSize:12, color:"#f87171" }}>本当に削除しますか？</div>
                <button onClick={()=>{ onDelete(r.id); setConfirmDelete(null); }}
                  style={{ fontSize:11, color:"#fff", backgroundColor:"#f87171", border:"none", borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>削除</button>
                <button onClick={()=>setConfirmDelete(null)}
                  style={{ fontSize:11, color:C.sub, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>×</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────
export function SalesPointCard({ user }) {
  const [records,    setRecords]    = useState(() => loadRecords());
  const [showRecord, setShowRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // Supabaseから乗車記録を取得してlocalStorageとマージ
  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) return;
    fetchRideRecords(user.id).then(({ data, error }) => {
      if (error) {
        console.error("[SalesPointCard] fetchRideRecords:", error.message);
        return; // テーブル未作成などのエラー時はlocalStorageで続行
      }
      // Supabaseのsnake_caseをcamelCaseに変換
      const fromServer = (data || []).map(r => ({
        id:              r.id,
        timestamp:       r.created_at,
        workDate:        r.work_date,
        boardingTime:    r.boarding_time,
        pickupLocation:  r.pickup_location,
        dropoffTime:     r.dropoff_time,
        dropoffLocation: r.dropoff_location,
        passengers:      r.passengers,
        fare:            r.fare,
        amount:          r.fare,
        highwayFee:      r.highway_fee,
        paymentMethod:   r.payment_method,
        boardingMethod:  r.boarding_method,
        radioType:       r.radio_type,
        memo:            r.memo,
        lat:             r.lat,
        lng:             r.lng,
        spotName:        r.pickup_location || "未記入",
      }));
      // ローカルと統合（Supabase側を優先、idで重複排除）
      setRecords(prev => {
        const serverIds = new Set(fromServer.map(r => r.id));
        const localOnly = prev.filter(r => !serverIds.has(r.id));
        // ローカルのみの記録をSupabaseに一括アップロード（端末間同期）
        if (localOnly.length > 0) {
          localOnly.forEach(rec => upsertRideRecord(user.id, rec));
        }
        const merged = [...fromServer, ...localOnly]
          .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
        saveRecords(merged);
        return merged;
      });
    });
  }, [user?.id]);

  useEffect(() => { saveRecords(records); }, [records]);

  async function handleSave(rec) {
    setRecords(prev => {
      const exists = prev.find(r => r.id === rec.id);
      return exists ? prev.map(r => r.id === rec.id ? rec : r) : [rec, ...prev];
    });
    if (SUPABASE_READY && user?.id) {
      await upsertRideRecord(user.id, rec);
    }
  }

  async function handleDelete(id) {
    setRecords(prev => prev.filter(r => r.id !== id));
    if (SUPABASE_READY && user?.id) {
      await deleteRideRecord(id);
    }
  }

  function handleEdit(rec) {
    setEditTarget(rec); setShowDetail(false); setShowRecord(true);
  }

  function handleSendToReport(rec) {
    const draft = {
      date:         rec.workDate || new Date(rec.timestamp).toISOString().slice(0,10),
      work_area:    rec.pickupLocation || rec.spotName || "",
      trouble_note: rec.dropoffLocation ? `乗:${rec.pickupLocation} → 降:${rec.dropoffLocation}` : rec.pickupLocation,
    };
    localStorage.setItem("taxi_report_draft", JSON.stringify(draft));
    alert(`日報作成画面に反映しました。日報ページから確認してください。`);
  }

  const latest3 = [...records].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0,3);

  return (
    <>
      <Card style={{ marginBottom:14 }}>
        {/* ヘッダー */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.text }}>🚕 乗車記録</div>
          <button
            data-tutorial="ride-record-btn"
            onClick={()=>{ setEditTarget(null); setShowRecord(true); }}
            style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
            ＋ 記録する
          </button>
        </div>

        {/* 最新3件 */}
        {latest3.length === 0 ? (
          <div style={{ textAlign:"center", padding:"8px 0", color:C.muted, fontSize:12 }}>
            まだ記録がありません
          </div>
        ) : (
          <>
            {latest3.map(r => (
              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {r.pickupLocation || r.spotName || "—"}
                    {r.dropoffLocation ? <span style={{ color:C.muted, fontWeight:400 }}> → {r.dropoffLocation}</span> : ""}
                  </div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
                    {r.workDate ? fmtDate(r.workDate) : new Date(r.timestamp).toLocaleDateString("ja-JP",{month:"numeric",day:"numeric",weekday:"short"})}
                    {r.boardingMethod && <span style={{ marginLeft:6 }}>· {r.boardingMethod}</span>}
                    {r.radioType      && <span style={{ marginLeft:4 }}>({r.radioType})</span>}
                    {r.paymentMethod  && <span style={{ marginLeft:4 }}>· {r.paymentMethod}</span>}
                  </div>
                </div>
                <div style={{ fontSize:15, fontWeight:900, color:C.gold, flexShrink:0 }}>
                  {(r.fare||r.amount) ? `${fmt(r.fare||r.amount)}円` : "—"}
                </div>
              </div>
            ))}
            <button onClick={()=>setShowDetail(true)}
              style={{ width:"100%", marginTop:10, padding:"9px 0", borderRadius:9, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}>
              一覧・詳細 ({records.length}件) →
            </button>
          </>
        )}
      </Card>

      {showRecord && (
        <RecordModal editTarget={editTarget} onClose={()=>{ setShowRecord(false); setEditTarget(null); }} onSave={handleSave} />
      )}
      {showDetail && (
        <DetailModal records={records} onClose={()=>setShowDetail(false)} onEdit={handleEdit} onDelete={handleDelete} onSendToReport={handleSendToReport} />
      )}
    </>
  );
}
