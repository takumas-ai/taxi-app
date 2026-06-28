// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// fetch-events — 東京イベント自動取得
// 毎朝5時にcronから呼ばれる（またはGETで手動実行可能）
// ソース: npb.jp（野球）+ live-events.a-jp.org（コンサート）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ━━━ 会場マスタ（優先度・収容人数・アクセス） ━━━━━━━━━
const VENUE_MASTER: Record<string, { priority: number; capacity: number; access: string }> = {
  "東京ドーム":            { priority: 3, capacity: 45000, access: "◎ 水道橋駅直結" },
  "明治神宮野球場":        { priority: 2, capacity: 30000, access: "◎ 外苑前駅近く" },
  "神 宮":                { priority: 2, capacity: 30000, access: "◎ 外苑前駅近く" },
  "神宮":                  { priority: 2, capacity: 30000, access: "◎ 外苑前駅近く" },
  "有明アリーナ":          { priority: 2, capacity: 15000, access: "△ 臨海エリア" },
  "日本武道館":            { priority: 2, capacity: 14000, access: "◎ 九段下駅近く" },
  "東京ガーデンシアター":  { priority: 2, capacity: 10000, access: "○ 有明ガーデン" },
  "国立代々木競技場":      { priority: 2, capacity: 13000, access: "◎ 原宿駅近く" },
  "東京体育館":            { priority: 2, capacity: 10000, access: "◎ 千駄ヶ谷駅近く" },
  "国立競技場":            { priority: 3, capacity: 60000, access: "○ 信濃町・千駄ヶ谷" },
  "味の素スタジアム":      { priority: 2, capacity: 50000, access: "◎ 飛田給駅直結" },
  "東京国際フォーラム":    { priority: 2, capacity:  5000, access: "◎ 有楽町駅近く" },
  "NHKホール":             { priority: 2, capacity:  3600, access: "◎ 渋谷駅近く" },
  "LINE CUBE SHIBUYA":    { priority: 1, capacity:  1700, access: "◎ 渋谷駅近く" },
  "Zepp":                 { priority: 1, capacity:  2500, access: "○ 各エリア" },
  "TOYOTA ARENA TOKYO":  { priority: 2, capacity:  8000, access: "△ 有明エリア" },
  "Zepp DiverCity":      { priority: 1, capacity:  2500, access: "○ お台場・東京テレポート" },
  "豊洲PIT":             { priority: 1, capacity:  3000, access: "○ 豊洲駅近く" },
  "東京ビッグサイト":    { priority: 3, capacity: 96000, access: "◎ 国際展示場駅直結" },
};

function getVenueInfo(venueName: string) {
  for (const [key, val] of Object.entries(VENUE_MASTER)) {
    if (venueName.includes(key)) return val;
  }
  return { priority: 1, capacity: 1000, access: "○" };
}

// ━━━ 日付ユーティリティ（offsetDays=0で今日、1で明日…） ━━━
function getDateJST(offsetDays = 0): { ymd: string; month: number; year: number; day: number; dow: string } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  now.setDate(now.getDate() + offsetDays);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const DOWS = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = DOWS[now.getDay()];
  return { ymd, month, year, day, dow };
}

// 後方互換
const getTodayJST = () => getDateJST(0);

