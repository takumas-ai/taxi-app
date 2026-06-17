// 設定画面（プロフィール・エリア・プラン・通知・ランク・モード・ロードマップ）
import { useState } from "react";
import { C, FREE_LIMIT, loadS, saveS } from "../lib/constants";
import { Card, Btn, ProgressBar, Toggle } from "../components/UI";
import { AreaBadges } from "../components/UI";
import { levelFromXp, getTitle, BADGES } from "../lib/xp";
import { insertFeedback, fetchReferralCount } from "../lib/supabase";
import { downloadCSV, printAsPDF, downloadRideRecordsCSV } from "../lib/export";
import AvatarPicker from "../components/AvatarPicker";

const SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN_EMAIL = "white-t@hotmail.co.jp";

export default function Settings({ user, onUpdate, onLogout, onDeleteAccount, onManageArea, notifSettings, onUpdateNotif, appMode="standard", onModeChange, themeMode="auto", onThemeChange, reports=[], initialSection="", onBack, onOpenAdmin, onAccountLink }) {
  const [subTab, setSubTab] = useState(initialSection);
  const [form, setForm] = useState({ name:user.name||"", company:user.company||"", workType:user.workType||"隔日勤務", target:user.target||"" });
  const [saved, setSaved] = useState(false);
  const [rankPrefs, setRankPrefs] = useState({ showMyRank:false, showTopSales:false });
  const [takePay, setTakePay] = useState(loadS("taxi_takepay", { rate:55, deduction:30000 }));
  const save = () => { onUpdate(form); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const saveTakePay = (next) => { setTakePay(next); saveS("taxi_takepay", next); };

  const SUB = [
    {id:"account",  icon:"🔗", label:"アカウント",   sub: user?._isGuest ? "⚠️ 未連携（データが危険）" : (user?.email || "連携済み")},
    {id:"closing",  icon:"📅", label:"締日設定",     sub: user.closing_day ? `毎月${user.closing_day}日締め` : "月末締め"},
    {id:"mode",    icon:"🎛️", label:"モードとカラーテーマ", sub:appMode==="simple"?"かんたん":appMode==="simple_large"?"かんたん（大）":appMode==="analysis"?"分析":"かんたん"},
    {id:"area",    icon:"📍", label:"エリア",       sub:user.areas?.length>0?user.areas[0]:"未設定"},
    {id:"notif",   icon:"🔔", label:"通知",         sub:"アラート設定"},
    {id:"takepay", icon:"💴", label:"手取り設定",    sub:`歩合${takePay.rate}% / 控除${(takePay.deduction/10000).toFixed(1)}万円`},
    {id:"plan",    icon:"💳", label:"プラン",        sub:"無料プラン"},
    {id:"rank",    icon:"🏆", label:"ランク",       sub:"表示設定"},
    {id:"export",   icon:"📤", label:"データエクスポート", sub:"CSV / PDF 出力"},
    {id:"coupon",   icon:"🎟️", label:"クーポンコード",    sub:"割引・特典コードを入力"},
    {id:"roadmap", icon:"🗺️", label:"ロードマップ",  sub:"開発予定"},
    {id:"feedback", icon:"💬", label:"意見箱",          sub:"要望・バグ報告・ひとこと"},
    {id:"help",    icon:"❓", label:"ヘルプ・FAQ",    sub:"よくある質問"},
    {id:"terms",   icon:"📄", label:"利用規約",      sub:"タクロー利用規約"},
    {id:"privacy", icon:"🔒", label:"プライバシーポリシー", sub:"個人情報の取り扱い"},
    ...(user?.email === ADMIN_EMAIL ? [{id:"admin", icon:"🦉", label:"管理画面", sub:"よしと専用"}] : []),
  ];

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"16px 16px 100px" }}>
      {!subTab ? (
        <>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>⚙️ 設定</div>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {SUB.map((t, i) => (
              <div key={t.id} onClick={()=>{ if(t.id==="admin"){ onOpenAdmin?.(); return; } setSubTab(t.id); }} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", borderBottom: i<SUB.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}>
                <div style={{ width:36, height:36, borderRadius:10, backgroundColor:C.accentLight+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{t.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{t.label}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{t.sub}</div>
                </div>
                <span style={{ color:C.muted, fontSize:18 }}>›</span>
              </div>
            ))}
          </Card>
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
          {!user?._isGuest && <Btn onClick={onLogout} variant="danger" style={{ marginTop:10 }}>ログアウト</Btn>}
          {/* アカウント削除 */}
          {(() => {
            const [deleteStep, setDeleteStep] = useState(0); // 0:非表示 1:確認 2:最終確認
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
                      日報データ・設定・XP・バッジなど、すべてのデータが削除されます。この操作は取り消せません。
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
                      アカウントとすべてのデータを削除します。30日以内にサーバーからも完全削除されます。
                    </div>
                    <Btn onClick={handleDelete} variant="danger" disabled={deleting} style={{ width:"100%", fontSize:13 }}>
                      {deleting ? "削除中..." : "削除する（取り消し不可）"}
                    </Btn>
                    <div onClick={()=>setDeleteStep(0)} style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:10, cursor:"pointer" }}>戻る</div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {subTab==="closing" && (() => {
        const [closingDay, setClosingDay] = useState(user.closing_day ?? 0);
        const [saved2, setSaved2] = useState(false);
        const options = [
          { value: 0,  label: "月末日" },
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
      })()}

      {subTab==="area" && (
        <Card style={{ borderColor:C.accentLight+"44", cursor:"pointer" }} onClick={onManageArea}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>所属エリア</div>{user.areas?.length>0?<AreaBadges areas={user.areas}/>:<span style={{ fontSize:12, color:C.red }}>未設定</span>}<div style={{ fontSize:11, color:C.muted, marginTop:6 }}>タップして変更</div></div>
            <span style={{ fontSize:20, color:C.muted }}>›</span>
          </div>
        </Card>
      )}

      {subTab==="plan" && (() => {
        const PlanCard = ({ title, icon, color, monthPrice, yearPrice, features, badge, comingSoon }) => (
          <Card style={{ marginBottom:14, borderColor: color+"44", position:"relative", overflow:"hidden" }}>
            {badge && <div style={{ position:"absolute", top:12, right:12, backgroundColor:color, color:"#fff", fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:99 }}>{badge}</div>}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:18, fontWeight:900, color }}>{title}</div>
            </div>
            {/* 料金 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"12px 14px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>月払い</div>
                <div style={{ fontSize:22, fontWeight:900, color }}>{monthPrice}<span style={{ fontSize:11, color:C.muted }}>円/月</span></div>
              </div>
              <div style={{ backgroundColor:C.bg, borderRadius:10, padding:"12px 14px", border:`1.5px solid ${color}66`, position:"relative" }}>
                <div style={{ position:"absolute", top:-8, left:"50%", transform:"translateX(-50%)", backgroundColor:color, color:"#fff", fontSize:9, fontWeight:800, padding:"2px 8px", borderRadius:99, whiteSpace:"nowrap" }}>★ おすすめ</div>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>年払い</div>
                <div style={{ fontSize:22, fontWeight:900, color }}>{yearPrice}<span style={{ fontSize:11, color:C.muted }}>円/年</span></div>
                <div style={{ fontSize:10, color, marginTop:2, fontWeight:700 }}>2ヶ月分お得！</div>
              </div>
            </div>
            {/* 機能一覧 */}
            {features.map(([t,d]) => (
              <div key={t} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ color:C.green, fontSize:15, flexShrink:0, marginTop:1 }}>✓</span>
                <div><div style={{ fontSize:13, fontWeight:600 }}>{t}</div>{d && <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{d}</div>}</div>
              </div>
            ))}
            <div style={{ marginTop:14, backgroundColor:C.bg, borderRadius:10, padding:"10px 14px", textAlign:"center", border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700 }}>🚧 準備中 — もうすぐ利用できます</div>
            </div>
          </Card>
        );

        return (
          <>
            {/* 現在のプラン */}
            <Card style={{ borderColor:C.border, marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:11, color:C.muted }}>現在のプラン</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text }}>無料プラン</div>
                </div>
                <div style={{ fontSize:11, color:C.muted, textAlign:"right" }}>
                  <div>日報アップロード</div>
                  <div style={{ fontSize:14, fontWeight:700, color:(user.uploadCount||0)>=FREE_LIMIT-1?C.red:C.text }}>{user.uploadCount||0} / {FREE_LIMIT} 件</div>
                </div>
              </div>
              <ProgressBar value={user.uploadCount||0} max={FREE_LIMIT} color={(user.uploadCount||0)>=FREE_LIMIT-1?C.red:C.gold} height={6}/>
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>Lv3以上で翌日発表・ランキング閲覧 / Lv5以上でグループ参加</div>
            </Card>

            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:12 }}>📋 有料プラン（準備中）</div>

            <PlanCard
              title="通常プラン"
              icon="🚕 タクシードライバー向け"
              color={C.accentLight}
              monthPrice="480"
              yearPrice="4,800"
              features={[
                ["日報アップロード無制限", "月8件の制限なし"],
                ["AIアドバイス", "毎回の日報に営業戦略コメント"],
                ["今日の戦略をAIに聞く", "出勤前に最適な戦略を提案"],
                ["週次レポート自動配信", "毎週月曜に先週の分析"],
                ["プッシュ通知", "遅延・翌日発表・需要スコア"],
                ["イベント詳細コメント", "需要予測の詳細情報"],
              ]}
            />

            <PlanCard
              title="個人タクシープラン"
              icon="🏅 個人タクシー事業者向け"
              color={C.gold}
              monthPrice="780"
              yearPrice="7,800"
              badge="個タク専用"
              features={[
                ["通常プランの全機能", ""],
                ["経費入力", "ガソリン・駐車場・車検・保険など"],
                ["月次・年次売上レポート", "PDF / CSV 出力対応"],
                ["確定申告用収支サマリー", "収入・経費・所得を自動集計"],
                ["AI需要予測（Phase3）", "エリア別の需要を先読み分析"],
              ]}
            />

            {/* 無料で使える機能 */}
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:10 }}>✅ 無料で使える機能</div>
            <Card style={{ marginBottom:6 }}>
              {[
                ["ダッシュボード基本表示", ""],
                ["日報アップロード（月8件）", "Lv1から利用可能"],
                ["乗り場・空港ガイド閲覧", "Lv1から利用可能"],
                ["電車遅延・渋滞の基本情報", "Lv1から利用可能"],
                ["オープン掲示板の閲覧", "Lv1 / 投稿はLv2から"],
                ["翌日発表・ランキング閲覧", "Lv3から利用可能"],
                ["グループ参加", "Lv5から利用可能"],
              ].map(([t,d]) => (
                <div key={t} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.green, fontSize:14, flexShrink:0 }}>✓</span>
                  <div><div style={{ fontSize:13 }}>{t}</div>{d && <div style={{ fontSize:11, color:C.muted }}>{d}</div>}</div>
                </div>
              ))}
            </Card>
          </>
        );
      })()}

      {subTab==="notif" && (() => {
        const [notifTab, setNotifTab] = useState("settings"); // settings | log
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
            {/* タブ切り替え */}
            <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:10, padding:3, gap:3, marginBottom:16 }}>
              {[["settings","⚙️ 設定"],["log","📋 通知ログ"]].map(([v,l])=>(
                <div key={v} onClick={()=>setNotifTab(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:notifTab===v?700:400, backgroundColor:notifTab===v?C.card:"transparent", color:notifTab===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
              ))}
            </div>

            {notifTab === "settings" && (
              <>
                {/* サイレント時間帯 */}
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

                {/* 通知種別 */}
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

                {/* 注意書き */}
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
      })()}

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

      {subTab==="takepay" && (() => {
        const preview = (sales) => Math.max(0, Math.round(sales * takePay.rate / 100 - takePay.deduction));
        const [wantedTake, setWantedTake] = useState("");
        const requiredSales = wantedTake
          ? Math.round((parseInt(wantedTake.replace(/,/g,"")) + takePay.deduction) / (takePay.rate / 100))
          : 0;
        const fmt2 = (n) => n.toLocaleString();
        return (
          <div>
            <Card style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>会社や契約によって異なります。自分の条件に合わせて設定してください。</div>

              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>歩合率</div>
                  <span style={{ fontSize:18, fontWeight:800, color:C.accentLight }}>{takePay.rate}%</span>
                </div>
                <input type="range" min={30} max={80} step={1} value={takePay.rate}
                  onChange={e=>saveTakePay({...takePay, rate:parseInt(e.target.value)})}
                  style={{ width:"100%", accentColor:C.accentLight }}/>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted, marginTop:2 }}>
                  <span>30%</span><span>80%</span>
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>月間控除額（社保・税など）</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  {[20000,30000,40000,50000,60000,70000].map(v=>(
                    <div key={v} onClick={()=>saveTakePay({...takePay, deduction:v})} style={{ padding:"8px 0", textAlign:"center", borderRadius:9, border:`2px solid ${takePay.deduction===v?C.accentLight:C.border}`, color:takePay.deduction===v?C.accentLight:C.muted, fontSize:12, fontWeight:takePay.deduction===v?700:400, cursor:"pointer" }}>
                      {v/10000}万円
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>または直接入力（円）</div>
                  <input type="number" value={takePay.deduction} onChange={e=>saveTakePay({...takePay, deduction:parseInt(e.target.value)||0})}
                    style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}/>
                </div>
              </div>
            </Card>

            {/* 逆算ツール */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:10 }}>🔄 逆算（欲しい手取り→必要な売上）</div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>目標手取り額を入力すると必要な売上を計算します</div>
              <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
                <input
                  type="number"
                  value={wantedTake}
                  onChange={e => setWantedTake(e.target.value)}
                  placeholder="例: 200000"
                  style={{ flex:1, backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}
                />
                <span style={{ fontSize:13, color:C.muted, flexShrink:0 }}>円</span>
              </div>
              {requiredSales > 0 && (
                <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>必要な月間売上（税抜）</div>
                  <div style={{ fontSize:28, fontWeight:900, color:C.accentLight }}>
                    {fmt2(requiredSales)}<span style={{ fontSize:13, marginLeft:4 }}>円</span>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                    手取り目標 {fmt2(parseInt(wantedTake)||0)}円 ÷ 歩合{takePay.rate}% + 控除{fmt2(takePay.deduction)}円
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:10 }}>📊 シミュレーション（売上→手取り）</div>
              {[200000,300000,380000,450000,500000].map(sales=>(
                <div key={sales} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.muted }}>売上 {(sales/10000).toFixed(0)}万円</span>
                  <span style={{ fontSize:14, fontWeight:700, color:C.text }}>手取り約 <span style={{ color:C.accentLight }}>{Math.round(preview(sales)/10000)}万円</span></span>
                </div>
              ))}
              <div style={{ fontSize:10, color:C.muted, marginTop:8 }}>※ 概算です。実際の手取りは会社の規定により異なります。</div>
            </Card>
          </div>
        );
      })()}

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

      {subTab==="export" && (() => {
        const isPaid = user?.plan === "paid" || user?.plan === "kojin";
        const now    = new Date();
        const thisYear  = now.getFullYear();
        const thisMonth = now.getMonth() + 1;

        // 月リスト（過去12ヶ月）
        const months = [];
        for (let i = 0; i < 12; i++) {
          let m = thisMonth - i, y = thisYear;
          if (m <= 0) { m += 12; y--; }
          months.push({ y, m });
        }

        const [exportYear,  setExportYear]  = useState(thisYear);
        const [exportMonth, setExportMonth] = useState(thisMonth);
        const [exportRange, setExportRange] = useState("month"); // month | year

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

        return (
          <div>
            {!isPaid && (
              <div style={{ backgroundColor:C.goldGlow, border:`1px solid ${C.gold}44`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:C.sub, lineHeight:1.7 }}>
                💡 無料プランは直近1ヶ月のみ出力できます。全期間は有料プランで利用可能です。
              </div>
            )}

            {/* 期間選択 */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>期間</div>
            <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:10, padding:3, gap:3, marginBottom:14 }}>
              {[["month","月次"],["year","年次"]].map(([v,l])=>(
                <div key={v} onClick={()=>setExportRange(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:8, fontSize:13, fontWeight:exportRange===v?700:400, backgroundColor:exportRange===v?C.card:"transparent", color:exportRange===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
              ))}
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {/* 年選択 */}
              <select value={exportYear} onChange={e=>setExportYear(Number(e.target.value))}
                style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}>
                {[thisYear, thisYear-1, thisYear-2].map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              {/* 月選択（月次のみ） */}
              {exportRange === "month" && (
                <select value={exportMonth} onChange={e=>setExportMonth(Number(e.target.value))}
                  style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 12px", color:C.text, fontSize:14, outline:"none" }}>
                  {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
                </select>
              )}
            </div>

            {/* 対象件数プレビュー */}
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

            {/* 乗車記録CSV */}
            <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:10 }}>乗車記録</div>
              {(() => {
                let allRecs = [];
                try { allRecs = JSON.parse(localStorage.getItem("taxi_sales_records") || "[]"); } catch {}
                const recs = exportRange === "month"
                  ? allRecs.filter(r => (r.workDate||"").startsWith(`${exportYear}-${String(exportMonth).padStart(2,"0")}`))
                  : allRecs.filter(r => (r.workDate||"").startsWith(String(exportYear)));
                return (
                  <>
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
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {subTab==="coupon" && (() => {
        const VALID_CODES = {
          "TAKURO2026":  { label:"2026年記念コード",   benefit:"1ヶ月無料",  xp:200 },
          "DRIVER100":   { label:"ドライバー応援コード", benefit:"2週間無料",  xp:100 },
          "BETA-TESTER": { label:"ベータテスター特典",  benefit:"3ヶ月無料",  xp:500 },
        };

        const [code,     setCode]     = useState("");
        const [applied,  setApplied]  = useState(() => loadS("taxi_coupon_applied", []));
        const [result,   setResult]   = useState(null); // { ok, msg, info }
        const [loading,  setLoading]  = useState(false);

        const handleApply = async () => {
          const upper = code.trim().toUpperCase();
          if (!upper) return;
          setLoading(true); setResult(null);
          await new Promise(r => setTimeout(r, 700));

          if (applied.includes(upper)) {
            setResult({ ok:false, msg:"このコードはすでに使用済みです" });
          } else if (VALID_CODES[upper]) {
            const info = VALID_CODES[upper];
            const next = [...applied, upper];
            setApplied(next);
            saveS("taxi_coupon_applied", next);
            setResult({ ok:true, msg:`コード適用完了！${info.benefit}と +${info.xp} XP を獲得`, info });
            setCode("");
          } else {
            setResult({ ok:false, msg:"無効なコードです。スペルを確認してください" });
          }
          setLoading(false);
        };

        return (
          <div>
            {/* 入力フォーム */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>クーポンコードを入力</div>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input
                value={code}
                onChange={e=>setCode(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&handleApply()}
                placeholder="例: TAKURO2026"
                style={{ flex:1, backgroundColor:C.card, border:`1px solid ${result?.ok===false?C.red:result?.ok?C.green:C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:14, outline:"none", letterSpacing:"1px", fontWeight:700 }}
              />
              <button onClick={handleApply} disabled={!code.trim()||loading}
                style={{ padding:"0 18px", borderRadius:10, border:"none", backgroundColor:code.trim()?C.accentLight:"#444", color:"#fff", fontSize:13, fontWeight:700, cursor:code.trim()?"pointer":"not-allowed", opacity:loading?0.6:1 }}>
                {loading?"確認中":"適用"}
              </button>
            </div>

            {result && (
              <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, backgroundColor:result.ok?C.greenGlow:C.redGlow, border:`1px solid ${result.ok?C.green+"44":C.red+"44"}`, fontSize:13, color:result.ok?C.green:C.red, fontWeight:600 }}>
                {result.ok?"✅ ":"❌ "}{result.msg}
              </div>
            )}

            {/* 適用済みコード一覧 */}
            {applied.length > 0 && (
              <>
                <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>適用済みコード</div>
                <Card style={{ padding:0, overflow:"hidden", marginBottom:16 }}>
                  {applied.map((c, i) => {
                    const info = VALID_CODES[c];
                    return (
                      <div key={c} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom: i<applied.length-1?`1px solid ${C.border}`:"none" }}>
                        <span style={{ fontSize:20 }}>🎟️</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>{c}</div>
                          {info && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{info.label} — {info.benefit}</div>}
                        </div>
                        <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>適用済み</span>
                      </div>
                    );
                  })}
                </Card>
              </>
            )}

            <div style={{ padding:"12px 14px", backgroundColor:C.surface, borderRadius:10, fontSize:11, color:C.muted, lineHeight:1.7 }}>
              💡 クーポンコードはキャンペーンやSNSで配布されます。大文字・小文字は区別しません。
            </div>
          </div>
        );
      })()}

      {subTab==="referral" && (() => {
        const refCode = "TAKURO-" + (user?.id || "").toString().slice(-6).toUpperCase();
        const refUrl  = `https://takuro-app.vercel.app/?ref=${refCode}`;
        const shareText = `タクシードライバー向け業務記録アプリ「タクロー」を使ってみて！売上分析・乗り場ガイド・AIアドバイスが全部ひとつで揃ってるよ🦉\n${refUrl}`;

        const [copied, setCopied] = useState(false);
        const [referralCount, setReferralCount] = useState(null); // null = 読み込み中

        // Supabaseから紹介数を取得
        useState(() => {
          if (!SUPABASE_READY || !refCode) { setReferralCount(0); return; }
          fetchReferralCount(refCode).then(({ count }) => setReferralCount(count ?? 0));
        });

        const rewardXp = (referralCount ?? 0) * 100;

        const copyLink = () => {
          navigator.clipboard.writeText(refUrl).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        const shareVia = (channel) => {
          if (channel === "line") {
            window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`, "_blank");
          } else if (channel === "x") {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
          } else if (channel === "instagram") {
            copyLink();
            alert("リンクをコピーしました。Instagramに貼り付けて投稿してください。");
          }
        };
        const REWARD_TIERS   = [
          { count:1,  reward:"🎉 +100 XP", desc:"1人招待達成" },
          { count:3,  reward:"⭐ +300 XP + 1ヶ月無料", desc:"3人招待達成" },
          { count:5,  reward:"👑 +500 XP + 3ヶ月無料", desc:"5人招待達成" },
          { count:10, reward:"🏆 永久無料プラン", desc:"10人招待達成" },
        ];

        return (
          <div>
            {/* 実績バナー */}
            <div style={{ background:`linear-gradient(135deg, ${C.accentLight}22, ${C.purple}22)`, border:`1px solid ${C.accentLight}44`, borderRadius:14, padding:"16px", marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>あなたの紹介実績</div>
              <div style={{ fontSize:36, fontWeight:900, color:C.text }}>
                {referralCount === null ? "—" : referralCount}
                <span style={{ fontSize:16, color:C.muted, marginLeft:4 }}>人</span>
              </div>
              <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginTop:4 }}>
                {referralCount === null ? "集計中..." : `累計 +${rewardXp} XP 獲得済み`}
              </div>
            </div>

            {/* 紹介コード */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>あなたの紹介コード</div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              <div style={{ flex:1, backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>招待コード</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.accentLight, letterSpacing:"1px" }}>{refCode}</div>
              </div>
              <button onClick={copyLink} style={{ padding:"0 16px", borderRadius:10, border:`1px solid ${copied?C.green:C.border}`, backgroundColor:copied?C.greenGlow:C.card, color:copied?C.green:C.sub, fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0, transition:"all 0.2s" }}>
                {copied ? "✓ コピー済" : "📋 コピー"}
              </button>
            </div>

            {/* シェアボタン */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>シェアする</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {[
                { ch:"line",      icon:"💬", label:"LINE で送る",    color:"#06C755", bg:"#06C75518" },
                { ch:"x",         icon:"✕",  label:"X (Twitter)",   color:"#000",    bg:"#00000018" },
                { ch:"instagram", icon:"📸", label:"Instagram",     color:"#E1306C", bg:"#E1306C18" },
                { ch:"copy",      icon:"🔗", label:"リンクをコピー", color:C.accentLight, bg:C.accentGlow },
              ].map(({ ch, icon, label, color, bg }) => (
                <button key={ch} onClick={() => ch === "copy" ? copyLink() : shareVia(ch)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", borderRadius:11, border:`1px solid ${color}44`, backgroundColor:bg, color, fontSize:13, fontWeight:700, cursor:"pointer", textAlign:"left" }}>
                  <span style={{ fontSize:18 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* 特典ティア */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>🎁 紹介特典</div>
            <Card style={{ padding:0, overflow:"hidden" }}>
              {REWARD_TIERS.map((tier, i) => {
                const achieved = referralCount >= tier.count;
                return (
                  <div key={tier.count} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderBottom: i < REWARD_TIERS.length-1 ? `1px solid ${C.border}` : "none", opacity: achieved ? 1 : 0.5 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", backgroundColor: achieved ? C.green+"22" : C.surface, border:`2px solid ${achieved ? C.green : C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                      {achieved ? "✓" : tier.count}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color: achieved ? C.text : C.muted }}>{tier.desc}</div>
                      <div style={{ fontSize:11, color: achieved ? C.green : C.muted, marginTop:2 }}>{tier.reward}</div>
                    </div>
                    {achieved && <span style={{ fontSize:18 }}>🏅</span>}
                  </div>
                );
              })}
            </Card>

            <div style={{ marginTop:12, fontSize:11, color:C.muted, lineHeight:1.7, padding:"10px 14px", backgroundColor:C.surface, borderRadius:10 }}>
              ※ 招待した相手がアカウント登録を完了した時点で特典が付与されます。自己紹介は対象外です。
            </div>
          </div>
        );
      })()}

      {subTab==="feedback" && (() => {
        const CATEGORIES = [
          { id:"feature", label:"✨ 機能要望", color:C.accentLight },
          { id:"bug",     label:"🐛 バグ報告", color:C.red },
          { id:"praise",  label:"👍 良かった点", color:C.green },
          { id:"other",   label:"💭 その他",    color:C.muted },
        ];
        const [fbCategory, setFbCategory] = useState("feature");
        const [fbBody, setFbBody]         = useState("");
        const [fbAnon, setFbAnon]         = useState(false);
        const [fbState, setFbState]       = useState("idle"); // idle | sending | done | error

        const handleSend = async () => {
          if (!fbBody.trim()) return;
          setFbState("sending");
          try {
            if (SUPABASE_READY) {
              const { error } = await insertFeedback({ userId: user?.id, category: fbCategory, body: fbBody.trim(), anonymous: fbAnon });
              if (error) throw error;
            } else {
              // Supabase未設定時はローカル保存で代替
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

            {/* カテゴリ */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>カテゴリ</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              {CATEGORIES.map(cat=>(
                <div key={cat.id} onClick={()=>setFbCategory(cat.id)}
                  style={{ padding:"10px 12px", borderRadius:10, border:`2px solid ${fbCategory===cat.id?cat.color:C.border}`, backgroundColor:fbCategory===cat.id?cat.color+"15":"transparent", color:fbCategory===cat.id?cat.color:C.muted, fontSize:13, fontWeight:fbCategory===cat.id?700:400, cursor:"pointer", textAlign:"center" }}>
                  {cat.label}
                </div>
              ))}
            </div>

            {/* テキスト */}
            <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>内容</div>
            <textarea
              value={fbBody}
              onChange={e=>setFbBody(e.target.value)}
              placeholder="例：〇〇機能が使いにくい、△△画面でエラーが出る など"
              rows={5}
              style={{ width:"100%", boxSizing:"border-box", backgroundColor:C.card, border:`1px solid ${fbBody?catColor+"77":C.border}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:13, outline:"none", resize:"vertical", lineHeight:1.7, fontFamily:"inherit" }}
            />
            <div style={{ fontSize:11, color:C.muted, textAlign:"right", marginTop:4, marginBottom:16 }}>
              {fbBody.length} 文字
            </div>

            {/* 匿名オプション */}
            <div onClick={()=>setFbAnon(p=>!p)} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, cursor:"pointer" }}>
              <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${fbAnon?C.accentLight:C.border}`, backgroundColor:fbAnon?C.accentLight:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {fbAnon && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize:13, color:C.text }}>匿名で送る</div>
                <div style={{ fontSize:11, color:C.muted }}>チェックするとユーザーIDが送信されません</div>
              </div>
            </div>

            {/* 送信ボタン */}
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
      })()}

      {subTab==="help" && (() => {
        const FAQ_DATA = [
          { category:"日報の記録", icon:"📋", items:[
            { q:"日報はどうやって登録するの？", a:"下のナビバーの「＋ アップロード」タブから登録できます。カメラで日報を撮影するとAIが自動読み取り（OCR）します。手動入力も可能です。" },
            { q:"OCRが正確に読み取れない", a:"画像が暗い・斜め・ぼけている場合に精度が下がります。明るい場所でまっすぐ撮影してください。読み取り後に数値を手修正することもできます。" },
            { q:"過去の日報を編集したい", a:"「記録」タブから日報を選び、詳細画面の「✏️ 編集」ボタンで修正できます。一覧画面の各カード右側の小さな✏️からも直接編集できます。" },
            { q:"1日に複数の日報を登録できる？", a:"はい、同じ日付で複数登録できます。日報は日付ごとに管理されます。" },
          ]},
          { category:"目標・売上", icon:"🎯", items:[
            { q:"月の目標売上はどこで設定する？", a:"設定 › プロフィール から「月間目標売上」を変更できます。デフォルトは38万円に設定されています。" },
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
            { q:"アカウントを削除したい", a:"設定 › プロフィール の一番下から削除申請ができます。申請後、30日以内にすべてのデータをサーバーから完全削除します。" },
            { q:"無料プランでできることは？", a:"月8件まで日報を登録できます。基本的な売上グラフ・分析・乗り場ガイドは全て無料で使えます。" },
          ]},
        ];

        const [helpSearch, setHelpSearch] = useState("");
        const [openItems, setOpenItems] = useState({});
        const toggleItem = key => setOpenItems(p => ({...p, [key]: !p[key]}));

        const q = helpSearch.trim().toLowerCase();
        const filtered = FAQ_DATA.map(cat => ({
          ...cat,
          items: cat.items.filter(item =>
            !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
          )
        })).filter(cat => cat.items.length > 0);

        return (
          <div>
            {/* 検索バー */}
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

            {/* 結果なし */}
            {filtered.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🤔</div>
                <div style={{ fontSize:14 }}>「{helpSearch}」に一致する質問が見つかりませんでした</div>
              </div>
            )}

            {/* FAQリスト */}
            {filtered.map(cat => (
              <div key={cat.category} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:8 }}>
                  {cat.icon} {cat.category}
                </div>
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

            {/* お問い合わせリンク */}
            <div onClick={()=>setSubTab("feedback")} style={{ marginTop:8, padding:"14px 16px", backgroundColor:C.surface, borderRadius:12, border:`1px solid ${C.border}`, textAlign:"center", cursor:"pointer" }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>解決しませんでしたか？</div>
              <div style={{ fontSize:13, color:C.accentLight, fontWeight:700 }}>💬 意見箱に送る →</div>
            </div>
          </div>
        );
      })()}

      {subTab==="terms" && (
        <div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:16 }}>タクロー 利用規約</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>最終更新日：2026年6月1日　施行日：2026年6月1日</div>

          {[
            { title:"第1条（目的・適用範囲）", body:"本規約は、タクロー運営者（以下「運営者」）が提供するスマートフォン・ウェブアプリケーション「タクロー」（以下「本アプリ」）の利用条件を定めるものです。ユーザーは本規約に同意のうえ、本アプリをご利用ください。本規約は本アプリを利用するすべてのユーザーに適用されます。本アプリの利用を開始した時点で、本規約に同意したものとみなします。" },
            { title:"第2条（アカウントの作成・管理）", body:"ユーザーは正確な情報を入力してアカウントを作成しなければなりません。アカウントのID・パスワードは自己の責任において管理してください。第三者によるアカウントの不正利用が発生した場合、運営者は責任を負いません。ユーザーは一人につき一つのアカウントのみ保有できます。虚偽情報によるアカウント作成は禁止します。" },
            { title:"第3条（免責事項）", body:"本アプリの利用による労働環境・健康状態・収益への影響について、運営者は一切の責任を負いません。本アプリはあくまで情報管理ツールであり、営業成果・収益を保証するものではありません。AIによる分析・アドバイスは参考情報であり、その正確性・有用性について運営者は保証しません。ユーザーは自己の判断と責任においてアプリを利用するものとします。" },
            { title:"第4条（ランキング・競争機能）", body:"ランキングは参考情報であり、無理な営業を推奨するものではありません。ランキング上位を目指すあまり、安全運転を損なう行為は禁止します。ランキングデータは統計的に処理されており、一部モック（サンプル）データを含む場合があります。" },
            { title:"第5条（健康・安全に関する注意）", body:"ドライバーは適切な休息を取り、疲労状態での運転を行わないでください。本アプリは連続乗務・過労・速度超過・ながら運転を助長することを意図していません。体調に異変を感じた場合は直ちに運転を中止し、適切な対応をとってください。運転中のアプリ操作は法令および安全上の観点から禁止します。" },
            { title:"第6条（データの正確性・管理）", body:"日報データの正確性はユーザー自身の責任において管理してください。虚偽・誤ったデータの入力による不利益について、運営者は責任を負いません。ユーザーはデータのバックアップを自身で管理することが推奨されます。アプリのデータはユーザーの端末・クラウドサービスに保存されますが、障害・データ損失のリスクをユーザーは理解したうえでご利用ください。" },
            { title:"第7条（禁止事項）", body:"以下の行為を禁止します。\n・システムへの不正アクセス・リバースエンジニアリング\n・データの改ざん・虚偽入力による不正なランキング操作\n・他ユーザーへの誹謗中傷・ハラスメント\n・コミュニティ機能での個人情報の無断掲載\n・営業目的でのスパム投稿\n・運営者の許可なく本アプリのコンテンツを複製・転用する行為\n・法令に違反する行為、公序良俗に反する行為\nこれらが確認された場合、アカウントを停止または削除することがあります。" },
            { title:"第8条（コミュニティ・投稿コンテンツ）", body:"ユーザーがコミュニティ機能に投稿したコンテンツの著作権はユーザーに帰属します。ただしユーザーは運営者に対し、サービス改善・品質向上の目的で当該コンテンツを使用する非独占的ライセンスを無償で付与するものとします。運営者は、不適切と判断した投稿を予告なく削除できます。" },
            { title:"第9条（知的財産権）", body:"本アプリのロゴ・デザイン・コード・コンテンツの著作権・商標権その他の知的財産権は運営者に帰属します。ユーザーは本規約の範囲内においてのみ本アプリを利用する権限を有します。本アプリの内容を運営者の許可なく転載・販売・再配布することを禁じます。" },
            { title:"第10条（有料サービス・決済）", body:"有料プランの料金・内容は運営者が定め、事前に告知します。決済は第三者決済サービスを経由して行われます。支払い済みの料金は原則返金しません。ただし法令上の権利は妨げません。有料プランの内容は予告のうえ変更されることがあります。" },
            { title:"第11条（サービスの変更・停止・終了）", body:"運営者は予告なくサービス内容を変更・停止・終了することがあります。ただし重要な変更については事前にアプリ内通知または登録メールアドレスへの連絡を行うよう努めます。これによりユーザーに生じた損害について、運営者は故意・重過失がある場合を除き責任を負いません。" },
            { title:"第12条（損害賠償の制限）", body:"運営者がユーザーに対して損害賠償責任を負う場合、その範囲はユーザーが本アプリに対して直近1ヶ月に支払った利用料金の総額を上限とします。ただし、運営者の故意・重過失による損害はこの限りではありません。間接損害・逸失利益・機会損失については運営者は一切責任を負いません。" },
            { title:"第13条（通知・連絡）", body:"運営者からユーザーへの通知は、アプリ内通知または登録メールアドレスへのメール送信をもって行います。ユーザーが登録した連絡先が無効の場合、当該通知は到達したものとみなします。" },
            { title:"第14条（規約の変更）", body:"本規約は運営者の判断により改定されることがあります。重要な変更の場合は30日前までにアプリ内で告知します。改定後も本アプリを継続してご利用いただいた場合、改定後の規約に同意したものとみなします。" },
            { title:"第15条（分離可能性）", body:"本規約の一部条項が法令により無効または執行不能と判断された場合でも、その他の条項は引き続き有効に存続します。" },
            { title:"第16条（準拠法・管轄）", body:"本規約は日本法に準拠し、本アプリに関する紛争は東京地方裁判所を専属的合意管轄裁判所とします。" },
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
          <div style={{ fontSize:11, color:C.muted, marginBottom:20 }}>2026年6月1日 制定　2026年6月15日 改定</div>

          {[
            { title:"収集する情報", body:"本アプリでは以下の情報を取得します。\n・氏名またはニックネーム\n・メールアドレス\n・日報データ（売上・走行距離・乗車回数・勤務時間等）\n・アップロードされた給与明細・日報の画像（OCR処理後に画像は保存しません）\n・勤務形態・所属エリア・月間目標売上（任意入力）\n・端末の種類・OSバージョン等の端末情報\n・Cookie等により生成された識別情報\n・アプリの操作履歴・利用ログ" },
            { title:"情報の利用目的", body:"取得した情報は以下の目的で利用します。\n・本サービスの提供・本人確認・認証\n・日報データの記録・分析・表示\n・ランキング・エリア統計の集計（匿名化処理後）\n・AIによる走行アドバイスの生成\n・サービスの改善・新機能の開発\n・不正利用の検知・防止\n・お問い合わせへの対応\n・利用規約変更等の重要事項のご通知" },
            { title:"外部サービスの利用", body:"本アプリは以下の外部サービスを使用しており、各社のプライバシーポリシーが適用されます。\n・Supabase（データベース・認証）：https://supabase.com/privacy\n・Anthropic（AI処理・Claude API）：https://www.anthropic.com/privacy\nこれらのサービスに送信されるデータは各社のポリシーに基づき取り扱われます。" },
            { title:"第三者への提供", body:"取得した個人情報は、以下の場合を除き第三者に提供しません。\n・ユーザー本人の同意がある場合\n・法令に基づく開示が必要な場合\n・サービス運営に必要な業務委託先への提供（守秘義務契約のもと）\n・事業譲渡等が発生した場合\n個人が特定できる形でのデータ販売は一切行いません。" },
            { title:"統計データの利用", body:"個人を特定できない形に匿名化・集計したデータを、エリア別売上統計・需要スコアの算出・サービス改善に利用することがあります。" },
            { title:"安全管理措置", body:"取得した情報の漏えい・滅失・毀損を防止するため、以下の措置を講じています。\n・データの暗号化通信（HTTPS/TLS）\n・Supabaseによるアクセス制御（Row Level Security）\n・パスワードのハッシュ化\nただし、インターネット上での完全なセキュリティを保証するものではありません。" },
            { title:"データの保管・削除", body:"アカウントを削除した場合、個人情報および日報データは30日以内にサーバーから削除されます。匿名化済みの統計データは引き続き保持されることがあります。\n\nデータの開示・訂正・削除をご希望の場合は下記お問い合わせ先までご連絡ください。ご本人確認のうえ、法令の定めに従い対応します。" },
            { title:"プライバシーポリシーの変更", body:"本ポリシーは必要に応じて変更されることがあります。重要な変更がある場合はアプリ内通知またはメールでお知らせします。" },
            { title:"お問い合わせ", body:"個人情報の取り扱いに関するお問い合わせ・開示請求・削除依頼は以下までご連絡ください。\nメール：support@takuro-app.jp\nアプリ内の「意見箱」からもお問い合わせいただけます。" },
          ].map(({title, body}) => (
            <div key={title} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>■ {title}</div>
              {body.split("\n").map((line, i) => (
                <div key={i} style={{ fontSize:12, color:C.sub }}>{line || <br/>}</div>
              ))}
            </div>
          ))}
          <div style={{ marginTop:16, padding:12, backgroundColor:C.card, borderRadius:10, fontSize:11, color:C.muted }}>
            運営者：タクロー開発チーム
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
