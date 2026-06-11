// 情報センター（電車遅延・イベント・渋滞・通知設定）
import { useState } from "react";
import { C } from "../lib/constants";
import { generateDayStrategy } from "../lib/ai";
import { Card, Btn, ProgressBar, Toggle } from "../components/UI";
import { AreaFilterBanner, inArea } from "../components/AreaFilter";
import { MOCK_EVENTS, MOCK_DELAYS, MOCK_TRAFFIC, MOCK_AREA_STATS } from "../data/mockData";

const CAT_META = { concert:{icon:"🎵",color:C.purple}, sports:{icon:"⚽",color:C.green}, event:{icon:"🎡",color:C.gold}, movie:{icon:"🎬",color:C.orange} };
const TRAFFIC_META = { jam:{label:"渋滞",color:C.red}, slow:{label:"混雑",color:C.gold}, normal:{label:"順調",color:C.green} };

export default function InfoCenter({ notifSettings, onUpdateNotif, userAreas=[], onManageArea }) {
  const [subTab, setSubTab] = useState("today");
  const [strategy, setStrategy] = useState("");
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [strategyLoaded, setStrategyLoaded] = useState(false);
  const [reservedEvents, setReservedEvents] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [areaParentFilter, setAreaParentFilter] = useState("all");
  const [areaSortKey, setAreaSortKey] = useState("avg_unit");

  const todayEvents  = (showAll ? MOCK_EVENTS : MOCK_EVENTS.filter(e=>inArea(e,userAreas))).filter(e=>e.date==="2026-06-10");
  const filteredDelays  = showAll ? MOCK_DELAYS  : MOCK_DELAYS.filter(d=>inArea(d,userAreas));
  const filteredTraffic = showAll ? MOCK_TRAFFIC : MOCK_TRAFFIC.filter(t=>inArea(t,userAreas));

  const demandColor = s => s>=90?C.red:s>=75?C.orange:s>=60?C.gold:C.green;
  const demandLabel = s => s>=90?"超高需要":s>=75?"高需要":s>=60?"需要増":"通常";

  const AllToggle = () => (
    <div onClick={()=>setShowAll(p=>!p)} style={{ display:"flex", alignItems:"center", gap:6, backgroundColor:showAll?C.border:C.accentGlow, border:`1px solid ${showAll?C.border:C.accentLight+"44"}`, borderRadius:99, padding:"5px 12px", cursor:"pointer", marginBottom:12, width:"fit-content" }}>
      <span style={{ fontSize:11, color:showAll?C.muted:C.accentLight, fontWeight:700 }}>{showAll?"全エリア表示中":"📍 "+userAreas.join("・")+"のみ"}</span>
      <span style={{ fontSize:10, color:C.muted }}>{showAll?"→ 絞り込む":"→ 全表示"}</span>
    </div>
  );

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      <AreaFilterBanner userAreas={userAreas} onManage={onManageArea} />
      <div style={{ display:"flex", backgroundColor:C.surface, borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
        {[["today","今日"],["delays","電車"],["traffic","渋滞"],["area","単価"],["notif","通知"]].map(([v,l])=>(
          <div key={v} onClick={()=>setSubTab(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:9, fontSize:11, fontWeight:subTab===v?700:400, backgroundColor:subTab===v?C.card:"transparent", color:subTab===v?C.text:C.muted, cursor:"pointer" }}>{l}</div>
        ))}
      </div>

      {subTab==="today" && (
        <>
          <AllToggle />
          <Card style={{ borderColor:C.accentLight+"44" }}>
            <div style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginBottom:8 }}>🤖 今日の営業戦略{userAreas.length>0&&!showAll?`（${userAreas.join("・")}）`:""}</div>
            {strategyLoaded ? <div style={{ fontSize:13, color:C.sub, lineHeight:1.8 }}>{strategy}</div> : (
              <><div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>エリアに絞った戦略をAIが提案します</div>
              <Btn onClick={async()=>{setLoadingStrategy(true);const t=await generateDayStrategy(todayEvents,filteredDelays,filteredTraffic,userAreas);setStrategy(t);setLoadingStrategy(false);setStrategyLoaded(true);}} disabled={loadingStrategy} variant="ghost" style={{ padding:"10px 0",fontSize:13 }}>{loadingStrategy?"分析中...":"AIに今日の戦略を聞く"}</Btn></>
            )}
          </Card>
          {filteredDelays.filter(d=>d.status!=="normal"&&d.opportunity).length>0&&(
            <div style={{ backgroundColor:C.redGlow, border:`1px solid ${C.red}44`, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.red, fontWeight:700, marginBottom:6 }}>🚨 電車遅延チャンス</div>
              {filteredDelays.filter(d=>d.status!=="normal"&&d.opportunity).map(d=>(
                <div key={d.id} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{ fontSize:13, fontWeight:700 }}>{d.line}</span><span style={{ backgroundColor:(d.severity==="high"?C.red:C.orange)+"22", color:d.severity==="high"?C.red:C.orange, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>{d.status==="stop"?"見合わせ":`${d.minutes}分遅延`}</span></div>
                  <div style={{ fontSize:12, color:C.orange }}>{d.opportunityMsg}</div>
                </div>
              ))}
            </div>
          )}
          {todayEvents.length===0&&!showAll ? (
            <Card style={{ textAlign:"center", padding:24 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>😴</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>今日はエリア内にイベントなし</div>
              <Btn onClick={()=>setShowAll(true)} variant="ghost" style={{ padding:"10px 0",fontSize:13 }}>全エリアを表示する</Btn>
            </Card>
          ) : todayEvents.sort((a,b)=>b.demandScore-a.demandScore).map(e=>{
            const meta=CAT_META[e.category]||{icon:"📍",color:C.sub}, isR=reservedEvents[e.id];
            return (
              <Card key={e.id} style={{ borderColor:meta.color+"44" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1 }}><div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}><span style={{ fontSize:16 }}>{meta.icon}</span><span style={{ fontSize:13, fontWeight:700 }}>{e.title}</span></div><div style={{ fontSize:11, color:C.muted }}>📍 {e.venue}　🕐 {e.startTime}〜{e.endTime}</div></div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}><div style={{ fontSize:18, fontWeight:900, color:demandColor(e.demandScore) }}>{e.demandScore}</div><div style={{ fontSize:9, color:C.muted }}>需要スコア</div></div>
                </div>
                <div style={{ marginBottom:10 }}><ProgressBar value={e.demandScore} max={100} color={demandColor(e.demandScore)} height={5}/></div>
                <div style={{ backgroundColor:C.bg, borderRadius:9, padding:"8px 10px", fontSize:12, color:C.sub, borderLeft:`3px solid ${meta.color}`, marginBottom:10 }}>💡 {e.tip}</div>
                <button onClick={()=>setReservedEvents(p=>({...p,[e.id]:!p[e.id]}))} style={{ width:"100%", padding:"9px 0", borderRadius:9, fontSize:12, fontWeight:700, cursor:"pointer", border:"none", backgroundColor:isR?C.green+"22":C.accentLight+"22", color:isR?C.green:C.accentLight }}>{isR?"✓ 出勤予定に追加済み":"+ 出勤予定に追加"}</button>
              </Card>
            );
          })}
        </>
      )}

      {subTab==="delays" && (
        <>
          <AllToggle />
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}><div style={{ fontSize:12, color:C.muted }}>国土交通省API / 各社公式</div><div style={{ fontSize:11, color:C.green }}>● 18:22更新</div></div>
          {filteredDelays.map(d=>{
            const sc=d.status==="stop"?C.red:d.status==="delay"?C.orange:C.green, sl=d.status==="stop"?"運転見合わせ":d.status==="delay"?`${d.minutes}分遅延`:"平常運転", ia=d.status!=="normal";
            return <Card key={d.id} style={{ borderColor:ia?sc+"44":C.border, padding:"14px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:ia?8:0 }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:8, height:8, borderRadius:"50%", backgroundColor:sc, boxShadow:ia?`0 0 8px ${sc}`:"none" }}/><span style={{ fontSize:14, fontWeight:700 }}>{d.line}</span></div><span style={{ backgroundColor:sc+"22", color:sc, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>{sl}</span></div>{ia&&<><div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>原因: {d.reason}　{d.since}〜</div>{d.opportunity&&<div style={{ backgroundColor:C.orangeGlow, border:`1px solid ${C.orange}44`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.orange }}>🚕 {d.opportunityMsg}</div>}</>}</Card>;
          })}
        </>
      )}

      {subTab==="traffic" && (
        <>
          <AllToggle />
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}><div style={{ fontSize:12, color:C.muted }}>Google Maps Routes API</div><div style={{ fontSize:11, color:C.green }}>● 18:22更新</div></div>
          {filteredTraffic.map(t=>{
            const meta=TRAFFIC_META[t.status]||{label:"不明",color:C.muted}, ij=t.level>=2;
            return <Card key={t.id} style={{ borderColor:ij?meta.color+"44":C.border, padding:"14px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:ij?10:0 }}><div><div style={{ fontSize:13, fontWeight:700, marginBottom:3 }}>{t.area}</div><div style={{ fontSize:12, color:C.muted }}>{t.desc}</div></div><span style={{ backgroundColor:meta.color+"22", color:meta.color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>{meta.label}</span></div>{ij&&<>{t.cause&&<div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>原因: {t.cause}</div>}{t.tip&&<div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.accentLight }}>🗺 {t.tip}</div>}</>}<div style={{ marginTop:10 }}><div style={{ display:"flex", gap:4 }}>{[1,2,3].map(l=><div key={l} style={{ flex:1, height:4, borderRadius:99, backgroundColor:t.level>=l?meta.color:C.border, opacity:t.level>=l?0.9:0.4 }}/>)}</div></div></Card>;
          })}
        </>
      )}

      {subTab==="area" && (
        <>
          {/* 説明バナー */}
          <div style={{ backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`, borderRadius:12, padding:"10px 14px", marginBottom:12, fontSize:12, color:C.accentLight }}>
            📊 ドライバーが日報に記録したエリアの集計データです（匿名・全ユーザー平均）
          </div>

          {/* 親エリアフィルター */}
          {(() => {
            const parents = ["all", ...new Set(MOCK_AREA_STATS.map(s=>s.parent))];
            return (
              <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:12 }}>
                {parents.map(p => (
                  <div key={p} onClick={()=>setAreaParentFilter(p)} style={{ flexShrink:0, padding:"5px 12px", borderRadius:99, fontSize:11, fontWeight:700, cursor:"pointer", backgroundColor:areaParentFilter===p?C.accentLight:C.surface, color:areaParentFilter===p?C.bg:C.muted, border:`1px solid ${areaParentFilter===p?C.accentLight:C.border}` }}>
                    {p==="all"?"全エリア":p}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ソート切り替え */}
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {[["avg_unit","時間単価"],["avg_occ","実車率"],["sample","データ数"]].map(([k,l])=>(
              <div key={k} onClick={()=>setAreaSortKey(k)} style={{ padding:"4px 10px", borderRadius:99, fontSize:11, cursor:"pointer", backgroundColor:areaSortKey===k?C.gold+"22":C.surface, color:areaSortKey===k?C.gold:C.muted, border:`1px solid ${areaSortKey===k?C.gold+"44":C.border}`, fontWeight:areaSortKey===k?700:400 }}>{l}順</div>
            ))}
          </div>

          {/* ランキング */}
          {MOCK_AREA_STATS
            .filter(s => areaParentFilter==="all" || s.parent===areaParentFilter)
            .sort((a,b) => b[areaSortKey] - a[areaSortKey])
            .map((s, i) => {
              const trendIcon = s.trend==="up"?"↑":s.trend==="down"?"↓":"→";
              const trendColor = s.trend==="up"?C.green:s.trend==="down"?C.red:C.muted;
              const unitColor = s.avg_unit>=3000?C.green:s.avg_unit>=2500?C.gold:C.orange;
              const occColor = s.avg_occ>=60?C.green:s.avg_occ>=50?C.gold:C.orange;
              const rankColor = i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted;
              return (
                <Card key={s.area} style={{ padding:"12px 14px", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {/* 順位 */}
                    <div style={{ width:28, textAlign:"center", fontSize:i<3?16:13, fontWeight:900, color:rankColor, flexShrink:0 }}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
                    {/* エリア名 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700 }}>{s.area}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{s.parent}　n={s.sample}件</div>
                    </div>
                    {/* 時間単価 */}
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:16, fontWeight:900, color:unitColor }}>¥{s.avg_unit.toLocaleString()}</div>
                      <div style={{ fontSize:10, color:C.muted }}>時間単価</div>
                    </div>
                    {/* 実車率 */}
                    <div style={{ textAlign:"right", flexShrink:0, marginLeft:8 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:occColor }}>{s.avg_occ}%</div>
                      <div style={{ fontSize:10, color:C.muted }}>実車率</div>
                    </div>
                    {/* トレンド */}
                    <div style={{ fontSize:16, color:trendColor, flexShrink:0, marginLeft:4, fontWeight:900 }}>{trendIcon}</div>
                  </div>
                </Card>
              );
            })
          }

          <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>
            ※ 日報の「メインエリア」を入力すると統計に参加できます<br/>データはすべて匿名・集計値です
          </div>
        </>
      )}

      {subTab==="notif" && (
        <>
          {[
            {k:"delays",    icon:"🚃",l:"電車遅延チャンス通知",      d:"遅延・見合わせ発生時（エリア内のみ）"},
            {k:"events",    icon:"🎵",l:"イベント前通知",             d:"出勤予定追加イベントの60分前"},
            {k:"traffic",   icon:"🚗",l:"重大渋滞通知",               d:"渋滞レベル3発生時"},
            {k:"dailyTip",  icon:"🤖",l:"AI日次戦略通知",             d:"毎朝8時にエリアに絞った戦略"},
            {k:"achievement",icon:"🏆",l:"自己ベスト更新通知",        d:"売上・実車率・時間単価の更新時"},
            {k:"dailyResult",icon:"📣",l:"翌日発表通知（毎朝8時）",  d:"前日の集計結果・順位・エリア平均"},
          ].map(({k,icon,l,d})=>(
            <Card key={k} style={{ padding:"14px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><div style={{ display:"flex", gap:10 }}><span style={{ fontSize:20 }}>{icon}</span><div><div style={{ fontSize:14, fontWeight:600 }}>{l}</div><div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{d}</div></div></div><Toggle value={notifSettings[k]||false} onChange={v=>onUpdateNotif(k,v)}/></div></Card>
          ))}
          <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>※ プッシュ通知はCowork（React Native）実装後に有効化</div>
        </>
      )}
    </div>
  );
}
