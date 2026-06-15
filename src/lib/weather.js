// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 天気ユーティリティ
// VITE_OPENWEATHER_API_KEY を .env に設定して使用
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const BASE    = "https://api.openweathermap.org/data/2.5";

// 天気コード → 絵文字・ラベル・雨フラグ
export function weatherMeta(code) {
  if (!code) return { icon:"🌀", label:"取得中", isRainy:false };
  if (code >= 200 && code < 300) return { icon:"⛈️",  label:"雷雨",   isRainy:true  };
  if (code >= 300 && code < 400) return { icon:"🌧️",  label:"霧雨",   isRainy:true  };
  if (code >= 500 && code < 504) return { icon:"🌧️",  label:"雨",     isRainy:true  };
  if (code === 511)              return { icon:"🌨️",  label:"みぞれ", isRainy:true  };
  if (code >= 512 && code < 600) return { icon:"🌧️",  label:"大雨",   isRainy:true  };
  if (code >= 600 && code < 700) return { icon:"❄️",  label:"雪",     isRainy:false };
  if (code >= 700 && code < 800) return { icon:"🌫️",  label:"霧",     isRainy:false };
  if (code === 800)              return { icon:"☀️",  label:"晴れ",   isRainy:false };
  if (code === 801)              return { icon:"🌤️",  label:"晴れ時々曇り", isRainy:false };
  if (code === 802)              return { icon:"⛅",  label:"曇り時々晴れ", isRainy:false };
  if (code >= 803)              return { icon:"☁️",  label:"曇り",   isRainy:false };
  return { icon:"🌡️", label:"不明", isRainy:false };
}

// 現在地 or デフォルト(横浜)の天気取得
export async function fetchWeather(lat, lon) {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ja`
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      code:    d.weather[0].id,
      desc:    d.weather[0].description,
      temp:    Math.round(d.main.temp),
      feels:   Math.round(d.main.feels_like),
      humidity:d.main.humidity,
      wind:    Math.round(d.wind.speed * 3.6), // m/s → km/h
      city:    d.name,
    };
  } catch {
    return null;
  }
}

// 位置情報を取得 → 天気を返す
export function useWeather() {
  return new Promise((resolve) => {
    if (!API_KEY) { resolve(null); return; }
    if (!navigator.geolocation) {
      // デフォルト: 横浜
      fetchWeather(35.4437, 139.6380).then(resolve);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude).then(resolve),
      ()  => fetchWeather(35.4437, 139.6380).then(resolve), // 失敗→横浜
      { timeout: 5000 }
    );
  });
}

// キャッシュ付きで天気を取得（15分間保持）
const CACHE_KEY = "taxi_weather_cache";
const CACHE_TTL = 15 * 60 * 1000;

export async function getCachedWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  } catch {}
  const data = await useWeather();
  if (data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }
  return data;
}
