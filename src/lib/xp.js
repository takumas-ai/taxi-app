// XP・レベル・称号・バッジ・ミッションのロジック

export const XP_ACTIONS = {
  DAILY_REPORT:   10,
  LOGIN_STREAK:    3,
  STREAK_WEEK:    20,
  STREAK_MONTH:  100,
  TARGET_ACHIEVED: 50,
  FIRST_OCR:      30,
  FIRST_AREA:     20,
  FIRST_LOGIN:    10,
};

export const TITLES = [
  { minLevel: 100, name: "神",           color: "#F59E0B" },
  { minLevel:  75, name: "レジェンド",    color: "#EF4444" },
  { minLevel:  50, name: "マスター",      color: "#8B5CF6" },
  { minLevel:  30, name: "エキスパート",  color: "#3B82F6" },
  { minLevel:  20, name: "ベテラン",      color: "#10B981" },
  { minLevel:  10, name: "一人前",        color: "#06B6D4" },
  { minLevel:   5, name: "見習い",        color: "#6366F1" },
  { minLevel:   1, name: "新人",          color: "#9CA3AF" },
];

export const BADGES = [
  { id: "first_login",   icon: "🚗", name: "はじめの一歩",     desc: "アプリに初ログイン",      xp: XP_ACTIONS.FIRST_LOGIN   },
  { id: "first_report",  icon: "📝", name: "初日報",           desc: "初めて日報を投稿",        xp: XP_ACTIONS.DAILY_REPORT  },
  { id: "first_ocr",     icon: "📷", name: "AI活用開始",       desc: "初回OCRを実行",          xp: XP_ACTIONS.FIRST_OCR     },
  { id: "first_area",    icon: "📍", name: "エリア設定",       desc: "所属エリアを設定",        xp: XP_ACTIONS.FIRST_AREA    },
  { id: "streak_7",      icon: "🔥", name: "7日連続",          desc: "7日間連続でログイン",     xp: XP_ACTIONS.STREAK_WEEK   },
  { id: "streak_30",     icon: "⭐", name: "月間パーフェクト", desc: "30日間連続でログイン",    xp: XP_ACTIONS.STREAK_MONTH  },
  { id: "reports_10",    icon: "📊", name: "記録好き",         desc: "日報10回投稿",            xp: 50  },
  { id: "reports_50",    icon: "🎯", name: "記録の達人",       desc: "日報50回投稿",            xp: 200 },
  { id: "reports_100",   icon: "🏆", name: "日報マスター",     desc: "日報100回投稿",           xp: 500 },
  { id: "target_3",      icon: "💰", name: "売上達人",         desc: "月間目標を3回達成",       xp: 150 },
];

// レベルアップに必要なXP（レベルごとに増加）
export function xpForNextLevel(level) {
  return 100 + (level - 1) * 20;
}

// XPからレベル情報を計算
export function levelFromXp(totalXp) {
  let level = 1;
  let remaining = totalXp;
  while (level < 100) {
    const needed = xpForNextLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level++;
  }
  return {
    level,
    xpInLevel:  remaining,
    xpForNext:  xpForNextLevel(level),
    progress:   Math.floor((remaining / xpForNextLevel(level)) * 100),
  };
}

// 称号を取得
export function getTitle(level) {
  return TITLES.find(t => level >= t.minLevel) || TITLES[TITLES.length - 1];
}

// 連続ログイン処理（返り値: { xpGained, newStreak, newBadges }）
export function processLogin(lastActiveDate, streakDays, earnedBadges) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let newStreak = streakDays || 0;
  let xpGained = 0;
  const newBadges = [];

  if (lastActiveDate === today) {
    // 今日すでにログイン済み
    return { xpGained: 0, newStreak, newBadges, alreadyLogged: true };
  }

  if (lastActiveDate === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1; // リセット
  }

  xpGained += XP_ACTIONS.LOGIN_STREAK;

  if (newStreak === 7)  { xpGained += XP_ACTIONS.STREAK_WEEK;  if (!earnedBadges.includes("streak_7"))  newBadges.push("streak_7");  }
  if (newStreak === 30) { xpGained += XP_ACTIONS.STREAK_MONTH; if (!earnedBadges.includes("streak_30")) newBadges.push("streak_30"); }

  return { xpGained, newStreak, newBadges, alreadyLogged: false };
}

