// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RideMatchModal.jsx — OCR乗車記録 × 手入力乗車記録 照合
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C, fmt } from "../lib/constants";
import { Card, Btn } from "./UI";

// ─── マッチングロジック ───────────────────────────

// "HH:MM" → 分
function toMins(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return isNaN(h) ? null : h * 60 + (m || 0);
}

// "2024-01-15T14:30" or "14:30" → 分
function dtToMins(dt) {
  if (!dt) return null;
  const s = dt.includes("T") ? dt.split("T")[1] : dt;
  return toMins(s.slice(0, 5));
}

// "2024-01-15T14:30" → "14:30"
function dtToHHMM(dt) {
  if (!dt) return null;
  return dt.includes("T") ? dt.split("T")[1].slice(0, 5) : dt.slice(0, 5);
}

function scoreMatch(ocr, manual) {
  const ocrAmt = ocr.amount || 0;
  const manAmt = parseInt(manual.fare) || 0;
  if (Math.abs(ocrAmt - manAmt) > 100) return 0;   // 金額が±100円超ならNG

  const ocrMins = toMins(ocr.pickup_time);
  const manMins = dtToMins(manual.boardingTime);
  if (ocrMins !== null && manMins !== null) {
    const diff = Math.abs(ocrMins - manMins);
    if (diff > 15) return 0;                         // 15分超ならNG
    return 100 - diff;
  }
  return 50;  // 金額一致・時刻不明 → 弱マッチ
}

export function matchRides(ocrRides, manualRecords) {
  const usedManual = new Set();
  const results = [];

  ocrRides.forEach(ocr => {
    let best = { score: 0, mi: -1 };
    manualRecords.forEach((m, mi) => {
      if (usedManual.has(mi)) return;
      const s = scoreMatch(ocr, m);
      if (s > best.score) best = { score: s, mi };
    });

    if (best.mi >= 0) {
      results.push({ type: "merged", ocr, manual: manualRecords[best.mi] });
      usedManual.add(best.mi);
    } else {
      results.push({ type: "ocr", ocr, manual: null });
    }
  });

  // 未照合の手入力
  manualRecords.forEach((m, mi) => {
    if (!usedManual.has(mi)) results.push({ type: "manual", ocr: null, manual: m });
  });

  return results;
}

// マッチ結果 → rides[] に変換
export function toMergedRides(matchResults) {
  return matchResults.map(item => {
    if (item.type === "merged") {
      return {
        ...item.ocr,
        point_name:        item.manual.pickupLocation  || null,
        dropoff_point_name:item.manual.dropoffLocation || null,
        payment_method:    item.manual.paymentMethod   || null,
        boarding_method:   item.manual.boardingMethod  || null,
        memo:              item.manual.memo            || null,
        source: "merged",
      };
    }
    if (item.type === "ocr") {
      return { ...item.ocr, source: "ocr" };
    }
    // manual only
    return {
      pickup_time:        dtToHHMM(item.manual.boardingTime),
      dropoff_time:       dtToHHMM(item.manual.dropoffTime),
      amount:             parseInt(item.manual.fare) || 0,
      point_name:         item.manual.pickupLocation  || null,
      dropoff_point_name: item.manual.dropoffLocation || null,
      payment_method:     item.manual.paymentMethod   || null,
      boarding_method:    item.manual.boardingMethod  || null,
      memo:               item.manual.memo            || null,
      km:                 null,
      pickup_area:        null,
      dropoff_area:       null,
      source: "manual",
    };
  });
}

// ─── UI ────────────────────────────────────────

function RideRow({ item }) {
  const isMerged = item.type === "merged";
  const isOcr    = item.type === "ocr";
  const isManual = item.type === "manual";

  const col    = isMerged ? C.green : isOcr ? C.accentLight : C.gold;
  const label  = isMerged ? "照合済" : isOcr ? "OCRのみ" : "手入力のみ";

  const pickup  = isMerged ? item.manual.pickupLocation  : isOcr ? item.ocr.pickup_area  : item.manual.pickupLocation;
  const dropoff = isMerged ? item.manual.dropoffLocation : isOcr ? item.ocr.dropoff_area : item.manual.dropoffLocation;
  const amount  = isMerged ? item.ocr.amount : isOcr ? item.ocr.amount : parseInt(item.manual.fare) || 0;
  const time    = isMerged ? item.ocr.pickup_time : isOcr ? item.ocr.pickup_time : dtToHHMM(item.manual.boardingTime);
  const km      = isMerged || isOcr ? item.ocr?.km : null;

  return (
    <div style={{ padding:"10px 12px", borderRadius:10, backgroundColor:C.card, border:`1px solid ${col}33`, marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <span style={{ fontSize:9, fontWeight:700, color:col, backgroundColor:col+"22", borderRadius:99, padding:"1px 6px", whiteSpace:"nowrap" }}>
              {label}
            </span>
            {time && <span style={{ fontSize:11, color:C.muted }}>{time}</span>}
            {km  && <span style={{ fontSize:10, color:C.muted }}>{km}km</span>}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {pickup || "—"} → {dropoff || "—"}
          </div>
          {/* OCRエリア名を補足表示 */}
          {isMerged && (item.ocr.pickup_area || item.ocr.dropoff_area) && (
            <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
              {item.ocr.pickup_area} → {item.ocr.dropoff_area}
            </div>
          )}
          {/* 支払・乗車方法 */}
          {(isMerged || isManual) && (item.manual.paymentMethod || item.manual.boardingMethod) && (
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
              {[item.manual.boardingMethod, item.manual.paymentMethod].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ fontSize:15, fontWeight:800, color:col, whiteSpace:"nowrap" }}>
          {fmt(amount)}円
        </div>
      </div>
    </div>
  );
}

export function RideMatchModal({ ocrRides, manualRecords, onConfirm, onSkip }) {
  const [results] = useState(() => matchRides(ocrRides, manualRecords));

  const mergedCount = results.filter(r => r.type === "merged").length;
  const ocrOnly     = results.filter(r => r.type === "ocr").length;
  const manualOnly  = results.filter(r => r.type === "manual").length;

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, margin:"0 auto", padding:"20px 16px 40px", maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 16px" }} />

        {/* ヘッダー */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>乗車記録の照合</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:C.green,       backgroundColor:C.green+"18",       borderRadius:99, padding:"2px 8px" }}>照合済 {mergedCount}件</span>
            <span style={{ fontSize:11, color:C.accentLight, backgroundColor:C.accentGlow,       borderRadius:99, padding:"2px 8px" }}>OCRのみ {ocrOnly}件</span>
            <span style={{ fontSize:11, color:C.gold,        backgroundColor:C.gold+"18",         borderRadius:99, padding:"2px 8px" }}>手入力のみ {manualOnly}件</span>
          </div>
        </div>

        {/* リスト */}
        <div style={{ overflowY:"auto", flex:1, marginBottom:12 }}>
          {results.map((item, i) => <RideRow key={i} item={item} />)}
        </div>

        {/* ボタン */}
        <Btn onClick={() => onConfirm(toMergedRides(results))}>
          この内容でOK（{results.length}件）
        </Btn>
        <Btn variant="ghost" onClick={onSkip} style={{ marginTop:8 }}>
          照合せずOCRデータのみ使う
        </Btn>
      </div>
    </div>
  );
}
