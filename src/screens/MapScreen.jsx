// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 単価分析画面（v2: 地図なし・高単価記録＋エリア分析）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useCallback, useMemo } from "react";
import { C, fmt, loadS, saveS } from "../lib/constants";
import { supabase, fetchRideRecords } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ──────────────────────────────────────
// 祝日リスト (2024〜2026)
// ──────────────────────────────────────
const JP_HOLIDAYS = new Set([
  "2024-01-01","2024-01-08","2024-02-11","2024-02-12","2024-02-23",
  "2024-03-20","2024-04-29","2024-05-03","2024-05-04","2024-05-05","2024-05-06",
  "2024-07-15","2024-08-11","2024-08-12","2024-09-16","2024-09-22","2024-09-23",
  "2024-10-14","2024-11-03","2024-11-04","2024-11-23",
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24",
  "2025-03-20","2025-04-29","2025-05-03","2025-05-04","2025-05-05","2025-05-06",
  "2025-07-21","2025-08-11","2025-09-15","2025-09-21","2025-09-22","2025-09-23",
  "2025-10-13","2025-11-03","2025-11-23","2025-11-24",
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23",
  "2026-03-20","2026-04-29","2026-05-03","2026-05-04","2026-05-05",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
]);

// ──────────────────────────────────────
// 時間帯・曜日定義
// ──────────────────────────────────────
const TIME_SLOTS = [
  { label:"全時間",    range:null },
  { label:"0〜2時",   range:[0,2]  },
  { label:"2〜4時",   range:[2,4]  },
  { label:"4〜6時",   range:[4,6]  },
  { label:"6〜8時",   range:[6,8]  },
  { label:"8〜10時",  range:[8,10] },
  { label:"10〜12時", range:[10,12]},
  { label:"12〜14時", range:[12,14]},
  { label:"14〜16時", range:[14,16]},
  { label:"16〜18時", range:[16,18]},
  { label:"18〜20時", range:[18,20]},
  { label:"20〜22時", range:[20,22]},
  { label:"22〜24時", range:[22,24]},
];
const DAY_LABELS = ["全","月","火","水","木","金","土","日","祝"];
const DAY_COLORS = { 土:"#3B82F6", 日:"#EF4444", 祝:"#A855F7" };
const DAY_INDEX  = { 月:1, 火:2, 水:3, 木:4, 金:5, 土:6, 日:0 };

function matchesTime(hour, range) {
  if (!range || hour === null || hour === undefined) return true;
  const [s, e] = range;
  return s < e ? (hour >= s && hour < e) : (hour >= s || hour < e);
}
function matchesDay(dateStr, selectedDays) {
  if (!selectedDays.length) return true;
  if (!dateStr) return true;
  const d   = new Date(dateStr);
  const dow = d.getDay();
  const hol = JP_HOLIDAYS.has(dateStr);
  return selectedDays.some(day => day === "祝" ? hol : DAY_INDEX[day] === dow);
}
const DOW_LABELS = ["日","月","火","水","木","金","土"];
function dowLabel(dateStr) {
  if (!dateStr) return "";
  return DOW_LABELS[new Date(dateStr).getDay()];
}

