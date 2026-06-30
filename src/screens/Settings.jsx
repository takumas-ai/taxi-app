// 設定画面（プロフィール・エリア・プラン・通知・ランク・モード・ロードマップ）
import { useState, useEffect } from "react";
import { C, FREE_LIMIT, PLAN_OCR_LIMITS, PLAN_LABELS, loadS, saveS } from "../lib/constants";
import { Card, Btn, ProgressBar, Toggle } from "../components/UI";
import { AreaBadges } from "../components/UI";
import { levelFromXp, getTitle, BADGES } from "../lib/xp";
import { insertFeedback, fetchReferralCount, fetchMyCoupons, fetchMyReferralStats, signOutOtherDevices, updateEmail, updatePassword } from "../lib/supabase";
import { downloadCSV, printAsPDF, downloadRideRecordsCSV } from "../lib/export";
import AvatarPicker from "../components/AvatarPicker";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";

function ClosingSection({ user, onUpdate }) {
  const [closingDay, setClosingDay] = useState(user.closing_day ?? 0);
  const [saved2, setSaved2] = useState(false);
  const options = [
    { value: 0, label: "月末日" },
    ...([5,10,15,20,25].map(d => ({ value: d, label: `毎月${d}日` }))),
  ];
  const saveClosing = () => {
    onUpdate({ closing_day: closingDay });
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2000);
  };
  return (
    <Card>
      <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:10, padding:"12px 14px", marginBottom:16, fontSize:12, color:C.sub, lineHeight:1.7 }}>
        締日を設定すると、締日の翌日から翌月の締日までの間に登録されたデータが集計されます。<br/>
        <span style={{ color:C.muted }}>例）締日: 15日 → 前月16日〜当月15日が集計期間</span>
      </div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>締日</div>
      <select value={closingDay} onChange={e => setClosingDay(Number(e.target.value))}
        style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"12px", color:C.text, fontSize:15, marginBottom:20, outline:"none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Btn onClick={saveClosing}>{saved2 ? "✓ 保存しました" : "締日を更新する"}</Btn>
    </Card>
  );
}


function TakePaySection({ takePay, saveTakePay, user, onUpdate }) {
  const isKoTaku = user?.workType === "個人タクシー";

  // 編集中の値（保存前）
  const [pending, setPending] = useState({ rate: takePay.rate, deduction: takePay.deduction, expenses: takePay.expenses ?? 0 });
  const [deductionStr, setDeductionStr] = useState(String(takePay.deduction));
  const [expensesStr, setExpensesStr]   = useState(String(takePay.expenses ?? 0));
  const [calcMode, setCalcMode] = useState("reverse"); // "reverse" | "forward"
  const [wantedTake, setWantedTake] = useState("");
  const [salesInput, setSalesInput] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = isKoTaku
    ? pending.expenses !== (takePay.expenses ?? 0)
    : pending.rate !== takePay.rate || pending.deduction !== takePay.deduction;

  const handleSave = () => {
    saveTakePay(pending);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fmt2 = (n) => n.toLocaleString();
  const calcTakeLocal = (sales) => isKoTaku
    ? Math.max(0, Math.round(sales - (pending.expenses || 0)))
    : Math.max(0, Math.round(sales * pending.rate / 100 - pending.deduction));
  const calcSales = (take) => isKoTaku
    ? Math.round(take + (pending.expenses || 0))
    : Math.round((take + pending.deduction) / (pending.rate / 100));

  const reverseSales = wantedTake ? calcSales(parseInt(wantedTake.replace(/,/g,"")) || 0) : 0;
  const forwardTake  = salesInput  ? calcTakeLocal(parseInt(salesInput.replace(/,/g,"")) || 0) : 0;

  const setGoal = (val) => {
    onUpdate({ target: val });
    setGoalSaved(true);
    setTimeout(() => setGoalSaved(false), 2000);
  };

  const currentTarget = parseInt(user?.target) || 0;

  return (
    <div>
      {/* 条件設定 */}
      <Card style={{ marginBottom:12 }}>
        {isKoTaku ? (
          <>
            <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>月間の経費合計を入力してください。燃料・保険・車両費・その他を合算した金額です。</div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>月間経費合計（円）</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:8 }}>
              {[50000,80000,100000,120000,150000,200000].map(v=>(
                <div key={v} onClick={()=>{ setPending(p => ({ ...p, expenses: v })); setExpensesStr(String(v)); }}
                  style={{ padding:"8px 0", textAlign:"center", borderRadius:9, border:`2px solid ${pending.expenses===v?C.accentLight:C.border}`, color:pending.expenses===v?C.accentLight:C.muted, fontSize:12, fontWeight:pending.expenses===v?700:400, cursor:"pointer" }}>
                  {v/10000}万円
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>または直接入力（円）</div>
            <input type="number" value={expensesStr}
              onChange={e => setExpensesStr(e.target.value)}
              onBlur={e => { const v = parseInt(e.target.value)||0; setExpensesStr(String(v)); setPending(p => ({ ...p, expenses: v })); }}
              onFocus={e => e.target.select()}
              style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
          </>
        ) : (
          <>
            <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>会社や契約によって異なります。自分の条件に合わせて設定してください。</div>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>歩合率</div>
                <span style={{ fontSize:18, fontWeight:800, color:C.accentLight }}>{pending.rate}%</span>
              </div>
              <input type="range" min={30} max={80} step={1} value={pending.rate}
                onChange={e => setPending(p => ({ ...p, rate: parseInt(e.target.value) }))}
                style={{ width:"100%", accentColor:C.accentLight }}/>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginTop:2 }}>
                <span>30%</span><span>80%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>月間控除額（社保・税など）</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                {[20000,30000,40000,50000,60000,70000].map(v=>(
                  <div key={v} onClick={()=>{ setPending(p => ({ ...p, deduction: v })); setDeductionStr(String(v)); }}
                    style={{ padding:"8px 0", textAlign:"center", borderRadius:9, border:`2px solid ${pending.deduction===v?C.accentLight:C.border}`, color:pending.deduction===v?C.accentLight:C.muted, fontSize:12, fontWeight:pending.deduction===v?700:400, cursor:"pointer" }}>
                    {v/10000}万円
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>または直接入力（円）</div>
                <input type="number" value={deductionStr}
                  onChange={e => setDeductionStr(e.target.value)}
                  onBlur={e => { const v = parseInt(e.target.value)||0; setDeductionStr(String(v)); setPending(p => ({ ...p, deduction: v })); }}
                  onFocus={e => e.target.select()}
                  style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
              </div>
            </div>
          </>
        )}
        {/* 保存ボタン */}
        <div style={{ marginTop:16 }}>
          <button onClick={handleSave}
            style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, border:"none", cursor:"pointer",
              backgroundColor: saved ? C.green : isDirty ? C.accentLight : C.border,
              color: (saved || isDirty) ? "#fff" : C.muted,
              transition:"background 0.2s" }}>
            {saved ? "✓ 保存しました" : "保存する"}
          </button>
        </div>
      </Card>

      {/* 計算 */}
      <Card>
        {/* 現在の目標 */}
        {currentTarget > 0 && (
          <div style={{ marginBottom:14, padding:"12px 14px", backgroundColor:C.accentGlow, borderRadius:10, border:`1px solid ${C.accentLight}22` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:12, color:C.muted }}>🎯 現在の目標（税抜）</span>
              <span style={{ fontSize:15, fontWeight:800, color:C.accentLight }}>¥{fmt2(currentTarget)}</span>
            </div>
            <div style={{ height:1, backgroundColor:C.accentLight+"22", marginBottom:8 }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:C.muted }}>💴 目標達成時の手取り（概算）</span>
              <span style={{ fontSize:15, fontWeight:800, color:C.green }}>¥{fmt2(calcTakeLocal(currentTarget))}</span>
            </div>
          </div>
        )}

        {/* トグル */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:16 }}>
          {[["reverse","手取りから計算"],["forward","売上から計算"]].map(([mode,label])=>(
            <div key={mode} onClick={()=>setCalcMode(mode)}
              style={{ padding:"10px 0", textAlign:"center", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer",
                backgroundColor: calcMode===mode ? C.accentLight : C.bg,
                color: calcMode===mode ? "#fff" : C.muted,
                border: `1px solid ${calcMode===mode ? C.accentLight : C.border}` }}>
              {label}
            </div>
          ))}
        </div>

        {/* 手取りから計算 */}
        {calcMode === "reverse" && (
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>目標手取り（月）</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
              <input type="number" value={wantedTake} onChange={e=>setWantedTake(e.target.value)}
                onFocus={e=>e.target.select()} placeholder="例: 250000"
                style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:16, outline:"none" }}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>円</span>
            </div>
            {reverseSales > 0 && (
              <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>必要な月間売上（税抜）</div>
                <div style={{ fontSize:30, fontWeight:900, color:C.accentLight }}>{fmt2(reverseSales)}<span style={{ fontSize:13, marginLeft:4 }}>円</span></div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                  {isKoTaku
                    ? `手取り ${fmt2(parseInt(wantedTake)||0)}円 + 経費${fmt2(pending.expenses||0)}円`
                    : `手取り ${fmt2(parseInt(wantedTake)||0)}円 ÷ 歩合${takePay.rate}% + 控除${fmt2(takePay.deduction)}円`}
                </div>
              </div>
            )}
            {reverseSales > 0 && (
              <Btn onClick={()=>setGoal(reverseSales)} variant={goalSaved?"secondary":"primary"}>
                {goalSaved ? "✓ 目標に設定しました" : "この売上を目標にする（税抜）"}
              </Btn>
            )}
          </div>
        )}

        {/* 売上から計算 */}
        {calcMode === "forward" && (
          <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>月間売上（税抜）</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
              <input type="number" value={salesInput} onChange={e=>setSalesInput(e.target.value)}
                onFocus={e=>e.target.select()} placeholder="例: 450000"
                style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:16, outline:"none" }}/>
              <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>円</span>
            </div>
            {forwardTake > 0 && (
              <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>手取り（概算）</div>
                <div style={{ fontSize:30, fontWeight:900, color:C.accentLight }}>{fmt2(forwardTake)}<span style={{ fontSize:13, marginLeft:4 }}>円</span></div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                  {isKoTaku
                    ? `売上 ${fmt2(parseInt(salesInput)||0)}円 − 経費 ${fmt2(pending.expenses||0)}円`
                    : `売上 ${fmt2(parseInt(salesInput)||0)}円 × 歩合${takePay.rate}% − 控除${fmt2(takePay.deduction)}円`}
                </div>
              </div>
            )}
            {forwardTake > 0 && (
              <Btn onClick={()=>setGoal(parseInt(salesInput)||0)} variant={goalSaved?"secondary":"primary"}>
                {goalSaved ? "✓ 目標に設定しました" : "この売上を目標にする（税抜）"}
              </Btn>
            )}
          </div>
        )}

        <div style={{ fontSize:10, color:C.muted, marginTop:12 }}>※ 概算です。実際の手取りは会社の規定により異なります。</div>
      </Card>
    </div>
  );
}

