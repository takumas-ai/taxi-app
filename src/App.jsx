// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App.jsx — メインエントリーポイント
// React Native 移行時: この App.jsx を App.js にリネームし
//   <div> → <View>、inline style → StyleSheet に置換する
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useRef } from "react";
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
  signInWithOAuth,
  resetPasswordForEmail,
  ensureReferralCode,
  registerWithReferral,
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
import RankingScreen, { hasUnseenRanking } from "./screens/Ranking";
import StatsScreen      from "./screens/Stats";

// Components
import { BottomNav, Header, TakuroFAB } from "./components/Navigation";
import { AreaSettingModal }  from "./components/AreaFilter";
import Tutorial from "./components/Tutorial";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase が未設定かどうかを判定
// → 未設定の場合はデモモード（localStorage）で動作
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PWA ホーム画面追加バナー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PWAInstallBanner() {
  const [show, setShow]   = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt    = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const COOLDOWN_DAYS = 7;
    const stored = localStorage.getItem("taxi_pwa_dismissed");
    if (stored) {
      // "forever" = 永久非表示、数値 = タイムスタンプ（7日クールダウン）
      if (stored === "forever") return;
      const shownAt = parseInt(stored, 10);
      if (Date.now() - shownAt < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
    if (ios) {
      const t = setTimeout(() => {
        localStorage.setItem("taxi_pwa_dismissed", String(Date.now())); // 表示時点でタイムスタンプ記録
        setIsIOS(true);
        setShow(true);
      }, 4000);
      return () => clearTimeout(t);
    }

    const onPrompt = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      localStorage.setItem("taxi_pwa_dismissed", String(Date.now())); // 表示時点でタイムスタンプ記録
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // × を押したら永久非表示
  const dismiss = () => { setShow(false); localStorage.setItem("taxi_pwa_dismissed", "forever"); };

  const install = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") localStorage.setItem("taxi_pwa_dismissed", "forever");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{ position:"fixed", bottom:72, left:0, right:0, zIndex:200, padding:"0 12px", pointerEvents:"none" }}>
      <div style={{ maxWidth:480, margin:"0 auto", backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 16px", boxShadow:"0 4px 24px #0009", display:"flex", alignItems:"center", gap:10, pointerEvents:"auto" }}>
        <div style={{ fontSize:22 }}>📱</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>ホーム画面に追加する</div>
          {isIOS
            ? <div style={{ fontSize:11, color:C.muted }}>Safariの <span style={{ color:C.accentLight, fontWeight:700 }}>共有ボタン（↑）</span> →「<span style={{ color:C.accentLight, fontWeight:700 }}>ホーム画面に追加</span>」</div>
            : <button onClick={install} style={{ fontSize:12, color:C.accentLight, background:"none", border:"none", padding:0, cursor:"pointer", fontWeight:700 }}>インストールする →</button>
          }
        </div>
        <button onClick={dismiss} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", lineHeight:1, padding:"0 4px", flexShrink:0 }}>✕</button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ログイン画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoginScreen({ onLogin, onGuestLogin }) {
  const [step, setStep]   = useState("top");
  const [form, setForm]   = useState({ name:"", email:"", password:"", company:"", workType:"隔日勤務", target:"380000" });
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const toggleArea = a => setAreas(prev => prev.includes(a) ? prev.filter(x=>x!==a) : [...prev,a]);

  // URLの ?ref= パラメータを取得（招待リンク経由は自動入力、口頭は手入力）
  const refFromUrl = new URLSearchParams(window.location.search).get("ref")?.toUpperCase() || "";
  const [refCode, setRefCode] = useState(refFromUrl);

  // Supabase メール登録
  const doRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError("名前・メール・パスワードは必須です"); return; }
    if (!isValidEmail(form.email)) { setError("正しいメールアドレスを入力してください"); return; }
    if (!isValidPassword(form.password)) { setError("パスワードは6文字以上で入力してください"); return; }
    setLoading(true); setError("");
    if (SUPABASE_READY) {
      const { data, error: err } = await signUpWithEmail(form.email, form.password);
      if (err) { setError(err.message); setLoading(false); return; }
      if (data.user) {
        const profileData = {
          id: data.user.id,
          ...sanitizeProfile({
            name: form.name, company_name: form.company,
            work_type: form.workType, areas,
            monthly_target: parseInt(form.target) || 380000,
          }),
        };
        await insertProfile(profileData);
        // 招待コードがあれば紹介イベントを記録・クーポン発行
        if (refCode.trim()) {
          await registerWithReferral({
            referredId:   data.user.id,
            referredName: form.name,
            referralCode: refCode.trim().toUpperCase(),
          });
        }
        // 自分の招待コードを生成
        if (SUPABASE_READY) await ensureReferralCode(data.user.id);
        // メール認証が必要な場合（session===null）は確認待ち画面へ
        if (!data.session) { setStep("verify_email"); setLoading(false); return; }
        onLogin({ id: data.user.id, name: form.name, company: form.company, workType: form.workType, target: form.target, plan:"free", uploadCount:0, areas, _migrationUserId: data.user.id });
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

  // OAuth（Google / Apple）
  const doOAuth = async (provider) => {
    setLoading(true); setError("");
    // ゲストデータがあれば移行フラグをセット（OAuthはリダイレクトするため）
    const localReports = loadS("taxi_reports", []);
    if (localReports.length > 0 && loadS("taxi_user", null)?._isGuest) {
      localStorage.setItem("taxi_migration_pending", "1");
    }
    const { error: err } = await signInWithOAuth(provider);
    if (err) { setError(err.message); setLoading(false); }
    // 成功時はリダイレクトされるので setLoading(false) 不要
  };

  const inputStyle = { width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:15, outline:"none" };
  const btnPrimary = { width:"100%", padding:"14px 0", borderRadius:11, fontSize:15, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" };
  const btnGhost   = { width:"100%", padding:"14px 0", borderRadius:11, fontSize:15, fontWeight:700, cursor:"pointer", backgroundColor:"transparent", color:C.sub, border:`1px solid ${C.border}` };
  const btnOAuth   = { width:"100%", padding:"13px 0", borderRadius:11, fontSize:15, fontWeight:600, cursor:"pointer", backgroundColor:C.card, color:C.text, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", gap:10 };

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

          {/* Google（新規・既存どちらでも機能する） */}
          <button onClick={()=>doOAuth("google")} disabled={loading} style={{ ...btnOAuth, marginBottom:4 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.2 33.5 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.5-5z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5c-7.5 0-14 4.3-17.7 10.2z"/><path fill="#FBBC05" d="M24 45.5c5.5 0 10.5-1.8 14.3-4.9l-6.6-5.4C29.7 36.9 27 38 24 38c-5.7 0-10.5-3.7-12.2-8.8l-7 5.4C8.3 41.4 15.5 45.5 24 45.5z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.6l6.6 5.4C42 36.4 44.5 31 44.5 25c0-1.4-.1-2.7-.5-5z"/></svg>
            Googleで続ける
          </button>
          <div style={{ textAlign:"center", fontSize:13, color:C.muted, marginBottom:16 }}>はじめての方も・ログインも、これひとつでOK</div>

          {/* 区切り */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
            <div style={{ fontSize:12, color:C.muted }}>またはメールで</div>
            <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
          </div>

          {/* メール：新規 / ログイン を縦並び */}
          <button onClick={()=>setStep("register")} style={{ ...btnPrimary, marginBottom:10 }}>新規登録</button>
          <button onClick={()=>setStep("login")} style={{ ...btnGhost, marginBottom:16 }}>ログイン</button>

          {/* 登録不要 */}
          {onGuestLogin && (
            <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={onGuestLogin}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>とりあえず使ってみる</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>登録不要・すぐ始められます</div>
              </div>
              <span style={{ fontSize:18, color:C.muted }}>→</span>
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
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <span onClick={()=>{ setError(""); setStep("reset"); }} style={{ fontSize:12, color:C.accentLight, cursor:"pointer", textDecoration:"underline" }}>
              パスワードをお忘れの方
            </span>
          </div>
          <button onClick={()=>setStep("top")} style={btnGhost}>戻る</button>
        </div>
      )}

      {/* パスワードリセット */}
      {step === "reset" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:8, textAlign:"center" }}>パスワードリセット</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:18, textAlign:"center", lineHeight:1.7 }}>
            登録済みのメールアドレスを入力してください。<br/>パスワード再設定のリンクを送ります。
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>メールアドレス</div>
            <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="taxi@example.com" style={inputStyle}/>
          </div>
          <button onClick={async()=>{
            if (!form.email) { setError("メールアドレスを入力してください"); return; }
            setLoading(true); setError("");
            const { error:err } = await resetPasswordForEmail(form.email);
            setLoading(false);
            if (err) { setError(err.message); }
            else { setStep("reset_sent"); }
          }} disabled={loading} style={{ ...btnPrimary, opacity:loading?0.5:1, marginBottom:10 }}>
            {loading ? "送信中..." : "リセットメールを送る"}
          </button>
          <button onClick={()=>setStep("login")} style={btnGhost}>戻る</button>
        </div>
      )}

      {/* リセットメール送信完了 */}
      {step === "reset_sent" && (
        <div style={{ width:"100%", maxWidth:360, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📧</div>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:10 }}>メールを送りました</div>
          <div style={{ fontSize:13, color:C.muted, lineHeight:1.8, marginBottom:24 }}>
            <strong>{form.email}</strong> にパスワード再設定のリンクを送りました。<br/>
            メールが届かない場合は迷惑メールフォルダを確認してください。
          </div>
          <button onClick={()=>{ setStep("login"); setForm(p=>({...p,password:""})); }} style={btnGhost}>ログイン画面に戻る</button>
        </div>
      )}

      {/* メール認証待ち */}
      {step === "verify_email" && (
        <div style={{ width:"100%", maxWidth:360, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✉️</div>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:10 }}>確認メールを送りました</div>
          <div style={{ fontSize:13, color:C.muted, lineHeight:1.8, marginBottom:24 }}>
            <strong>{form.email}</strong> に確認メールを送りました。<br/>
            メール内のリンクをクリックして登録を完了してください。
          </div>
          <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, padding:"12px 16px", fontSize:12, color:C.sub, lineHeight:1.8, marginBottom:24, textAlign:"left" }}>
            ✅ リンクをクリックするとアプリに戻ります<br/>
            📁 届かない場合は迷惑メールフォルダを確認してください
          </div>
          <button onClick={()=>setStep("top")} style={btnGhost}>トップに戻る</button>
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
          {/* 招待コード（任意） */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>
              招待コード
              <span style={{ color:C.accentLight, marginLeft:6, fontSize:10 }}>任意</span>
              {refFromUrl && <span style={{ color:C.green, marginLeft:6, fontSize:10 }}>✓ 自動入力済み</span>}
            </div>
            <input
              type="text"
              value={refCode}
              onChange={e=>setRefCode(e.target.value.toUpperCase())}
              placeholder="例: TK-A3K7PX"
              style={{ ...inputStyle, letterSpacing:"1px", fontWeight:refCode?700:400 }}
            />
            {refCode && (
              <div style={{ fontSize:11, color:C.accentLight, marginTop:4 }}>
                🎁 招待コードで登録すると無料期間が+30日になります
              </div>
            )}
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
// ゲストユーザー向け アカウント連携モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function GuestAccountModal({ onClose, onOAuth, onSwitchToRegister }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const doOAuth = async (provider) => {
    setLoading(true); setError("");
    localStorage.setItem("taxi_migration_pending", "1");
    const { error: err } = await signInWithOAuth(provider);
    if (err) { setError(err.message); setLoading(false); }
  };
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, backgroundColor:"#0008", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 48px" }}>
        {/* 警告バナー */}
        <div style={{ backgroundColor:"#FFF3E0", border:"1px solid #FF980055", borderRadius:12, padding:"12px 14px", marginBottom:20, display:"flex", alignItems:"flex-start", gap:10 }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <span style={{ fontSize:13, color:"#E65100", lineHeight:1.6 }}>外部アカウント未連携のため、機種変更またはアプリを消した場合にデータが失われます</span>
        </div>

        <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:6 }}>外部アカウント連携すればすべてのデータが安全に保存されます</div>
        <div style={{ marginBottom:20 }}>
          {[
            "端末をなくしてもデータ復旧可能",
            "機種変更時にもデータの引き継ぎが可能",
            "複数端末でデータの同期が可能",
            "締日設定が可能",
          ].map(t => (
            <div key={t} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", fontSize:14, color:C.sub }}>
              <span style={{ color:C.accentLight, fontSize:16 }}>✓</span>{t}
            </div>
          ))}
        </div>

        {error && <div style={{ backgroundColor:"#ffebee", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#c62828", marginBottom:12 }}>{error}</div>}

        {/* Googleボタン */}
        <button onClick={()=>doOAuth("google")} disabled={loading} style={{ width:"100%", padding:"14px 0", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:C.surface, color:C.text, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.2 33.5 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.5-5z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5c-7.5 0-14 4.3-17.7 10.2z"/><path fill="#FBBC05" d="M24 45.5c5.5 0 10.5-1.8 14.3-4.9l-6.6-5.4C29.7 36.9 27 38 24 38c-5.7 0-10.5-3.7-12.2-8.8l-7 5.4C8.3 41.4 15.5 45.5 24 45.5z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.6l6.6 5.4C42 36.4 44.5 31 44.5 25c0-1.4-.1-2.7-.5-5z"/></svg>
          Googleでサインイン
        </button>

        <button onClick={onClose} style={{ width:"100%", padding:"12px 0", marginTop:14, borderRadius:11, fontSize:13, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>
          あとで連携する
        </button>
      </div>
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
  const [themeMode, setThemeMode] = useState(() => loadS("taxi_theme_mode","light"));
  const [themeVer, setThemeVer] = useState(0); // テーマ変更時に全体を再描画させるカウンター
  const [consentDone, setConsentDone]       = useState(() => !!loadS("taxi_consent_done", false));
  const [onboardingDone, setOnboardingDone] = useState(() => !!loadS("taxi_onboarding_done", false));
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [reports, setReports]   = useState(() => {
    const savedUser = loadS("taxi_user", null);
    // ゲストユーザーまたはSupabase未設定ならlocalStorageから読む
    if (!SUPABASE_READY || savedUser?._isGuest) return loadS("taxi_reports", INITIAL_REPORTS);
    return [];
  });
  const [tab, setTab]           = useState(() => {
    const saved = loadS("taxi_last_tab", "dashboard");
    // adminタブはリロード後に復元しない（セキュリティ）
    return ["dashboard","list","upload","info","guide","shift","settings","community","ranking","stats"].includes(saved) ? saved : "dashboard";
  });
  const [hasNewRanking, setHasNewRanking] = useState(() => hasUnseenRanking());
  const [alertsSeen, setAlertsSeen]   = useState(() => loadS("taxi_alerts_seen", false));
  const [settingsSection, setSettingsSection] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(false);
  const [notif, setNotif]       = useState(() => loadS("taxi_notif", { delays:true, events:false, traffic:false, dailyTip:false, achievement:true, dailyResult:false }));
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showAccountLink, setShowAccountLink] = useState(false);
  const [showClosingPrompt, setShowClosingPrompt] = useState(false);
  const [closingDayPick, setClosingDayPick] = useState(15);
  const [closingDaySaving, setClosingDaySaving] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type: "success"|"error"|"info" }
  const areaModalShownRef = useRef(false); // セッション中1回だけ表示
  // SUPABASE_READYでもキャッシュユーザーがあればすぐ表示（リフレッシュ対策）
  const [authReady, setAuthReady] = useState(!SUPABASE_READY || !!loadS("taxi_user", null));

  // ─── Supabase 認証セッション復元 ───
  useEffect(() => {
    if (!SUPABASE_READY) return;

    // 既存セッションを確認
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await fetchProfile(session.user.id);
        if (profile) {
          // 既存ユーザー — 再ログイン時に利用規約・締日モーダルをスキップ
          localStorage.setItem("taxi_consent_done", "true");
          saveS("taxi_closing_prompted", true); // 返ってきたユーザーには再表示しない
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
          localStorage.setItem("taxi_onboarding_done", "true");
          setOnboardingDone(true);
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile.name,
            company: profile.company_name || "",
            workType: profile.work_type || "隔日勤務",
            target: profile.monthly_target != null ? String(profile.monthly_target) : "",
            plan: profile.plan || "free",
            uploadCount: profile.monthly_upload_count || 0,
            areas: profile.areas || [],
            xp: nextXp,
            streakDays: loginResult.newStreak,
            badges: nextBadges,
            avatarUrl: profile.avatar_url || null,
            avatarPreset: profile.avatar_preset || null,
            closing_day: profile.closing_day ?? null,
          });
          const { data: reps } = await fetchReports(session.user.id);
          if (reps?.length) setReports(reps.map(r => ({ ...r, date: r.report_date })));
          else setReports([]);
        } else {
          // Google/Apple OAuth 新規ユーザー → プロフィール作成してオンボーディングへ
          const oauthName = session.user.user_metadata?.full_name
            || session.user.user_metadata?.name
            || session.user.email?.split("@")[0]
            || "ドライバー";
          await insertProfile({
            id: session.user.id,
            name: oauthName,
            work_type: "隔日勤務",
            monthly_target: 380000,
            areas: [],
          });
          // ゲストデータの移行
          let migratedReports = [];
          if (localStorage.getItem("taxi_migration_pending")) {
            localStorage.removeItem("taxi_migration_pending");
            const localReports = loadS("taxi_reports", []);
            if (localReports.length > 0) {
              for (const r of localReports) {
                await insertReport({
                  user_id: session.user.id,
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
                  ai_comment: r.ai_comment,
                  trouble_note: r.trouble_note,
                });
              }
              const { data: reps } = await fetchReports(session.user.id);
              if (reps?.length) migratedReports = reps.map(r => ({ ...r, date: r.report_date }));
            }
          }
          setReports(migratedReports);
          // オンボーディングを表示（onboarding_done はセットしない）
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: oauthName,
            company: "",
            workType: "隔日勤務",
            target: "380000",
            plan: "free",
            uploadCount: 0,
            areas: [],
          });
        }
      }
      setAuthReady(true);
    });

    // 認証状態の変化を監視
    const { data: { subscription } } = onAuthStateChange(session => {
      if (!session) { setUser(null); setReports([]); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── ローカル保存 ───
  // reports: Supabase未設定時 or ゲストユーザー時はlocalStorageに保存
  useEffect(() => { if (!SUPABASE_READY || user?._isGuest) saveS("taxi_reports", reports); }, [reports, user]);
  // user: 常に保存（リフレッシュ時にローディング画面をスキップするため）
  useEffect(() => { saveS("taxi_user", user); }, [user]);
  useEffect(() => { saveS("taxi_app_mode", appMode); }, [appMode]);

  // ─── テーマ管理 ───
  useEffect(() => {
    saveS("taxi_theme_mode", themeMode);
    applyTheme(computeIsDark(themeMode));
    setThemeVer(v => v + 1);
  }, [themeMode]);

  // autoモード: 1分ごとに日没チェック（実際にテーマが変わった時だけ再レンダリング）
  useEffect(() => {
    if (themeMode !== "auto") return;
    let prevDark = computeIsDark("auto");
    const tick = () => {
      const nowDark = computeIsDark("auto");
      if (nowDark !== prevDark) {
        prevDark = nowDark;
        applyTheme(nowDark);
        setThemeVer(v => v + 1);
      }
    };
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [themeMode]);
  useEffect(() => saveS("taxi_notif", notif), [notif]);
  useEffect(() => {
    if (user && (!user.areas || user.areas.length === 0) && !areaModalShownRef.current) {
      areaModalShownRef.current = true;
      setShowAreaModal(true);
    }
  }, [user]);

  // 締日未設定の新規ユーザーに1度だけ促す
  useEffect(() => {
    if (!user || user._isGuest) return;
    if (user.closing_day != null) return; // 設定済みはスキップ
    if (loadS("taxi_closing_prompted", false)) return;
    saveS("taxi_closing_prompted", true);
    setShowClosingPrompt(true);
  }, [user?.id]);

  // トーストの自動消去
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!authReady) {
    return <div style={{ minHeight:"100vh", backgroundColor:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:"'Inter','Hiragino Sans',sans-serif" }}>読み込み中...</div>;
  }

  if (!consentDone) {
    return <ConsentScreen onAgree={() => { saveS("taxi_consent_done", true); setConsentDone(true); }}/>;
  }

  // ゲストとして使い始める
  const handleGuestLogin = () => {
    const guestUser = { id: "guest_" + Date.now(), name: "ゲスト", _isGuest: true, plan:"free", uploadCount:0, areas:[] };
    setReports(loadS("taxi_reports", INITIAL_REPORTS));
    setOnboardingDone(true); // オンボーディングはスキップ
    saveS("taxi_onboarding_done", true);
    setUser(guestUser);
  };

  if (!user) {
    return <LoginScreen onLogin={u => {
      if (u._returningUser) { saveS("taxi_onboarding_done", true); setOnboardingDone(true); }
      // メール登録でゲストデータがある場合は移行
      if (u._migrationUserId && SUPABASE_READY) {
        const localReports = loadS("taxi_reports", []);
        if (localReports.length > 0) {
          (async () => {
            for (const r of localReports) {
              await insertReport({
                user_id: u._migrationUserId,
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
                ai_comment: r.ai_comment,
                trouble_note: r.trouble_note,
              });
            }
            const { data: reps } = await fetchReports(u._migrationUserId);
            if (reps?.length) setReports(reps.map(r => ({ ...r, date: r.report_date })));
          })();
        }
      }
      const { _migrationUserId: _, ...cleanUser } = u;
      setUser({ ...cleanUser, uploadCount: cleanUser.uploadCount ?? 0, areas: cleanUser.areas || [] });
    }} onGuestLogin={handleGuestLogin} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen onComplete={() => {
        saveS("taxi_onboarding_done", true);
        setOnboardingDone(true);
        // XPボーナス +50
        setUser(u => ({ ...u, xp: (u.xp || 0) + 50 }));
        // チュートリアル未完了なら自動スタート
        if (!loadS("taxi_tutorial_done", false)) {
          setShowTutorial(true);
        }
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

  // トーストヘルパー
  const showToast = (msg, type = "info") => setToast({ msg, type });

  // 日報保存（Supabase or ローカル）
  const handleSave = async (r) => {
    let savedReport = r;
    if (SUPABASE_READY && user.id) {
      try {
      const { data, error: saveErr } = await insertReport({
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
      if (saveErr) throw saveErr;
      if (data) savedReport = { ...r, id: data.id };
      } catch(e) {
        showToast("保存に失敗しました。通信状況を確認してください", "error");
        console.error("[handleSave]", e);
      }
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
    if (newTab === "ranking" && hasNewRanking) {
      setHasNewRanking(false);
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
      case "dashboard": return <Dashboard reports={reports} user={user} onOpenReport={setSelected} onManageArea={()=>setShowAreaModal(true)} rankPrefs={rankPrefs} appMode={appMode} onGoShift={()=>handleSetTab("shift")} onUpdateReport={handleUpdateReport} onGoRanking={notif.dailyResult && hasNewRanking ? ()=>handleSetTab("ranking") : null} onUpdateUser={u=>setUser(u)}/>;
      case "list":      return <ReportList reports={reports} onSelect={r=>{setSelectedForEdit(false);setSelected(r);}} onEdit={r=>{setSelectedForEdit(true);setSelected(r);}}/>;
      case "upload":    return <UploadScreen uploadCount={user.uploadCount||0} onSave={handleSave} reports={reports} user={user}/>;
      case "info":      return <InfoCenter notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} userAreas={userAreas} onManageArea={()=>setShowAreaModal(true)}/>;
      case "guide":     return <GuideScreen userAreas={userAreas} user={user}/>;
      case "shift":     return <ShiftScreen reports={reports} onGoUpload={()=>setTab("upload")} user={user} onBack={()=>handleSetTab("dashboard")}/>;
      case "settings":  return <Settings appMode={appMode} onModeChange={setAppMode} themeMode={themeMode} onThemeChange={setThemeMode} user={user} onUpdate={async u=>{ setUser(prev=>({...prev,...u})); if(SUPABASE_READY&&user?.id&&!user?._isGuest){const p={id:user.id};if(u.name!==undefined)p.name=u.name;if(u.workType!==undefined)p.work_type=u.workType;if(u.company!==undefined)p.company_name=u.company;if(u.target!==undefined)p.monthly_target=Number(u.target);if(u.closing_day!==undefined)p.closing_day=u.closing_day;if("avatar_url"in u)p.avatar_url=u.avatar_url;if("avatar_preset"in u)p.avatar_preset=u.avatar_preset;if(Object.keys(p).length>1)await upsertProfile(p);}}} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onManageArea={()=>setShowAreaModal(true)} notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} reports={reports} initialSection={settingsSection} onBack={settingsSection ? ()=>{ setSettingsSection(""); handleSetTab("dashboard"); } : undefined} onOpenAdmin={()=>handleSetTab("admin")} onAccountLink={user?._isGuest ? ()=>setShowAccountLink(true) : undefined}/>;
      case "community": return <CommunityScreen />;
      case "ranking":   return <RankingScreen user={user} rankPrefs={rankPrefs} />;
      case "stats":     return <StatsScreen reports={reports} />;
      case "admin":     return <AdminScreen user={{ ...user, email: user.email || "" }} onExit={() => handleSetTab("dashboard")}/>;
      case "feedback":  return <Settings appMode={appMode} onModeChange={setAppMode} themeMode={themeMode} onThemeChange={setThemeMode} user={user} onUpdate={async u=>{ setUser(prev=>({...prev,...u})); if(SUPABASE_READY&&user?.id&&!user?._isGuest){const p={id:user.id};if(u.name!==undefined)p.name=u.name;if(Object.keys(p).length>1)await upsertProfile(p);}}} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onManageArea={()=>setShowAreaModal(true)} notifSettings={notif} onUpdateNotif={(k,v)=>setNotif(p=>({...p,[k]:v}))} reports={reports} initialSection="feedback" onBack={()=>handleSetTab("dashboard")}/>;
      default:          return null;
    }
  };

  return (
    <div key={themeVer} style={{ minHeight:"100vh", backgroundColor:C.bg, fontFamily:"'Inter','Hiragino Sans',sans-serif", color:C.text, overflowX:"hidden" }}>
      <Header user={user} tab={tab} setTab={handleSetTab} appMode={appMode} onModeChange={setAppMode} alertsSeen={alertsSeen} onNavigateSettings={handleNavigateSettings} onManageArea={()=>setShowAreaModal(true)} hasNewRanking={hasNewRanking && notif.dailyResult} />
      {renderScreen()}
      <ReportModal key={selected ? `${selected.id}-${selectedForEdit}` : "none"} report={selected} onClose={()=>{setSelected(null);setSelectedForEdit(false);}} onUpdate={handleUpdateReport} startInEdit={selectedForEdit}/>
      <TakuroFAB setTab={handleSetTab} />
      <BottomNav tab={tab} setTab={handleSetTab} userAreas={userAreas} alertsSeen={alertsSeen}/>
      {showAreaModal && <AreaSettingModal userAreas={userAreas} onSave={areas=>{
        setUser(u=>({...u,areas}));
        if (SUPABASE_READY && user?.id) upsertProfile({ id: user.id, areas });
      }} onClose={()=>setShowAreaModal(false)}/>}
      {showAccountLink && <GuestAccountModal onClose={()=>setShowAccountLink(false)} />}

      {/* 締日設定促進モーダル */}
      {showClosingPrompt && (
        <div style={{ position:"fixed", inset:0, backgroundColor:"#0008", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
          <div style={{ backgroundColor:C.surface, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 48px" }}>
            <div style={{ width:40, height:4, backgroundColor:C.border, borderRadius:99, margin:"0 auto 20px" }}/>
            <div style={{ fontSize:17, fontWeight:800, marginBottom:8 }}>📅 締日を設定しましょう</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.8, marginBottom:20 }}>
              締日を設定すると「今月の残り出番」や期間集計が正しく計算されます。<br/>
              <span style={{ color:C.accentLight, fontWeight:700 }}>例）15日締めなら「前月16日〜当月15日」が1ヶ月</span>
            </div>
            {(() => {
              const options = [{ value:0, label:"月末日" }, ...[5,10,15,20,25].map(d=>({ value:d, label:`毎月${d}日` }))];
              return (
                <>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
                    {options.map(o => (
                      <div key={o.value} onClick={()=>setClosingDayPick(o.value)} style={{ padding:"10px 16px", borderRadius:10, border:`2px solid ${closingDayPick===o.value?C.accentLight:C.border}`, color:closingDayPick===o.value?C.accentLight:C.muted, fontSize:14, fontWeight:closingDayPick===o.value?700:400, cursor:"pointer" }}>
                        {o.label}
                      </div>
                    ))}
                  </div>
                  <button onClick={async()=>{
                    setClosingDaySaving(true);
                    if (SUPABASE_READY && user?.id) await upsertProfile({ id:user.id, closing_day:closingDayPick });
                    setUser(u=>({...u, closing_day:closingDayPick}));
                    setClosingDaySaving(false);
                    setShowClosingPrompt(false);
                    setToast({ msg:"締日を設定しました ✓", type:"success" });
                  }} disabled={closingDaySaving} style={{ width:"100%", padding:"14px 0", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff", marginBottom:10 }}>
                    {closingDaySaving ? "保存中..." : "この締日で設定する"}
                  </button>
                  <button onClick={()=>setShowClosingPrompt(false)} style={{ width:"100%", padding:"12px 0", borderRadius:12, fontSize:13, fontWeight:600, cursor:"pointer", backgroundColor:"transparent", border:"none", color:C.muted }}>
                    あとで設定する
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {showTutorial && (
        <Tutorial
          onComplete={() => setShowTutorial(false)}
          onSetTarget={() => setShowTutorial(false)}
        />
      )}

      {/* トースト通知 */}
      {toast && (
        <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", zIndex:500, backgroundColor: toast.type==="error" ? C.red : toast.type==="success" ? C.green : C.accentLight, color:"#fff", padding:"12px 20px", borderRadius:12, fontSize:13, fontWeight:700, boxShadow:"0 4px 20px #0004", whiteSpace:"nowrap", pointerEvents:"none" }}>
          {toast.msg}
        </div>
      )}

      <PWAInstallBanner />
    </div>
  );
}
