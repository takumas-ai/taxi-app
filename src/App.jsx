// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App.jsx — メインエントリーポイント
// React Native 移行時: この App.jsx を App.js にリネームし
//   <div> → <View>、inline style → StyleSheet に置換する
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, loadS, saveS, applyTheme, computeIsDark } from "./lib/constants";
import { sanitizeProfile, isValidEmail, isValidPassword } from "./lib/validate";
import { INITIAL_REPORTS, ALL_AREAS, AREA_MASTER } from "./data/mockData";
import { processLogin, processReport, processAction, levelFromXp, checkMissions, getMissionState, saveMissionState } from "./lib/xp";
import {
  supabase,
  signUpWithEmail,
  signInWithEmail,
  signOut,
  onAuthStateChange,
  fetchProfile,
  upsertProfile,
  insertProfile,
  fetchReports,
  insertReport,
  updateReport,
  saveReferredBy,
} from "./lib/supabase";

// Screens
import Dashboard          from "./screens/Dashboard";
import ReportList, { ReportModal } from "./screens/ReportList";
import UploadScreen       from "./screens/Upload";
import InfoCenter         from "./screens/InfoCenter";
import GuideScreen        from "./screens/Guide";
import ShiftScreen        from "./screens/Shift";
import Settings           from "./screens/Settings";
import OnboardingScreen   from "./screens/Onboarding";
import CommunityScreen    from "./screens/Community";
import AdminScreen        from "./screens/Admin";