function AccountSection({ user }) {
  const [emailMode, setEmailMode]   = useState(false);
  const [passMode,  setPassMode]    = useState(false);
  const [newEmail,  setNewEmail]    = useState("");
  const [newPass,   setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [msg,  setMsg]  = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  const inputSt = { width:"100%", padding:"10px 12px", borderRadius:9, border:`1px solid ${C.border}`, backgroundColor:C.bg, color:C.text, fontSize:13, outline:"none", boxSizing:"border-box" };

  async function handleEmailChange() {
    if (!newEmail) { setErr("新しいメールアドレスを入力してください"); return; }
    setBusy(true); setErr(""); setMsg("");
    const { error } = await updateEmail(newEmail);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。");
    setEmailMode(false); setNewEmail("");
  }

  async function handlePassChange() {
    if (!newPass || newPass.length < 6) { setErr("6文字以上のパスワードを入力してください"); return; }
    if (newPass !== confirmPass) { setErr("パスワードが一致しません"); return; }
    setBusy(true); setErr(""); setMsg("");
    const { error } = await updatePassword(newPass);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("パスワードを変更しました。");
    setPassMode(false); setNewPass(""); setConfirmPass("");
  }

  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:12 }}>アカウント</div>

      {/* 現在のメアド表示 */}
      <div style={{ fontSize:12, color:C.muted, marginBottom:12, padding:"10px 12px", backgroundColor:C.card, borderRadius:9, border:`1px solid ${C.border}` }}>
        <span style={{ color:C.sub, marginRight:6 }}>メールアドレス:</span>{user.email}
      </div>

      {/* メアド変更 */}
      {!emailMode ? (
        <button onClick={()=>{ setEmailMode(true); setPassMode(false); setErr(""); setMsg(""); }}
          style={{ width:"100%", padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:C.card, color:C.sub, marginBottom:8 }}>
          メールアドレスを変更する
        </button>
      ) : (
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginBottom:8 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>新しいメールアドレス</div>
          <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@example.com" style={{ ...inputSt, marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleEmailChange} disabled={busy} style={{ flex:2, padding:"10px 0", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff", opacity:busy?0.5:1 }}>{busy?"送信中...":"確認メールを送る"}</button>
            <button onClick={()=>{ setEmailMode(false); setNewEmail(""); setErr(""); }} style={{ flex:1, padding:"10px 0", borderRadius:9, fontSize:13, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* パスワード変更 */}
      {!passMode ? (
        <button onClick={()=>{ setPassMode(true); setEmailMode(false); setErr(""); setMsg(""); }}
          style={{ width:"100%", padding:"11px 0", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:C.card, color:C.sub, marginBottom:8 }}>
          パスワードを変更する
        </button>
      ) : (
        <div style={{ backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginBottom:8 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>新しいパスワード（6文字以上）</div>
          <div style={{ position:"relative", marginBottom:8 }}>
            <input type={showNewPass?"text":"password"} value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="••••••••" style={{ ...inputSt, paddingRight:44 }}/>
            <button type="button" onClick={()=>setShowNewPass(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.muted, padding:4, display:"flex", alignItems:"center" }}>
              {showNewPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>確認（もう一度）</div>
          <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="••••••••" style={{ ...inputSt, marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handlePassChange} disabled={busy} style={{ flex:2, padding:"10px 0", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff", opacity:busy?0.5:1 }}>{busy?"変更中...":"パスワードを変更する"}</button>
            <button onClick={()=>{ setPassMode(false); setNewPass(""); setConfirmPass(""); setErr(""); }} style={{ flex:1, padding:"10px 0", borderRadius:9, fontSize:13, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted }}>キャンセル</button>
          </div>
        </div>
      )}

      {err && <div style={{ fontSize:12, color:C.red, marginTop:6, padding:"8px 12px", backgroundColor:C.redGlow, borderRadius:8 }}>{err}</div>}
      {msg && <div style={{ fontSize:12, color:C.green, marginTop:6, padding:"8px 12px", backgroundColor:C.green+"15", borderRadius:8 }}>✓ {msg}</div>}
    </div>
  );
}

function DeleteSection({ onDeleteAccount }) {
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    if (onDeleteAccount) await onDeleteAccount();
  };
  return (
    <div style={{ marginTop:24 }}>
      {deleteStep === 0 && (
        <div onClick={()=>setDeleteStep(1)} style={{ textAlign:"center", fontSize:12, color:C.muted, textDecoration:"underline", cursor:"pointer", padding:"8px 0" }}>
          アカウントを削除する
        </div>
      )}
      {deleteStep === 1 && (
        <div style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:8 }}>⚠️ アカウント削除</div>
          <div style={{ fontSize:12, color:C.sub, lineHeight:1.7, marginBottom:14 }}>
            アカウントを削除します。ログインできなくなります。この操作は取り消せません。
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={()=>setDeleteStep(0)} style={{ flex:1, fontSize:12 }}>キャンセル</Btn>
            <Btn onClick={()=>setDeleteStep(2)} variant="danger" style={{ flex:1, fontSize:12 }}>削除に進む</Btn>
          </div>
        </div>
      )}
      {deleteStep === 2 && (
        <div style={{ backgroundColor:C.redGlow, border:`2px solid ${C.red}`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:8 }}>本当に削除しますか？</div>
          <div style={{ fontSize:12, color:C.sub, lineHeight:1.7, marginBottom:14 }}>
            アカウントを即時削除します。ログインできなくなります。記録したデータは運営側で保持されます。
          </div>
          <Btn onClick={handleDelete} variant="danger" disabled={deleting} style={{ width:"100%", fontSize:13 }}>
            {deleting ? "削除中..." : "削除する（取り消し不可）"}
          </Btn>
          <div onClick={()=>setDeleteStep(0)} style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:10, cursor:"pointer" }}>戻る</div>
        </div>
      )}
    </div>
  );
}