// ━━━ NPB 野球スクレイピング ━━━━━━━━━━━━━━━━━━━
async function fetchBaseballEvents(today: ReturnType<typeof getTodayJST>) {
  const events: EventRow[] = [];
  const url = `https://npb.jp/games/${today.year}/schedule_${String(today.month).padStart(2, "0")}_detail.html`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return events;
    const html = await res.text();

    // 今日の日付パターン（例: 6/20（土））
    const datePattern = `${today.month}/${today.day}（${today.dow}）`;

    // テーブル行を正規表現で解析
    // 試合の行パターン: 球場名と時間を含む
    const TOKYO_VENUES = ["東京ドーム", "神 宮", "明治神宮野球場"];

    // 今日のセクションを見つける
    const dateIdx = html.indexOf(datePattern);
    if (dateIdx === -1) return events;

    // 次の日付セクションまで
    const nextDatePattern = /\d+\/\d+（[日月火水木金土]）/g;
    nextDatePattern.lastIndex = dateIdx + datePattern.length;
    const nextMatch = nextDatePattern.exec(html);
    const sectionEnd = nextMatch ? nextMatch.index : dateIdx + 3000;
    const section = html.slice(dateIdx, sectionEnd);

    // 試合行を抽出: 球団名と球場・時刻
    const gameRowReg = /href="[^"]+scores[^"]+"[^>]*>([^<]+)<\/a>\s*[^<]*<\/a>[\s\S]*?([東京ドーム|神 宮|神宮|明治神宮][^)]*)\s+(\d+:\d+)/g;

    // より単純なアプローチ: テキストから東京会場行を検索
    const lines = section.split("\n").map(l => l.trim()).filter(Boolean);
    let currentMatch = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 球団の対戦を探す（ハイフンまたはスコアを含む行）
      if ((line.includes("vs") || line.includes("-") || line.includes("巨人") || line.includes("ヤクルト")) && i + 2 < lines.length) {
        // 次の行に球場情報があるか確認
      }
      for (const venue of TOKYO_VENUES) {
        if (line.includes(venue)) {
          // この行の前後から試合情報を取得
          const timeMatch = line.match(/(\d+:\d+)/);
          const time = timeMatch ? timeMatch[1] : "18:00";

          // 前後のコンテキストから対戦カードを取得
          const context = lines.slice(Math.max(0, i - 3), i + 1).join(" ");
          const teams = extractTeams(context);
          const displayVenue = venue === "神 宮" ? "明治神宮野球場" : venue;

          if (teams) {
            const venueInfo = getVenueInfo(displayVenue);
            events.push({
              event_date: today.ymd,
              title: `⚾ ${teams}`,
              venue: displayVenue,
              start_time: time,
              event_type: "baseball",
              estimated_capacity: venueInfo.capacity,
              priority: venueInfo.priority,
              access_info: venueInfo.access,
            });
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error("[fetch-events] NPB fetch error:", e);
  }

  // HTMLから直接パースする別アプローチ（バックアップ）
  if (events.length === 0) {
    await fetchBaseballEventsAlt(today, events);
  }

  return events;
}

function extractTeams(context: string): string | null {
  // チーム名のパターン
  const teams = ["巨人", "阪神", "中日", "ヤクルト", "DeNA", "広島", "ソフトバンク", "日本ハム", "楽天", "ロッテ", "オリックス", "西武"];
  const found: string[] = [];
  for (const team of teams) {
    if (context.includes(team)) found.push(team);
  }
  if (found.length >= 2) return `${found[0]} vs ${found[1]}`;
  if (found.length === 1) return found[0];
  return null;
}

// NPB バックアップパース（テーブルのtd構造から）
async function fetchBaseballEventsAlt(today: ReturnType<typeof getTodayJST>, events: EventRow[]) {
  try {
    const url = `https://npb.jp/games/${today.year}/schedule_${String(today.month).padStart(2, "0")}_detail.html`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return;
    const html = await res.text();

    const dateStr = `${today.month}/${today.day}（${today.dow}）`;
    const dateIdx = html.indexOf(dateStr);
    if (dateIdx === -1) return;

    // 次の日付まで
    const rest = html.slice(dateIdx, dateIdx + 5000);

    // 東京ドームの試合
    if (rest.includes("東京ドーム")) {
      const timeMatch = rest.match(/東京ドーム[\s\S]{1,50}?(\d+:\d+)/);
      const time = timeMatch ? timeMatch[1] : "18:00";

      // チームを検索
      const teams = extractTeamFromSection(rest, "東京ドーム");
      if (teams) {
        const venueInfo = getVenueInfo("東京ドーム");
        events.push({
          event_date: today.ymd,
          title: `⚾ ${teams}`,
          venue: "東京ドーム",
          start_time: time,
          event_type: "baseball",
          estimated_capacity: venueInfo.capacity,
          priority: venueInfo.priority,
          access_info: venueInfo.access,
        });
      }
    }

    // 神宮球場の試合
    if (rest.includes("神 宮") || rest.includes("神宮")) {
      const timeMatch = rest.match(/神\s*宮[\s\S]{1,50}?(\d+:\d+)/);
      const time = timeMatch ? timeMatch[1] : "18:00";
      const teams = extractTeamFromSection(rest, "神");
      if (teams) {
        const venueInfo = getVenueInfo("神宮");
        events.push({
          event_date: today.ymd,
          title: `⚾ ${teams}`,
          venue: "明治神宮野球場",
          start_time: time,
          event_type: "baseball",
          estimated_capacity: venueInfo.capacity,
          priority: venueInfo.priority,
          access_info: venueInfo.access,
        });
      }
    }
  } catch (e) {
    console.error("[fetch-events] Alt parse error:", e);
  }
}

function extractTeamFromSection(html: string, venueKeyword: string): string | null {
  const venueIdx = html.indexOf(venueKeyword);
  if (venueIdx === -1) return null;

  // 前後2000文字を対象
  const start = Math.max(0, venueIdx - 500);
  const section = html.slice(start, venueIdx + 500);

  const TEAM_NAMES: Record<string, string> = {
    "巨人": "巨人", "ジャイアンツ": "巨人",
    "阪神": "阪神", "タイガース": "阪神",
    "中日": "中日", "ドラゴンズ": "中日",
    "ヤクルト": "ヤクルト",
    "DeNA": "DeNA", "ベイスターズ": "DeNA",
    "広島": "広島", "カープ": "広島",
    "ソフトバンク": "ソフトバンク", "ホークス": "ソフトバンク",
    "日本ハム": "日本ハム", "ファイターズ": "日本ハム",
    "楽天": "楽天", "イーグルス": "楽天",
    "ロッテ": "ロッテ", "マリーンズ": "ロッテ",
    "オリックス": "オリックス", "バファローズ": "オリックス",
    "西武": "西武", "ライオンズ": "西武",
  };

  const found: string[] = [];
  for (const [key, name] of Object.entries(TEAM_NAMES)) {
    if (section.includes(key) && !found.includes(name)) {
      found.push(name);
    }
  }

  if (found.length >= 2) return `${found[0]} vs ${found[1]}`;
  return null;
}

// ━━━ ライブ・コンサートスクレイピング ━━━━━━━━━━━━
// live-events.a-jp.org:
//   一覧ページ → 今日のイベントURLを収集 → 詳細ページで開演時刻を取得
async function fetchConcertEvents(today: ReturnType<typeof getTodayJST>) {
  const events: EventRow[] = [];

  const todayMD = `${today.month}/${today.day}`;   // e.g. "6/21"
  const yearStr = `${today.year}年 日程`;            // e.g. "2026年 日程"

  try {
    const res = await fetch("https://live-events.a-jp.org/soko/prf/13.html", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!res.ok) return events;
    const html = await res.text();

    // 当該年のセクションだけを対象にする（前年データと混在しないよう）
    const yearIdx = html.indexOf(yearStr);
    const searchHtml = yearIdx !== -1 ? html.slice(yearIdx) : html;

    // 生HTMLをラインごとに走査してURLを抽出
    const candidates: Array<{ title: string; venue: string; detailUrl: string }> = [];
    const rawLines = searchHtml.split("\n");

    for (let i = 0; i < rawLines.length; i++) {
      const lineText = rawLines[i].replace(/<[^>]+>/g, "").trim();

      // 今日の日付(M/D)を含む日付行か？
      if (!lineText.includes(todayMD) || !lineText.match(/\d+\/\d+/)) continue;

      let title = "";
      let venue = "";
      let detailUrl = "";

      for (let j = i + 1; j < Math.min(i + 10, rawLines.length); j++) {
        const jRaw  = rawLines[j];
        const jText = jRaw.replace(/<[^>]+>/g, "").trim();

        if (!jText) continue;
        // 次の日付行に入ったら終了
        if (jText.match(/^\d+\/\d+[（(]/) && !jText.includes(todayMD)) break;

        if (!title && jText.length > 3
            && !jText.includes("詳細") && !jText.includes("ホテル")
            && !jText.includes("（東京都）")) {
          title = jText;
        } else if (title && !venue && jText.includes("（東京都）")) {
          venue = jText.replace("（東京都）", "").trim();
        }

        if (!detailUrl) {
          const m = jRaw.match(/href="(https:\/\/live-events\.a-jp\.org\/soko\/evg\/\d+\.html)"/);
          if (m) detailUrl = m[1];
        }

        if (title && venue && detailUrl) break;
      }

      if (title && venue && detailUrl && !candidates.some(c => c.detailUrl === detailUrl)) {
        candidates.push({ title, venue, detailUrl });
      }
    }

    if (candidates.length === 0) return events;

    // 詳細ページを並列フェッチして開演時刻を取得（最大8件）
    const results = await Promise.allSettled(
      candidates.slice(0, 8).map(async ({ title, venue, detailUrl }) => {
        try {
          const r = await fetch(detailUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(7000),
          });
          if (!r.ok) return null;
          const dHtml = await r.text();

          // 終了済みイベントは除外
          if (dHtml.includes("このイベントは終了しました")) return null;

          const dText = dHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

          // 今日の日付付近で開演時刻を検索
          const dayIdx = dText.indexOf(todayMD);
          const searchRange = dayIdx !== -1
            ? dText.slice(dayIdx, dayIdx + 300)
            : dText;

          const timeMatch =
            searchRange.match(/(\d{1,2}:\d{2})\s*開演/) ??
            searchRange.match(/開演\s*[：:]\s*(\d{1,2}:\d{2})/) ??
            searchRange.match(/START\s*[：:]\s*(\d{1,2}:\d{2})/i) ??
            dText.match(/(\d{1,2}:\d{2})\s*開演/);

          return timeMatch ? { title, venue, startTime: timeMatch[1] } : null;
        } catch {
          return null;
        }
      }),
    );

    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const { title, venue, startTime } = r.value;
      const venueInfo = getVenueInfo(venue);
      events.push({
        event_date: today.ymd,
        title: `🎵 ${title}`,
        venue,
        start_time: startTime,
        event_type: "concert",
        estimated_capacity: venueInfo.capacity,
        priority: venueInfo.priority,
        access_info: venueInfo.access,
      });
    }
  } catch (e) {
    console.error("[fetch-events] Concert fetch error:", e);
  }

  return events;
}