// Components
import { BottomNav, Header, TakuroFAB } from "./components/Navigation";
import { AreaSettingModal }  from "./components/AreaFilter";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase が未設定かどうかを判定
// → 未設定の場合はデモモード（localStorage）で動作
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ログイン画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoginScreen({ onLogin }) {
  const [step, setStep]   = useState("top");
  const [form, setForm]   = useState({ name:"", email:"", password:"", company:"", workType:"隔日勤務", target:"380000" });
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const toggleArea = a => setAreas(prev => prev.includes(a) ? prev.filter(x=>x!==a) : [...prev,a]);

  // URLの ?ref= パラメータを取得（招待リンク経由の場合）
  const refFromUrl = new URLSearchParams(window.location.search).get("ref") || "";

  // Supabase メール登録
  const doRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError("名前・メール・パスワードは必須です"); return; }
    if (!isValidEmail(form.email)) { setError("正しいメールアドレスを入力してください"); return; }
    if (!isValidPassword(form.password)) { setError("パスワードは6文字以上で入力してください"); return; }
    setLoading(true); setError("");
    if (SUPABASE_READY) {
      const { data, error: err } = await signUpWithEmail(form.email, form.password);
      if (err) { setError(err.message); setLoading(false); return; }
      // usersテーブルを更新（トリガーで基本行は作成済み）
      if (data.user) {
        const profileData = {
          id: data.user.id,
          ...sanitizeProfile({
            name: form.name, company_name: form.company,
            work_type: form.workType, areas,
            monthly_target: parseInt(form.target) || 380000,
          }),
        };
        // 紹介コード経由なら referred_by を保存
        if (refFromUrl) profileData.referred_by = refFromUrl.toUpperCase();
        await insertProfile(profileData);
        onLogin({ id: data.user.id, name: form.name, company: form.company, workType: form.workType, target: form.target, plan:"free", uploadCount:0, areas });
      }
    } else {
      // Supabase未設定時はローカルで動作
      await new Promise(r=>setTimeout(r,700));
      onLogin({ id: "local_" + Date.now(), ...form, plan:"free", uploadCount:0, areas });
    }
    setLoading(false);
  };

  // Supabase メールログイン
  const doLogin = async () => {
    if (!form.email || !form.password) { setError("メールとパスワードを入力してください"); return; }
    setLoading(true); setError("");
    const { data, error: err } = await signInWithEmail(form.email, form.password);
    if (err) { setError(err.message); setLoading(false); return; }
    if (data.user) {
      const { data: profile } = await fetchProfile(data.user.id);
      // 既存ユーザーのログインなのでオンボーディング済みにする
      localStorage.setItem("taxi_onboarding_done", "true");
      onLogin({
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || data.user.email,
        company: profile?.company_name || "",
        workType: profile?.work_type || "隔日勤務",
        target: String(profile?.monthly_target || 380000),
        plan: profile?.plan || "free",
        uploadCount: profile?.monthly_upload_count || 0,
        areas: profile?.areas || [],
        _returningUser: true,
      });
    }
    setLoading(false);
  };

  const inputStyle = { width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:15, outline:"none" };
  const btnPrimary = { width:"100%", padding:"14px 0", borderRadius:11, fontSize:15, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" };
  const btnGhost   = { width:"100%", padding:"14px 0", borderRadius:11, fontSize:15, fontWeight:700, cursor:"pointer", backgroundColor:"transparent", color:C.sub, border:`1px solid ${C.border}` };

  return (
    <div style={{ minHeight:"100vh", backgroundColor:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Inter','Hiragino Sans',sans-serif", color:C.text }}>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:52, marginBottom:8 }}>🦉</div>
        <div style={{ fontSize:28, fontWeight:900, color:C.text, letterSpacing:"-1px" }}>タクロー</div>
        <div style={{ fontSize:13, color:C.muted, marginTop:6, fontStyle:"italic" }}>勘と経験を、データに変える。</div>
      </div>

      {error && <div style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:C.red, maxWidth:360, width:"100%" }}>{error}</div>}

      {/* トップ */}
      {step === "top" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          <button onClick={()=>setStep("login")} style={{ ...btnPrimary, marginBottom:12 }}>ログイン</button>
          <button onClick={()=>setStep("register")} style={{ ...btnGhost }}>新規登録</button>
        </div>
      )}

      {/* メールログイン */}
      {step === "login" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:18, textAlign:"center" }}>ログイン</div>
          {[{l:"メールアドレス",k:"email",t:"email",ph:"taxi@example.com"},{l:"パスワード",k:"password",t:"password",ph:""}].map(({l,k,t,ph})=>(
            <div key={k} style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{l}</div>
              <input type={t} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={inputStyle}/>
            </div>
          ))}
          <button onClick={doLogin} disabled={loading} style={{ ...btnPrimary, opacity:loading?0.5:1, marginBottom:10 }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
          <button onClick={()=>setStep("top")} style={btnGhost}>戻る</button>
        </div>
      )}

      {/* 新規登録 */}
      {step === "register" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:18, textAlign:"center" }}>アカウント登録</div>
          {[
            {l:"お名前",k:"name",t:"text",ph:"田中 義人"},
            ...(SUPABASE_READY ? [
              {l:"メールアドレス",k:"email",t:"email",ph:"taxi@example.com"},
              {l:"パスワード（6文字以上）",k:"password",t:"password",ph:""},
            ] : []),
          ].map(({l,k,t,ph})=>(
            <div key={k} style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{l}</div>
              <input type={t} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={inputStyle}/>
            </div>
          ))}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>勤務形態</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {["日勤","夜勤","隔日勤務","個人タクシー"].map(t=>(
                <div key={t} onClick={()=>setForm(p=>({...p,workType:t}))} style={{ padding:"9px 0", textAlign:"center", borderRadius:9, border:`2px solid ${form.workType===t?C.accentLight:C.border}`, color:form.workType===t?C.accentLight:C.muted, fontSize:13, fontWeight:form.workType===t?700:400, cursor:"pointer" }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>📍 所属エリア（複数可）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {ALL_AREAS.map(a=>{
                const meta=AREA_MASTER[a], isOn=areas.includes(a);
                return <div key={a} onClick={()=>toggleArea(a)} style={{ padding:"10px 0", textAlign:"center", borderRadius:10, border:`2px solid ${isOn?meta.color:C.border}`, backgroundColor:isOn?meta.color+"15":"transparent", cursor:"pointer" }}><div style={{ fontSize:16 }}>{meta.emoji}</div><div style={{ fontSize:12, fontWeight:isOn?700:400, color:isOn?meta.color:C.muted }}>{a}</div></div>;
              })}
            </div>
          </div>
          <button onClick={doRegister} disabled={!form.name||loading} style={{ ...btnPrimary, opacity:!form.name||loading?0.5:1, marginBottom:10 }}>
            {loading ? "登録中..." : "登録して始める"}
          </button>
          <button onClick={()=>setStep("top")} style={btnGhost}>戻る</button>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Root App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初回起動同意画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ConsentScreen({ onAgree }) {
  const [checked, setChecked] = useState(false);
  const s = {
    wrap: { minHeight:"100vh", backgroundColor:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Inter','Hiragino Sans',sans-serif", color:C.text },
    title: { fontSize:22, fontWeight:900, color:C.text, marginBottom:6 },
    sub: { fontSize:13, color:C.muted, marginBottom:28, textAlign:"center" },
    box: { width:"100%", maxWidth:360, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20, marginBottom:20, fontSize:12, color:C.sub, lineHeight:1.9, maxHeight:280, overflowY:"auto" },
    row: { display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", maxWidth:360, marginBottom:24 },
    chk: { width:22, height:22, borderRadius:6, border:`2px solid ${checked?C.accentLight:C.border}`, backgroundColor:checked?C.accentLight:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 },
    btn: { width:"100%", maxWidth:360, padding:"14px 0", borderRadius:12, fontSize:16, fontWeight:800, cursor:"pointer", border:"none", backgroundColor:checked?C.accentLight:"#444", color:checked?"#fff":"#888" },
  };
  return (
    <div style={s.wrap}>
      <div style={{ fontSize:44, marginBottom:10 }}>🦉</div>
      <div style={s.title}>タクローへようこそ</div>
      <div style={s.sub}>利用開始の前に、ご確認ください</div>

      <div style={s.box}>
        <div style={{ fontWeight:700, color:C.text, marginBottom:10 }}>利用規約・プライバシーポリシーの要点</div>
        <div>• 本アプリはタクシードライバーの業務記録管理ツールです。</div>
        <div>• 収益・健康・労働環境への影響について運営者は責任を負いません。</div>
        <div>• ランキングは参考情報です。無理な営業や過労運転を推奨しません。</div>
        <div>• 疲労時は必ず休憩を取り、安全を最優先にしてください。</div>
        <div>• 日報画像はAI読み取り後、数値データのみ保存されます（画像は保存しません）。</div>
        <div>• 個人を特定できない匿名データは統計に使用されることがあります。</div>
        <div>• データの改ざん・虚偽入力はアカウント停止の対象になります。</div>
        <div>• サービスは予告なく変更・終了することがあります。</div>
        <div style={{ marginTop:10 }}>詳細は設定画面の「利用規約」「プライバシーポリシー」でご確認いただけます。</div>
      </div>

      <div style={s.row} onClick={()=>setChecked(p=>!p)}>
        <div style={s.chk}>{checked && <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>✓</span>}</div>
        <div style={{ fontSize:13, color:C.sub, lineHeight:1.7 }}>利用規約およびプライバシーポリシーを読み、内容に同意します</div>
      </div>

      <button onClick={()=>{ if(checked) onAgree(); }} style={s.btn} disabled={!checked}>
        同意してはじめる
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser]         = useState(() => loadS("taxi_user", null));
  // "standard" は旧モード名 → "simple" にマッピング
  const [appMode, setAppMode]   = useState(() => { const m = loadS("taxi_app_mode","simple"); return m === "standard" ? "simple" : m; });
  const [themeMode, setThemeMode] = useState(() => loadS("taxi_theme_mode","auto"));
  const [themeVer, setThemeVer] = useState(0); // テーマ変更時に全体を再描画させるカウンター
  const [consentDone, setConsentDone]       = useState(() => !!loadS("taxi_consent_done", false));
  const [onboardingDone, setOnboardingDone] = useState(() => !!loadS("taxi_onboarding_done", false));
  const [reports, setReports]   = useState(() => loadS("taxi_reports", INITIAL_REPORTS));
  const [tab, setTab]           = useState(() => {
    const saved = loadS("taxi_last_tab", "dashboard");
    // adminタブはリロード後に復元しない（セキュリティ）
    return ["dashboard","list","upload","info","guide","shift","settings","community"].includes(saved) ? saved : "dashboard";
  });
  const [alertsSeen, setAlertsSeen]   = useState(() => loadS("taxi_alerts_seen", false));
  const [settingsSection, setSettingsSection] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(false);
  const [notif, setNotif]       = useState(() => loadS("taxi_notif", { delays:true, events:false, traffic:false, dailyTip:false, achievement:true, dailyResult:false }));
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [authReady, setAuthReady] = useState(!SUPABASE_READY);

  // ─── Supabase 認証セッション復元 ───
  useEffect(() => {
    if (!SUPABASE_READY) return;

    // 既存セッションを確認
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await fetchProfile(session.user.id);
        if (profile) {
          const loginResult = processLogin(
            profile.last_active_date,
            profile.streak_days || 0,
            profile.badges || []
          );
          const nextXp      = (profile.xp || 0) + loginResult.xpGained;
          const nextBadges  = [...new Set([...(profile.badges || []), ...loginResult.newBadges])];
          const today       = new Date().toISOString().slice(0, 10);
          if (!loginResult.alreadyLogged) {
            upsertProfile({ id: session.user.id, xp: nextXp, streak_days: loginResult.newStreak, last_active_date: today, badges: nextBadges });
          }
          // セッション復元 = 既存ユーザーなのでオンボーディング済みにする
          localStorage.setItem("taxi_onboarding_done", "true");
          setOnboardingDone(true);
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile.name,
            company: profile.company_name || "",
            workType: profile.work_type || "隔日勤務",
            target: String(profile.monthly_target || 380000),
            plan: profile.plan || "free",
            uploadCount: profile.monthly_upload_count || 0,
            areas: profile.areas || [],
            xp: nextXp,
            streakDays: loginResult.newStreak,
            badges: nextBadges,
          });
          // Supabaseから日報を取得
          const { data: reps } = await fetchReports(session.user.id);
          if (reps?.length) setReports(reps.map(r => ({ ...r, date: r.report_date })));
        }
      }
      setAuthReady(true);
    });

    // 認証状態の変化を監視
    const { data: { subscription } } = onAuthStateChange(session => {
      if (!session) { setUser(null); setReports(INITIAL_REPORTS); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── ローカル保存（Supabase未設定時） ───
  useEffect(() => { if (!SUPABASE_READY) saveS("taxi_reports", reports); }, [reports]);
  useEffect(() => { if (!SUPABASE_READY) saveS("taxi_user", user); }, [user]);
  useEffect(() => { saveS("taxi_app_mode", appMode); }, [appMode]);

  // ─── テーマ管理 ───
  useEffect(() => {
    saveS("taxi_theme_mode", themeMode);
    applyTheme(computeIsDark(themeMode));
    setThemeVer(v => v + 1);
  }, [themeMode]);

  // autoモード: 1分ごとに日没チェック
  useEffect(() => {
    if (themeMode !== "auto") return;
    const tick = () => {
      applyTheme(computeIsDark("auto"));
      setThemeVer(v => v + 1);
    };
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [themeMode]);
  useEffect(() => saveS("taxi_notif", notif), [notif]);
  useEffect(() => { if (user && (!user.areas || user.areas.length === 0)) setShowAreaModal(true); }, [user]);

  if (!authReady) {
    return <div style={{ minHeight:"100vh", backgroundColor:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:"'Inter','Hiragino Sans',sans-serif" }}>読み込み中...</div>;
  }

  if (!consentDone) {
    return <ConsentScreen onAgree={() => { saveS("taxi_consent_done", true); setConsentDone(true); }}/>;
  }

  if (!user) {
    return <LoginScreen onLogin={u => {
      if (u._returningUser) { saveS("taxi_onboarding_done", true); setOnboardingDone(true); }
      setUser({ ...u, uploadCount: u.uploadCount ?? 0, areas: u.areas || [] });
    }} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen onComplete={() => {
        saveS("taxi_onboarding_done", true);
        setOnboardingDone(true);
        // XPボーナス +50
        setUser(u => ({ ...u, xp: (u.xp || 0) + 50 }));
      }}/>
    );
  }

  const userAreas = user.areas || [];
  const rankPrefs = loadS("taxi_rank_prefs", { showMyRank:false, showTopSales:false });

  // XP付与ヘルパー
  const awardXP = async (xpGained, newBadges) => {
    if (!xpGained && !newBadges?.length) return;
    setUser(u => {
      const nextXp      = (u.xp || 0) + xpGained;
      const nextBadges  = [...new Set([...(u.badges || []), ...newBadges])];
      const nextUser    = { ...u, xp: nextXp, badges: nextBadges };
      if (SUPABASE_READY && u.id) {
        upsertProfile({ id: u.id, xp: nextXp, badges: nextBadges });
      }
      return nextUser;
    });
  };

  // 日報保存（Supabase or ローカル）
  const handleSave = async (r) => {
    let savedReport = r;
    if (SUPABASE_READY && user.id) {
      const { data } = await insertReport({
        user_id: user.id,
        report_date: r.date,
        gross_sales: r.gross_sales,
        cash_sales: r.cash_sales,
        card_sales: r.card_sales,
        app_sales: r.app_sales,
        highway_fee: r.highway_fee,
        ride_count: r.ride_count,
        total_distance: r.total_distance,
        occupied_distance: r.occupied_distance || null,
        work_hours: r.work_hours,
        break_hours: r.break_hours,
        format_type: r.format_type || "manual",
        confidence_score: r.confidence_score || null,
        raw_ocr_fields: r.raw_ocr_fields || null,
        image_url: r.image_url || null,
        ai_comment: r.ai_comment,
        trouble_note: r.trouble_note,
      });
      if (data) savedReport = { ...r, id: data.id };
    }
    setReports(prev => [savedReport, ...prev]);
    const { xpGained: reportXp, newBadges } = processReport(user.uploadCount || 0, user.badges || []);
    // ミッションチェック
    const missionState = getMissionState();
    const { xpGained: missionXp, newCompleted } = checkMissions(savedReport, user, missionState);
    if (newCompleted.length) saveMissionState({ ...missionState, completed: [...missionState.completed, ...newCompleted] });
    setUser(u => ({ ...u, uploadCount: (u.uploadCount || 0) + 1 }));
    await awardXP(reportXp + missionXp, newBadges);
    setTab("list");
  };

  // 日報更新（編集後）
  const handleUpdateReport = async (updated) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (SUPABASE_READY && user.id && updated.id) {
      await updateReport(updated.id, {
        report_date:       updated.date,
        gross_sales:       updated.gross_sales,
        cash_sales:        updated.cash_sales,
        card_sales:        updated.card_sales,
        app_sales:         updated.app_sales,
        highway_fee:       updated.highway_fee,
        ride_count:        updated.ride_count,
        total_distance:    updated.total_distance,
        occupied_distance: updated.occupied_distance,
        work_hours:        updated.work_hours,
        break_hours:       updated.break_hours,
        trouble_note:      updated.trouble_note,
        work_area:         updated.work_area,
      });
    }
  };

  // 通知をinfoタブで見たらバッジを消す / 設定以外に移動したらsectionリセット
  const handleSetTab = (newTab) => {
    if (newTab === "info" && !alertsSeen) {
      setAlertsSeen(true);
      saveS("taxi_alerts_seen", true);
    }
    if (newTab !== "settings") {
      setSettingsSection("");
    }
    setTab(newTab);
    if (newTab !== "admin") saveS("taxi_last_tab", newTab);
  };

  // ハンバーガー → 設定の特定セクションへ
  const handleNavigateSettings = (section) => {
    setSettingsSection(section);
    setTab("settings");
  };

  const handleLogout = async () => {
    if (SUPABASE_READY) await signOut();
    // 同意・オンボーディングフラグはログアウト後も保持
    const consentFlag = localStorage.getItem("taxi_consent_done");
    const onboardingFlag = localStorage.getItem("taxi_onboarding_done");
    localStorage.clear();
    if (consentFlag) localStorage.setItem("taxi_consent_done", consentFlag);
    if (onboardingFlag) localStorage.setItem("taxi_onboarding_done", onboardingFlag);
    setUser(null);
    setReports(INITIAL_REPORTS);
  };

  const handleDeleteAccount = async () => {
    // Supabaseからサインアウト（アカウント本体の削除は管理者が30日以内に実施）
    if (SUPABASE_READY) await signOut();
    // すべてのローカルデータを消去（同意・オンボーディングフラグも含む）
    localStorage.clear();
    setUser(null);
    setReports(INITIAL_REPORTS);
  };

  const renderScreen = () => {
    switch (tab) {
      case "dashboard": return <Dashboard reports={reports} user={user} onOpenReport={setSelected} onManageArea={()=>setShowAreaModal(true)} rankPrefs={rankPrefs} appMode={appMode} onGoShift={()=>handleSetTab("shift")}/>;
      case "list":      return <ReportList reports={reports} onSelect={r=>{setSelectedForEdit(false);setSelected(r);}} onEdit={r=>{setSelectedForEdit(true);setSelected(r);}}/>;
      case "upload":    return <UploadScreen uploadCount={user.uploadCount||0} onSave={handleSave} reports={reports}/>;
      case "info":      return <InfoCenter notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} userAreas={userAreas} onManageArea={()=>setShowAreaModal(true)}/>;
      case "guide":     return <GuideScreen userAreas={userAreas}/>;
      case "shift":     return <ShiftScreen reports={reports} onGoUpload={()=>setTab("upload")} user={user}/>;
      case "settings":  return <Settings appMode={appMode} onModeChange={setAppMode} themeMode={themeMode} onThemeChange={setThemeMode} user={user} onUpdate={u=>setUser(prev=>({...prev,...u}))} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onManageArea={()=>setShowAreaModal(true)} notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} reports={reports} initialSection={settingsSection} onBack={settingsSection ? ()=>{ setSettingsSection(""); handleSetTab("dashboard"); } : undefined} onOpenAdmin={()=>handleSetTab("admin")}/>;
      case "community": return <CommunityScreen />;
      case "admin":     return <AdminScreen user={{ ...user, email: user.email || "" }} onExit={() => handleSetTab("dashboard")}/>;
      case "feedback":  return <Settings appMode={appMode} onModeChange={setAppMode} themeMode={themeMode} onThemeChange={setThemeMode} user={user} onUpdate={u=>setUser(prev=>({...prev,...u}))} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onManageArea={()=>setShowAreaModal(true)} notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} reports={reports} initialSection="feedback" onBack={()=>handleSetTab("dashboard")}/>;
      default:          return null;
    }
  };

  return (
    <div key={themeVer} style={{ minHeight:"100vh", backgroundColor:C.bg, fontFamily:"'Inter','Hiragino Sans',sans-serif", color:C.text }}>
      <Header user={user} tab={tab} setTab={handleSetTab} appMode={appMode} onModeChange={setAppMode} alertsSeen={alertsSeen} onNavigateSettings={handleNavigateSettings} onManageArea={()=>setShowAreaModal(true)} />
      {renderScreen()}
      <ReportModal key={selected ? `${selected.id}-${selectedForEdit}` : "none"} report={selected} onClose={()=>{setSelected(null);setSelectedForEdit(false);}} onUpdate={handleUpdateReport} startInEdit={selectedForEdit}/>
      <TakuroFAB setTab={handleSetTab} />
      <BottomNav tab={tab} setTab={handleSetTab} userAreas={userAreas} alertsSeen={alertsSeen}/>
      {showAreaModal && <AreaSettingModal userAreas={userAreas} onSave={areas=>setUser(u=>({...u,areas}))} onClose={()=>setShowAreaModal(false)}/>}
    </div>
  );
}