// 日報投稿時のXP・バッジ判定
export function processReport(uploadCount, earnedBadges) {
  const count = (uploadCount || 0) + 1;
  let xpGained = XP_ACTIONS.DAILY_REPORT;
  const newBadges = [];

  if (count === 1  && !earnedBadges.includes("first_report"))  { newBadges.push("first_report");  }
  if (count === 10 && !earnedBadges.includes("reports_10"))    { xpGained += 50;  newBadges.push("reports_10");  }
  if (count === 50 && !earnedBadges.includes("reports_50"))    { xpGained += 200; newBadges.push("reports_50");  }
  if (count === 100 && !earnedBadges.includes("reports_100"))  { xpGained += 500; newBadges.push("reports_100"); }

  return { xpGained, newBadges };
}

// ─── ミッション ───────────────────────────────────────

export const MISSIONS = [
  { id: "daily_report",  icon: "📝", name: "今日の日報を投稿する",      xp: 15, type: "daily",  check: (r) => !!r },
  { id: "target_hit",    icon: "💰", name: "売上目標を達成する",         xp: 30, type: "daily",  check: (r, user) => r && parseInt(user.target) > 0 && parseInt(r.gross_sales) >= parseInt(user.target) },
  { id: "ride_20",       icon: "🚗", name: "乗車20回以上を記録する",     xp: 20, type: "daily",  check: (r) => r && (r.ride_count || 0) >= 20 },
  { id: "streak_3",      icon: "🔥", name: "3日連続でログインする",      xp: 50, type: "weekly", check: (_, user) => (user.streakDays || 0) >= 3 },
];

// ミッション状態をlocalStorageから取得（日次リセット付き）
export function getMissionState() {
  const today = new Date().toISOString().slice(0, 10);
  const saved = (() => { try { return JSON.parse(localStorage.getItem("taxi_missions") || "{}"); } catch { return {}; } })();
  if (saved.date !== today) return { date: today, completed: [] };
  return saved;
}

export function saveMissionState(state) {
  localStorage.setItem("taxi_missions", JSON.stringify(state));
}

// 日報保存時にミッション達成チェック（返り値: { xpGained, newCompleted }）
export function checkMissions(report, user, missionState) {
  let xpGained = 0;
  const newCompleted = [];
  for (const m of MISSIONS) {
    if (missionState.completed.includes(m.id)) continue;
    if (m.check(report, user)) {
      xpGained += m.xp;
      newCompleted.push(m.id);
    }
  }
  // 全ミッションクリアボーナス
  const allDone = MISSIONS.every(m => [...missionState.completed, ...newCompleted].includes(m.id));
  const wasAllDone = MISSIONS.every(m => missionState.completed.includes(m.id));
  if (allDone && !wasAllDone) xpGained += 30;

  return { xpGained, newCompleted };
}

// 特定アクションのXP付与
export function processAction(action, earnedBadges) {
  const newBadges = [];
  let xpGained = 0;

  if (action === "first_ocr" && !earnedBadges.includes("first_ocr")) {
    xpGained = XP_ACTIONS.FIRST_OCR;
    newBadges.push("first_ocr");
  }
  if (action === "first_area" && !earnedBadges.includes("first_area")) {
    xpGained = XP_ACTIONS.FIRST_AREA;
    newBadges.push("first_area");
  }
  if (action === "first_login" && !earnedBadges.includes("first_login")) {
    xpGained = XP_ACTIONS.FIRST_LOGIN;
    newBadges.push("first_login");
  }

  return { xpGained, newBadges };
}
