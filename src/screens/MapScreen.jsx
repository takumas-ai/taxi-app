// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 単価マップ画面
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

async function geocodeAddress(address) {
  const cache = loadS(GEO_CACHE_KEY, {});
  if (cache[address]) return cache[address];
  const query = address.startsWith("東京") ? address : `東京都${address}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=jp&limit=1&accept-language=ja`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "TakuroApp/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      const updated = loadS(GEO_CACHE_KEY, {});
      updated[address] = result;
      saveS(GEO_CACHE_KEY, updated);
      return result;
    }
  } catch { /* ignore */ }
  return null;
}

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
      address, count, total,
      avg: count > 0 ? Math.round(total / count) : 0,
    }))
    .filter(e => e.count > 0 && e.avg > 0)
    .sort((a, b) => b.avg - a.avg); // 単価降順
}

function fareColor(avg, p25, p75) {
  if (avg >= p75) return "#10B981";
  if (avg <= p25) return "#EF4444";
  return "#F59E0B";
}

export default function MapScreen({ reports, user }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersLayer    = useRef(null);

  const [scope, setScope]       = useState("self");   // "self" | "all"
  const [view, setView]         = useState("list");   // "list" | "map"
  const [allStats, setAllStats] = useState([]);       // 集計結果（未ジオコーディング）
  const [mapStats, setMapStats] = useState([]);       // ジオコーディング済み
  const [progress, setProgress] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);

  // ──────────────────────────────────────
  // データ収集
  // ──────────────────────────────────────
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

  const getAllRides = useCallback(async () => {
    if (!SUPABASE_READY) return getMyRides();
    const { data, error } = await supabase
      .from("daily_reports").select("rides").not("rides", "is", null);
    if (error) return getMyRides();
    const rides = [];
    (data || []).forEach(row =>
      (row.rides || []).forEach(ride => {
        const address = (ride.pickup_area || ride.point_name || "").trim();
        if (address) rides.push({ address, amount: ride.amount || 0 });
      })
    );
    return rides;
  }, [getMyRides]);

  // ──────────────────────────────────────
  // 集計（即時）
  // ──────────────────────────────────────
  const loadStats = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    const rawRides = scope === "self" ? getMyRides() : await getAllRides();
    setAllStats(aggregateRides(rawRides));
    setLoading(false);
  }, [scope, getMyRides, getAllRides]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ──────────────────────────────────────
  // ジオコーディング（マップビュー切替時）
  // ──────────────────────────────────────
  const startGeocoding = useCallback(async () => {
    if (allStats.length === 0) return;
    const cache   = loadS(GEO_CACHE_KEY, {});
    const topItems = allStats.slice(0, 20);
    const result  = [];
    setProgress({ done: 0, total: topItems.length });

    for (let i = 0; i < topItems.length; i++) {
      const item   = topItems[i];
      const coords = await geocodeAddress(item.address);
      if (coords) result.push({ ...item, ...coords });
      setProgress({ done: i + 1, total: topItems.length });
      if (!cache[topItems[i + 1]?.address]) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }
    setMapStats(result);
    setProgress(null);
  }, [allStats]);

  useEffect(() => {
    if (view === "map" && mapStats.length === 0 && allStats.length > 0) {
      startGeocoding();
    }
  }, [view, allStats, mapStats.length, startGeocoding]);

  // ──────────────────────────────────────
  // Leafletマップ初期化
  // ──────────────────────────────────────
  useEffect(() => {
    if (view !== "map" || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [35.6812, 139.7671], zoom: 12,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
      subdomains: "abcd",
    }).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapRef.current       = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [view]);

  // マーカー更新
  useEffect(() => {
    if (!mapRef.current || !markersLayer.current || mapStats.length === 0) return;
    markersLayer.current.clearLayers();
    const avgs = [...mapStats.map(s => s.avg)].sort((a, b) => a - b);
    const p25  = avgs[Math.floor(avgs.length * 0.25)] || 0;
    const p75  = avgs[Math.floor(avgs.length * 0.75)] || 0;
    const maxC = Math.max(...mapStats.map(s => s.count));
    const minC = Math.min(...mapStats.map(s => s.count));

    mapStats.forEach(spot => {
      const color  = fareColor(spot.avg, p25, p75);
      const ratio  = maxC === minC ? 0.5 : (spot.count - minC) / (maxC - minC);
      const radius = 8 + ratio * 22;
      const circle = L.circleMarker([spot.lat, spot.lng], {
        radius, fillColor: color, color: "#fff", weight: 1.5,
        opacity: 0.9, fillOpacity: 0.72,
      });
      circle.on("click", () => setSelected(spot));
      circle.bindTooltip(
        `<b>${spot.address}</b><br>¥${spot.avg.toLocaleString()} / ${spot.count}件`,
        { direction: "top" }
      );
      markersLayer.current.addLayer(circle);
    });
    const bounds = L.latLngBounds(mapStats.map(s => [s.lat, s.lng]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [mapStats]);

  // ──────────────────────────────────────
  // サマリー
  // ──────────────────────────────────────
  const totalCount = allStats.reduce((s, e) => s + e.count, 0);
  const totalAmt   = allStats.reduce((s, e) => s + e.total, 0);
  const overallAvg = totalCount > 0 ? Math.round(totalAmt / totalCount) : 0;

  // ──────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", backgroundColor:C.bg, paddingBottom:80 }}>

      {/* ヘッダー */}
      <div style={{ padding:"52px 16px 12px", backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:10 }}>🗺️ 単価マップ</div>

        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {/* 自分/全体 */}
          {[{id:"self",label:"👤 自分"},{id:"all",label:"👥 全体"}].map(m => (
            <button key={m.id} onClick={() => { setScope(m.id); setMapStats([]); }}
              style={{ flex:1, padding:"8px 0", borderRadius:10, fontSize:13, fontWeight:700,
                cursor:"pointer", border:"none",
                backgroundColor: scope===m.id ? C.accentLight : C.card,
                color: scope===m.id ? "#fff" : C.muted }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* リスト/マップ切替 */}
        <div style={{ display:"flex", backgroundColor:C.card, borderRadius:10, padding:3 }}>
          {[{id:"list",label:"📋 ランキング"},{id:"map",label:"🗺️ 地図"}].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontWeight:700,
                cursor:"pointer", border:"none",
                backgroundColor: view===v.id ? C.surface : "transparent",
                color: view===v.id ? C.text : C.muted,
                boxShadow: view===v.id ? "0 1px 4px #0004" : "none" }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* サマリーバー */}
      {allStats.length > 0 && (
        <div style={{ display:"flex", gap:0, backgroundColor:C.card, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          {[
            { label:"エリア数", value: allStats.length },
            { label:"総件数",   value: `${totalCount}件` },
            { label:"全体平均", value: overallAvg > 0 ? `¥${overallAvg.toLocaleString()}` : "—" },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, padding:"8px 0", textAlign:"center",
              borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{s.value}</div>
              <div style={{ fontSize:10, color:C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ジオコーディング進捗 */}
      {progress && (
        <div style={{ padding:"8px 16px", backgroundColor:C.card, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
            📍 位置情報を取得中... {progress.done}/{progress.total}
          </div>
          <div style={{ backgroundColor:C.border, borderRadius:99, height:4 }}>
            <div style={{ backgroundColor:C.accentLight, borderRadius:99, height:4,
              width:`${(progress.done/progress.total)*100}%`, transition:"width 0.3s" }}/>
          </div>
        </div>
      )}

      {/* データなし */}
      {!loading && allStats.length === 0 && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", color:C.muted, gap:12, padding:"0 32px", textAlign:"center" }}>
          <div style={{ fontSize:44 }}>📍</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>データがありません</div>
          <div style={{ fontSize:13 }}>
            日報の乗車記録に乗車場所を入力すると<br/>単価マップが表示されます
          </div>
        </div>
      )}

      {/* ── ランキングビュー ── */}
      {view === "list" && allStats.length > 0 && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {/* ヘッダー行 */}
          <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 72px 56px 56px",
            gap:0, padding:"6px 16px", backgroundColor:C.card,
            borderBottom:`1px solid ${C.border}`, fontSize:10, color:C.muted, fontWeight:700 }}>
            <span>#</span>
            <span>乗車エリア</span>
            <span style={{ textAlign:"right" }}>平均単価</span>
            <span style={{ textAlign:"right" }}>件数</span>
            <span style={{ textAlign:"right" }}>合計</span>
          </div>

          {allStats.map((spot, i) => {
            const avgs = allStats.map(s => s.avg);
            const p25  = [...avgs].sort((a,b)=>a-b)[Math.floor(avgs.length*0.25)] || 0;
            const p75  = [...avgs].sort((a,b)=>a-b)[Math.floor(avgs.length*0.75)] || 0;
            const color = fareColor(spot.avg, p25, p75);
            return (
              <div key={spot.address}
                style={{ display:"grid", gridTemplateColumns:"28px 1fr 72px 56px 56px",
                  gap:0, padding:"10px 16px", borderBottom:`1px solid ${C.border}`,
                  backgroundColor: i % 2 === 0 ? "transparent" : C.card+"44",
                  alignItems:"center" }}>
                <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span style={{ fontSize:13, color:C.text, fontWeight: i < 3 ? 700 : 400,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>
                  {spot.address}
                </span>
                <span style={{ fontSize:13, fontWeight:800, color, textAlign:"right" }}>
                  ¥{spot.avg.toLocaleString()}
                </span>
                <span style={{ fontSize:12, color:C.muted, textAlign:"right" }}>
                  {spot.count}件
                </span>
                <span style={{ fontSize:11, color:C.muted, textAlign:"right" }}>
                  ¥{Math.round(spot.total/1000)}k
                </span>
              </div>
            );
          })}

          <div style={{ padding:"16px", textAlign:"center", fontSize:11, color:C.muted }}>
            ※ 単価の高さ: <span style={{ color:"#10B981" }}>●高</span>
            　<span style={{ color:"#F59E0B" }}>●中</span>
            　<span style={{ color:"#EF4444" }}>●低</span>
          </div>
        </div>
      )}

      {/* ── マップビュー ── */}
      {view === "map" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
          <div ref={mapContainerRef} style={{ flex:1, minHeight:0 }}/>

          {/* 選択スポット */}
          {selected && (
            <div style={{ padding:"10px 16px", backgroundColor:C.card, borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, marginBottom:4 }}>📍 {selected.address}</div>
                  <div style={{ display:"flex", gap:14, fontSize:12, color:C.muted }}>
                    <span>平均 <b style={{ color:C.green }}>¥{selected.avg.toLocaleString()}</b></span>
                    <span>件数 <b style={{ color:C.text }}>{selected.count}件</b></span>
                    <span>合計 <b style={{ color:C.text }}>¥{selected.total.toLocaleString()}</b></span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer" }}>×</button>
              </div>
            </div>
          )}

          {/* 凡例 */}
          <div style={{ padding:"8px 16px", backgroundColor:C.surface, borderTop:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div style={{ fontSize:11, color:C.muted }}>
              {mapStats.length > 0
                ? `${mapStats.length}スポットをマップ表示`
                : progress ? "地図に配置中..." : "地図ビューを開くとジオコーディングが始まります"}
            </div>
            <div style={{ display:"flex", gap:8, fontSize:10, color:C.muted }}>
              {[["#10B981","高"],["#F59E0B","中"],["#EF4444","低"]].map(([c,l]) => (
                <span key={l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", backgroundColor:c, display:"inline-block" }}/>{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