function NotifSection({ notifSettings, onUpdateNotif }) {
  const [notifTab, setNotifTab] = useState("settings");
  const [quietHours, setQuietHours] = useState(() => loadS("taxi_quiet_hours", { enabled:true, from:"23:00", to:"07:00" }));
  const saveQuiet = (next) => { setQuietHours(next); saveS("taxi_quiet_hours", next); };
  const NOTIF_ITEMS = [
    { k:"delays",      icon:"🚃", l:"電車遅延チャンス通知",   d:"遅延・見合わせ発生時（エリア内）" },
    { k:"events",      icon:"🎵", l:"イベント前通知",         d:"出勤予定のイベントの60分前" },
    { k:"traffic",     icon:"🚗", l:"重大渋滞通知",           d:"渋滞レベル3以上の発生時" },
    { k:"dailyTip",    icon:"🤖", l:"AI日次戦略通知",         d:"毎朝8時にエリア別の戦略ヒント" },
    { k:"achievement", icon:"🏆", l:"自己ベスト更新通知",     d:"売上・実車率・時間単価の更新時" },
    { k:"dailyResult", icon:"📣", l:"翌日発表通知",           d:"毎朝8時 — 前日の集計・エリア平均" },
  ];
  const MOCK_LOG = [
    { icon:"🚃", title:"電車遅延チャンス", body:"東海道線が遅延中（横浜方面）。駅周辺の需要が上昇しています。", time:"今日 18:42", read:false },
    { icon:"🏆", title:"自己ベスト更新！", body:"今日の売上が過去最高の73,200円を記録しました！", time:"今日 06:31", read:false },
    { icon:"📣", title:"翌日発表 — 6/11", body:"昨日の平均売上: 62,400円。あなたは上位28%でした。", time:"昨日 08:00", read:true },
    { icon:"🤖", title:"今日の戦略ヒント", body:"金曜夜は六本木・銀座エリアの需要が高い傾向があります。", time:"昨日 08:00", read:true },
    { icon:"🎵", title:"イベント前通知", body:"横浜アリーナでコンサートが19:00開始。17時以降に現地入り推奨。", time:"6/11 16:00", read:true },
  ];
  return (
    <>
      <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:10, padding:3, gap:3, marginBottom:16 }}>
        {[["settings","⚙️ 設定"],["log","📋 通知ログ"]].map(([v,l])=>(
          <div key={v} onClick={()=>setNotifTab(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:notifTab===v?700:400, backgroundColor:notifTab===v?C.card:"transparent", color:notifTab===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
        ))}
      </div>
      {notifTab === "settings" && (
        <>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>🌙 サイレント時間帯</div>
          <Card style={{ marginBottom:14, padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: quietHours.enabled ? 14 : 0 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>おやすみモード</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>設定した時間帯は通知を受け取りません</div>
              </div>
              <Toggle value={quietHours.enabled} onChange={v=>saveQuiet({...quietHours, enabled:v})}/>
            </div>
            {quietHours.enabled && (
              <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:5 }}>開始</div>
                  <input type="time" value={quietHours.from} onChange={e=>saveQuiet({...quietHours, from:e.target.value})}
                    style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px", color:C.text, fontSize:14, fontWeight:700, outline:"none" }}/>
                </div>
                <div style={{ fontSize:18, color:C.muted, paddingTop:14 }}>〜</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:5 }}>終了</div>
                  <input type="time" value={quietHours.to} onChange={e=>saveQuiet({...quietHours, to:e.target.value})}
                    style={{ width:"100%", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px", color:C.text, fontSize:14, fontWeight:700, outline:"none" }}/>
                </div>
              </div>
            )}
          </Card>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>📬 通知の種類</div>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {NOTIF_ITEMS.map(({k,icon,l,d}, i)=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", borderBottom: i<NOTIF_ITEMS.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{l}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{d}</div>
                  </div>
                </div>
                <Toggle value={notifSettings[k]||false} onChange={v=>onUpdateNotif(k,v)}/>
              </div>
            ))}
          </Card>
          <div style={{ marginTop:12, padding:"10px 14px", backgroundColor:C.surface, borderRadius:10, fontSize:11, color:C.muted, lineHeight:1.7 }}>
            💡 プッシュ通知は有料プランで利用可能です。現在はアプリ内通知のみ対応しています。
          </div>
        </>
      )}
      {notifTab === "log" && (
        <>
          <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>直近7日間の通知履歴</div>
          {MOCK_LOG.map((n, i) => (
            <div key={i} style={{ display:"flex", gap:12, padding:"13px 14px", backgroundColor: n.read ? C.surface : C.accentGlow, border:`1px solid ${n.read ? C.border : C.accentLight+"44"}`, borderRadius:12, marginBottom:8 }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{n.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ fontSize:13, fontWeight:n.read?600:800, color:C.text }}>{n.title}</div>
                  {!n.read && <div style={{ width:7, height:7, borderRadius:"50%", backgroundColor:C.accentLight, flexShrink:0 }}/>}
                </div>
                <div style={{ fontSize:12, color:C.sub, lineHeight:1.6 }}>{n.body}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:5 }}>{n.time}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function ExportSection({ user, reports }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const [exportYear,  setExportYear]  = useState(thisYear);
  const [exportMonth, setExportMonth] = useState(thisMonth);
  const [exportRange, setExportRange] = useState("month");

  const getReports = () => {
    if (exportRange === "month") {
      const prefix = `${exportYear}-${String(exportMonth).padStart(2,"0")}`;
      return reports.filter(r => r.date.startsWith(prefix));
    }
    return reports.filter(r => r.date.startsWith(String(exportYear)));
  };
  const label = exportRange === "month"
    ? `${exportYear}年${exportMonth}月`
    : `${exportYear}年間`;
  const targetReports = getReports();

  let allRecs = [];
  try { allRecs = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]"); } catch {}
  const recs = exportRange === "month"
    ? allRecs.filter(r => (r.workDate||"").startsWith(`${exportYear}-${String(exportMonth).padStart(2,"0")}`))
    : allRecs.filter(r => (r.workDate||"").startsWith(String(exportYear)));

  return (
    <div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>期間</div>
      <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:10, padding:3, gap:3, marginBottom:14 }}>
        {[["month","月次"],["year","年次"]].map(([v,l])=>(
          <div key={v} onClick={()=>setExportRange(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:exportRange===v?700:400, backgroundColor:exportRange===v?C.card:"transparent", color:exportRange===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <select value={exportYear} onChange={e=>setExportYear(Number(e.target.value))}
          style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}>
          {[thisYear, thisYear-1, thisYear-2].map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
        {exportRange === "month" && (
          <select value={exportMonth} onChange={e=>setExportMonth(Number(e.target.value))}
            style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}>
            {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
          </select>
        )}
      </div>
      <div style={{ backgroundColor:C.surface, borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:13, color:C.muted }}>{label} の日報</div>
        <div style={{ fontSize:18, fontWeight:800, color: targetReports.length>0?C.text:C.muted }}>{targetReports.length}<span style={{ fontSize:12, marginLeft:3 }}>件</span></div>
      </div>
      {targetReports.length === 0 ? (
        <div style={{ textAlign:"center", padding:"24px", color:C.muted, fontSize:13 }}>この期間の日報はありません</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={()=>downloadCSV(targetReports, label)}
            style={{ width:"100%", padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.green, color:"#fff" }}>
            📊 CSV でダウンロード
          </button>
          <button onClick={()=>printAsPDF(targetReports, label, user)}
            style={{ width:"100%", padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:C.card, color:C.text }}>
            🖨️ PDF で印刷 / 保存
          </button>
        </div>
      )}
      <div style={{ marginTop:12, fontSize:11, color:C.muted, lineHeight:1.7 }}>
        ※ PDFはブラウザの印刷ダイアログから「PDFとして保存」を選んでください。
      </div>
      <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:10 }}>乗車記録</div>
        <div style={{ backgroundColor:C.surface, borderRadius:10, padding:"12px 16px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13, color:C.muted }}>{label} の乗車記録</div>
          <div style={{ fontSize:18, fontWeight:800, color: recs.length>0?C.text:C.muted }}>{recs.length}<span style={{ fontSize:12, marginLeft:3 }}>件</span></div>
        </div>
        {recs.length > 0 ? (
          <button onClick={()=>downloadRideRecordsCSV(recs, label)}
            style={{ width:"100%", padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:C.accentLight, color:"#fff" }}>
            🚕 乗車記録を CSV でダウンロード
          </button>
        ) : (
          <div style={{ textAlign:"center", padding:"16px", color:C.muted, fontSize:13 }}>この期間の乗車記録はありません</div>
        )}
      </div>

      {/* 全データJSONバックアップ */}
      <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:6 }}>🔒 データバックアップ</div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, marginBottom:12 }}>
          全日報データをJSONファイルとして保存します。万が一のデータ消失に備えて定期的にバックアップを取っておくことをおすすめします。
        </div>
        <button onClick={() => {
          const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            reportCount: reports.length,
            reports: reports.map(r => ({
              date: r.date || r.report_date,
              gross_sales: r.gross_sales,
              cash_sales: r.cash_sales,
              card_sales: r.card_sales,
              app_sales: r.app_sales,
              highway_fee: r.highway_fee,
              ride_count: r.ride_count,
              total_distance: r.total_distance,
              occupied_distance: r.occupied_distance,
              work_hours: r.work_hours,
              break_hours: r.break_hours,
              trouble_note: r.trouble_note,
              ai_comment: r.ai_comment,
            })),
          };
          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `タクロー_バックアップ_${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }} style={{ width:"100%", padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:"#6366f1", color:"#fff" }}>
          💾 全日報データをバックアップ（{reports.length}件）
        </button>
        <div style={{ marginTop:8, fontSize:11, color:C.muted }}>
          ※ バックアップファイルはお手持ちのデバイスに保存されます
        </div>
      </div>
    </div>
  );
}

function CouponSection({ user }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) { setLoading(false); return; }
    fetchMyCoupons(user.id).then(({ data }) => { setCoupons(data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [user?.id]);

  const typeLabel = { invited:"招待登録特典", milestone:"招待マイルストーン特典" };
  const typeIcon  = { invited:"🎁", milestone:"🏅" };

  return (
    <div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>保有クーポン</div>
      {loading ? (
        <Card><div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:13 }}>読み込み中...</div></Card>
      ) : coupons.length === 0 ? (
        <Card>
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎟️</div>
            <div style={{ fontSize:13, color:C.muted }}>まだクーポンがありません</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>友達を招待すると特典クーポンが届きます</div>
          </div>
        </Card>
      ) : (
        <Card style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
          {coupons.map((cp, i) => (
            <div key={cp.id} style={{ padding:"14px 16px", borderBottom: i<coupons.length-1?`1px solid ${C.border}`:"none" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, backgroundColor:cp.used_at?C.surface:C.accentLight+"22", border:`1px solid ${cp.used_at?C.border:C.accentLight+"44"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                  {typeIcon[cp.type] || "🎟️"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:cp.used_at?C.muted:C.text }}>{typeLabel[cp.type] || "クーポン"}</span>
                    {cp.used_at && <span style={{ fontSize:10, color:C.muted, backgroundColor:C.surface, padding:"1px 6px", borderRadius:4, fontWeight:600 }}>使用済み</span>}
                  </div>
                  <div style={{ fontSize:12, color:cp.used_at?C.muted:C.accentLight, fontWeight:700 }}>無料期間 +{cp.benefit_days}日</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>
                    発行日: {new Date(cp.issued_at).toLocaleDateString("ja-JP")}
                    {cp.expires_at ? ` ／ 有効期限: ${new Date(cp.expires_at).toLocaleDateString("ja-JP")}` : " ／ 有効期限: 無期限"}
                  </div>
                </div>
                <button disabled style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, backgroundColor:C.surface, color:C.muted, fontSize:11, fontWeight:700, cursor:"not-allowed", flexShrink:0, opacity:cp.used_at?0.4:0.8 }}>
                  近日公開
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <div style={{ padding:"12px 14px", backgroundColor:C.surface, borderRadius:10, fontSize:11, color:C.muted, lineHeight:1.8 }}>
        🎟️ クーポンは友達招待の特典として自動発行されます。<br/>
        ⏳ クーポン適用機能は有料プランと同時に公開予定です。<br/>
        ✅ 保有クーポンは期限なし（無期限）で保存されます。
      </div>
    </div>
  );
}

function ReferralSection({ user }) {
  const myCode = user?.referral_code || null;
  const appUrl = "https://taxi-app-nine-eta.vercel.app";
  const refUrl = myCode ? `${appUrl}/?ref=${myCode}` : appUrl;
  const shareText = `タクシードライバー向けアプリ「タクロー」を使ってみて！日報記録・売上分析・AIアドバイスが全部ひとつ🦉\n招待コード: ${myCode}\n${refUrl}`;

  const [copied, setCopied]         = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) { setLoading(false); return; }
    fetchMyReferralStats(user.id, myCode).then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, [user?.id]);

  const total = stats?.events?.length ?? 0;
  const MILESTONES = [1, 3, 6, 9, 12];
  const nextMilestone = MILESTONES.find(m => m > total) ?? null;
  const lastMilestone = [...MILESTONES].reverse().find(m => m <= total) ?? 0;

  const copyCode = () => {
    navigator.clipboard.writeText(myCode || "").catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  };
  const copyLink2 = () => {
    navigator.clipboard.writeText(refUrl).catch(()=>{});
    setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 2000);
  };
  const shareLine = () => {
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`, "_blank");
  };

  const REWARD_TIERS = [
    { count:1,  days:14,  label:"1人招待",   benefit:"+14日延長クーポン", xp:100 },
    { count:3,  days:30,  label:"3人招待",   benefit:"+30日延長クーポン", xp:100 },
    { count:6,  days:30,  label:"6人招待",   benefit:"+30日延長クーポン", xp:100 },
    { count:9,  days:30,  label:"9人招待",   benefit:"+30日延長クーポン", xp:100 },
    { count:12, days:30,  label:"12人招待",  benefit:"+30日延長クーポン", xp:100 },
  ];

  if (!myCode && !loading) {
    return (
      <Card>
        <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:13 }}>
          招待コードの準備中です。少し待ってからもう一度開いてください。
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ background:`linear-gradient(135deg, ${C.accentLight}18, ${C.accentLight}08)`, border:`1px solid ${C.accentLight}33`, borderRadius:14, padding:"16px", marginBottom:16, textAlign:"center" }}>
        <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>累計招待人数</div>
        <div style={{ fontSize:40, fontWeight:900, color:C.text }}>
          {loading ? "—" : total}
          <span style={{ fontSize:16, color:C.muted, marginLeft:4 }}>人</span>
        </div>
        {!loading && total > 0 && (
          <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginTop:4 }}>累計 +{total * 100} XP 獲得</div>
        )}
        {!loading && nextMilestone && (
          <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>あと{nextMilestone - total}人で次の特典クーポン！</div>
        )}
        {!loading && !nextMilestone && total > 0 && (
          <div style={{ fontSize:12, color:C.green, fontWeight:700, marginTop:4 }}>🏆 全マイルストーン達成！</div>
        )}
      </div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>あなたの招待コード</div>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:18, fontWeight:900, color:C.accentLight, letterSpacing:"2px", fontFamily:"monospace" }}>{myCode || "..."}</div>
        </div>
        <button onClick={copyCode} style={{ padding:"0 16px", borderRadius:10, border:`1px solid ${copied?C.green:C.border}`, backgroundColor:copied?C.greenGlow:C.card, color:copied?C.green:C.sub, fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
          {copied ? "✓ 済" : "コピー"}
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
        <button onClick={shareLine} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px 0", borderRadius:11, border:"1px solid #06C75544", backgroundColor:"#06C75514", color:"#06C755", fontSize:14, fontWeight:800, cursor:"pointer" }}>
          💬 LINEで送る
        </button>
        <button onClick={copyLink2} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px 0", borderRadius:11, border:`1px solid ${copiedLink?C.green:C.border}`, backgroundColor:copiedLink?C.greenGlow:C.card, color:copiedLink?C.green:C.sub, fontSize:14, fontWeight:700, cursor:"pointer" }}>
          {copiedLink ? "✓ コピー済" : "🔗 リンクをコピー"}
        </button>
      </div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>🎁 招待特典（累計人数で達成）</div>
      <Card style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
        {REWARD_TIERS.map((tier, i) => {
          const achieved = total >= tier.count;
          const isCurrent = lastMilestone === tier.count && achieved;
          return (
            <div key={tier.count} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderBottom: i < REWARD_TIERS.length-1 ? `1px solid ${C.border}` : "none", backgroundColor: isCurrent ? C.accentLight+"0c" : "transparent" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", backgroundColor: achieved ? C.green+"22" : C.surface, border:`2px solid ${achieved ? C.green : C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color: achieved ? C.green : C.muted, flexShrink:0 }}>
                {achieved ? "✓" : tier.count}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color: achieved ? C.text : C.muted }}>{tier.label}</div>
                <div style={{ fontSize:11, color: achieved ? C.green : C.muted, marginTop:2 }}>{tier.benefit}</div>
              </div>
              <div style={{ fontSize:11, color:C.accentLight, fontWeight:700, opacity: achieved ? 1 : 0.4 }}>+{tier.xp} XP</div>
              {achieved && <span style={{ fontSize:16 }}>🏅</span>}
            </div>
          );
        })}
      </Card>
      {stats?.events?.length > 0 && (
        <>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>招待した人</div>
          <Card style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
            {stats.events.map((e, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom: i < stats.events.length-1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", backgroundColor:C.accentLight+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🦉</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{e.referred_name || "ドライバー"}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{new Date(e.created_at).toLocaleDateString("ja-JP")}</div>
                </div>
                <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>登録済み</span>
              </div>
            ))}
          </Card>
        </>
      )}
      <div style={{ padding:"10px 14px", backgroundColor:C.surface, borderRadius:10, fontSize:11, color:C.muted, lineHeight:1.8 }}>
        ※ 招待した相手が登録完了した時点でカウントされます。<br/>
        ※ クーポンはアプリ内通知でお知らせします。<br/>
        ※ 招待された方は登録時に+30日の無料期間が付与されます。
      </div>
    </div>
  );
}

