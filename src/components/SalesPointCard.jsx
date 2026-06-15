// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SalesPointCard.jsx — 営業ポイント記録機能（指示書4 #13）
// ホーム画面に設置。GPS自動入力・最新3件表示・全件一覧・統計分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useCallback } from "react";
import { C, fmt, loadS, saveS } from "../lib/constants";
import { Card, Btn } from "../components/UI";

const LS_KEY = "taxi_sales_records";

// ─── ユーティリティ ───────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowDate() {
  const d = new Date();
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`,
      { headers: { "Accept-Language": "ja" } }
    );
    const data = await res.json();
    // 市区町村＋丁目レベルで返す
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
      { enableHighAccuracy: true, timeout: 8000 }
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

// ─── 記録モーダル ─────────────────────────────
function RecordModal({ onClose, onSave, editTarget }) {
  const [spotName, setSpotName]     = useState(editTarget?.spotName ?? "");
  const [time, setTime]             = useState(editTarget?.time ?? nowTime());
  const [pickup, setPickup]         = useState(editTarget?.pickupLocation ?? "");
  const [dropoff, setDropoff]       = useState(editTarget?.dropoffLocation ?? "");
  const [amount, setAmount]         = useState(editTarget?.amount ?? "");
  const [lat, setLat]               = useState(editTarget?.lat ?? null);
  const [lng, setLng]               = useState(editTarget?.lng ?? null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]     = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  // 初回: GPS自動取得（新規のみ）
  useEffect(() => {
    if (!editTarget) autoFillGps();
  }, []);

  async function autoFillGps() {
    setGpsLoading(true);
    setGpsError("");
    try {
      const pos = await getGps();
      setLat(pos.lat);
      setLng(pos.lng);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      if (!spotName) setSpotName(addr);
      if (!pickup)   setPickup(addr);
      setAutoFilled(true);
    } catch (e) {
      setGpsError("GPS取得失敗。手動で入力してください。");
    } finally {
      setGpsLoading(false);
    }
  }

  async function refetchPickupGps() {
    setGpsLoading(true);
    setGpsError("");
    try {
      const pos = await getGps();
      setLat(pos.lat);
      setLng(pos.lng);
      const addr = await reverseGeocode(pos.lat, pos.lng);
      setPickup(addr);
    } catch {
      setGpsError("GPS取得失敗");
    } finally {
      setGpsLoading(false);
    }
  }

  function handleSave() {
    const rec = {
      id: editTarget?.id ?? genId(),
      timestamp: editTarget?.timestamp ?? new Date().toISOString(),
      spotName: spotName.trim() || "（未記入）",
      time,
      pickupLocation: pickup.trim(),
      dropoffLocation: dropoff.trim(),
      amount: parseInt(amount, 10) || 0,
      lat,
      lng,
    };
    onSave(rec);
    onClose();
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, backgroundColor: C.bg,
    color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11, color: C.muted, marginBottom: 4, display: "block" };

  return (
    <div
      style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: C.surface, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480,
                 maxHeight: "90vh", overflowY: "auto", padding: 22, paddingBottom: 36 }}
      >
        {/* ハンドル */}
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }} />

        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
          {editTarget ? "✏️ 営業ポイントを編集" : "📍 営業ポイントを記録"}
        </div>

        {/* GPS状態 */}
        {gpsLoading && (
          <div style={{ fontSize:12, color:C.accentLight, marginBottom:12, padding:"8px 12px", backgroundColor:C.accentGlow, borderRadius:9 }}>
            📡 GPS取得中...
          </div>
        )}
        {gpsError && (
          <div style={{ fontSize:12, color:"#f87171", marginBottom:12, padding:"8px 12px", backgroundColor:"#f8717122", borderRadius:9 }}>
            ⚠️ {gpsError}
          </div>
        )}
        {autoFilled && !gpsLoading && !gpsError && (
          <div style={{ fontSize:12, color:C.green, marginBottom:12, padding:"8px 12px", backgroundColor:C.green+"18", borderRadius:9 }}>
            ✅ GPS自動入力しました（修正可）
          </div>
        )}

        {/* 時刻 */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>時刻</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
        </div>

        {/* 営業ポイント名（GPS地名） */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>営業ポイント名</label>
          <input
            type="text" value={spotName}
            onChange={e => setSpotName(e.target.value)}
            placeholder="例: 渋谷駅、新宿三丁目 ..."
            style={inputStyle}
          />
        </div>

        {/* 乗車場所 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <label style={{ ...labelStyle, marginBottom:0 }}>乗車場所</label>
            <button
              onClick={refetchPickupGps}
              disabled={gpsLoading}
              style={{ fontSize:10, color:C.accentLight, background:"none", border:"none", cursor:"pointer", padding:0 }}
            >
              📡 現在地
            </button>
          </div>
          <input
            type="text" value={pickup}
            onChange={e => setPickup(e.target.value)}
            placeholder="例: 渋谷駅前"
            style={inputStyle}
          />
        </div>

        {/* 降車場所 */}
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>降車場所（任意）</label>
          <input
            type="text" value={dropoff}
            onChange={e => setDropoff(e.target.value)}
            placeholder="例: 六本木ヒルズ"
            style={inputStyle}
          />
        </div>

        {/* 金額 */}
        <div style={{ marginBottom:22 }}>
          <label style={labelStyle}>金額（円）</label>
          <input
            type="number" inputMode="numeric" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="1500"
            style={inputStyle}
          />
        </div>

        {/* ボタン */}
        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={onClose}
            style={{ flex:1, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700,
                     cursor:"pointer", border:`1.5px solid ${C.border}`, backgroundColor:"transparent", color:C.sub }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            style={{ flex:2, padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700,
                     cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 詳細一覧モーダル ─────────────────────────
function DetailModal({ records, onClose, onEdit, onDelete, onSendToReport }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  const sorted = [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // 統計
  const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
  const avgAmount = records.length ? Math.round(totalAmount / records.length) : 0;

  // 営業ポイント別集計
  const spotStats = {};
  records.forEach(r => {
    const k = r.spotName || "不明";
    if (!spotStats[k]) spotStats[k] = { count: 0, total: 0 };
    spotStats[k].count++;
    spotStats[k].total += r.amount || 0;
  });
  const topSpots = Object.entries(spotStats)
    .map(([name, s]) => ({ name, ...s, avg: Math.round(s.total / s.count) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div
      style={{ position:"fixed", inset:0, backgroundColor:"#00000099", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: C.surface, borderRadius: "20px 20px 0 0", width:"100%", maxWidth:480,
                 maxHeight:"92vh", overflowY:"auto", padding:22, paddingBottom:40 }}
      >
        <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 18px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>📍 営業ポイント一覧</div>
          <div style={{ fontSize:12, color:C.muted }}>{records.length}件</div>
        </div>

        {/* 統計サマリー */}
        {records.length > 0 && (
          <div style={{ backgroundColor:C.bg, borderRadius:12, padding:"14px 16px", marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.sub, marginBottom:10 }}>📊 統計</div>
            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              <div style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.muted }}>合計</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>{fmt(totalAmount)}<span style={{ fontSize:11 }}>円</span></div>
              </div>
              <div style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.muted }}>平均</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{fmt(avgAmount)}<span style={{ fontSize:11 }}>円</span></div>
              </div>
              <div style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:10, color:C.muted }}>記録数</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.text }}>{records.length}<span style={{ fontSize:11 }}>件</span></div>
              </div>
            </div>
            {topSpots.length > 0 && (
              <>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>📍 稼げたポイント TOP{topSpots.length}</div>
                {topSpots.map((s, i) => (
                  <div key={s.name} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <div style={{ fontSize:12, color:C.accentLight, fontWeight:800, width:18 }}>#{i+1}</div>
                    <div style={{ flex:1, fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{s.count}回</div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.gold }}>{fmt(s.avg)}円/回</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 記録一覧 */}
        {sorted.length === 0 ? (
          <div style={{ textAlign:"center", padding:32, color:C.muted, fontSize:14 }}>
            記録がありません
          </div>
        ) : (
          sorted.map(r => (
            <div key={r.id} style={{ backgroundColor:C.bg, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{r.spotName}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {new Date(r.timestamp).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric", weekday:"short" })} {r.time}
                  </div>
                </div>
                <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>
                  {r.amount ? `${fmt(r.amount)}円` : "—"}
                </div>
              </div>
              {(r.pickupLocation || r.dropoffLocation) && (
                <div style={{ fontSize:11, color:C.sub, marginBottom:8 }}>
                  {r.pickupLocation && <div>🚕 乗: {r.pickupLocation}</div>}
                  {r.dropoffLocation && <div>🏁 降: {r.dropoffLocation}</div>}
                </div>
              )}
              {r.lat && r.lng && (
                <a
                  href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:10, color:C.accentLight, textDecoration:"none" }}
                >
                  🗺 Googleマップで見る
                </a>
              )}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                {onSendToReport && (
                  <button
                    onClick={() => onSendToReport(r)}
                    style={{ fontSize:11, color:C.accentLight, backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`,
                             borderRadius:7, padding:"4px 10px", cursor:"pointer" }}
                  >
                    📋 日報に送る
                  </button>
                )}
                <button
                  onClick={() => onEdit(r)}
                  style={{ fontSize:11, color:C.sub, backgroundColor:"transparent", border:`1px solid ${C.border}`,
                           borderRadius:7, padding:"4px 10px", cursor:"pointer" }}
                >
                  編集
                </button>
                <button
                  onClick={() => setConfirmDelete(r.id)}
                  style={{ fontSize:11, color:"#f87171", backgroundColor:"transparent", border:"1px solid #f8717144",
                           borderRadius:7, padding:"4px 10px", cursor:"pointer", marginLeft:"auto" }}
                >
                  削除
                </button>
              </div>

              {/* 削除確認 */}
              {confirmDelete === r.id && (
                <div style={{ marginTop:8, padding:"10px 12px", backgroundColor:"#f8717114", borderRadius:9, display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1, fontSize:12, color:"#f87171" }}>本当に削除しますか？</div>
                  <button onClick={() => { onDelete(r.id); setConfirmDelete(null); }}
                    style={{ fontSize:11, color:"#fff", backgroundColor:"#f87171", border:"none", borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
                    削除
                  </button>
                  <button onClick={() => setConfirmDelete(null)}
                    style={{ fontSize:11, color:C.sub, backgroundColor:"transparent", border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
                    ×
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────
export function SalesPointCard() {
  const [records, setRecords]       = useState(() => loadRecords());
  const [showRecord, setShowRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // recordsが変わったらlocalStorageに保存
  useEffect(() => { saveRecords(records); }, [records]);

  function handleSave(rec) {
    setRecords(prev => {
      const exists = prev.find(r => r.id === rec.id);
      if (exists) return prev.map(r => r.id === rec.id ? rec : r);
      return [rec, ...prev];
    });
  }

  function handleDelete(id) {
    setRecords(prev => prev.filter(r => r.id !== id));
  }

  function handleEdit(rec) {
    setEditTarget(rec);
    setShowDetail(false);
    setShowRecord(true);
  }

  function handleSendToReport(rec) {
    // localStorage経由で日報作成画面に引き渡す（個タク向け）
    const draft = {
      date: new Date(rec.timestamp).toISOString().slice(0, 10),
      work_area: rec.spotName || "",
      trouble_note: rec.dropoffLocation ? `乗:${rec.pickupLocation} → 降:${rec.dropoffLocation}` : rec.pickupLocation,
    };
    localStorage.setItem("taxi_report_draft", JSON.stringify(draft));
    alert(`「${rec.spotName}」の情報を日報作成画面に反映しました。\n日報ページから確認してください。`);
  }

  // 最新3件（新しい順）
  const latest3 = [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 3);

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        {/* ヘッダー */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>📍</span>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:C.text }}>営業ポイント</div>
              <div style={{ fontSize:10, color:C.muted }}>稼げた場所を記録</div>
            </div>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowRecord(true); }}
            style={{ backgroundColor:C.accentLight, color:"#fff", border:"none", borderRadius:10,
                     padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}
          >
            ＋ 記録する
          </button>
        </div>

        {/* 最新3件 */}
        {latest3.length === 0 ? (
          <div style={{ textAlign:"center", padding:"18px 0", color:C.muted, fontSize:13 }}>
            <div style={{ fontSize:28, marginBottom:6 }}>📍</div>
            <div>まだ記録がありません</div>
            <div style={{ fontSize:11, marginTop:4 }}>「記録する」から営業ポイントを追加しましょう</div>
          </div>
        ) : (
          <>
            {latest3.map(r => (
              <div
                key={r.id}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0",
                         borderBottom:`1px solid ${C.border}` }}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {r.spotName}
                  </div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
                    {new Date(r.timestamp).toLocaleDateString("ja-JP", { month:"numeric", day:"numeric", weekday:"short" })} {r.time}
                    {r.pickupLocation && <span style={{ marginLeft:6 }}>🚕 {r.pickupLocation}</span>}
                  </div>
                </div>
                <div style={{ fontSize:15, fontWeight:900, color:C.gold, flexShrink:0 }}>
                  {r.amount ? `${fmt(r.amount)}円` : "—"}
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowDetail(true)}
              style={{ width:"100%", marginTop:10, padding:"9px 0", borderRadius:9, fontSize:12,
                       fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`,
                       backgroundColor:"transparent", color:C.sub }}
            >
              詳細・全件一覧 ({records.length}件) →
            </button>
          </>
        )}
      </Card>

      {/* 記録モーダル */}
      {showRecord && (
        <RecordModal
          editTarget={editTarget}
          onClose={() => { setShowRecord(false); setEditTarget(null); }}
          onSave={handleSave}
        />
      )}

      {/* 詳細モーダル */}
      {showDetail && (
        <DetailModal
          records={records}
          onClose={() => setShowDetail(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSendToReport={handleSendToReport}
        />
      )}
    </>
  );
}