// ━━━ Jリーグ スクレイピング ━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchJLeagueEvents(today: ReturnType<typeof getDateJST>): Promise<EventRow[]> {
  const events: EventRow[] = [];

  const TOKYO_SOCCER_VENUES: Record<string, { venue: string; capacity: number; access: string }> = {
    "味の素スタジアム":  { venue: "味の素スタジアム", capacity: 50000, access: "◎ 飛田給駅直結" },
    "国立競技場":        { venue: "国立競技場",       capacity: 60000, access: "○ 信濃町・千駄ヶ谷" },
    "国立":             { venue: "国立競技場",        capacity: 60000, access: "○ 信濃町・千駄ヶ谷" },
  };

  const J_TEAMS = [
    "FC東京","東京ヴェルディ","東京V","川崎フロンターレ","川崎F",
    "横浜FM","横浜F","浦和レッズ","浦和","鹿島アントラーズ","鹿島",
    "柏レイソル","柏","ガンバ大阪","G大阪","セレッソ大阪","C大阪",
    "名古屋グランパス","名古屋","ヴィッセル神戸","神戸","サンフレッチェ広島","広島",
    "ジュビロ磐田","磐田","アルビレックス新潟","新潟","アビスパ福岡","福岡",
    "京都サンガ","京都","湘南ベルマーレ","湘南","横浜FC","町田ゼルビア","町田",
  ];

  // Yahoo Sports Jリーグ日程
  try {
    const url = `https://sports.yahoo.co.jp/soccer/jleague/game/list/?period=${today.ymd}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (res.ok) {
      const html = await res.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                       .replace(/<style[\s\S]*?<\/style>/gi, "")
                       .replace(/<[^>]+>/g, " ")
                       .replace(/\s+/g, " ");

      for (const [key, info] of Object.entries(TOKYO_SOCCER_VENUES)) {
        if (!text.includes(key)) continue;
        const idx = text.indexOf(key);
        const ctx = text.slice(Math.max(0, idx - 400), idx + 400);

        const timeMatch = ctx.match(/(\d{1,2}:\d{2})/);
        if (!timeMatch) continue;

        const foundTeams: string[] = [];
        for (const t of J_TEAMS) {
          if (ctx.includes(t) && !foundTeams.some(f => f.includes(t.slice(0, 3)))) {
            foundTeams.push(t);
            if (foundTeams.length >= 2) break;
          }
        }

        const title = foundTeams.length >= 2
          ? `⚽ ${foundTeams[0]} vs ${foundTeams[1]}`
          : `⚽ Jリーグ（${info.venue}）`;

        if (!events.some(e => e.title === title)) {
          events.push({
            event_date: today.ymd,
            title,
            venue: info.venue,
            start_time: timeMatch[1],
            event_type: "sports",
            estimated_capacity: info.capacity,
            priority: 3,
            access_info: info.access,
          });
        }
      }
    }
  } catch (e) {
    console.error("[fetch-events] J-League Yahoo error:", e);
  }

  // Jリーグ公式（バックアップ）
  try {
    const url = `https://www.jleague.jp/match/search/?competition_frame_ids=1&fiscal_year=${today.year}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (res.ok) {
      const html = await res.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                       .replace(/<[^>]+>/g, " ")
                       .replace(/\s+/g, " ");

      for (const [key, info] of Object.entries(TOKYO_SOCCER_VENUES)) {
        if (!text.includes(key)) continue;
        if (!text.includes(today.ymd) && !text.includes(`${today.month}/${today.day}`)) continue;

        const idx = text.indexOf(key);
        const ctx = text.slice(Math.max(0, idx - 500), idx + 500);
        const timeMatch = ctx.match(/(\d{2}:\d{2})/);
        if (!timeMatch) continue;

        const foundTeams: string[] = [];
        for (const t of J_TEAMS) {
          if (ctx.includes(t) && !foundTeams.some(f => f.includes(t.slice(0, 3)))) {
            foundTeams.push(t);
            if (foundTeams.length >= 2) break;
          }
        }

        const title = foundTeams.length >= 2
          ? `⚽ ${foundTeams[0]} vs ${foundTeams[1]}`
          : `⚽ Jリーグ（${info.venue}）`;

        if (!events.some(e => e.title === title)) {
          events.push({
            event_date: today.ymd,
            title,
            venue: info.venue,
            start_time: timeMatch[1],
            event_type: "sports",
            estimated_capacity: info.capacity,
            priority: 3,
            access_info: info.access,
          });
        }
      }
    }
  } catch (e) {
    console.error("[fetch-events] J-League official error:", e);
  }

  return events;
}