function FeedbackSection({ user }) {
  const CATEGORIES = [
    { id:"feature", label:"✨ 機能要望", color:C.accentLight },
    { id:"bug",     label:"🐛 バグ報告", color:C.red },
    { id:"praise",  label:"👍 良かった点", color:C.green },
    { id:"other",   label:"💭 その他",    color:C.muted },
  ];
  const [fbCategory, setFbCategory] = useState("feature");
  const [fbBody, setFbBody]         = useState("");
  const [fbAnon, setFbAnon]         = useState(false);
  const [fbState, setFbState]       = useState("idle");

  const handleSend = async () => {
    if (!fbBody.trim()) return;
    setFbState("sending");
    try {
      if (SUPABASE_READY) {
        const { error } = await insertFeedback({ userId: user?.id, category: fbCategory, body: fbBody.trim(), anonymous: fbAnon });
        if (error) throw error;
      } else {
        const prev = loadS("taxi_feedback_local", []);
        saveS("taxi_feedback_local", [...prev, { category: fbCategory, body: fbBody.trim(), anonymous: fbAnon, at: new Date().toISOString() }]);
        await new Promise(r => setTimeout(r, 600));
      }
      setFbState("done");
      setFbBody("");
    } catch {
      setFbState("error");
    }
  };

  if (fbState === "done") {
    return (
      <div style={{ textAlign:"center", padding:"48px 24px" }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🙏</div>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>ありがとうございます！</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:24, lineHeight:1.8 }}>ご意見はしっかり読んで、アプリ改善に活かします。</div>
        <button onClick={()=>setFbState("idle")} style={{ padding:"10px 24px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", color:C.accentLight, cursor:"pointer", fontSize:13, fontWeight:700 }}>
          もう一件送る
        </button>
      </div>
    );
  }

  const catColor = CATEGORIES.find(c=>c.id===fbCategory)?.color || C.muted;

  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16, lineHeight:1.8 }}>
        アプリへのご意見・要望・バグ報告をお送りください。開発者が全件読んでいます。
      </div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>カテゴリ</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {CATEGORIES.map(cat=>(
          <div key={cat.id} onClick={()=>setFbCategory(cat.id)}
            style={{ padding:"10px 12px", borderRadius:10, border:`2px solid ${fbCategory===cat.id?cat.color:C.border}`, backgroundColor:fbCategory===cat.id?cat.color+"15":"transparent", color:fbCategory===cat.id?cat.color:C.muted, fontSize:13, fontWeight:fbCategory===cat.id?700:400, cursor:"pointer", textAlign:"center" }}>
            {cat.label}
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>内容</div>
      <textarea
        value={fbBody}
        onChange={e=>setFbBody(e.target.value)}
        placeholder="例：〇〇機能が使いにくい、△△画面でエラーが出る など"
        rows={5}
        style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${fbBody?catColor+"77":C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:13, outline:"none", resize:"vertical", lineHeight:1.7, fontFamily:"inherit" }}
      />
      <div style={{ fontSize:11, color:C.muted, textAlign:"right", marginTop:4, marginBottom:16 }}>{fbBody.length} 文字</div>
      <div onClick={()=>setFbAnon(p=>!p)} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, cursor:"pointer" }}>
        <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${fbAnon?C.accentLight:C.border}`, backgroundColor:fbAnon?C.accentLight:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {fbAnon && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
        </div>
        <div>
          <div style={{ fontSize:13, color:C.text }}>匿名で送る</div>
          <div style={{ fontSize:11, color:C.muted }}>チェックするとユーザーIDが送信されません</div>
        </div>
      </div>
      {fbState === "error" && (
        <div style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:12, color:C.red }}>
          送信に失敗しました。しばらく待ってから再度お試しください。
        </div>
      )}
      <button onClick={handleSend} disabled={!fbBody.trim() || fbState==="sending"}
        style={{ width:"100%", padding:"13px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:fbBody.trim()?"pointer":"not-allowed", border:"none", backgroundColor:fbBody.trim()?catColor:"#444", color:fbBody.trim()?"#fff":"#888", opacity:fbState==="sending"?0.6:1 }}>
        {fbState === "sending" ? "送信中..." : "📨 送信する"}
      </button>
    </div>
  );
}

function HelpSection({ setSubTab }) {
  const FAQ_DATA = [
    { category:"日報の記録", icon:"📋", items:[
      { q:"日報はどうやって登録するの？", a:"下のナビバーの「＋ アップロード」タブから登録できます。カメラで日報を撮影するとAIが自動読み取り（OCR）します。手動入力も可能です。" },
      { q:"OCRが正確に読み取れない", a:"画像が暗い・斜め・ぼけている場合に精度が下がります。明るい場所でまっすぐ撮影してください。読み取り後に数値を手修正することもできます。" },
      { q:"過去の日報を編集したい", a:"「記録」タブから日報を選び、詳細画面の「✏️ 編集」ボタンで修正できます。一覧画面の各カード右側の小さな✏️からも直接編集できます。" },
      { q:"1日に複数の日報を登録できる？", a:"はい、同じ日付で複数登録できます。日報は日付ごとに管理されます。" },
    ]},
    { category:"目標・売上", icon:"🎯", items:[
      { q:"月の目標売上はどこで設定する？", a:"設定 › プロフィール から「月間目標売上」を変更できます。" },
      { q:"残りシフトの計算はどうやってる？", a:"隔日勤務の場合は残り日数÷2、それ以外は残り日数×0.75で推定しています。シフト実績と異なる場合があります。" },
      { q:"手取り計算の歩合・控除を変えたい", a:"設定 › 手取り設定 から歩合率と固定控除額を変更できます。" },
    ]},
    { category:"乗り場ガイド", icon:"📍", items:[
      { q:"乗り場ガイドの情報はいつ更新されるの？", a:"現在はアプリのバージョンアップ時に更新されます。今後、ドライバーからの投稿で随時更新できる仕組みを検討中です。" },
      { q:"自分のエリア外の乗り場も見られる？", a:"はい、全ての乗り場・空港を閲覧できます。エリア設定はホームの情報表示の絞り込みにのみ影響します。" },
      { q:"お気に入りに追加した乗り場はどこに保存される？", a:"お使いの端末のローカルに保存されます。アプリを削除すると消えます。" },
    ]},
    { category:"XP・レベル", icon:"🏅", items:[
      { q:"XPはどうすれば貯まるの？", a:"日報登録（+20XP）、毎日ログイン（+5〜10XP）、デイリーミッション達成、実績バッジ獲得などで増えます。" },
      { q:"レベルが上がると何がある？", a:"現在はドライバー称号（見習い→ベテラン→エースなど）が変わります。今後、上位ランクへの特典を追加予定です。" },
    ]},
    { category:"アカウント・データ", icon:"🔐", items:[
      { q:"データはどこに保存されているの？", a:"Supabaseのクラウドに安全に暗号化して保存されています。アカウント登録することでデータはどの端末からもアクセスできます。" },
      { q:"アカウントを削除したい", a:"設定 › プロフィール の一番下から削除できます。削除するとすぐにログインできなくなります。記録したデータは運営側で保持されます。" },
      { q:"無料プランでできることは？", a:"βテスト期間中は全機能を月30回のOCR読み取りを含めて無料でお使いいただけます。基本的な売上グラフ・分析・乗り場ガイドもすべて無料です。" },
    ]},
  ];
  const [helpSearch, setHelpSearch] = useState("");
  const [openItems, setOpenItems]   = useState({});
  const toggleItem = key => setOpenItems(p => ({...p, [key]: !p[key]}));
  const q = helpSearch.trim().toLowerCase();
  const filtered = FAQ_DATA.map(cat => ({
    ...cat,
    items: cat.items.filter(item => !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
  })).filter(cat => cat.items.length > 0);

  return (
    <div>
      <div style={{ position:"relative", marginBottom:16 }}>
        <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", fontSize:14, color:C.muted, pointerEvents:"none" }}>🔍</span>
        <input
          value={helpSearch}
          onChange={e=>setHelpSearch(e.target.value)}
          placeholder="キーワードで検索（例：OCR、編集）"
          style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px 10px 34px", fontSize:13, color:C.text, outline:"none" }}
        />
        {helpSearch && (
          <button onClick={()=>setHelpSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>×</button>
        )}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🤔</div>
          <div style={{ fontSize:14 }}>「{helpSearch}」に一致する質問が見つかりませんでした</div>
        </div>
      )}
      {filtered.map(cat => (
        <div key={cat.category} style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>{cat.icon} {cat.category}</div>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {cat.items.map((item, idx) => {
              const key = cat.category + idx;
              const isOpen = !!openItems[key];
              return (
                <div key={idx} style={{ borderBottom: idx < cat.items.length-1 ? `1px solid ${C.border}` : "none" }}>
                  <div onClick={()=>toggleItem(key)} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer" }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:isOpen?700:400, color:isOpen?C.text:C.sub, lineHeight:1.4 }}>{item.q}</div>
                    <span style={{ color:C.muted, fontSize:14, flexShrink:0 }}>{isOpen?"▲":"▼"}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding:"0 16px 14px", fontSize:12, color:C.sub, lineHeight:1.8, borderTop:`1px solid ${C.border}`, backgroundColor:C.bg }}>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      ))}
      <div onClick={()=>setSubTab("feedback")} style={{ marginTop:8, padding:"14px 16px", backgroundColor:C.surface, borderRadius:12, border:`1px solid ${C.border}`, textAlign:"center", cursor:"pointer" }}>
        <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>解決しませんでしたか？</div>
        <div style={{ fontSize:13, color:C.accentLight, fontWeight:700 }}>💬 意見箱に送る →</div>
      </div>
    </div>
  );
}

export default function Settings({ user, onUpdate, onLogout, onDeleteAccount, onManageArea, notifSettings, onUpdateNotif, appMode="standard", onModeChange, themeMode="auto", onThemeChange, showFAB=true, onToggleFAB, showAiMilestone=true, onToggleAiMilestone, reports=[], initialSection="", onBack, onOpenAdmin, onAccountLink }) {
  const [subTab, setSubTab] = useState(initialSection);
  const [form, setForm] = useState({ name:user.name||"", company:user.company||"", workType:user.workType||"隔日勤務", target:user.target||"" });
  const [saved, setSaved] = useState(false);
  const [rankPrefs, setRankPrefs] = useState({ showMyRank:false, showTopSales:false });
  const [takePay, setTakePay] = useState(loadS("taxi_takepay", { rate:55, deduction:30000 }));
  const save = () => { onUpdate(form); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const saveTakePay = (next) => { setTakePay(next); saveS("taxi_takepay", next); };

  const SECTIONS = [
    { label: "アカウント", items: [
      {id:"account", icon:"🔗", label:"アカウント",        sub: user?._isGuest ? "⚠️ 未連携（データが危険）" : (user?.email || "連携済み")},
      {id:"plan",    icon:"💳", label:"プラン",             sub:user?.plan==="pro"?"プロ":user?.plan==="standard"?"スタンダード":"無料プラン"},
    ]},
    { label: "表示設定", items: [
      {id:"mode",    icon:"🎛️", label:"画面設定", sub:appMode==="simple"?"かんたん":appMode==="simple_large"?"かんたん（大）":appMode==="analysis"?"分析":"かんたん"},
      {id:"ai",      icon:"🤖", label:"AI設定",   sub: showAiMilestone ? "分析オン" : "分析オフ"},
      {id:"area",    icon:"📍", label:"エリア",              sub:user.areas?.length>0?user.areas[0]:"未設定"},
      {id:"notif",   icon:"🔔", label:"通知",                sub:"アラート設定"},
    ]},
    { label: "収入計算", items: [
      {id:"closing", icon:"📅", label:"締日設定",            sub: user.closing_day ? `毎月${user.closing_day}日締め` : "月末締め"},
      {id:"takepay", icon:"💴", label:"売上・手取り設定",       sub: user.workType==="個人タクシー" ? `経費${((takePay.expenses||0)/10000).toFixed(1)}万円/月` : user.target ? `目標¥${parseInt(user.target).toLocaleString()} / 歩合${takePay.rate}%` : `歩合${takePay.rate}% / 控除${(takePay.deduction/10000).toFixed(1)}万円`},
    ]},
    { label: "特典", items: [
      {id:"referral",icon:"🎁", label:"友達を招待",           sub:"紹介リンク・特典"},
      {id:"coupon",  icon:"🎟️", label:"クーポンコード",       sub:"割引・特典コードを入力"},
      {id:"rank",    icon:"🏆", label:"ランク",              sub:"XP・バッジ・レベル"},
    ]},
    { label: "データ", items: [
      {id:"export",  icon:"📤", label:"データエクスポート",    sub:"CSV / PDF 出力"},
    ]},
    { label: "サポート", items: [
      {id:"feedback",icon:"💬", label:"意見箱",               sub:"要望・バグ報告・ひとこと"},
      {id:"help",    icon:"❓", label:"ヘルプ・FAQ",           sub:"よくある質問"},
      {id:"roadmap", icon:"🗺️", label:"ロードマップ",          sub:"開発予定"},
    ]},
    { label: "規約", items: [
      {id:"terms",   icon:"📄", label:"利用規約",             sub:"タクロー利用規約"},
      {id:"privacy", icon:"🔒", label:"プライバシーポリシー",  sub:"個人情報の取り扱い"},
      ...(user?.email === ADMIN_EMAIL ? [{id:"admin", icon:"🦉", label:"管理画面", sub:"よしと専用"}] : []),
    ]},
  ];
  const SUB = SECTIONS.flatMap(s => s.items);

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>
      {!subTab ? (
        <>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>⚙️ 設定</div>
          {SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, paddingLeft:4, letterSpacing:"0.5px" }}>{section.label}</div>
              <Card style={{ padding:0, overflow:"hidden" }}>
                {section.items.map((t, i) => (
                  <div key={t.id} onClick={()=>{ if(t.id==="admin"){ onOpenAdmin?.(); return; } setSubTab(t.id); }} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", borderBottom: i<section.items.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}>
                    <div style={{ width:36, height:36, borderRadius:10, backgroundColor:C.accentLight+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{t.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{t.label}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{t.sub}</div>
                    </div>
                    <span style={{ color:C.muted, fontSize:18 }}>›</span>
                  </div>
                ))}
              </Card>
            </div>
          ))}
          {/* ログアウト */}
          {!user?._isGuest && (
            <div style={{ marginTop:8, marginBottom:16 }}>
              <Btn onClick={onLogout} variant="danger">ログアウト</Btn>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div onClick={()=>{ if (initialSection && subTab === initialSection && onBack) { onBack(); } else { setSubTab(""); } }} style={{ display:"flex", alignItems:"center", gap:4, color:C.accentLight, fontSize:14, cursor:"pointer", fontWeight:600 }}>‹ 戻る</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{SUB.find(t=>t.id===subTab)?.label}</div>
          </div>

      {subTab==="account" && (
        user?._isGuest ? (
          <div>
            {/* 警告バナー */}
            <div style={{ backgroundColor:"#FFF3E0", border:"1px solid #FF980055", borderRadius:12, padding:"14px 16px", marginBottom:20, display:"flex", alignItems:"flex-start", gap:10 }}>
              <span style={{ fontSize:20 }}>⚠️</span>
              <span style={{ fontSize:13, color:"#E65100", lineHeight:1.7 }}>外部アカウント未連携のため、機種変更またはアプリを削除した場合にデータが失われます</span>
            </div>

            <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:8, lineHeight:1.5 }}>連携すればすべてのデータが安全に保存されます</div>

            <Card style={{ marginBottom:20 }}>
              {[
                "端末をなくしてもデータ復旧可能",
                "機種変更時にもデータの引き継ぎが可能",
                "複数端末でデータの同期が可能",
                "締日設定が可能",
              ].map(t => (
                <div key={t} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}`, fontSize:14, color:C.sub }}>
                  <span style={{ color:C.accentLight, fontSize:16, flexShrink:0 }}>✓</span>{t}
                </div>
              ))}
            </Card>

            {onAccountLink && (
              <button onClick={onAccountLink} style={{ width:"100%", padding:"14px 0", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, backgroundColor:C.surface, color:C.text, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.2 33.5 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.5-5z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4.5 24 4.5c-7.5 0-14 4.3-17.7 10.2z"/><path fill="#FBBC05" d="M24 45.5c5.5 0 10.5-1.8 14.3-4.9l-6.6-5.4C29.7 36.9 27 38 24 38c-5.7 0-10.5-3.7-12.2-8.8l-7 5.4C8.3 41.4 15.5 45.5 24 45.5z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.6l6.6 5.4C42 36.4 44.5 31 44.5 25c0-1.4-.1-2.7-.5-5z"/></svg>
                Googleで連携する
              </button>
            )}
          </div>
        ) : (
          <Card>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", backgroundColor:C.accentLight+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>✓</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text }}>アカウント連携済み</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{user?.email || "Google アカウント"}</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.8, backgroundColor:C.bg, borderRadius:10, padding:"10px 14px" }}>
              データはクラウドに安全に保存されています。機種変更時もログインすれば引き継げます。
            </div>
            {/* メアド・パスワード変更 */}
            {!user._isGuest && SUPABASE_READY && <AccountSection user={user} />}
            {/* アカウント削除 */}
            <DeleteSection onDeleteAccount={onDeleteAccount} />
          </Card>
        )
      )}

      {subTab==="profile" && (
        <Card>
          {/* ゲストユーザー：アカウント連携バナー */}
          {user?._isGuest && onAccountLink && (
            <div style={{ backgroundColor:"#FFF3E0", border:"1px solid #FF980055", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#E65100", marginBottom:6 }}>⚠️ データが保護されていません</div>
              <div style={{ fontSize:12, color:"#BF360C", lineHeight:1.6, marginBottom:10 }}>アカウント未連携のため、機種変更やアプリ削除でデータが失われます。</div>
              <button onClick={onAccountLink} style={{ width:"100%", padding:"10px 0", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:"#E65100", color:"#fff" }}>
                アカウントを連携してデータを守る
              </button>
            </div>
          )}
          {/* アバター選択 */}
          {!user?._isGuest && SUPABASE_READY && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:12 }}>プロフィール画像</div>
              <AvatarPicker
                userId={user?.id}
                avatarUrl={user?.avatarUrl ?? null}
                avatarPreset={user?.avatarPreset ?? null}
                onSave={(vals) => onUpdate({ avatar_url: vals.avatar_url, avatar_preset: vals.avatar_preset })}
              />
            </div>
          )}
          {/* 区切り線 */}
          {!user?._isGuest && SUPABASE_READY && (
            <div style={{ height:1, backgroundColor:C.border, marginBottom:20 }}/>
          )}
          {[{l:"お名前",k:"name",t:"text"}].map(({l,k,t})=>(
            <div key={k} style={{ marginBottom:14 }}><div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{l}</div><input type={t} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"11px 12px", color:C.text, fontSize:15, outline:"none" }}/></div>
          ))}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>勤務形態</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {["日勤","夜勤","隔日勤務","個人タクシー"].map(t=>(
                <div key={t} onClick={()=>setForm(p=>({...p,workType:t}))} style={{ padding:"8px 0", textAlign:"center", borderRadius:9, border:`2px solid ${form.workType===t?C.accentLight:C.border}`, color:form.workType===t?C.accentLight:C.muted, fontSize:13, fontWeight:form.workType===t?700:400, cursor:"pointer" }}>{t}</div>
              ))}
            </div>
          </div>
          {!user?._isGuest && <Btn onClick={save}>{saved?"✓ 保存しました":"設定を保存"}</Btn>}
          {!user?._isGuest && <Btn onClick={async () => { await signOutOtherDevices(); alert("他のデバイスからログアウトしました"); }} variant="secondary" style={{ marginTop:10 }}>他のデバイスからログアウト</Btn>}
        </Card>
      )}

      {subTab==="closing" && <ClosingSection user={user} onUpdate={onUpdate} />}


      {subTab==="area" && (
        <div>
          <Card style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:10 }}>現在の設定エリア</div>
            {user.areas?.length > 0 ? (
              <>
                <AreaBadges areas={user.areas} />
                <div style={{ fontSize:11, color:C.muted, marginTop:10, lineHeight:1.7 }}>
                  選択したエリアをもとに、ホーム画面の電車遅延・イベント情報が絞り込まれます。
                </div>
              </>
            ) : (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📍</div>
                <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>エリアがまだ設定されていません。<br/>主に営業するエリアを選択してください。</div>
              </div>
            )}
          </Card>
          <button
            onClick={onManageArea}
            style={{ width:"100%", padding:"14px 0", borderRadius:11, fontSize:14, fontWeight:700, cursor:"pointer", border:`1.5px solid ${C.accentLight}`, backgroundColor:C.accentGlow, color:C.accentLight }}
          >
            📍 エリアを{user.areas?.length > 0 ? "変更する" : "選択する"}
          </button>
          <div style={{ marginTop:12, padding:"10px 14px", backgroundColor:C.surface, borderRadius:10, fontSize:11, color:C.muted, lineHeight:1.7 }}>
            💡 複数のエリアを選択できます。所属会社の営業区域に合わせて設定してください。
          </div>
        </div>
      )}

      {subTab==="plan" && (() => {
        const planKey   = user?.plan || "free";
        const planLimit = PLAN_OCR_LIMITS[planKey] ?? PLAN_OCR_LIMITS.free;
        const planLabel = PLAN_LABELS[planKey] ?? "無料プラン";
        const used      = user.uploadCount || 0;
        const usedColor = used >= planLimit ? C.red : used >= planLimit * 0.8 ? C.gold : C.accentLight;

        const PLANS = [
          {
            key: "free", label: "無料プラン", icon: "🆓", color: C.muted,
            price: "無料", ocrLimit: 8,
            features: [
              ["日報記録（月8回）", "OCR読み取り上限あり"],
              ["ダッシュボード・分析", "基本的な売上グラフ"],
              ["乗り場・空港ガイド", ""],
              ["電車遅延・イベント情報", ""],
            ],
          },
          {
            key: "standard", label: "スタンダード", icon: "🚕", color: C.accentLight,
            price: "準備中", ocrLimit: 30,
            features: [
              ["日報記録（月30回）", "月30回まで読み取り可能"],
              ["AIアドバイス", "毎回の日報に営業戦略コメント"],
              ["プッシュ通知", "遅延・翌日発表・需要スコア"],
              ["無料プランの全機能", ""],
            ],
          },
          {
            key: "pro", label: "プロ", icon: "🏆", color: C.gold,
            price: "準備中", ocrLimit: 60,
            features: [
              ["日報記録（月60回）", "月60回まで読み取り可能"],
              ["スタンダードの全機能", ""],
              ["週次レポート自動配信", "毎週月曜に先週の分析"],
              ["AI需要予測（予定）", "エリア別の需要を先読み分析"],
            ],
          },
        ];

        return (
          <>
            {/* 現在のプラン */}
            <Card style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:11, color:C.muted }}>現在のプラン</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{planLabel}</div>
                </div>
                <div style={{ fontSize:11, color:C.muted, textAlign:"right" }}>
                  <div>今月のOCR使用</div>
                  <div style={{ fontSize:14, fontWeight:700, color:usedColor }}>{used} / {planLimit} 回</div>
                </div>
              </div>
              <ProgressBar value={used} max={planLimit} color={usedColor} height={6}/>
            </Card>

            {/* β版: 有料プランは準備中 */}
            <div style={{ backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🚀</div>
              <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:8 }}>β版テスト中</div>
              <div style={{ fontSize:13, color:C.muted, lineHeight:1.9 }}>
                現在はすべての機能を<span style={{ color:C.accentLight, fontWeight:700 }}>無料</span>でお使いいただけます。<br/>
                有料プランはβ版終了後に公開予定です。<br/>
                ご協力ありがとうございます 🙏
              </div>
            </div>
          </>
        );
      })()}

      {subTab==="notif" && <NotifSection notifSettings={notifSettings} onUpdateNotif={onUpdateNotif} />}

      {subTab==="ai" && (
        <div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>AIによる自動分析とチャットボタンの表示を設定します</div>

          {/* シフト÷3のAI分析 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:4 }}>📊 AI分析（シフト÷3タイミング）</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>日報を記録するたびに、シフト数に応じた間隔（目安：3回）でAIがデータを分析してアドバイスを届けます</div>
            <div onClick={onToggleAiMilestone} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px", borderRadius:12, border:`1px solid ${C.border}`, backgroundColor:C.card, cursor:"pointer" }}>
              <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>自動AI分析を受け取る</span>
              <div style={{ width:44, height:26, borderRadius:99, backgroundColor: showAiMilestone ? C.accentLight : C.border, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:3, left: showAiMilestone ? 21 : 3, width:20, height:20, borderRadius:"50%", backgroundColor:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px #00000033" }}/>
              </div>
            </div>
          </div>

          {/* タクローFABボタン */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:4 }}>🦉 タクローボタン</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>右下に表示されるタクローとのチャットボタン</div>
            <div onClick={onToggleFAB} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px", borderRadius:12, border:`1px solid ${C.border}`, backgroundColor:C.card, cursor:"pointer" }}>
              <span style={{ fontSize:14, color:C.text, fontWeight:500 }}>チャットボタンを表示する</span>
              <div style={{ width:44, height:26, borderRadius:99, backgroundColor: showFAB ? C.accentLight : C.border, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:3, left: showFAB ? 21 : 3, width:20, height:20, borderRadius:"50%", backgroundColor:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px #00000033" }}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OLD notif IIFE removed — replaced by <NotifSection> above */}

      {subTab==="rank" && (() => {
        const xpData   = levelFromXp(user.xp || 0);
        const title    = getTitle(xpData.level);
        const earned   = user.badges || [];
        const streak   = user.streakDays || 0;
        return (
          <>
            {/* レベルカード */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
                <div style={{ width:60, height:60, borderRadius:"50%", background:`conic-gradient(${title.color} ${xpData.progress}%, ${C.border} 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", backgroundColor:C.card, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
                    <span style={{ fontSize:10, color:C.muted, lineHeight:1 }}>Lv</span>
                    <span style={{ fontSize:18, fontWeight:900, color:title.color, lineHeight:1.1 }}>{xpData.level}</span>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:16, fontWeight:800, color:C.text }}>{title.name}</span>
                    <span style={{ fontSize:11, backgroundColor:title.color+"22", color:title.color, padding:"2px 8px", borderRadius:99, fontWeight:700 }}>Lv {xpData.level}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>次のレベルまで {xpData.xpForNext - xpData.xpInLevel} XP</div>
                  <div style={{ backgroundColor:C.border, borderRadius:99, height:6, overflow:"hidden" }}>
                    <div style={{ width:`${xpData.progress}%`, height:"100%", backgroundColor:title.color, borderRadius:99, transition:"width 0.5s" }}/>
                  </div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[
                  { label:"総XP",     value:`${user.xp||0}` },
                  { label:"連続ログイン", value:`${streak}日` },
                  { label:"投稿数",    value:`${user.uploadCount||0}回` },
                ].map(({label,value})=>(
                  <div key={label} style={{ backgroundColor:C.bg, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{value}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* バッジ一覧 */}
            <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8 }}>バッジ {earned.length}/{BADGES.length}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {BADGES.map(b => {
                const got = earned.includes(b.id);
                return (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px", borderRadius:12, backgroundColor:got?C.card:C.bg, border:`1px solid ${got?C.accentLight+"44":C.border}`, opacity:got?1:0.45 }}>
                    <span style={{ fontSize:24, filter:got?"none":"grayscale(1)" }}>{b.icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:got?C.text:C.muted }}>{b.name}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{b.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {subTab==="mode" && (
        <div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>使い方に合わせて表示を切り替えます</div>
          {[
            { id:"simple",       icon:"🟢", name:"かんたん",      color:"#10B981", desc:"シンプル表示・標準文字サイズ。日報記録を最優先にした構成。" },
            { id:"simple_large", icon:"🔵", name:"かんたん（大）", color:C.accentLight, desc:"かんたんモードの文字を大きく表示。視認性重視・年配の方向け。" },
            { id:"analysis",     icon:"🟣", name:"分析",          color:"#8B5CF6", desc:"AI分析・詳細グラフ・統計情報をフルで表示する上級者向けモード。" },
          ].map(m => (
            <div key={m.id} onClick={()=>onModeChange&&onModeChange(m.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px", marginBottom:10, borderRadius:12, border:`2px solid ${appMode===m.id?m.color:C.border}`, backgroundColor:appMode===m.id?m.color+"11":"transparent", cursor:"pointer" }}>
              <span style={{ fontSize:28 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:appMode===m.id?m.color:C.text }}>{m.name}</span>
                  {appMode===m.id && <span style={{ fontSize:10, backgroundColor:m.color, color:"#fff", padding:"2px 8px", borderRadius:99, fontWeight:700 }}>使用中</span>}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>{m.desc}</div>
              </div>
            </div>
          ))}

          {/* テーマ切替 */}
          <div style={{ marginTop:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:4 }}>🌗 カラーテーマ</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>自動は季節の日没時間に合わせてダークに切替わります</div>
            {[
              { id:"auto",  icon:"🌗", name:"自動（日没で切替）", desc:"春17:45 / 夏18:30 / 秋17:15 / 冬16:30 にダークへ" },
              { id:"dark",  icon:"🌙", name:"ダーク固定", desc:"常に濃いネイビー系" },
              { id:"light", icon:"☀️", name:"ライト固定", desc:"常に白基調" },
            ].map(t => (
              <div key={t.id} onClick={()=>onThemeChange&&onThemeChange(t.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:8, borderRadius:12, border:`2px solid ${themeMode===t.id?C.accentLight:C.border}`, backgroundColor:themeMode===t.id?C.accentLight+"11":"transparent", cursor:"pointer" }}>
                <span style={{ fontSize:22 }}>{t.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:themeMode===t.id?C.accentLight:C.text }}>{t.name}</span>
                    {themeMode===t.id && <span style={{ fontSize:10, backgroundColor:C.accentLight, color:"#fff", padding:"2px 8px", borderRadius:99, fontWeight:700 }}>使用中</span>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab==="takepay" && <TakePaySection takePay={takePay} saveTakePay={saveTakePay} user={user} onUpdate={onUpdate} />}

      {subTab==="roadmap" && (
        <Card>
          {[
            { phase:"Phase 1（完了）",     color:C.green,       items:["ログイン・登録","日報アップロード・OCR","AI分析コメント","ダッシュボード"] },
            { phase:"Phase 2（実装済み）",  color:C.accentLight, items:["電車遅延チャンス通知","イベント需要スコア","渋滞情報","休憩・飲食スポット","匿名情報共有","自己ベスト・ランク設定","シフト管理","乗り場ガイド","空港ガイド","翌日発表機能","エリア絞り込み"] },
            { phase:"Phase 3（予定）",      color:C.muted,       items:["エリア売上ランキング＋特典","全国比較","AI需要予測","週次レポート自動配信","LINEコピペ→AI整形投稿"] },
          ].map(({phase,color,items})=>(
            <div key={phase} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}><div style={{ width:8, height:8, borderRadius:"50%", backgroundColor:color }}/><span style={{ fontSize:12, fontWeight:700, color }}>{phase}</span></div>
              {items.map(item=><div key={item} style={{ fontSize:12, color:C.sub, padding:"3px 0 3px 16px" }}>• {item}</div>)}
            </div>
          ))}
        </Card>
      )}

      {subTab==="export" && <ExportSection user={user} reports={reports} />}


      {subTab==="coupon" && <CouponSection user={user} />}


      {subTab==="referral" && <ReferralSection user={user} />}


      {subTab==="feedback" && <FeedbackSection user={user} />}


      {subTab==="help" && <HelpSection setSubTab={setSubTab} />}


      {subTab==="terms" && (
        <div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:16 }}>タクロー 利用規約</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>最終更新日：2026年6月23日　施行日：2026年6月1日</div>

          {[
            { title:"第1条（目的・適用範囲）", body:"本規約は、タクロー運営者（以下「運営者」）が提供するスマートフォン・ウェブアプリケーション「タクロー」（以下「本アプリ」）の利用条件を定めるものです。本アプリは、タクシードライバーの日報管理・収益分析・シフト管理・ドライバー同士のコミュニティ機能等を提供するサービスです。ユーザーは本規約に同意のうえ、本アプリをご利用ください。本アプリの利用を開始した時点で、本規約に同意したものとみなします。" },
            { title:"第2条（アカウントの作成・管理）", body:"ユーザーは正確な情報を入力してアカウントを作成しなければなりません。アカウントのID・パスワードは自己の責任において管理してください。第三者によるアカウントの不正利用が発生した場合、運営者は責任を負いません。ユーザーは一人につき一つのアカウントのみ保有できます。虚偽情報によるアカウント作成は禁止します。パスワードを忘れた場合は登録メールアドレスへのリセットメールをご利用ください。アカウントの不審な利用を発見した場合は速やかに運営者へご連絡ください。" },
            { title:"第3条（βテスト期間中の利用）", body:"現在本アプリはβ（ベータ）テスト期間中です。βテスト期間中は機能の追加・変更・削除が予告なく行われる場合があります。データの損失や予期せぬ不具合が発生する可能性があり、運営者はこれによる損害について責任を負いません。βテスト期間終了後、有料プランへの移行・機能の変更が行われる場合があります。βテスト期間中のOCR利用上限は月30枚です（プランにかかわらず）。" },
            { title:"第4条（OCR・AI機能の利用）", body:"本アプリのOCR機能（給与明細・日報の画像読み取り）は、Anthropic社のClaude APIを使用しています。OCR処理に際してアップロードされた画像データは処理後に保存されません。OCR読み取り結果の正確性は保証されません。必ずご自身で内容を確認・修正のうえご利用ください。AIによる分析・アドバイス・着地予想はあくまで参考情報であり、収益・成果を保証するものではありません。月間OCR利用枚数に上限があります（プラン別）。上限に達した場合は翌月初日にリセットされます。" },
            { title:"第5条（フレンド機能・データ共有）", body:"本アプリのフレンド機能では、QRコードをスキャンすることで他のユーザーとフレンド登録ができます。フレンド登録にはQRコードの物理的・デジタル的な提示が必要であり、本人の意図しない登録を防止しています。フレンドと共有する日報・シフトデータは、ユーザー自身が「共有」に設定したものに限られます。共有設定は各日報・シフト画面からいつでも変更・解除できます。フレンドを解除した場合、相手方からの共有データの閲覧は即時停止されます。フレンド機能を悪用したハラスメント・ストーキング等の行為は禁止します。" },
            { title:"第6条（招待コード・特典）", body:"本アプリでは招待コード（TK-XXXXXX形式）による新規登録特典を提供しています。招待コードによる特典（無料期間の延長等）は運営者が定めた条件に従い付与されます。特典の内容は予告のうえ変更されることがあります。不正な招待コードの生成・転売・スパム配布は禁止します。これらが確認された場合、アカウントの停止および特典の剥奪を行うことがあります。" },
            { title:"第7条（健康・安全に関する注意）", body:"ドライバーは適切な休息を取り、疲労状態での運転を行わないでください。本アプリは連続乗務・過労・速度超過・ながら運転を助長することを意図していません。体調に異変を感じた場合は直ちに運転を中止し、適切な対応をとってください。運転中のアプリ操作は道路交通法および安全上の観点から禁止します。本アプリの使用により生じた交通事故・違反について、運営者は一切の責任を負いません。" },
            { title:"第8条（免責事項）", body:"本アプリの利用による労働環境・健康状態・収益への影響について、運営者は一切の責任を負いません。本アプリはあくまで情報管理ツールであり、営業成果・収益を保証するものではありません。AIによる分析・アドバイスは参考情報であり、その正確性・有用性について運営者は保証しません。地図機能・エリア情報の正確性について運営者は保証しません。ユーザーは自己の判断と責任においてアプリを利用するものとします。" },
            { title:"第9条（データの正確性・管理）", body:"日報・シフトデータの正確性はユーザー自身の責任において管理してください。虚偽・誤ったデータの入力による不利益について、運営者は責任を負いません。ユーザーはデータのバックアップを自身で管理することが推奨されます。アプリのデータはクラウドサービス（Supabase）に保存されますが、障害・データ損失のリスクをユーザーは理解したうえでご利用ください。" },
            { title:"第10条（ランキング・統計機能）", body:"ランキングは参考情報であり、無理な営業を推奨するものではありません。ランキング上位を目指すあまり、安全運転を損なう行為は禁止します。ランキング・エリア統計データは個人を特定できない形に匿名化して算出されます。一部機能にサンプルデータが含まれる場合があります。" },
            { title:"第11条（禁止事項）", body:"以下の行為を禁止します。\n・システムへの不正アクセス・リバースエンジニアリング\n・データの改ざん・虚偽入力による不正なランキング操作\n・他ユーザーへの誹謗中傷・ハラスメント・ストーキング\n・フレンド機能・コミュニティ機能を通じた個人情報の無断収集・掲載\n・招待コードの不正生成・転売・スパム配布\n・OCR機能を著作権保護コンテンツの複製等に利用する行為\n・営業目的でのスパム投稿・宣伝活動\n・運営者の許可なく本アプリのコンテンツを複製・転用する行為\n・法令に違反する行為、公序良俗に反する行為\nこれらが確認された場合、アカウントを停止または削除することがあります。" },
            { title:"第12条（コミュニティ・投稿コンテンツ）", body:"ユーザーがガイド機能等に投稿したコンテンツの著作権はユーザーに帰属します。ただしユーザーは運営者に対し、サービス改善・品質向上の目的で当該コンテンツを使用する非独占的ライセンスを無償で付与するものとします。運営者は、不適切と判断した投稿を予告なく削除できます。投稿コンテンツに他者の個人情報が含まれないよう注意してください。" },
            { title:"第13条（知的財産権）", body:"本アプリのロゴ・デザイン・コード・コンテンツの著作権・商標権その他の知的財産権は運営者に帰属します。ユーザーは本規約の範囲内においてのみ本アプリを利用する権限を有します。本アプリの内容を運営者の許可なく転載・販売・再配布することを禁じます。" },
            { title:"第14条（有料サービス・決済）", body:"有料プランの料金・内容は運営者が定め、事前にアプリ内で告知します。決済は第三者決済サービスを経由して行われます。支払い済みの料金は原則返金しません。ただし法令上の権利は妨げません。有料プランの内容・価格は予告のうえ変更されることがあります。βテスト期間終了後に有料化が行われる場合は、30日前までにアプリ内で告知します。" },
            { title:"第15条（サービスの変更・停止・終了）", body:"運営者はサービス内容を変更・停止・終了することがあります。重要な変更については事前にアプリ内通知または登録メールアドレスへの連絡を行うよう努めます。これによりユーザーに生じた損害について、運営者は故意・重過失がある場合を除き責任を負いません。" },
            { title:"第16条（損害賠償の制限）", body:"運営者がユーザーに対して損害賠償責任を負う場合、その範囲はユーザーが本アプリに対して直近1ヶ月に支払った利用料金の総額を上限とします。ただし、運営者の故意・重過失による損害はこの限りではありません。間接損害・逸失利益・機会損失については運営者は一切責任を負いません。" },
            { title:"第17条（通知・連絡）", body:"運営者からユーザーへの通知は、アプリ内通知または登録メールアドレスへのメール送信をもって行います。ユーザーが登録した連絡先が無効の場合、当該通知は到達したものとみなします。" },
            { title:"第18条（規約の変更）", body:"本規約は運営者の判断により改定されることがあります。重要な変更の場合は30日前までにアプリ内で告知します。改定後も本アプリを継続してご利用いただいた場合、改定後の規約に同意したものとみなします。" },
            { title:"第19条（分離可能性）", body:"本規約の一部条項が法令により無効または執行不能と判断された場合でも、その他の条項は引き続き有効に存続します。" },
            { title:"第20条（準拠法・管轄）", body:"本規約は日本法に準拠し、本アプリに関する紛争は東京地方裁判所を専属的合意管轄裁判所とします。" },
          ].map(({title, body}) => (
            <div key={title} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>{title}</div>
              {body.split("\n").map((line, i) => (
                <div key={i} style={{ fontSize:12, color:C.sub, lineHeight:1.8 }}>{line}</div>
              ))}
            </div>
          ))}

          <div style={{ marginTop:24, padding:14, backgroundColor:C.card, borderRadius:10, fontSize:11, color:C.muted }}>
            ※ 本規約はタクシードライバーの安全・健康を最優先に設計されています。不明な点はアプリ内意見箱よりお問い合わせください。
          </div>
        </div>
      )}

      {subTab==="privacy" && (
        <div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:16 }}>プライバシーポリシー</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>2026年6月1日 制定　2026年6月23日 改定</div>

          {[
            { title:"1. 収集する情報", body:"本アプリでは以下の情報を取得します。\n\n【アカウント情報】\n・氏名またはニックネーム\n・メールアドレス（またはGoogle/Apple認証情報）\n・所属会社名（任意）\n\n【業務データ】\n・日報データ（売上・走行距離・乗車回数・勤務時間・休憩時間・乗車記録等）\n・シフトデータ（勤務日程・出退勤時刻）\n・月間目標売上・勤務形態・締め日（任意入力）\n・所属エリア（任意入力）\n\n【OCR処理データ】\n・アップロードされた給与明細・日報画像（OCR解析後に元画像は削除します。抽出テキストのみAI処理されます）\n\n【コミュニティ・フレンド機能データ】\n・投稿したガイドスポット情報・コメント\n・フレンド関係情報（フレンド登録したユーザーのID）\n・フレンドと共有を選択した日報・シフトデータ\n\n【端末・利用ログ】\n・端末の種類・OSバージョン等の端末情報\n・アプリの操作履歴・利用ログ\n・Cookie等により生成された識別情報" },
            { title:"2. 情報の利用目的", body:"取得した情報は以下の目的で利用します。\n・本サービスの提供・本人確認・認証\n・日報・シフトデータの記録・分析・グラフ表示\n・OCRによる日報・給与明細の自動入力支援\n・AIによる走行アドバイス・着地予想・分析コメントの生成\n・フレンドへの日報・シフトデータの共有（ユーザーが共有を設定した場合のみ）\n・ランキング・エリア統計の集計（匿名化処理後）\n・ガイド機能でのエリア別スポット情報の提供\n・招待コード・紹介特典の管理\n・サービスの改善・新機能の開発\n・不正利用の検知・防止\n・お問い合わせへの対応\n・利用規約変更等の重要事項のご通知" },
            { title:"3. フレンド機能とデータ共有", body:"フレンド機能では、ユーザーが「共有」に設定した日報・シフトデータのみがフレンドに公開されます。フレンドに共有される情報の範囲：\n・共有設定した日報の売上・走行距離・乗車回数・勤務時間等\n・共有設定したシフトの勤務日・出退勤時刻\n・ユーザー名\n\n共有されない情報：\n・メールアドレス・パスワード\n・OCR処理した画像・給与明細\n・非共有設定の日報・シフト\n・乗車記録の詳細\n\nフレンド関係はQRコードによる相互同意のもとで成立し、いつでも解除できます。フレンド解除後は相手方の共有データへのアクセスが即時停止されます。" },
            { title:"4. OCR・AI処理について", body:"日報・給与明細のOCR処理にはAnthropic社のClaude APIを使用します。\n・アップロードした画像はOCR処理のためのみ使用され、処理後に本アプリのサーバーには保存されません\n・抽出されたテキストデータはAI分析に使用されます\n・AI分析の結果（アドバイス・着地予想等）はサービス改善のため匿名化されたうえでログに記録されることがあります\n・Anthropic社のAPIポリシー：https://www.anthropic.com/privacy" },
            { title:"5. 外部サービスの利用", body:"本アプリは以下の外部サービスを使用しており、各社のプライバシーポリシーが適用されます。\n\n・Supabase（データベース・認証・ストレージ）\n  https://supabase.com/privacy\n  ユーザーデータ・日報データ等はSupabaseのサーバーに保存されます。\n\n・Anthropic（Claude API：OCR・AI分析）\n  https://www.anthropic.com/privacy\n  OCR処理・AIアドバイス生成に使用されます。\n\n・OpenStreetMap / CARTO（地図表示）\n  地図機能の表示に使用します。位置情報を送信することはありません。\n\n・Google / Apple（OAuth認証：利用する場合）\n  ソーシャルログインを選択した場合に適用されます。" },
            { title:"6. 第三者への提供", body:"取得した個人情報は、以下の場合を除き第三者に提供しません。\n・ユーザー本人の同意がある場合\n・法令に基づく開示が必要な場合\n・サービス運営に必要な業務委託先への提供（守秘義務契約のもと）\n・事業譲渡等が発生した場合（事前通知のうえ）\n\n個人が特定できる形でのデータ販売は一切行いません。フレンド以外のユーザーがあなたの個人データにアクセスすることはありません。" },
            { title:"7. 統計データの利用", body:"個人を特定できない形に匿名化・集計したデータを以下の目的で利用することがあります。\n・エリア別売上統計・需要スコアの算出（ガイド機能）\n・ランキング集計\n・サービス改善・新機能の開発\n・業界レポート等への活用\nこれらは個人を特定できない集計データのみです。" },
            { title:"8. 安全管理措置", body:"取得した情報の漏えい・滅失・毀損を防止するため、以下の措置を講じています。\n・データの暗号化通信（HTTPS/TLS）\n・Supabaseによるアクセス制御（Row Level Security）\n・パスワードのハッシュ化（Supabase Auth）\n・フレンドデータへの行単位アクセス制御\n・不審なアクセスの監視\nただし、インターネット上での完全なセキュリティを保証するものではありません。不審なアクセスを発見した場合は速やかにご連絡ください。" },
            { title:"9. データの保管・削除", body:"データの保管場所：Supabaseサーバー（日本国外を含む）\n\nアカウントを削除した場合：\n・アカウント情報は即時削除され、ログインできなくなります\n・日報・シフト等の業務データは運営側で保持されます（個人を特定しない形で統計・改善目的に利用することがあります）\n・フレンド関係データは即時削除されます\n\nデータの開示・訂正・削除をご希望の場合は下記お問い合わせ先までご連絡ください。ご本人確認のうえ、個人情報保護法の定めに従い対応します。" },
            { title:"10. Cookieおよびローカルストレージ", body:"本アプリはブラウザのローカルストレージを使用して以下のデータを端末上に保存します。\n・ログイン状態の維持\n・アプリ設定（テーマ・表示モード等）\n・日報データのキャッシュ\nこれらはユーザーの操作（ログアウト・ブラウザデータ削除）により消去されます。本アプリはトラッキングCookieを使用しません。" },
            { title:"11. プライバシーポリシーの変更", body:"本ポリシーは必要に応じて変更されることがあります。重要な変更がある場合はアプリ内通知またはメールで30日前までにお知らせします。改定後も本アプリをご利用の場合、改定後のポリシーに同意したものとみなします。" },
            { title:"12. お問い合わせ・開示請求", body:"個人情報の取り扱いに関するお問い合わせ・開示請求・訂正・削除依頼は以下までご連絡ください。\n\nメール：support@takuro-app.jp\nアプリ内の「意見箱」からもお問い合わせいただけます。\n\n対応時間：平日10:00〜18:00（土日祝除く）\nご本人確認のうえ、原則2週間以内にご回答します。" },
          ].map(({title, body}) => (
            <div key={title} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>■ {title}</div>
              {body.split("\n").map((line, i) => (
                <div key={i} style={{ fontSize:12, color:C.sub }}>{line || <br/>}</div>
              ))}
            </div>
          ))}
          <div style={{ marginTop:16, padding:12, backgroundColor:C.card, borderRadius:10, fontSize:11, color:C.muted }}>
            運営者：タクロー開発チーム　/ support@takuro-app.jp
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