// ──────────────────────────────────────
// エリアマッピングテーブル（住所キーワード → 区・エリア）
// 長いキーワード優先でマッチするためsortしてある
// ──────────────────────────────────────
const AREA_MAP = [
  // 千代田区
  ["東京国際フォーラム","千代田区","有楽町・日比谷"],
  ["東京駅",    "千代田区","丸の内・東京駅"],
  ["大手町",    "千代田区","大手町"],
  ["丸の内",    "千代田区","丸の内・東京駅"],
  ["有楽町",    "千代田区","有楽町・日比谷"],
  ["日比谷公園","千代田区","有楽町・日比谷"],
  ["日比谷",    "千代田区","有楽町・日比谷"],
  ["神田",      "千代田区","神田"],
  ["秋葉原",    "千代田区","秋葉原"],
  ["御茶ノ水",  "千代田区","御茶ノ水"],
  ["水道橋",    "千代田区","水道橋"],
  ["九段下",    "千代田区","九段下・神保町"],
  ["神保町",    "千代田区","九段下・神保町"],
  ["半蔵門",    "千代田区","半蔵門"],
  ["永田町",    "千代田区","永田町"],
  ["霞が関",    "千代田区","霞が関"],
  ["飯田橋",    "千代田区","飯田橋"],
  ["市ヶ谷",    "千代田区","市ヶ谷・四ツ谷"],
  ["四ツ谷",    "千代田区","市ヶ谷・四ツ谷"],
  ["皇居",      "千代田区","皇居周辺"],
  // 中央区
  ["銀座",      "中央区","銀座"],
  ["日本橋",    "中央区","日本橋"],
  ["三越前",    "中央区","日本橋"],
  ["人形町",    "中央区","人形町"],
  ["水天宮前",  "中央区","人形町"],
  ["茅場町",    "中央区","茅場町"],
  ["新橋",      "中央区","新橋・汐留"],
  ["汐留",      "中央区","新橋・汐留"],
  // 港区
  ["東京ミッドタウン","港区","六本木"],
  ["六本木ヒルズ",    "港区","六本木"],
  ["ミッドタウン",    "港区","六本木"],
  ["ヒルズ",          "港区","六本木"],
  ["六本木",          "港区","六本木"],
  ["赤坂サカス",      "港区","赤坂"],
  ["赤坂見附",        "港区","赤坂"],
  ["溜池山王",        "港区","赤坂"],
  ["赤坂",            "港区","赤坂"],
  ["虎ノ門ヒルズ",    "港区","虎ノ門"],
  ["虎ノ門",          "港区","虎ノ門"],
  ["麻布十番",        "港区","麻布"],
  ["西麻布",          "港区","西麻布"],
  ["麻布",            "港区","麻布"],
  ["乃木坂",          "港区","乃木坂"],
  ["青山一丁目",      "港区","青山"],
  ["青山",            "港区","青山"],
  ["広尾",            "港区","広尾"],
  ["白金高輪",        "港区","白金"],
  ["白金台",          "港区","白金"],
  ["白金",            "港区","白金"],
  ["高輪ゲートウェイ","港区","高輪"],
  ["高輪",            "港区","高輪"],
  ["泉岳寺",          "港区","高輪"],
  ["芝公園",          "港区","芝・浜松町"],
  ["大門",            "港区","芝・浜松町"],
  ["浜松町",          "港区","芝・浜松町"],
  ["東京タワー",      "港区","芝・浜松町"],
  ["三田",            "港区","三田・田町"],
  ["田町",            "港区","三田・田町"],
  ["ダイバーシティ",  "港区","お台場"],
  ["お台場",          "港区","お台場"],
  ["台場",            "港区","お台場"],
  ["有明",            "江東区","有明・豊洲"],
  ["品川",            "港区","品川"],
  // 新宿区
  ["新宿駅",    "新宿区","新宿"],
  ["新宿",      "新宿区","新宿"],
  ["西新宿",    "新宿区","西新宿"],
  ["代々木",    "新宿区","代々木"],
  ["初台",      "新宿区","初台"],
  ["神楽坂",    "新宿区","神楽坂"],
  ["高田馬場",  "新宿区","高田馬場"],
  // 渋谷区
  ["渋谷駅",      "渋谷区","渋谷"],
  ["渋谷",        "渋谷区","渋谷"],
  ["明治神宮前",  "渋谷区","原宿"],
  ["原宿",        "渋谷区","原宿"],
  ["明治神宮",    "渋谷区","原宿"],
  ["表参道",      "渋谷区","表参道"],
  ["代官山",      "渋谷区","代官山"],
  ["恵比寿",      "渋谷区","恵比寿"],
  ["笹塚",        "渋谷区","笹塚・幡ヶ谷"],
  ["幡ヶ谷",      "渋谷区","笹塚・幡ヶ谷"],
  // 目黒区
  ["中目黒",    "目黒区","中目黒"],
  ["学芸大学",  "目黒区","学芸大学"],
  ["祐天寺",    "目黒区","祐天寺"],
  ["自由が丘",  "目黒区","自由が丘"],
  ["目黒",      "目黒区","目黒"],
  // 品川区
  ["大崎",      "品川区","大崎"],
  ["五反田",    "品川区","五反田"],
  ["大井町",    "品川区","大井町"],
  ["新馬場",    "品川区","品川南"],
  ["青物横丁",  "品川区","品川南"],
  ["鮫洲",      "品川区","品川南"],
  ["立会川",    "品川区","品川南"],
  ["北品川",    "品川区","品川南"],
  // 大田区
  ["羽田空港第1・2ターミナル","大田区","羽田空港"],
  ["羽田空港",  "大田区","羽田空港"],
  ["穴守稲荷",  "大田区","羽田空港"],
  ["天空橋",    "大田区","羽田空港"],
  ["羽田",      "大田区","羽田空港"],
  ["京急蒲田",  "大田区","蒲田"],
  ["蒲田",      "大田区","蒲田"],
  ["大森海岸",  "大田区","大森"],
  ["大森",      "大田区","大森"],
  ["平和島",    "大田区","平和島"],
  ["大鳥居",    "大田区","糀谷"],
  ["糀谷",      "大田区","糀谷"],
  // 世田谷区
  ["三軒茶屋",  "世田谷区","三軒茶屋"],
  ["下北沢",    "世田谷区","下北沢"],
  ["上野毛",    "世田谷区","二子玉川"],
  ["二子玉川",  "世田谷区","二子玉川"],
  ["瀬田",      "世田谷区","二子玉川"],
  ["成城学園前","世田谷区","成城"],
  ["千歳船橋",  "世田谷区","千歳船橋"],
  ["千歳烏山",  "世田谷区","千歳烏山"],
  ["等々力",    "世田谷区","等々力"],
  ["尾山台",    "世田谷区","等々力"],
  // 杉並区
  ["西荻窪",    "杉並区","西荻窪"],
  ["荻窪",      "杉並区","荻窪"],
  ["阿佐ヶ谷",  "杉並区","阿佐ヶ谷"],
  ["高円寺",    "杉並区","高円寺"],
  // 中野区
  ["東中野",    "中野区","東中野"],
  ["中野",      "中野区","中野"],
  // 豊島区
  ["椎名町",    "豊島区","池袋西"],
  ["東長崎",    "豊島区","池袋西"],
  ["目白",      "豊島区","目白"],
  ["池袋",      "豊島区","池袋"],
  // 台東区
  ["上野公園",  "台東区","上野"],
  ["上野広小路","台東区","上野"],
  ["仲御徒町",  "台東区","上野"],
  ["新御徒町",  "台東区","上野"],
  ["上野",      "台東区","上野"],
  ["稲荷町",    "台東区","上野"],
  ["田原町",    "台東区","浅草"],
  ["浅草",      "台東区","浅草"],
  ["蔵前",      "台東区","蔵前"],
  ["浅草橋",    "台東区","浅草橋"],
  // 墨田区
  ["スカイツリー","墨田区","押上・スカイツリー"],
  ["押上",      "墨田区","押上・スカイツリー"],
  ["両国",      "墨田区","両国"],
  ["錦糸町",    "墨田区","錦糸町"],
  // 江東区
  ["清澄白河",  "江東区","清澄白河"],
  ["門前仲町",  "江東区","門前仲町"],
  ["森下",      "江東区","森下"],
  ["木場",      "江東区","木場"],
  ["東陽町",    "江東区","東陽町"],
  ["亀戸",      "江東区","亀戸"],
  ["豊洲",      "江東区","豊洲"],
  ["辰巳",      "江東区","辰巳"],
  ["新木場",    "江東区","新木場"],
  // 江戸川区
  ["西葛西",    "江戸川区","葛西"],
  ["葛西",      "江戸川区","葛西"],
  // 練馬区
  ["石神井公園","練馬区","石神井公園"],
  ["大泉学園",  "練馬区","大泉学園"],
  ["江古田",    "練馬区","江古田"],
  ["桜台",      "練馬区","練馬"],
  ["豊島園",    "練馬区","練馬"],
  ["練馬",      "練馬区","練馬"],
  // 神奈川・多摩
  ["武蔵小杉",  "川崎市","武蔵小杉"],
  ["元住吉",    "川崎市","武蔵小杉"],
  ["日吉",      "横浜市","日吉"],
  ["溝の口",    "川崎市","溝の口"],
  ["吉祥寺",    "武蔵野市","吉祥寺"],
  ["三鷹",      "三鷹市","三鷹"],
  ["仙川",      "調布市","仙川"],
  ["調布",      "調布市","調布"],
  ["立川",      "立川市","立川"],
  ["国分寺",    "国分寺市","国分寺"],
  // 特別
  ["成田空港",  "千葉県","成田空港"],
].sort((a, b) => b[0].length - a[0].length);

