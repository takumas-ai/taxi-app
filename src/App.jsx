// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App.jsx — メインエントリーポイント
// React Native 移行時: この App.jsx を App.js にリネームし
//   <div> → <View>、inline style → StyleSheet に置換する
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect } from "react";
import { C, loadS, saveS } from "./lib/constants";
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
  fetchReports,
  insertReport,
} from "./lib/supabase";

// Screens
import Dashboard          from "./screens/Dashboard";
import ReportList, { ReportModal } from "./screens/ReportList";
import UploadScreen       from "./screens/Upload";
import InfoCenter         from "./screens/InfoCenter";
import GuideScreen        from "./screens/Guide";
import ShiftScreen        from "./screens/Shift";
import Settings           from "./screens/Settings";

// Components
import { BottomNav, Header } from "./components/Navigation";
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

  // デモログイン（Supabase未接続 or 開発中）
  const doDemo = () => onLogin({
    id: "demo", name:"田中 義人", company:"神奈川交通",
    workType:"隔日勤務", target:"380000", plan:"free",
    uploadCount:6, areas:["横浜"], isDemo: true,
  });

  // Supabase メール登録
  const doRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError("名前・メール・パスワードは必須です"); return; }
    setLoading(true); setError("");
    if (SUPABASE_READY) {
      const { data, error: err } = await signUpWithEmail(form.email, form.password);
      if (err) { setError(err.message); setLoading(false); return; }
      // usersテーブルを更新（トリガーで基本行は作成済み）
      if (data.user) {
        await upsertProfile({
          id: data.user.id, name: form.name, email: form.email,
          company_name: form.company, work_type: form.workType,
          areas, monthly_target: parseInt(form.target) || 380000,
        });
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
      onLogin({
        id: data.user.id,
        name: profile?.name || data.user.email,
        company: profile?.company_name || "",
        workType: profile?.work_type || "隔日勤務",
        target: String(profile?.monthly_target || 380000),
        plan: profile?.plan || "free",
        uploadCount: profile?.monthly_upload_count || 0,
        areas: profile?.areas || [],
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
        <div style={{ fontSize:52, marginBottom:8 }}>🚕</div>
        <div style={{ fontSize:28, fontWeight:900, color:C.text, letterSpacing:"-1px" }}>日報AI</div>
        <div style={{ fontSize:13, color:C.muted, marginTop:6, fontStyle:"italic" }}>紙の日報を、資産に変える。</div>
      </div>

      {error && <div style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:C.red, maxWidth:360, width:"100%" }}>{error}</div>}

      {/* トップ */}
      {step === "top" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          {SUPABASE_READY && (
            <button onClick={()=>setStep("login")} style={{ ...btnPrimary, marginBottom:12 }}>ログイン</button>
          )}
          <button onClick={doDemo} style={{ ...btnPrimary, backgroundColor:C.accentLight+"bb", marginBottom:12 }}>デモで試す（横浜エリア）</button>
          <button onClick={()=>setStep("register")} style={{ ...btnGhost }}>新規登録</button>
          {!SUPABASE_READY && (
            <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:12 }}>
              ※ .env を設定するとSupabase認証が有効になります
            </div>
          )}
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
export default function App() {
  const [user, setUser]         = useState(() => loadS("taxi_user", null));
  const [appMode, setAppMode] = useState(loadS("taxi_app_mode","standard"));
  const [reports, setReports]   = useState(() => loadS("taxi_reports", INITIAL_REPORTS));
  const [tab, setTab]           = useState("dashboard");
  const [selected, setSelected] = useState(null);
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
          setUser({
            id: session.user.id,
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

  // ─── ローカル保存（デモ・Supabase未設定時） ───
  useEffect(() => { if (!SUPABASE_READY || user?.isDemo) saveS("taxi_reports", reports); }, [reports]);
  useEffect(() => { if (!SUPABASE_READY || user?.isDemo) saveS("taxi_user", user); }, [user]);
  useEffect(() => { saveS("taxi_app_mode", appMode); }, [appMode]);
  useEffect(() => saveS("taxi_notif", notif), [notif]);
  useEffect(() => { if (user && (!user.areas || user.areas.length === 0)) setShowAreaModal(true); }, [user]);

  if (!authReady) {
    return <div style={{ minHeight:"100vh", backgroundColor:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:"'Inter','Hiragino Sans',sans-serif" }}>読み込み中...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={u => setUser({ ...u, uploadCount: u.uploadCount ?? 0, areas: u.areas || [] })} />;
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
      if (SUPABASE_READY && !u.isDemo && u.id) {
        upsertProfile({ id: u.id, xp: nextXp, badges: nextBadges });
      }
      return nextUser;
    });
  };

  // 日報保存（Supabase or ローカル）
  const handleSave = async (r) => {
    let savedReport = r;
    if (SUPABASE_READY && !user.isDemo && user.id) {
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

  const handleLogout = async () => {
    if (SUPABASE_READY && !user.isDemo) await signOut();
    localStorage.clear();
    setUser(null);
    setReports(INITIAL_REPORTS);
  };

  const renderScreen = () => {
    switch (tab) {
      case "dashboard": return <Dashboard reports={reports} user={user} onOpenReport={setSelected} onManageArea={()=>setShowAreaModal(true)} rankPrefs={rankPrefs}/>;
      case "list":      return <ReportList reports={reports} onSelect={setSelected}/>;
      case "upload":    return <UploadScreen uploadCount={user.uploadCount||0} onSave={handleSave} reports={reports}/>;
      case "info":      return <InfoCenter notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} userAreas={userAreas} onManageArea={()=>setShowAreaModal(true)}/>;
      case "guide":     return <GuideScreen userAreas={userAreas}/>;
      case "shift":     return <ShiftScreen reports={reports} onGoUpload={()=>setTab("upload")}/>;
      case "settings":  return <Settings appMode={appMode} onModeChange={setAppMode} user={user} onUpdate={u=>setUser(prev=>({...prev,...u}))} onLogout={handleLogout} onManageArea={()=>setShowAreaModal(true)} notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))}/>;
      default:          return null;
    }
  };

  return (
    <div style={{ minHeight:"100vh", backgroundColor:C.bg, fontFamily:"'Inter','Hiragino Sans',sans-serif", color:C.text }}>
      <Header user={user} tab={tab} setTab={setTab} onManageArea={()=>setShowAreaModal(true)} />
      {renderScreen()}
      <ReportModal report={selected} onClose={()=>setSelected(null)}/>
      <BottomNav tab={tab} setTab={setTab} userAreas={userAreas}/>
      {showAreaModal && <AreaSettingModal userAreas={userAreas} onSave={areas=>setUser(u=>({...u,areas}))} onClose={()=>setShowAreaModal(false)}/>}
    </div>
  );
}
