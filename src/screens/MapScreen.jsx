// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 単価マップ画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { C, loadS, saveS } from "../lib/constants";
import { supabase, fetchRideRecords } from "../lib/supabase";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);
const GEO_CACHE_KEY = "taxi_geocode_cache_v1";

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
// 時間帯定義（2時間刻み）
// ──────────────────────────────────────
const TIME_SLOTS = [
  { label: "全時間",    range: null },
  { label: "0〜2時",   range: [0,  2] },
  { label: "2〜4時",   range: [2,  4] },
  { label: "4〜6時",   range: [4,  6] },
  { label: "6〜8時",   range: [6,  8] },
  { label: "8〜10時",  range: [8,  10] },
  { label: "10〜12時", range: [10, 12] },
  { label: "12〜14時", range: [12, 14] },
  { label: "14〜16時", range: [14, 16] },
  { label: "16〜18時", range: [16, 18] },
  { label: "18〜20時", range: [18, 20] },
  { label: "20〜22時", range: [20, 22] },
  { label: "22〜24時", range: [22, 24] },
];

// ──────────────────────────────────────
// 曜日定義
// ──────────────────────────────────────
const DAY_LABELS = ["全","月","火","水","木","金","土","日","祝"];
const DAY_COLORS = { 土: "#3B82F6", 日: "#EF4444", 祝: "#A855F7" };
const DAY_INDEX  = { 月:1, 火:2, 水:3, 木:4, 金:5, 土:6, 日:0 };

// ──────────────────────────────────────
// フィルター関数
// ──────────────────────────────────────
function matchesTime(hour, range) {
  if (!range || hour === null || hour === undefined) return true;
  const [s, e] = range;
  return s < e ? (hour >= s && hour < e) : (hour >= s || hour < e);
}

function matchesDay(dateStr, selectedDays) {
  if (!selectedDays.length) return true;
  if (!dateStr) return true; // 日付不明は除外しない
  const d   = new Date(dateStr);
  const dow = d.getDay();
  const hol = JP_HOLIDAYS.has(dateStr);
  return selectedDays.some(day => {
    if (day === "祝") return hol;
    return DAY_INDEX[day] === dow;
  });
}