// ━━━ 主要会場ページ スクレイピング ━━━━━━━━━━━━━━━━━━━━━
// 武道館・有明アリーナなど会場公式サイトから時刻付きイベントを取得
async function fetchVenueSchedules(today: ReturnType<typeof getDateJST>): Promise<EventRow[]> {
  const events: EventRow[] = [];

  // 今日の日付の主な表記パターン
  const yy = today.year;
  const mm = String(today.month).padStart(2, "0");
  const dd = String(today.day).padStart(2, "0");
  const datePats = [
    today.ymd,                         // 2026-06-21
    `${yy}/${mm}/${dd}`,               // 2026/06/21
    `${yy}.${mm}.${dd}`,               // 2026.06.21
    `${yy}年${today.month}月${today.day}日`, // 2026年6月21日
    `${today.month}/${today.day}`,     // 6/21
    `${today.month}月${today.day}日`,  // 6月21日
  ];

  // 時刻を取得するヘルパー
  function findStartTime(text: string): string | null {
    const m = text.match(/(?:開演|START|start)\s*[：:]\s*(\d{1,2}:\d{2})/i)
           ?? text.match(/(?:開演|START|start)\s+(\d{1,2}:\d{2})/i)
           ?? text.match(/(\d{1,2}:\d{2})\s*(?:開演|START)/i);
    if (m) return m[1];
    // フォールバック: 最初の時刻（HH:MM形式、17:00〜22:00の範囲で公演時刻らしいもの）
    const all = [...text.matchAll(/(\d{1,2}:\d{2})/g)].map(x => x[1]);
    return all.find(t => {
      const h = parseInt(t.split(":")[0]);
      return h >= 12 && h <= 21;
    }) ?? all[0] ?? null;
  }

  // イベントタイトルを取得するヘルパー
  function extractTitle(section: string): string | null {
    const cleaned = section
      .replace(/\d{4}[年/.]\d{1,2}[月/.]\d{1,2}日?/g, " ")
      .replace(/[（(][日月火水木金土][）)]/g, " ")
      .replace(/\d{1,2}:\d{2}/g, " ")
      .replace(/開場|開演|OPEN|START|CLOSE|SOLD\s*OUT|売り切れ/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    // 5文字以上の意味のある単語を取得
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !/^[\d\W]+$/.test(w));
    return words.length > 0 ? words.slice(0, 6).join(" ").slice(0, 60) : null;
  }

  const VENUE_URLS: Array<{
    url: string;
    venueName: string;
    venueKey: string;
  }> = [
    // ── 都心・九段 ──────────────────────────────────────
    { url: "https://www.nipponbudokan.or.jp/schedule/",                   venueName: "日本武道館",         venueKey: "日本武道館" },
    // ── 有明・お台場エリア ────────────────────────────
    { url: "https://www.ariake-arena.com/schedule/",                      venueName: "有明アリーナ",        venueKey: "有明アリーナ" },
    { url: "https://www.toyota-arena-tokyo.jp/schedule/",                 venueName: "TOYOTA ARENA TOKYO", venueKey: "TOYOTA ARENA TOKYO" },
    { url: "https://www.zepp.co.jp/hall/zepp-divercity-tokyo/schedule/",  venueName: "Zepp DiverCity",     venueKey: "Zepp DiverCity" },
    // ── 豊洲エリア ────────────────────────────────────
    { url: "https://toyosupit.jp/schedule/",                              venueName: "豊洲PIT",             venueKey: "豊洲PIT" },
    // ── 国際展示場（ビッグサイト） ─────────────────────
    { url: "https://www.bigsight.jp/events/calendar/",                    venueName: "東京ビッグサイト",    venueKey: "東京ビッグサイト" },
    // ── 原宿・渋谷 ────────────────────────────────────
    { url: "https://tokyogardentg.com/schedule/",                         venueName: "東京ガーデンシアター", venueKey: "東京ガーデンシアター" },
  ];

  for (const { url, venueName, venueKey } of VENUE_URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      for (const pat of datePats) {
        const idx = html.indexOf(pat);
        if (idx === -1) continue;

        const raw = html.slice(idx, idx + 800);
        const section = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        // ビッグサイト等の展示会は開場時間（10:00）をデフォルトにする
        const isBigSight = venueName.includes("ビッグサイト");
        const startTime = findStartTime(section) ?? (isBigSight ? "10:00" : null);
        if (!startTime) continue;

        const titleRaw = extractTitle(section);
        const title = (titleRaw && titleRaw.length >= 3)
          ? titleRaw
          : `イベント（${venueName}）`;

        if (!events.some(e => e.venue === venueName && e.start_time === startTime)) {
          const venueInfo = getVenueInfo(venueKey);
          const eventType = isBigSight ? "other" : "concert";
          const emoji = isBigSight ? "🏛️" : "🎵";
          events.push({
            event_date: today.ymd,
            title: `${emoji} ${title}`,
            venue: venueName,
            start_time: startTime,
            event_type: eventType,
            estimated_capacity: venueInfo.capacity,
            priority: venueInfo.priority,
            access_info: venueInfo.access,
          });
        }
        break; // 1会場につき最初にヒットした日付で1件
      }
    } catch (e) {
      console.error(`[fetch-events] ${venueName} error:`, e);
    }
  }

  return events;
}

