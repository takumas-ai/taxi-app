// 設定画面（プロフィール・エリア・プラン・通知・ランク・モード・ロードマップ）
import { useState } from "react";
import { C, FREE_LIMIT, loadS, saveS } from "../lib/constants";
import { Card, Btn, ProgressBar, Toggle } from "../components/UI";
import { AreaBadges } from "../components/UI";
import { levelFromXp, getTitle, BADGES } from "../lib/xp";

export default function Settings({ user, onUpdate, onLogout, onManageArea, notifSettings, onUpdateNotif, appMode="standard", onModeChange }) {
  const [subTab, setSubTab] = useState("");
  const [form, setForm] = useState({ name:user.name||"", company:user.company||"", workType:user.workType||"隔日勤務", target:user.target||"380000" });
  const [saved, setSaved] = useState(false);
  const [rankPrefs, setRankPrefs] = useState({ showMyRank:false, showTopSales:false });
  const [takePay, setTakePay] = useState(loadS("taxi_takepay", { rate:55, deduction:30000 }));
  const save = () => { onUpdate(form); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  const saveTakePay = (next) => { setTakePay(next); saveS("taxi_takepay", next); };

  const SUB = [
    {id:"profile", icon:"👤", label:"プロフィール", sub:"名前・勤務形態"},
    {id:"mode",    icon:"🎛️", label:"モード",       sub:appMode==="easy"?"かんたん":appMode==="analyze"?"分析":"スタンダード"},
    {id:"area",    icon:"📍", label:"エリア",       sub:user.areas?.length>0?user.areas[0]:"未設定"},
    {id:"notif",   icon:"🔔", label:"通知",         sub:"アラート設定"},
    {id:"takepay", icon:"💴", label:"手取り設定",    sub:`歩合${takePay.rate}% / 控除${(takePay.deduction/10000).toFixed(1)}万円`},
    {id:"plan",    icon:"💳", label:"プラン",        sub:"無料プラン"},
    {id:"rank",    icon:"🏆", label:"ランク",       sub:"表示設定"},
    {id:"roadmap", icon:"🗺️", label:"ロードマップ",  sub:"開発予定"},
  ];

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      {!subTab ? (
        <>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>⚙️ 設定</div>
          <Card style={{ padding:0, overflow:"hidden" }}>
            {SUB.map((t, i) => (
              <div key={t.id} onClick={()=>setSubTab(t.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", borderBottom: i<SUB.length-1?`1px solid ${C.border}`:"none", cursor:"pointer" }}>
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
            <div onClick={()=>setSubTab("")} style={{ display:"flex", alignItems:"center", gap:4, color:C.accentLight, fontSize:14, cursor:"pointer", fontWeight:600 }}>‹ 設定</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{SUB.find(t=>t.id===subTab)?.label}</div>
          </div>

      {subTab==="profile" && (
        <Card>
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
          <Btn onClick={save}>{saved?"✓ 保存しました":"設定を保存"}</Btn>
          <Btn onClick={onLogout} variant="danger" style={{ marginTop:10 }}>ログアウト</Btn>
        </Card>
      )}

      {subTab==="area" && (
        <Card style={{ borderColor:C.accentLight+"44", cursor:"pointer" }} onClick={onManageArea}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>所属エリア</div>{user.areas?.length>0?<AreaBadges areas={user.areas}/>:<span style={{ fontSize:12, color:C.red }}>未設定</span>}<div style={{ fontSize:11, color:C.muted, marginTop:6 }}>タップして変更</div></div>
            <span style={{ fontSize:20, color:C.muted }}>›</span>
          </div>
        </Card>
      )}

      {subTab==="plan" && (
        <>
          <Card style={{ borderColor:C.gold+"44", backgroundColor:C.goldGlow }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div><div style={{ fontSize:16, fontWeight:800, color:C.gold }}>無料プラン</div><div style={{ fontSize:12, color:C.sub, marginTop:2 }}>今月 {user.uploadCount||0}/{FREE_LIMIT} 件使用</div></div>
              <Btn variant="gold" style={{ width:"auto", padding:"10px 18px", fontSize:13 }}>480円/月</Btn>
            </div>
            <ProgressBar value={user.uploadCount||0} max={FREE_LIMIT} color={(user.uploadCount||0)>=FREE_LIMIT-1?C.red:C.gold} height={6}/>
          </Card>
          {[["無制限アップロード","月8件の制限なし"],["AI分析コメント","毎回の日報に営業アドバイス"],["売上グラフ","曜日別・月別トレンド分析"],["目標管理","達成率と逆算表示"],["翌日発表通知","毎朝8時に前日集計を受け取れる"]].map(([t,d])=>(
            <div key={t} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.green, fontSize:18 }}>✓</span>
              <div><div style={{ fontSize:14, fontWeight:600 }}>{t}</div><div style={{ fontSize:12, color:C.muted }}>{d}</div></div>
            </div>
          ))}
          <Btn variant="gold" style={{ marginTop:16 }}>月額480円で始める</Btn>
          <Btn variant="ghost" style={{ marginTop:10 }}>年払い 3,800円で始める</Btn>
        </>
      )}

      {subTab==="notif" && (
        <>
          {[{k:"delays",icon:"🚃",l:"電車遅延チャンス通知",d:"遅延・見合わせ発生時（エリア内）"},{k:"events",icon:"🎵",l:"イベント前通知",d:"出勤予定追加イベントの60分前"},{k:"traffic",icon:"🚗",l:"重大渋滞通知",d:"渋滞レベル3発生時"},{k:"dailyTip",icon:"🤖",l:"AI日次戦略通知",d:"毎朝8時にエリアに絞った戦略"},{k:"achievement",icon:"🏆",l:"自己ベスト更新通知",d:"売上・実車率・時間単価の更新時"},{k:"dailyResult",icon:"📣",l:"翌日発表通知（毎朝8時）",d:"前日の集計結果・順位・エリア平均"}].map(({k,icon,l,d})=>(
            <Card key={k} style={{ padding:"14px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><div style={{ display:"flex", gap:10 }}><span style={{ fontSize:20 }}>{icon}</span><div><div style={{ fontSize:14, fontWeight:600 }}>{l}</div><div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{d}</div></div></div><Toggle value={notifSettings[k]||false} onChange={v=>onUpdateNotif(k,v)}/></div></Card>
          ))}
        </>
      )}

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
            { id:"easy",     icon:"😊", name:"かんたん",    color:"#10B981", desc:"大きな文字・最小限の入力。年配の方や疲れてる日でも使いやすいモード。" },
            { id:"standard", icon:"📊", name:"スタンダード", color:C.accentLight, desc:"基本機能をすべて使えるデフォルトモード。" },
            { id:"analyze",  icon:"🔬", name:"分析",        color:"#8B5CF6", desc:"エリア統計・詳細グラフ・実車率など全データを表示するモード。" },
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
        </div>
      )}

      {subTab==="takepay" && (() => {
        const preview = (sales) => Math.max(0, Math.round(sales * takePay.rate / 100 - takePay.deduction));
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

            <Card>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:10 }}>📊 シミュレーション</div>
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
        </>
      )}
    </div>
  );
}