// ──────────────────────────────────────
// 東京主要エリア 座標テーブル（API不要・即時解決）
// キーワードが住所に含まれれば座標を返す。長いキーワード優先でマッチ。
// ──────────────────────────────────────
const TOKYO_AREAS = [
  // === 主要ターミナル駅 ===
  ["東京駅",     35.6812, 139.7671], ["新宿駅",    35.6896, 139.7005],
  ["渋谷駅",     35.6580, 139.7016], ["池袋駅",    35.7295, 139.7109],
  ["上野駅",     35.7141, 139.7774], ["品川駅",    35.6284, 139.7388],
  ["新橋駅",     35.6659, 139.7581], ["有楽町駅",  35.6750, 139.7633],
  ["秋葉原駅",   35.7022, 139.7745], ["浜松町駅",  35.6554, 139.7565],
  ["田町駅",     35.6458, 139.7474], ["大崎駅",    35.6196, 139.7282],
  ["五反田駅",   35.6257, 139.7233], ["目黒駅",    35.6333, 139.7156],
  ["恵比寿駅",   35.6466, 139.7100], ["代官山駅",  35.6484, 139.7027],
  ["中目黒駅",   35.6440, 139.6987], ["三軒茶屋駅",35.6433, 139.6717],
  ["下北沢駅",   35.6611, 139.6666], ["明治神宮前駅",35.6660,139.7023],
  ["原宿駅",     35.6686, 139.7027], ["表参道駅",  35.6654, 139.7128],
  ["青山一丁目駅",35.6709,139.7145], ["六本木駅",  35.6628, 139.7315],
  ["赤坂駅",     35.6737, 139.7368], ["溜池山王駅",35.6735, 139.7421],
  ["永田町駅",   35.6750, 139.7427], ["霞が関駅",  35.6748, 139.7498],
  ["日比谷駅",   35.6739, 139.7591], ["銀座駅",    35.6713, 139.7648],
  ["新橋駅",     35.6659, 139.7581], ["汐留駅",    35.6551, 139.7578],
  ["大門駅",     35.6553, 139.7553], ["浜松町駅",  35.6554, 139.7565],
  ["芝公園駅",   35.6567, 139.7481], ["三田駅",    35.6484, 139.7398],
  ["白金台駅",   35.6378, 139.7255], ["白金高輪駅",35.6433, 139.7293],
  ["泉岳寺駅",   35.6349, 139.7394], ["高輪ゲートウェイ駅",35.6364,139.7408],
  ["大手町駅",   35.6860, 139.7632], ["日本橋駅",  35.6812, 139.7746],
  ["三越前駅",   35.6834, 139.7748], ["人形町駅",  35.6834, 139.7802],
  ["水天宮前駅", 35.6830, 139.7821], ["茅場町駅",  35.6793, 139.7782],
  ["門前仲町駅", 35.6694, 139.7992], ["木場駅",    35.6722, 139.8171],
  ["東陽町駅",   35.6757, 139.8100], ["豊洲駅",    35.6553, 139.7955],
  ["新木場駅",   35.6489, 139.8140], ["辰巳駅",    35.6489, 139.8018],
  ["台場駅",     35.6275, 139.7760], ["お台場海浜公園駅",35.6247,139.7762],
  ["清澄白河駅", 35.6797, 139.7945], ["森下駅",    35.6915, 139.7945],
  ["両国駅",     35.6962, 139.7956], ["浅草橋駅",  35.7004, 139.7871],
  ["浅草駅",     35.7116, 139.7967], ["押上駅",    35.7102, 139.8144],
  ["錦糸町駅",   35.6983, 139.8148], ["亀戸駅",    35.7063, 139.8268],
  ["葛西駅",     35.6913, 139.8765], ["西葛西駅",  35.6888, 139.8641],
  ["神田駅",     35.6918, 139.7711], ["御茶ノ水駅",35.6996, 139.7650],
  ["水道橋駅",   35.7022, 139.7534], ["飯田橋駅",  35.7018, 139.7467],
  ["市ヶ谷駅",   35.6923, 139.7361], ["四ツ谷駅",  35.6862, 139.7300],
  ["半蔵門駅",   35.6815, 139.7430], ["九段下駅",  35.6943, 139.7491],
  ["神保町駅",   35.6965, 139.7590], ["小川町駅",  35.6963, 139.7629],
  ["新御茶ノ水駅",35.6996,139.7650], ["代々木駅",  35.6836, 139.7021],
  ["初台駅",     35.6782, 139.6886], ["幡ヶ谷駅",  35.6714, 139.6830],
  ["笹塚駅",     35.6641, 139.6737], ["上野広小路駅",35.7092,139.7714],
  ["仲御徒町駅", 35.7093, 139.7778], ["稲荷町駅",  35.7103, 139.7866],
  ["田原町駅",   35.7111, 139.7924], ["蔵前駅",    35.7055, 139.7940],
  ["新御徒町駅", 35.7069, 139.7836], ["馬喰横山駅",35.6946, 139.7822],
  ["大島駅",     35.6943, 139.8327], ["西大島駅",  35.6958, 139.8211],
  ["大井町駅",   35.6002, 139.7308], ["西大井駅",  35.5936, 139.7173],
  ["蒲田駅",     35.5632, 139.7158], ["大森駅",    35.5791, 139.7174],
  ["平和島駅",   35.5766, 139.7291], ["大森海岸駅",35.5853, 139.7352],
  ["立会川駅",   35.5966, 139.7394], ["鮫洲駅",    35.6027, 139.7395],
  ["青物横丁駅", 35.6089, 139.7388], ["新馬場駅",  35.6150, 139.7377],
  ["北品川駅",   35.6219, 139.7382],
  ["天空橋駅",   35.5528, 139.7808], ["羽田空港第1・2ターミナル駅",35.5491,139.7808],
  ["糀谷駅",     35.5572, 139.7350], ["大鳥居駅",  35.5557, 139.7210],
  ["穴守稲荷駅", 35.5519, 139.7558], ["京急蒲田駅",35.5578, 139.7149],
  ["自由が丘駅", 35.6079, 139.6690], ["二子玉川駅",35.5955, 139.6271],
  ["溝の口駅",   35.5912, 139.6170], ["武蔵小杉駅",35.5756, 139.6573],
  ["日吉駅",     35.5598, 139.6356],
  ["成城学園前駅",35.6329,139.6213], ["千歳烏山駅",35.6500, 139.6285],
  ["千歳船橋駅", 35.6477, 139.6439], ["仙川駅",    35.6582, 139.5994],
  ["調布駅",     35.6506, 139.5445], ["府中駅",    35.6671, 139.4794],
  ["立川駅",     35.6978, 139.4126], ["国分寺駅",  35.7006, 139.4630],
  ["吉祥寺駅",   35.7033, 139.5796], ["三鷹駅",    35.7029, 139.5601],
  ["武蔵境駅",   35.7061, 139.5444], ["東小金井駅",35.7013, 139.5166],
  ["武蔵小金井駅",35.6955,139.5037], ["国立駅",    35.6861, 139.4487],
  ["西国分寺駅", 35.6953, 139.4733], ["西荻窪駅",  35.7049, 139.5988],
  ["荻窪駅",     35.7055, 139.6201], ["阿佐ヶ谷駅",35.7061, 139.6362],
  ["高円寺駅",   35.7060, 139.6494], ["中野駅",    35.7075, 139.6634],
  ["東中野駅",   35.7111, 139.6711], ["大久保駅",  35.7009, 139.6941],
  ["高田馬場駅", 35.7127, 139.7036], ["目白駅",    35.7200, 139.7073],
  ["椎名町駅",   35.7249, 139.7043], ["東長崎駅",  35.7278, 139.7002],
  ["江古田駅",   35.7350, 139.6839], ["桜台駅",    35.7337, 139.6712],
  ["練馬駅",     35.7360, 139.6530], ["豊島園駅",  35.7398, 139.6494],
  ["石神井公園駅",35.7401,139.6225], ["大泉学園駅",35.7425, 139.5940],
  ["鶴瀬駅",     35.8185, 139.5326], ["志木駅",    35.8360, 139.5671],
  ["北朝霞駅",   35.8213, 139.5876], ["南浦和駅",  35.8223, 139.6570],
  // === ターミナル（駅名なし） ===
  ["羽田空港",   35.5494, 139.7798], ["成田空港",   35.7648, 140.3864],
  ["東京国際フォーラム",35.6764,139.7632],
  // === 主要地区・ランドマーク ===
  ["丸の内",     35.6812, 139.7671], ["銀座",       35.6713, 139.7648],
  ["新宿",       35.6896, 139.7005], ["渋谷",       35.6580, 139.7016],
  ["池袋",       35.7295, 139.7109], ["上野",       35.7141, 139.7774],
  ["浅草",       35.7116, 139.7967], ["六本木",     35.6628, 139.7315],
  ["赤坂",       35.6737, 139.7368], ["青山",       35.6709, 139.7145],
  ["原宿",       35.6686, 139.7027], ["表参道",     35.6654, 139.7128],
  ["恵比寿",     35.6466, 139.7100], ["目黒",       35.6333, 139.7156],
  ["五反田",     35.6257, 139.7233], ["品川",       35.6284, 139.7388],
  ["大崎",       35.6196, 139.7282], ["汐留",       35.6551, 139.7578],
  ["新橋",       35.6659, 139.7581], ["虎ノ門",     35.6675, 139.7497],
  ["神田",       35.6918, 139.7711], ["日本橋",     35.6812, 139.7746],
  ["茅場町",     35.6793, 139.7782], ["木場",       35.6722, 139.8171],
  ["豊洲",       35.6553, 139.7955], ["お台場",     35.6275, 139.7760],
  ["台場",       35.6275, 139.7760], ["有明",       35.6350, 139.7888],
  ["錦糸町",     35.6983, 139.8148], ["亀戸",       35.7063, 139.8268],
  ["葛西",       35.6913, 139.8765], ["清澄白河",   35.6797, 139.7945],
  ["門前仲町",   35.6694, 139.7992], ["両国",       35.6962, 139.7956],
  ["押上",       35.7102, 139.8144], ["大手町",     35.6860, 139.7632],
  ["霞が関",     35.6748, 139.7498], ["永田町",     35.6750, 139.7427],
  ["赤坂見附",   35.6768, 139.7362], ["四ツ谷",     35.6862, 139.7300],
  ["市ヶ谷",     35.6923, 139.7361], ["飯田橋",     35.7018, 139.7467],
  ["神保町",     35.6965, 139.7590], ["代々木",     35.6836, 139.7021],
  ["笹塚",       35.6641, 139.6737], ["幡ヶ谷",     35.6714, 139.6830],
  ["初台",       35.6782, 139.6886], ["三軒茶屋",   35.6433, 139.6717],
  ["下北沢",     35.6611, 139.6666], ["自由が丘",   35.6079, 139.6690],
  ["二子玉川",   35.5955, 139.6271], ["溝の口",     35.5912, 139.6170],
  ["武蔵小杉",   35.5756, 139.6573], ["蒲田",       35.5632, 139.7158],
  ["大森",       35.5791, 139.7174], ["大井町",     35.6002, 139.7308],
  ["高田馬場",   35.7127, 139.7036], ["中野",       35.7075, 139.6634],
  ["荻窪",       35.7055, 139.6201], ["高円寺",     35.7060, 139.6494],
  ["吉祥寺",     35.7033, 139.5796], ["三鷹",       35.7029, 139.5601],
  ["調布",       35.6506, 139.5445], ["立川",       35.6978, 139.4126],
  ["国分寺",     35.7006, 139.4630], ["練馬",       35.7360, 139.6530],
  ["白金",       35.6378, 139.7255], ["三田",       35.6484, 139.7398],
  ["麻布",       35.6556, 139.7318], ["麻布十番",   35.6556, 139.7318],
  ["西麻布",     35.6604, 139.7235], ["乃木坂",     35.6641, 139.7266],
  ["広尾",       35.6516, 139.7228], ["代官山",     35.6484, 139.7027],
  ["中目黒",     35.6440, 139.6987], ["学芸大学",   35.6283, 139.6934],
  ["祐天寺",     35.6378, 139.6988], ["中町",       35.6322, 139.7012],
  ["等々力",     35.6102, 139.6592], ["尾山台",     35.6146, 139.6587],
  ["上野毛",     35.6082, 139.6430], ["瀬田",       35.6029, 139.6343],
  ["虎ノ門ヒルズ",35.6676,139.7489], ["六本木ヒルズ",35.6604,139.7292],
  ["赤坂サカス",  35.6752, 139.7399], ["東京ミッドタウン",35.6654,139.7302],
  ["ヒルズ",     35.6604, 139.7292], ["ミッドタウン",35.6654,139.7302],
  ["お台場",     35.6275, 139.7760], ["ダイバーシティ",35.6246,139.7750],
  ["東京タワー",  35.6586, 139.7454], ["スカイツリー",35.7102,139.8144],
  ["明治神宮",   35.6762, 139.6993], ["皇居",       35.6852, 139.7528],
  ["上野公園",   35.7160, 139.7733], ["日比谷公園", 35.6731, 139.7587],
  ["有楽町",     35.6750, 139.7633], ["日比谷",     35.6739, 139.7591],
  ["浜松町",     35.6554, 139.7565], ["田町",       35.6458, 139.7474],
  ["高輪",       35.6364, 139.7408], ["泉岳寺",     35.6349, 139.7394],
  ["北品川",     35.6219, 139.7382], ["大井",       35.5970, 139.7349],
  ["平和島",     35.5766, 139.7291], ["天空橋",     35.5528, 139.7808],
  ["羽田",       35.5494, 139.7798],
].sort((a, b) => b[0].length - a[0].length); // 長いキーワード優先