// ━━━ イベント型定義 ━━━━━━━━━━━━━━━━━━━━━━━━━━
interface EventRow {
  event_date: string;
  title: string;
  venue: string;
  start_time: string | null;
  event_type: "baseball" | "concert" | "sports" | "other";
  estimated_capacity: number;
  priority: number;  // 1=低 2=中 3=高
  access_info: string;
}

// ━━━ メインハンドラ ━━━━━━━━━━━━━━━━━━━━━━━━━━
Deno.serve(async (req) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // ?date=YYYY-MM-DD が指定されたらその1日だけ取得、なければ今日〜3日分
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    let targetDates: ReturnType<typeof getDateJST>[];
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      // 特定日指定
      const [y, m, d] = dateParam.split("-").map(Number);
      const DOWS = ["日", "月", "火", "水", "木", "金", "土"];
      const dt = new Date(y, m - 1, d);
      targetDates = [{ ymd: dateParam, year: y, month: m, day: d, dow: DOWS[dt.getDay()] }];
    } else {
      // デフォルト: 今日・明日・明後日
      targetDates = [getDateJST(0), getDateJST(1), getDateJST(2)];
    }

    const results: { date: string; count: number }[] = [];

    for (const dateInfo of targetDates) {
      console.log(`[fetch-events] 取得日: ${dateInfo.ymd}`);

      const [baseballEvents, concertEvents, jleagueEvents, venueEvents] = await Promise.all([
        fetchBaseballEvents(dateInfo),
        fetchConcertEvents(dateInfo),
        fetchJLeagueEvents(dateInfo),
        fetchVenueSchedules(dateInfo),
      ]);

      // start_timeなし（時間不明）のイベントは除外
      const allEvents = [...baseballEvents, ...concertEvents, ...jleagueEvents, ...venueEvents]
        .filter(e => e.start_time !== null);
      allEvents.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.estimated_capacity - a.estimated_capacity;
      });

      console.log(`[fetch-events] ${dateInfo.ymd}: ${allEvents.length}件`);

      if (allEvents.length > 0) {
        await supabase.from("events").delete().eq("event_date", dateInfo.ymd);
        const { error } = await supabase.from("events").insert(allEvents);
        if (error) {
          console.error("[fetch-events] DB insert error:", error);
        } else {
          results.push({ date: dateInfo.ymd, count: allEvents.length });
        }
      } else {
        results.push({ date: dateInfo.ymd, count: 0 });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[fetch-events] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