function resolveArea(address) {
  const a = (address || "").trim();
  if (!a) return null;
  for (const [kw, ward, area] of AREA_MAP) {
    if (a.includes(kw)) return { ward, area, label: `${ward}${area}` };
  }
  return null;
}

// ──────────────────────────────────────
// コンポーネント
// ──────────────────────────────────────
export default function MapScreen({ reports, user }) {
  const [scope,        setScope]        = useState("self");
  const [tab,          setTab]          = useState("highFare");
  const bizPoints = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("taxi_biz_points") || "[]");
      return raw.map(p => typeof p === "string" ? { name: p, memo: "", timestamp: null } : p);
    } catch { return []; }
  }, []);
  const [timeSlotIdx,  setTimeSlotIdx]  = useState(0);
  const [selectedDays, setSelectedDays] = useState([]);
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [rawRides,     setRawRides]     = useState([]);
  const [rawRidesList, setRawRidesList] = useState([]);
  const [loading,      setLoading]      = useState(false);

  const timeRange = TIME_SLOTS[timeSlotIdx].range;

  // ── 自分のデータ取得 ──
  const getMyRides = useCallback(async () => {
    const rides = [], ridesList = [];

    reports.forEach(r => {
      const date = r.date || r.work_date || null;
      (r.rides || []).forEach(ride => {
        const pickup  = (ride.pickup_area  || ride.point_name || "").trim();
        const dropoff = (ride.dropoff_area || "").trim();
        let hour = null;
        const ts = ride.pickup_time || ride.start_time || "";
        if (ts) { const h = parseInt(ts.split(":")[0]); if (!isNaN(h)) hour = h; }
        if (pickup) rides.push({ address: pickup, amount: ride.amount || 0, date, hour });
        if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: ride.amount || 0, date, hour });
      });
      if (!(r.rides || []).length && r.work_area && r.gross_sales) {
        const perRide = r.ride_count > 0
          ? Math.round(r.gross_sales / r.ride_count)
          : Math.round(r.gross_sales);
        rides.push({ address: r.work_area.trim(), amount: perRide, date, hour: null });
      }
    });

    if (SUPABASE_READY && user?.id) {
      const { data: recs } = await fetchRideRecords(user.id);
      (recs || []).forEach(r => {
        const pickup  = (r.pickup_location  || "").trim();
        const dropoff = (r.dropoff_location || "").trim();
        let hour = null;
        if (r.boarding_time) { const h = new Date(r.boarding_time).getHours(); if (!isNaN(h)) hour = h; }
        const date = r.work_date || null;
        if (pickup) rides.push({ address: pickup, amount: r.fare || 0, date, hour });
        if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: r.fare || 0, date, hour });
      });
    }
    return { rides, ridesList };
  }, [reports, user]);

  // ── 全体データ取得 ──
  const getAllRides = useCallback(async () => {
    if (!SUPABASE_READY) return getMyRides();
    const { data, error } = await supabase.from("daily_reports").select("*");
    if (error) return getMyRides();
    const rides = [], ridesList = [];
    (data || []).forEach(row => {
      const date = row.date || row.report_date || null;
      (row.rides || []).forEach(ride => {
        const pickup  = (ride.pickup_area || ride.point_name || "").trim();
        const dropoff = (ride.dropoff_area || "").trim();
        let hour = null;
        const ts = ride.pickup_time || ride.start_time || "";
        if (ts) { const h = parseInt(ts.split(":")[0]); if (!isNaN(h)) hour = h; }
        if (pickup) rides.push({ address: pickup, amount: ride.amount || 0, date, hour });
        if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: ride.amount || 0, date, hour });
      });
    });
    return { rides, ridesList };
  }, [getMyRides]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { rides, ridesList } = scope === "self" ? await getMyRides() : await getAllRides();
    setRawRides(rides);
    setRawRidesList(ridesList);
    setLoading(false);
  }, [scope, getMyRides, getAllRides]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 曜日トグル ──
  const toggleDay = (day) => {
    if (day === "全") { setSelectedDays([]); return; }
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  const isDayActive = (day) => day === "全" ? !selectedDays.length : selectedDays.includes(day);

  // ── 高単価記録（3,000円以上・降順・上位100件） ──
  const highFareList = useMemo(() =>
    rawRidesList
      .filter(r => matchesTime(r.hour, timeRange) && matchesDay(r.date, selectedDays))
      .filter(r => Number(r.amount) >= 3000)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 100),
    [rawRidesList, timeRange, selectedDays]
  );

  // ── エリア分析（区＋エリア単位で集計・平均単価降順） ──
  const areaStats = useMemo(() => {
    const map = {};
    rawRides
      .filter(r => matchesTime(r.hour, timeRange) && matchesDay(r.date, selectedDays))
      .filter(r => Number(r.amount) > 0)
      .forEach(({ address, amount }) => {
        const resolved = resolveArea(address);
        const key   = resolved ? resolved.label : (address || "不明");
        const ward  = resolved?.ward  || "";
        const area  = resolved?.area  || address || "不明";
        if (!map[key]) map[key] = { count: 0, total: 0, ward, area };
        map[key].count++;
        map[key].total += Number(amount) || 0;
      });
    return Object.entries(map)
      .map(([label, { count, total, ward, area }]) => ({
        label, ward, area, count,
        avg: Math.round(total / count),
      }))
      .filter(e => e.avg >= 100)
      .sort((a, b) => b.avg - a.avg);
  }, [rawRides, timeRange, selectedDays]);

  // ── マイポイント統計（手動記録のpickup名で一致） ──
  const pointStats = useMemo(() =>
    bizPoints.map(p => {
      const matching = rawRidesList.filter(r =>
        matchesTime(r.hour, timeRange) && matchesDay(r.date, selectedDays) &&
        r.pickup === p.name
      );
      const count = matching.length;
      const avg   = count > 0 ? Math.round(matching.reduce((s, r) => s + Number(r.amount), 0) / count) : 0;
      const dates  = matching.map(r => r.date).filter(Boolean).sort();
      return { ...p, count, avg, lastDate: dates[dates.length - 1] || null };
    }).sort((a, b) => b.avg - a.avg),
    [bizPoints, rawRidesList, timeRange, selectedDays]
  );

  const hasFilter = timeSlotIdx > 0 || selectedDays.length > 0;

  // ── UI ──
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16, color:C.text }}>単価分析</div>

      {/* スコープ切替 */}
      <div style={{ display:"flex", backgroundColor:C.bg, borderRadius:10, padding:3, marginBottom:14 }}>
        {[["self","自分"],["all","全体"]].map(([v, lbl]) => (
          <button key={v} onClick={() => setScope(v)}
            style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none", fontWeight:700, fontSize:13,
              backgroundColor: scope === v ? C.accentLight : "transparent",
              color: scope === v ? "#fff" : C.muted, cursor:"pointer", transition:"all 0.15s" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* タブ切替 */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["highFare","💰 高単価"],["area","📊 エリア"],["point","📍 ポイント"]].map(([v, lbl]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ flex:1, padding:"10px 0", borderRadius:10,
              border:`1.5px solid ${tab === v ? C.accentLight : C.border}`,
              fontWeight:700, fontSize:12, cursor:"pointer",
              backgroundColor: tab === v ? C.accentGlow : C.surface,
              color: tab === v ? C.accentLight : C.muted }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* フィルター（折りたたみ） */}
      <div style={{ backgroundColor:C.surface, borderRadius:12, marginBottom:14, overflow:"hidden" }}>
        <div onClick={() => setFiltersOpen(p => !p)}
          style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"12px 16px", cursor:"pointer" }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
            🔍 絞り込み
            {hasFilter && <span style={{ marginLeft:6, fontSize:11, color:C.accentLight, fontWeight:600 }}>適用中</span>}
          </span>
          <span style={{ fontSize:11, color:C.muted }}>{filtersOpen ? "▲" : "▼"}</span>
        </div>
        {filtersOpen && (
          <div style={{ padding:"0 16px 16px" }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>時間帯</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {TIME_SLOTS.map((s, i) => (
                <button key={i} onClick={() => setTimeSlotIdx(i)}
                  style={{ padding:"5px 10px", borderRadius:8,
                    border:`1px solid ${i === timeSlotIdx ? C.accentLight : C.border}`,
                    backgroundColor: i === timeSlotIdx ? C.accentGlow : "transparent",
                    color: i === timeSlotIdx ? C.accentLight : C.muted,
                    fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>曜日</div>
            <div style={{ display:"flex", gap:5 }}>
              {DAY_LABELS.map(day => (
                <button key={day} onClick={() => toggleDay(day)}
                  style={{ flex:1, padding:"7px 0", borderRadius:8,
                    border:`1px solid ${isDayActive(day) ? (DAY_COLORS[day] || C.accentLight) : C.border}`,
                    backgroundColor: isDayActive(day) ? (DAY_COLORS[day] || C.accentLight) + "22" : "transparent",
                    color: isDayActive(day) ? (DAY_COLORS[day] || C.accentLight) : C.muted,
                    fontSize:10, fontWeight:700, cursor:"pointer" }}>
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ローディング */}
      {loading && (
        <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:14 }}>読み込み中...</div>
      )}

      {/* ── 高単価記録タブ ── */}
      {!loading && tab === "highFare" && (
        <div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
            3,000円以上の乗車 {highFareList.length}件
          </div>
          {highFareList.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:13 }}>
              3,000円以上の乗車記録がありません
            </div>
          ) : highFareList.map((r, i) => {
            const borderColor = r.amount >= 6000 ? C.green : r.amount >= 4000 ? C.gold : C.accentLight;
            return (
              <div key={i} style={{ backgroundColor:C.surface, borderRadius:12, padding:"14px 16px",
                marginBottom:8, borderLeft:`3px solid ${borderColor}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>
                      #{i+1}
                      {r.date && (
                        <span style={{ marginLeft:6 }}>
                          {r.date}（{dowLabel(r.date)}）
                        </span>
                      )}
                      {r.hour !== null && r.hour !== undefined && (
                        <span style={{ marginLeft:6 }}>{r.hour}時台</span>
                      )}
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      🚖 {r.pickup || "—"}
                    </div>
                    {r.dropoff && (
                      <div style={{ fontSize:12, color:C.muted,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        → {r.dropoff}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.text, marginLeft:12, flexShrink:0 }}>
                    ¥{fmt(r.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── エリア分析タブ ── */}
      {!loading && tab === "area" && (
        <div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
            エリア別平均単価 {areaStats.length}エリア
          </div>
          {areaStats.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:13 }}>
              データがありません
            </div>
          ) : areaStats.map((s, i) => {
            const color = s.avg >= 5000 ? C.green : s.avg >= 3000 ? C.gold : C.muted;
            return (
              <div key={i} style={{ backgroundColor:C.surface, borderRadius:12, padding:"14px 16px",
                marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center",
                borderLeft:`3px solid ${color}` }}>
                <div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>
                    #{i+1}
                    {s.ward && <span style={{ marginLeft:6 }}>{s.ward}</span>}
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.area}エリア</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.count}回</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:22, fontWeight:900, color }}>
                    {fmt(s.avg)}<span style={{ fontSize:12, marginLeft:2, color:C.muted }}>円</span>
                  </div>
                  <div style={{ fontSize:10, color:C.muted }}>平均単価</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ── マイポイントタブ ── */}
      {!loading && tab === "point" && (
        <div>
          {bizPoints.length === 0 ? (
            <div style={{ textAlign:"center", padding:48, color:C.muted, fontSize:13 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📍</div>
              マイポイントが未登録です<br/>
              <span style={{ fontSize:11 }}>ハンバーガーメニュー → マイポイントで追加できます</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
                登録ポイント {bizPoints.length}件
                {hasFilter && " （絞り込み適用中）"}
              </div>
              {pointStats.map((p, i) => {
                const color = p.avg >= 5000 ? C.green : p.avg >= 3000 ? C.gold : C.accentLight;
                return (
                  <div key={i} style={{ backgroundColor:C.surface, borderRadius:12, padding:"14px 16px",
                    marginBottom:8, borderLeft:`3px solid ${p.count > 0 ? color : C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:C.text,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          📍 {p.name}
                        </div>
                        {p.memo ? (
                          <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>メモ: {p.memo}</div>
                        ) : null}
                        <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>
                          {p.count > 0
                            ? <>{p.count}回{p.lastDate ? `  最終: ${p.lastDate}` : ""}</>
                            : "記録なし"}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:12, flexShrink:0 }}>
                        {p.avg > 0 ? (
                          <>
                            <div style={{ fontSize:22, fontWeight:900, color }}>
                              {fmt(p.avg)}<span style={{ fontSize:12, color:C.muted, marginLeft:2 }}>円</span>
                            </div>
                            <div style={{ fontSize:10, color:C.muted }}>平均単価</div>
                          </>
                        ) : (
                          <div style={{ fontSize:12, color:C.border }}>—</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