// 住所文字列に含まれるエリアを検索して座標を返す
function resolveLocal(address) {
  const a = address.trim();
  for (const [keyword, lat, lng] of TOKYO_AREAS) {
    if (a.includes(keyword)) return { lat, lng };
  }
  return null;
}

// ──────────────────────────────────────
// ジオコーディング（ローカル→localStorage→Edge Function の3段階）
// ──────────────────────────────────────
async function geocodeBatch(addresses) {
  const localCache = loadS(GEO_CACHE_KEY, {});
  const result = {};
  const misses = []; // ローカルテーブルにもキャッシュにもない住所

  for (const addr of addresses) {
    // 1. ローカルテーブルで即時解決
    const local = resolveLocal(addr);
    if (local) { result[addr] = local; continue; }
    // 2. localStorageキャッシュ
    if (localCache[addr]) { result[addr] = localCache[addr]; continue; }
    misses.push(addr);
  }
  if (misses.length === 0) return result;

  // 3. Edge Function（DBキャッシュ or Nominatim）
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${supabaseUrl}/functions/v1/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey,
      },
      body: JSON.stringify({ addresses: misses }),
    });
    if (res.ok) {
      const data = await res.json();
      const updated = loadS(GEO_CACHE_KEY, {});
      for (const [addr, coords] of Object.entries(data)) {
        result[addr] = coords;
        updated[addr] = coords;
      }
      saveS(GEO_CACHE_KEY, updated);
    }
  } catch { /* ignore */ }

  return result;
}

