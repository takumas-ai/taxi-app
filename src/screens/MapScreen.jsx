// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 単価マップ画面
// 乗車場所ごとの平均単価を地図上にバブルで表示
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { C, loadS, saveS } from "../lib/constants";
import { supabase } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GEO_CACHE_KEY = "taxi_geocode_cache_v1";

// ジオコーディング（Nominatim）- キャッシュ付き
async function geocodeAddress(address) {
  const cache = loadS(GEO_CACHE_KEY, {});
  if (cache[address]) return cache[address];

  const query = address.startsWith("東京") ? address : `東京都${address}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=jp&limit=1&accept-language=ja`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TakuroApp/1.0 (taxi-driver-app)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      const updated = loadS(GEO_CACHE_KEY, {});
      updated[address] = result;
      saveS(GEO_CACHE_KEY, updated);
      return result;
    }
  } catch (e) {
    console.warn("[MapScreen] geocode failed:", address, e);
  }
  return null;
}

// 乗車データを場所ごとに集計
function aggregateRides(rides) {
  const map = {};
  rides.forEach(({ address, amount }) => {
    const key = (address || "").trim();
    if (!key || key.length < 2) return;
    if (!map[key]) map[key] = { count: 0, total: 0 };
    map[key].count++;
    map[key].total += Number(amount) || 0;
  });

  return Object.entries(map)
    .map(([address, { count, total }]) => ({
      address,
      count,
      total,
      avg: count > 0 ? Math.round(total / count) : 0,
    }))
    .filter(e => e.count > 0 && e.avg > 0)
    .sort((a, b) => b.count - a.count);
}

// 単価レベルに応じた色
function fareColor(avg, p25, p75) {
  if (avg >= p75) return "#10B981"; // 高: green
  if (avg <= p25) return "#EF4444"; // 低: red
  return "#F59E0B";                  // 中: gold
}