// ──────────────────────────────────────
// 集計
// ──────────────────────────────────────
function aggregateRides(rides, timeRange, selectedDays) {
  const map = {};
  rides.forEach(({ address, amount, date, hour }) => {
    const key = (address || "").trim();
    if (!key || key.length < 2) return;
    if (!matchesTime(hour, timeRange)) return;
    if (!matchesDay(date, selectedDays)) return;
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
    .sort((a, b) => b.avg - a.avg);
}

function fareColor(avg, p25, p75) {
  if (avg >= p75) return "#10B981";
  if (avg <= p25) return "#EF4444";
  return "#F59E0B";
}

// ──────────────────────────────────────
// コンポーネント
// ──────────────────────────────────────
export default function MapScreen({ reports, user }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersLayer    = useRef(null);

  const [scope, setScope]             = useState("self");
  const [view, setView]               = useState("list");
  const [timeSlotIdx, setTimeSlotIdx] = useState(0);
  const [selectedDays, setSelectedDays] = useState([]);
  const [rawRides, setRawRides]       = useState([]);      // 地図用（乗車エリア集計）
  const [rawRidesList, setRawRidesList] = useState([]);    // リスト用（個別乗車記録）
  const [mapStats, setMapStats]       = useState([]);
  const [progress, setProgress]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);  // フィルター折りたたみ

  const timeRange = TIME_SLOTS[timeSlotIdx].range;

  // ──────────────────────────────────────
  // データ収集
  // ──────────────────────────────────────
  const getMyRides = useCallback(async () => {
    const rides = [];      // 地図用（乗車エリアのみ）
    const ridesList = [];  // リスト用（乗車＋降車エリア）

    // 1) 日報の乗車記録 + work_area フォールバック
    reports.forEach(r => {
      const date = r.date || r.work_date || null;
      (r.rides || []).forEach(ride => {
        const pickup  = (ride.pickup_area  || ride.point_name || "").trim();
        const dropoff = (ride.dropoff_area || "").trim();
        let hour = null;
        const timeStr = ride.pickup_time || ride.start_time || "";
        if (timeStr) {
          const h = parseInt(timeStr.split(":")[0]);
          if (!isNaN(h)) hour = h;
        }
        if (pickup) rides.push({ address: pickup, amount: ride.amount || 0, date, hour });
        // リスト用：pickup か dropoff どちらかあれば追加
        if (pickup || dropoff) {
          ridesList.push({ pickup, dropoff, amount: ride.amount || 0, date, hour });
        }
      });
      if ((r.rides || []).length === 0 && r.work_area && r.gross_sales) {
        const perRide = r.ride_count > 0
          ? Math.round(r.gross_sales / r.ride_count)
          : Math.round(r.gross_sales);
        rides.push({ address: r.work_area.trim(), amount: perRide, date, hour: null });
      }
    });
    // 2) Supabase ride_records（ホーム乗車記録）
    if (SUPABASE_READY && user?.id) {
      const { data: recs } = await fetchRideRecords(user.id);
      (recs || []).forEach(r => {
        const pickup  = (r.pickup_location  || "").trim();
        const dropoff = (r.dropoff_location || "").trim();
        let hour = null;
        if (r.boarding_time) {
          const h = new Date(r.boarding_time).getHours();
          if (!isNaN(h)) hour = h;
        }
        const date = r.work_date || null;
        if (pickup) rides.push({ address: pickup, amount: r.fare || 0, date, hour });
        if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: r.fare || 0, date, hour });
      });
    }
    // 3) ローカルストレージ（オフライン入力分）
    loadS("taxi_sales_records", []).forEach(r => {
      const pickup  = (r.pickupLocation  || r.spotName || "").trim();
      const dropoff = (r.dropoffLocation || "").trim();
      let hour = null;
      if (r.boardingTime) {
        const h = new Date(r.boardingTime).getHours();
        if (!isNaN(h)) hour = h;
      }
      if (pickup) rides.push({ address: pickup, amount: parseInt(r.fare || r.amount) || 0, date: r.workDate || r.date || null, hour });
      if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: parseInt(r.fare || r.amount) || 0, date: r.workDate || r.date || null, hour });
    });
    return { rides, ridesList };
  }, [reports, user]);

  const getAllRides = useCallback(async () => {
    if (!SUPABASE_READY) return getMyRides();
    const { data, error } = await supabase
      .from("daily_reports").select("rides, date");
    if (error) return getMyRides();
    const rides = [];
    const ridesList = [];
    (data || []).forEach(row => {
      const date = row.date || null;
      (row.rides || []).forEach(ride => {
        const pickup  = (ride.pickup_area || ride.point_name || "").trim();
        const dropoff = (ride.dropoff_area || "").trim();
        let hour = null;
        const timeStr = ride.pickup_time || ride.start_time || "";
        if (timeStr) { const h = parseInt(timeStr.split(":")[0]); if (!isNaN(h)) hour = h; }
        if (pickup) rides.push({ address: pickup, amount: ride.amount || 0, date, hour });
        if (pickup || dropoff) ridesList.push({ pickup, dropoff, amount: ride.amount || 0, date, hour });
      });
    });
    return { rides, ridesList };
  }, [getMyRides]);

  // ──────────────────────────────────────
  // 生データ読込（scope変更時のみ）
  // ──────────────────────────────────────
  const loadRawRides = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    const { rides, ridesList } = scope === "self" ? await getMyRides() : await getAllRides();
    setRawRides(rides);
    setRawRidesList(ridesList);
    setMapStats([]);
    setLoading(false);
  }, [scope, getMyRides, getAllRides]);

  useEffect(() => { loadRawRides(); }, [loadRawRides]);

  // ──────────────────────────────────────
  // フィルター適用（即時・メモ化）
  // ──────────────────────────────────────
  const allStats = useMemo(
    () => aggregateRides(rawRides, timeRange, selectedDays),
    [rawRides, timeRange, selectedDays]
  );

  // フィルター変更時はマップリセット
  useEffect(() => {
    setMapStats([]);
    setSelected(null);
  }, [timeRange, selectedDays]);

  // ──────────────────────────────────────
  // 曜日トグル
  // ──────────────────────────────────────
  const toggleDay = (day) => {
    if (day === "全") { setSelectedDays([]); return; }
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const isDayActive = (day) =>
    day === "全" ? selectedDays.length === 0 : selectedDays.includes(day);

  // ──────────────────────────────────────
  // ジオコーディング（マップビュー切替時）
  // ──────────────────────────────────────
  const startGeocoding = useCallback(async () => {
    if (allStats.length === 0) return;
    setProgress({ done: 0, total: allStats.length });

    const addresses = allStats.map(i => i.address);
    const coordsMap = await geocodeBatch(addresses);

    const result = [];
    for (const item of allStats) {
      if (coordsMap[item.address]) result.push({ ...item, ...coordsMap[item.address] });
    }
    setMapStats(result);
    setProgress(null);
  }, [allStats]);

  // allStats 確定次第バックグラウンドでジオコーディング開始（地図表示を待たずに）
  useEffect(() => {
    if (allStats.length > 0 && mapStats.length === 0) {
      startGeocoding();
    }
  }, [allStats, mapStats.length, startGeocoding]);

  // ──────────────────────────────────────
  // Leafletマップ初期化
  // ──────────────────────────────────────
  useEffect(() => {
    if (view !== "map" || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [35.6812, 139.7671], zoom: 12,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
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
  // リスト用：個別乗車記録（運賃降順・上限200件）
  // ──────────────────────────────────────
  const listStats = useMemo(() => {
    return rawRidesList
      .filter(r => matchesTime(r.hour, timeRange) && matchesDay(r.date, selectedDays))
      .map(r => ({ pickup: r.pickup || "—", dropoff: r.dropoff || "—", amount: Number(r.amount) || 0, date: r.date || null }))
      .filter(r => r.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 200);
  }, [rawRidesList, timeRange, selectedDays]);

  // ──────────────────────────────────────
  // サマリー
  // ──────────────────────────────────────
  const totalCount = listStats.length;
  const totalAmt   = listStats.reduce((s, e) => s + e.amount, 0);
  const overallAvg = totalCount > 0 ? Math.round(totalAmt / totalCount) : 0;

  // ──────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", backgroundColor:C.bg, paddingBottom:80 }}>

      {/* ヘッダー */}
      <div style={{ backgroundColor:C.surface, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ padding:"8px 14px 0" }}>

          {/* 常時表示: 自分/全体 + リスト/地図 + フィルターボタン */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            {/* 自分/全体 */}
            <div style={{ display:"flex", gap:4, backgroundColor:C.card, borderRadius:10, padding:3 }}>
              {[{id:"self",label:"自分"},{id:"all",label:"全体"}].map(m => (
                <button key={m.id} onClick={() => setScope(m.id)}
                  style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700,
                    cursor:"pointer", border:"none",
                    backgroundColor: scope===m.id ? C.accentLight : "transparent",
                    color: scope===m.id ? "#fff" : C.muted }}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* リスト/地図 */}
            <div style={{ display:"flex", backgroundColor:C.card, borderRadius:10, padding:3 }}>
              {[{id:"list",label:"リスト"},{id:"map",label:"地図"}].map(v => (
                <button key={v.id} onClick={() => setView(v.id)}
                  style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700,
                    cursor:"pointer", border:"none",
                    backgroundColor: view===v.id ? C.surface : "transparent",
                    color: view===v.id ? C.text : C.muted,
                    boxShadow: view===v.id ? "0 1px 4px #0004" : "none" }}>
                  {v.label}
                </button>
              ))}
            </div>
            {/* フィルタートグル */}
            <button onClick={() => setFiltersOpen(p => !p)}
              style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4,
                padding:"6px 12px", borderRadius:10, fontSize:12, fontWeight:700,
                cursor:"pointer", border:`1px solid ${(selectedDays.length > 0 || timeSlotIdx > 0) ? C.accentLight : C.border}`,
                backgroundColor: (selectedDays.length > 0 || timeSlotIdx > 0) ? C.accentLight+"22" : C.card,
                color: (selectedDays.length > 0 || timeSlotIdx > 0) ? C.accentLight : C.muted }}>
              絞込 {filtersOpen ? "▲" : "▼"}
            </button>
          </div>

          {/* 折りたたみフィルター */}
          {filtersOpen && (
            <div style={{ paddingBottom:10 }}>
              {/* 時間帯 */}
              <select
                value={timeSlotIdx}
                onChange={e => setTimeSlotIdx(Number(e.target.value))}
                style={{ width:"100%", fontSize:13, padding:"7px 8px", borderRadius:10,
                  border:`1px solid ${C.border}`, backgroundColor:C.card,
                  color:C.text, cursor:"pointer", marginBottom:8 }}>
                {TIME_SLOTS.map((s, i) => (
                  <option key={i} value={i}>{s.label}</option>
                ))}
              </select>
              {/* 曜日フィルター */}
              <div style={{ display:"grid", gridTemplateColumns:"44px 1fr", gap:4 }}>
                <button onClick={() => toggleDay("全")}
                  style={{ gridRow:"1/3", fontSize:13, fontWeight: isDayActive("全") ? 700 : 400,
                    textAlign:"center", borderRadius:8, cursor:"pointer",
                    border: isDayActive("全") ? "none" : `1px solid ${C.border}`,
                    backgroundColor: isDayActive("全") ? C.accentLight : C.card,
                    color: isDayActive("全") ? "#fff" : C.text }}>
                  全
                </button>
                <div style={{ display:"flex", gap:4 }}>
                  {["月","火","水","木","金"].map(day => {
                    const active = isDayActive(day);
                    return (
                      <button key={day} onClick={() => toggleDay(day)}
                        style={{ flex:1, padding:"6px 0", fontSize:13,
                          fontWeight: active ? 700 : 400, textAlign:"center",
                          borderRadius:7, cursor:"pointer",
                          border: active ? "none" : `1px solid ${C.border}`,
                          backgroundColor: active ? C.accentLight : C.card,
                          color: active ? "#fff" : C.text }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {["土","日","祝"].map(day => {
                    const active   = isDayActive(day);
                    const activeBg = DAY_COLORS[day] || C.accentLight;
                    return (
                      <button key={day} onClick={() => toggleDay(day)}
                        style={{ flex:1, padding:"6px 0", fontSize:13,
                          fontWeight: active ? 700 : 400, textAlign:"center",
                          borderRadius:7, cursor:"pointer",
                          border: active ? "none" : `1px solid ${C.border}`,
                          backgroundColor: active ? activeBg : C.card,
                          color: active ? "#fff" : (DAY_COLORS[day] || C.text) }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* サマリーバー */}
      {(listStats.length > 0 || allStats.length > 0) && (
        <div style={{ display:"flex", backgroundColor:C.card, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          {[
            { label:"エリア数", value: allStats.length },
            { label:"総件数",   value: `${totalCount}件` },
            { label:"平均単価", value: overallAvg > 0 ? `¥${overallAvg.toLocaleString()}` : "—" },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, padding:"8px 0", textAlign:"center",
              borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize:16, fontWeight:800, color: i===2 ? C.accentLight : C.text }}>
                {s.value}
              </div>
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

      {/* ── ランキングビュー ── */}
      {view === "list" && allStats.length === 0 && !loading && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", color:C.muted, gap:12, padding:"0 32px", textAlign:"center" }}>
          <div style={{ fontSize:44 }}>📍</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>データがありません</div>
          <div style={{ fontSize:13 }}>
            日報の乗車記録に乗車場所を入力すると<br/>単価マップが表示されます
          </div>
        </div>
      )}

      {view === "list" && listStats.length === 0 && !loading && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", color:C.muted, gap:12, padding:"0 32px", textAlign:"center" }}>
          <div style={{ fontSize:44 }}>🚕</div>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>乗車記録がありません</div>
          <div style={{ fontSize:13 }}>日報の乗車記録に乗車場所を入力すると<br/>ここに一覧が表示されます</div>
        </div>
      )}

      {view === "list" && listStats.length > 0 && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {/* ヘッダー */}
          <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 64px 60px",
            padding:"6px 16px", backgroundColor:C.card,
            borderBottom:`1px solid ${C.border}`, fontSize:10, color:C.muted, fontWeight:700 }}>
            <span>#</span>
            <span>乗車エリア → 降車エリア</span>
            <span style={{ textAlign:"right" }}>運賃</span>
            <span style={{ textAlign:"right" }}>日時</span>
          </div>

          {listStats.map((spot, i) => {
            const amounts = listStats.map(s => s.amount);
            const p25  = [...amounts].sort((a,b)=>a-b)[Math.floor(amounts.length*0.25)] || 0;
            const p75  = [...amounts].sort((a,b)=>a-b)[Math.floor(amounts.length*0.75)] || 0;
            const color = fareColor(spot.amount, p25, p75);
            const dateLabel = spot.date ? spot.date.slice(5).replace("-","/") : "—";
            const timeLabel = spot.hour != null ? `${String(spot.hour).padStart(2,"0")}:00` : "";
            return (
              <div key={i}
                style={{ display:"grid", gridTemplateColumns:"28px 1fr 64px 60px",
                  padding:"10px 16px", borderBottom:`1px solid ${C.border}`,
                  backgroundColor: i % 2 === 0 ? "transparent" : C.card+"44",
                  alignItems:"center" }}>
                <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <div style={{ minWidth:0, paddingRight:6 }}>
                  <div style={{ fontSize:12, color:C.text, fontWeight: i < 3 ? 700 : 400,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {spot.pickup}
                  </div>
                  <div style={{ fontSize:11, color:C.muted,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    → {spot.dropoff}
                  </div>
                </div>
                <span style={{ fontSize:13, fontWeight:800, color, textAlign:"right" }}>
                  ¥{spot.amount.toLocaleString()}
                </span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:C.muted }}>{dateLabel}</div>
                  {timeLabel && <div style={{ fontSize:10, color:C.muted }}>{timeLabel}</div>}
                </div>
              </div>
            );
          })}

          <div style={{ padding:"16px", textAlign:"center", fontSize:11, color:C.muted }}>
            ※ 単価の高さ:
            <span style={{ color:"#10B981" }}> ●高</span>
            <span style={{ color:"#F59E0B" }}> ●中</span>
            <span style={{ color:"#EF4444" }}> ●低</span>
          </div>
        </div>
      )}

      {/* ── マップビュー ── */}
      {view === "map" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
          <div ref={mapContainerRef} style={{ flex:1, minHeight:0 }}/>

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