export default function MapScreen({ reports, user }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersLayer    = useRef(null);

  const [mode, setMode]             = useState("self");  // "self" | "all"
  const [stats, setStats]           = useState([]);
  const [progress, setProgress]     = useState(null);    // { done, total } | null
  const [loading, setLoading]       = useState(false);
  const [selectedSpot, setSelected] = useState(null);

  // 自分の乗車データを収集
  const getMyRides = useCallback(() => {
    const rides = [];
    reports.forEach(r => {
      (r.rides || []).forEach(ride => {
        const address = (ride.pickup_area || ride.point_name || "").trim();
        if (address) rides.push({ address, amount: ride.amount || 0 });
      });
    });
    loadS("taxi_sales_records", []).forEach(r => {
      const address = (r.pickupLocation || r.spotName || "").trim();
      if (address) rides.push({ address, amount: parseInt(r.fare || r.amount) || 0 });
    });
    return rides;
  }, [reports]);

  // 全体データをSupabaseから取得
  const getAllRides = useCallback(async () => {
    if (!SUPABASE_READY) return getMyRides();
    const { data, error } = await supabase
      .from("daily_reports")
      .select("rides")
      .not("rides", "is", null);
    if (error) { console.error(error); return getMyRides(); }
    const rides = [];
    (data || []).forEach(row => {
      (row.rides || []).forEach(ride => {
        const address = (ride.pickup_area || ride.point_name || "").trim();
        if (address) rides.push({ address, amount: ride.amount || 0 });
      });
    });
    return rides;
  }, [getMyRides]);

  // データ処理（集計→ジオコーディング）
  const processData = useCallback(async () => {
    setLoading(true);
    setProgress(null);
    setSelected(null);

    const rawRides = mode === "self" ? getMyRides() : await getAllRides();
    if (rawRides.length === 0) {
      setStats([]);
      setLoading(false);
      return;
    }

    const aggregated = aggregateRides(rawRides);
    const topItems   = aggregated.slice(0, 50); // 上位50件

    const cache      = loadS(GEO_CACHE_KEY, {});
    const withCoords = [];

    setProgress({ done: 0, total: topItems.length });

    for (let i = 0; i < topItems.length; i++) {
      const item   = topItems[i];
      const coords = await geocodeAddress(item.address);
      if (coords) withCoords.push({ ...item, ...coords });
      setProgress({ done: i + 1, total: topItems.length });

      // Nominatim制限: キャッシュにない次のアドレスは1.1秒待機
      const nextAddr = topItems[i + 1]?.address;
      if (nextAddr && !cache[nextAddr]) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    setStats(withCoords);
    setProgress(null);
    setLoading(false);
  }, [mode, getMyRides, getAllRides]);

  useEffect(() => { processData(); }, [processData]);

  // Leafletマップ初期化（一度だけ）
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [35.6812, 139.7671],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    mapRef.current       = map;

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // stats変更時にマーカー更新
  useEffect(() => {
    if (!mapRef.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();
    if (stats.length === 0) return;

    // 単価の分位数（色分け基準）
    const avgs = [...stats.map(s => s.avg)].sort((a, b) => a - b);
    const p25  = avgs[Math.floor(avgs.length * 0.25)] || 0;
    const p75  = avgs[Math.floor(avgs.length * 0.75)] || 0;

    const maxCount = Math.max(...stats.map(s => s.count));
    const minCount = Math.min(...stats.map(s => s.count));

    stats.forEach(spot => {
      const color  = fareColor(spot.avg, p25, p75);
      const ratio  = maxCount === minCount ? 0.5 : (spot.count - minCount) / (maxCount - minCount);
      const radius = 8 + ratio * 22; // 8〜30px

      const circle = L.circleMarker([spot.lat, spot.lng], {
        radius,
        fillColor: color,
        color:       "#ffffff",
        weight:      1.5,
        opacity:     0.9,
        fillOpacity: 0.72,
      });

      circle.on("click", () => setSelected(spot));
      circle.bindTooltip(
        `<div style="font-weight:700;margin-bottom:2px">${spot.address}</div>` +
        `<div>平均 ¥${spot.avg.toLocaleString()} ／ ${spot.count}件</div>`,
        { direction: "top", sticky: false }
      );
      markersLayer.current.addLayer(circle);
    });

    // 全マーカーが見えるようにフィット
    const bounds = L.latLngBounds(stats.map(s => [s.lat, s.lng]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [stats]);

  // サマリー計算
  const totalCount = stats.reduce((s, e) => s + e.count, 0);
  const avgFare    = totalCount > 0
    ? Math.round(stats.reduce((s, e) => s + e.total, 0) / totalCount)
    : 0;
  const topByAvg   = stats.length > 0
    ? [...stats].sort((a, b) => b.avg - a.avg)[0]
    : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", backgroundColor:C.bg, paddingBottom:80 }}>

      {/* ヘッダー */}
      <div style={{ padding:"52px 16px 12px", backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:10 }}>🗺️ 単価マップ</div>
        <div style={{ display:"flex", gap:8 }}>
          {[
            { id:"self", label:"👤 自分" },
            { id:"all",  label:"👥 全体" },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ flex:1, padding:"9px 0", borderRadius:10, fontSize:13, fontWeight:700,
                cursor:"pointer", border:"none",
                backgroundColor: mode===m.id ? C.accentLight : C.card,
                color: mode===m.id ? "#fff" : C.muted }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ジオコーディング進捗バー */}
      {progress && (
        <div style={{ padding:"8px 16px", backgroundColor:C.card, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:5 }}>
            📍 位置情報を取得中... {progress.done} / {progress.total}
          </div>
          <div style={{ backgroundColor:C.border, borderRadius:99, height:4 }}>
            <div style={{
              backgroundColor: C.accentLight, borderRadius:99, height:4,
              width: `${(progress.done / progress.total) * 100}%`,
              transition: "width 0.3s",
            }}/>
          </div>
        </div>
      )}

      {/* データなし */}
      {!loading && !progress && stats.length === 0 && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          color:C.muted, gap:14, padding:"0 32px", textAlign:"center" }}>
          <div style={{ fontSize:44 }}>📍</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>データがありません</div>
          <div style={{ fontSize:13 }}>
            日報の乗車記録に<br/>乗車場所を入力すると<br/>ここに単価マップが表示されます
          </div>
        </div>
      )}

      {/* 地図本体 */}
      <div ref={mapContainerRef}
        style={{ flex:1, minHeight:0, display: stats.length > 0 || loading ? "block" : "none" }}
      />

      {/* 下部パネル */}
      {stats.length > 0 && (
        <div style={{ backgroundColor:C.surface, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>

          {/* 選択スポット詳細 */}
          {selectedSpot && (
            <div style={{ padding:"10px 16px", backgroundColor:C.card, borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, marginBottom:5 }}>
                    📍 {selectedSpot.address}
                  </div>
                  <div style={{ display:"flex", gap:14, fontSize:12, color:C.muted, flexWrap:"wrap" }}>
                    <span>平均単価 <b style={{ color:C.green }}>¥{selectedSpot.avg.toLocaleString()}</b></span>
                    <span>件数 <b style={{ color:C.text }}>{selectedSpot.count}件</b></span>
                    <span>合計 <b style={{ color:C.text }}>¥{selectedSpot.total.toLocaleString()}</b></span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>
                  ×
                </button>
              </div>
            </div>
          )}

          {/* サマリー & 凡例 */}
          <div style={{ padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:14, fontSize:11, color:C.muted }}>
              <span>📌 <b style={{ color:C.text }}>{stats.length}</b>スポット</span>
              <span>🚖 <b style={{ color:C.text }}>{totalCount}</b>件</span>
              {avgFare > 0 && <span>平均 <b style={{ color:C.text }}>¥{avgFare.toLocaleString()}</b></span>}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", fontSize:10, color:C.muted }}>
              {[["#10B981","高"],["#F59E0B","中"],["#EF4444","低"]].map(([clr, lbl]) => (
                <span key={lbl} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", backgroundColor:clr, display:"inline-block" }}/>
                  {lbl}
                </span>
              ))}
            </div>
          </div>

          {/* 最高単価スポット */}
          {topByAvg && (
            <div style={{ padding:"0 16px 12px", fontSize:11, color:C.muted }}>
              🏆 最高単価:
              <span style={{ color:C.green, fontWeight:700, marginLeft:5 }}>{topByAvg.address}</span>
              <span style={{ marginLeft:4 }}>（平均 ¥{topByAvg.avg.toLocaleString()}）</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
