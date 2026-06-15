// 乗り場・空港・休憩・飲食店ガイド（コミュニティ投稿型）
import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { Card, Btn } from "../components/UI";
import { STAND_GUIDES } from "../data/mockData";
import { loadS, saveS } from "../lib/constants";
import {
  fetchGuideSpots, insertGuideSpot, updateGuideSpot,
  insertGuideReview, flagGuideSpot, fetchGuideReviews, fetchGuideEdits,
} from "../lib/supabase";
import { upsertProfile } from "../lib/supabase";

const SUPABASE_READY = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

// ─── 定数 ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"stand",   label:"乗り場",   emoji:"🚕" },
  { id:"airport", label:"空港",     emoji:"✈️" },
  { id:"rest",    label:"休憩場所", emoji:"😴" },
  { id:"food",    label:"飲食店",   emoji:"🍜" },
];

const STAND_SUBS = [
  { id:"all",        label:"全て" },
  { id:"station",    label:"駅・バス停" },
  { id:"hotel",      label:"ホテル" },
  { id:"hospital",   label:"病院" },
  { id:"commercial", label:"商業施設" },
];

const SORT_OPTIONS = [
  { id:"demand", label:"🔥 需要順" },
  { id:"rating", label:"⭐ 評価順" },
  { id:"name",   label:"🔤 名前順" },
  { id:"area",   label:"📍 エリア順" },
];

const AREA_OPTIONS = ["東京都心","横浜","川崎","千葉","埼玉","大阪","名古屋","福岡","京都","神戸"];

const XP_GUIDE_POST   = 20;
const XP_GUIDE_REVIEW = 5;

// mockData → 共通形式に正規化
const normalizeMock = (g) => ({
  ...g,
  category:         g.type,
  subcategory:      null,
  access_note:      g.access || null,
  description:      null,
  address:          null,
  has_parking:      false,
  open_hours:       null,
  contributor_name: null,
  isMock:           true,
});

// ─── PostModal ────────────────────────────────────────────────────────────────
function PostModal({ defaultCategory, userAreas, onClose, onSave }) {
  const [form, setForm] = useState({
    category:    defaultCategory || "stand",
    subcategory: "",
    name: "", area: userAreas[0] || "", emoji: "",
    peak: "", lineup: "", description: "", tips: "", caution: "",
    address: "", openHours: "", hasParking: false,
  });
  const [saving, setSaving] = useState(false);
  const inp = { backgroundColor:C.bg, border:`1px solid ${C.border}`, borderRadius:8,
    padding:"9px 11px", color:C.text, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" };

  const handleSave = async () => {
    if (!form.name.trim() || !form.area.trim()) { alert("名前とエリアは必須です"); return; }
    setSaving(true);
    const spot = {
      ...form,
      tips: form.tips ? form.tips.split("\n").map(t=>t.trim()).filter(Boolean) : [],
      emoji: form.emoji || (form.category === "stand" ? "🚕" : form.category === "airport" ? "✈️" : form.category === "rest" ? "😴" : "🍜"),
    };
    await onSave(spot);
    setSaving(false);
  };

  const sel = (field, opts) => (
    <select value={form[field]} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} style={{...inp}}>
      {opts.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
    </select>
  );

  return (
    <div style={{position:"fixed",inset:0,backgroundColor:"#00000090",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{backgroundColor:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,paddingBottom:36,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,backgroundColor:C.border,borderRadius:99,margin:"0 auto 16px"}}/>
        <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>📍 スポットを投稿する</div>
        <div style={{fontSize:11,color:C.accentLight,backgroundColor:C.accentGlow,borderRadius:8,padding:"6px 10px",marginBottom:14}}>
          ✨ 投稿すると {XP_GUIDE_POST} XP獲得！ みんなのガイドを育てよう
        </div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>カテゴリ *</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {CATEGORIES.map(c=>(
              <div key={c.id} onClick={()=>setForm(p=>({...p,category:c.id,subcategory:""}))}
                style={{textAlign:"center",padding:"8px 0",borderRadius:9,border:`1.5px solid ${form.category===c.id?C.accentLight:C.border}`,backgroundColor:form.category===c.id?C.accentGlow:"transparent",fontSize:13,fontWeight:form.category===c.id?700:400,color:form.category===c.id?C.accentLight:C.muted,cursor:"pointer"}}>
                {c.emoji} {c.label}
              </div>
            ))}
          </div>
        </div>

        {form.category === "stand" && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>種別</div>
            {sel("subcategory", [{value:"",label:"選択（任意）"},...STAND_SUBS.filter(s=>s.id!=="all").map(s=>({value:s.id,label:s.label}))])}
          </div>
        )}

        {[
          {key:"name",  label:"スポット名 *", ph:"例: 六本木ヒルズ"},
          {key:"emoji", label:"絵文字（任意）", ph:"例: 🌆"},
        ].map(({key,label,ph})=>(
          <div key={key} style={{marginBottom:10}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{label}</div>
            <input value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} placeholder={ph} style={inp}/>
          </div>
        ))}

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>エリア *</div>
          <input list="area-list" value={form.area} onChange={e=>setForm(p=>({...p,area:e.target.value}))} placeholder="例: 東京都心" style={inp}/>
          <datalist id="area-list">{AREA_OPTIONS.map(a=><option key={a} value={a}/>)}</datalist>
        </div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>ピーク時間帯</div>
          <input value={form.peak} onChange={e=>setForm(p=>({...p,peak:e.target.value}))} placeholder="例: 夜〜深夜◎" style={inp}/>
        </div>

        {(form.category === "stand" || form.category === "airport") && (
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>並び方・ルール</div>
            <textarea value={form.lineup} onChange={e=>setForm(p=>({...p,lineup:e.target.value}))} rows={3}
              placeholder="並び方、係員の有無、乗り場の場所など" style={{...inp,resize:"vertical",lineHeight:1.6}}/>
          </div>
        )}

        {(form.category === "rest" || form.category === "food") && (
          <>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4}}>説明</div>
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3}
                placeholder="場所の特徴、おすすめポイントなど" style={{...inp,resize:"vertical",lineHeight:1.6}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4}}>住所・場所</div>
              <input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="例: 港区六本木6-10-1" style={inp}/>
            </div>
            {form.category === "food" && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4}}>営業時間</div>
                <input value={form.openHours} onChange={e=>setForm(p=>({...p,openHours:e.target.value}))} placeholder="例: 24時間営業" style={inp}/>
              </div>
            )}
            <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" id="parking" checked={form.hasParking} onChange={e=>setForm(p=>({...p,hasParking:e.target.checked}))}/>
              <label htmlFor="parking" style={{fontSize:13,color:C.sub,cursor:"pointer"}}>🅿️ 駐車・停車できる</label>
            </div>
          </>
        )}

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>コツ・ポイント（1行1つ）</div>
          <textarea value={form.tips} onChange={e=>setForm(p=>({...p,tips:e.target.value}))} rows={3}
            placeholder={"終電後は需要爆発\n外国人客は地図を見せてもらう"} style={{...inp,resize:"vertical",lineHeight:1.6}}/>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>注意点</div>
          <textarea value={form.caution} onChange={e=>setForm(p=>({...p,caution:e.target.value}))} rows={2}
            placeholder="気をつけること、落とし穴など" style={{...inp,resize:"vertical",lineHeight:1.6}}/>
        </div>

        <Btn onClick={handleSave} disabled={saving} style={{marginBottom:8}}>{saving?"投稿中...":"投稿する（+"+XP_GUIDE_POST+" XP）"}</Btn>
        <Btn onClick={onClose} variant="ghost">キャンセル</Btn>
      </div>
    </div>
  );
}

// ─── ReviewModal ──────────────────────────────────────────────────────────────
function ReviewModal({ spot, user, onClose, onSaved }) {
  const [rating, setRating] = useState(0);
  const [body, setBody]     = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!rating) { alert("星を選んでください"); return; }
    setSaving(true);
    await insertGuideReview(spot.id, user.id, user.name || "匿名", rating, body);
    // XP付与
    if (SUPABASE_READY) await upsertProfile({ id: user.id, xp: (user.xp || 0) + XP_GUIDE_REVIEW });
    onSaved();
    setSaving(false);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,backgroundColor:"#00000090",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{backgroundColor:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,paddingBottom:36}}>
        <div style={{width:40,height:4,backgroundColor:C.border,borderRadius:99,margin:"0 auto 14px"}}/>
        <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>⭐ レビューを書く</div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[1,2,3,4,5].map(n=>(
            <div key={n} onClick={()=>setRating(n)} style={{fontSize:28,cursor:"pointer",opacity:n<=rating?1:0.3}}>⭐</div>
          ))}
        </div>
        <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4}
          placeholder="実際に使ってみた感想、役立ったポイントなど（任意）"
          style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",fontSize:13,color:C.text,outline:"none",resize:"vertical",lineHeight:1.6,marginBottom:12}}/>
        <Btn onClick={handleSave} disabled={saving} style={{marginBottom:8}}>{saving?"送信中...":"送信（+"+XP_GUIDE_REVIEW+" XP）"}</Btn>
        <Btn onClick={onClose} variant="ghost">キャンセル</Btn>
      </div>
    </div>
  );
}

// ─── DetailView ───────────────────────────────────────────────────────────────
function DetailView({ g, user, onBack, onUpdated }) {
  const [reviews, setReviews]   = useState([]);
  const [edits, setEdits]       = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    if (g.isMock) return;
    fetchGuideReviews(g.id).then(({data})=>setReviews(data));
    fetchGuideEdits(g.id).then(({data})=>setEdits(data));
  }, [g.id]);

  const handleFlag = async () => {
    if (!user) return;
    setFlagging(true);
    await flagGuideSpot(g.id, user.id, "情報が古い/誤りがある");
    setFlagging(false);
    alert("フラグを立てました。コミュニティが確認します。");
  };

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={onBack} style={{backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:C.sub,cursor:"pointer",fontSize:13}}>← 戻る</button>
        <div style={{flex:1}}><div style={{fontSize:15,fontWeight:800}}>{g.emoji} {g.name}</div><div style={{fontSize:11,color:C.muted}}>{g.area}</div></div>
      </div>

      {/* 公式 / 投稿者バッジ */}
      {g.isMock
        ? <div style={{fontSize:11,color:C.gold,backgroundColor:C.goldGlow,border:`1px solid ${C.gold}44`,borderRadius:8,padding:"4px 10px",marginBottom:12,display:"inline-block"}}>⭐ 公式キュレーションスポット</div>
        : g.contributor_name && <div style={{fontSize:11,color:C.muted,marginBottom:12}}>👤 投稿: {g.contributor_name}</div>
      }

      {/* スコア */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[
          {label:"需要",   val:`🔥 ${g.demandScore||g.demand_score||"-"}`, color:C.accentLight, glow:C.accentGlow},
          {label:"評価",   val:`⭐ ${g.rating||0}`,                        color:C.gold,        glow:C.goldGlow},
          {label:"レビュー",val:`${reviews.length||g.reviews||0}件`,        color:C.text,        glow:C.surface},
        ].map(({label,val,color,glow})=>(
          <div key={label} style={{flex:1,backgroundColor:glow,border:`1px solid ${color}44`,borderRadius:10,padding:"6px 0",textAlign:"center"}}>
            <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{label}</div>
            <div style={{fontSize:14,fontWeight:800,color}}>{val}</div>
          </div>
        ))}
      </div>

      {g.peak    && <Card style={{borderColor:C.gold+"44"}}><div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:6}}>⏰ ピーク時間帯</div><div style={{fontSize:13}}>{g.peak}</div></Card>}
      {(g.access_note||g.access) && <Card style={{borderColor:C.purple+"44"}}><div style={{fontSize:11,color:C.purple,fontWeight:700,marginBottom:6}}>🛣️ 進入路・アクセス</div><div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>{g.access_note||g.access}</div></Card>}
      {g.flow?.length>0 && (
        <Card>
          <div style={{fontSize:11,color:C.accentLight,fontWeight:700,marginBottom:10}}>🔢 入港ステップ</div>
          {g.flow.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
              <div style={{width:22,height:22,borderRadius:"50%",backgroundColor:C.accentLight,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:13,color:C.sub,paddingTop:2}}>{s}</div>
            </div>
          ))}
        </Card>
      )}
      {g.lineup  && <Card style={{borderColor:C.green+"44"}}><div style={{fontSize:11,color:C.green,fontWeight:700,marginBottom:8}}>🚕 並び方・ルール</div><div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>{g.lineup}</div></Card>}
      {g.description && <Card><div style={{fontSize:11,color:C.accentLight,fontWeight:700,marginBottom:8}}>📝 説明</div><div style={{fontSize:13,color:C.sub,lineHeight:1.8}}>{g.description}</div></Card>}
      {g.address && <Card><div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:4}}>📍 住所</div><div style={{fontSize:13}}>{g.address}</div>{g.has_parking&&<div style={{fontSize:12,color:C.green,marginTop:4}}>🅿️ 駐車・停車OK</div>}</Card>}
      {g.open_hours && <Card><div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:4}}>🕐 営業時間</div><div style={{fontSize:13}}>{g.open_hours}</div></Card>}
      {g.tips?.length>0 && (
        <Card>
          <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:10}}>💡 稼ぐためのコツ</div>
          {g.tips.map((t,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,paddingBottom:8,borderBottom:i<g.tips.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{fontSize:14,flexShrink:0}}>✓</span><div style={{fontSize:13,color:C.sub,lineHeight:1.7}}>{t}</div>
            </div>
          ))}
        </Card>
      )}
      {g.caution && <Card style={{borderColor:C.orange+"44",backgroundColor:C.orangeGlow}}><div style={{fontSize:11,color:C.orange,fontWeight:700,marginBottom:6}}>⚠️ 注意</div><div style={{fontSize:13,color:C.sub,lineHeight:1.7}}>{g.caution}</div></Card>}

      {/* レビュー */}
      {reviews.length > 0 && (
        <Card>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,marginBottom:10}}>💬 レビュー</div>
          {reviews.map(r=>(
            <div key={r.id} style={{borderBottom:`1px solid ${C.border}`,paddingBottom:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700}}>{r.user_name||"匿名"}</span>
                <span style={{fontSize:11,color:C.gold}}>{"⭐".repeat(r.rating)}</span>
              </div>
              {r.body&&<div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>{r.body}</div>}
            </div>
          ))}
        </Card>
      )}

      {/* アクションボタン（コミュニティスポットのみ） */}
      {!g.isMock && user && (
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn onClick={()=>setShowReview(true)} style={{flex:1,fontSize:12}}>⭐ レビューを書く</Btn>
          <button onClick={handleFlag} disabled={flagging}
            style={{flex:1,backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:11,padding:"12px 0",fontSize:12,color:C.muted,cursor:"pointer"}}>
            {flagging?"報告中...":"🚩 情報が古い"}
          </button>
        </div>
      )}

      {/* 編集履歴 */}
      {edits.length > 0 && (
        <div style={{marginTop:12}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>📝 編集履歴（直近{edits.length}件）</div>
          {edits.map(e=>(
            <div key={e.id} style={{fontSize:10,color:C.muted,padding:"3px 0",borderBottom:`1px solid ${C.border}44`}}>
              {e.editor_name||"匿名"} — {new Date(e.created_at).toLocaleDateString("ja-JP")}
            </div>
          ))}
        </div>
      )}

      {showReview && <ReviewModal spot={g} user={user} onClose={()=>setShowReview(false)} onSaved={()=>fetchGuideReviews(g.id).then(({data})=>setReviews(data))}/>}
    </div>
  );
}

// ─── GuideScreen（メイン） ─────────────────────────────────────────────────────
export default function GuideScreen({ userAreas = [], user }) {
  const [category, setCategory] = useState("stand");
  const [subCat, setSubCat]     = useState("all");
  const [search, setSearch]     = useState("");
  const [sort, setSort]         = useState("demand");
  const [selected, setSelected] = useState(null);
  const [bookmarks, setBookmarks] = useState(()=>loadS("taxi_guide_bm",[]));
  const [dbSpots, setDbSpots]   = useState([]);
  const [areaFilter, setAreaFilter] = useState(userAreas[0] || null);
  const [showPost, setShowPost] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(()=>saveS("taxi_guide_bm",bookmarks),[bookmarks]);
  const toggleBm = id => setBookmarks(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  // Supabaseからスポット取得
  useEffect(() => {
    if (!SUPABASE_READY) return;
    setLoading(true);
    fetchGuideSpots(areaFilter).then(({data})=>{ setDbSpots(data); setLoading(false); });
  }, [areaFilter]);

  // mockData + Supabase を統合
  const allSpots = [
    ...STAND_GUIDES.map(normalizeMock),
    ...dbSpots,
  ];

  // フィルタ
  const q = search.trim().toLowerCase();
  const filtered = allSpots.filter(g => {
    if (g.category !== category && g.type !== category) return false;
    if (category === "stand" && subCat !== "all") {
      if ((g.subcategory || "") !== subCat) return false;
    }
    if (areaFilter && g.area !== areaFilter) return false;
    if (!q) return true;
    const hay = [g.name, g.area, ...(g.tags||[]), g.peak, g.lineup, g.description, ...(g.tips||[])].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  // ソート
  const list = [...filtered].sort((a,b) => {
    const ds = (x) => x.demandScore || x.demand_score || 0;
    if (sort === "demand") return ds(b) - ds(a);
    if (sort === "rating") return (b.rating||0) - (a.rating||0);
    if (sort === "name")   return a.name.localeCompare(b.name, "ja");
    if (sort === "area")   return a.area.localeCompare(b.area, "ja");
    return 0;
  });

  const handlePost = async (spot) => {
    if (!SUPABASE_READY || !user) { alert("ログインが必要です"); return; }
    const { data, error } = await insertGuideSpot(user.id, user.name || "匿名", spot);
    if (error) { alert("投稿に失敗しました"); return; }
    // XP付与
    await upsertProfile({ id: user.id, xp: (user.xp || 0) + XP_GUIDE_POST });
    setDbSpots(prev=>[data,...prev]);
    setShowPost(false);
    alert(`✨ 投稿完了！+${XP_GUIDE_POST} XP獲得！`);
  };

  // 詳細画面
  if (selected) {
    return <DetailView g={selected} user={user} onBack={()=>setSelected(null)} onUpdated={()=>fetchGuideSpots(areaFilter).then(({data})=>setDbSpots(data))}/>;
  }

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:13,fontWeight:700}}>📍 スポットガイド</div>
        {areaFilter
          ? <div style={{display:"flex",alignItems:"center",gap:4,backgroundColor:C.accentGlow,border:`1px solid ${C.accentLight}44`,borderRadius:99,padding:"3px 10px",cursor:"pointer"}} onClick={()=>setAreaFilter(null)}>
              <span style={{fontSize:11,color:C.accentLight,fontWeight:600}}>{areaFilter}</span>
              <span style={{fontSize:10,color:C.accentLight}}>×</span>
            </div>
          : <div style={{fontSize:11,color:C.muted,cursor:"pointer",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:99,padding:"3px 10px"}} onClick={()=>setAreaFilter(userAreas[0]||"東京都心")}>
              📍 全エリア
            </div>
        }
      </div>
      <div style={{fontSize:11,color:C.muted,marginBottom:12}}>並び方・コツ・進入路を新人〜ベテランまで</div>

      {/* 4カテゴリ 2段タブ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {CATEGORIES.map(c=>(
          <div key={c.id} onClick={()=>{ setCategory(c.id); setSubCat("all"); setSearch(""); }}
            style={{textAlign:"center",padding:"10px 0",borderRadius:11,border:`1.5px solid ${category===c.id?C.accentLight:C.border}`,backgroundColor:category===c.id?C.accentGlow:C.surface,fontSize:13,fontWeight:category===c.id?700:400,color:category===c.id?C.accentLight:C.muted,cursor:"pointer",transition:"all 0.15s"}}>
            {c.emoji} {c.label}
          </div>
        ))}
      </div>

      {/* 乗り場の小タブ */}
      {category === "stand" && (
        <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
          {STAND_SUBS.map(s=>(
            <div key={s.id} onClick={()=>setSubCat(s.id)}
              style={{flexShrink:0,padding:"5px 12px",borderRadius:99,fontSize:11,fontWeight:subCat===s.id?700:400,border:`1px solid ${subCat===s.id?C.accentLight:C.border}`,backgroundColor:subCat===s.id?C.accentGlow:"transparent",color:subCat===s.id?C.accentLight:C.muted,cursor:"pointer",whiteSpace:"nowrap"}}>
              {s.label}
            </div>
          ))}
        </div>
      )}

      {/* 検索バー */}
      <div style={{position:"relative",marginBottom:10}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted,pointerEvents:"none"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・エリア・タグで検索..."
          style={{width:"100%",boxSizing:"border-box",backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px 9px 34px",fontSize:13,color:C.text,outline:"none"}}/>
        {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>×</button>}
      </div>

      {/* ソートボタン */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
        {SORT_OPTIONS.map(o=>(
          <button key={o.id} onClick={()=>setSort(o.id)}
            style={{flexShrink:0,padding:"5px 10px",borderRadius:99,fontSize:11,fontWeight:sort===o.id?700:400,border:`1px solid ${sort===o.id?C.accentLight:C.border}`,backgroundColor:sort===o.id?C.accentGlow:"transparent",color:sort===o.id?C.accentLight:C.muted,cursor:"pointer",whiteSpace:"nowrap"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* 投稿ボタン */}
      <button onClick={()=>setShowPost(true)}
        style={{width:"100%",backgroundColor:C.surface,border:`1.5px dashed ${C.accentLight}66`,borderRadius:11,padding:"10px 0",fontSize:13,color:C.accentLight,fontWeight:600,cursor:"pointer",marginBottom:12}}>
        ＋ このエリアのスポットを投稿する（+{XP_GUIDE_POST} XP）
      </button>

      {/* お気に入り */}
      {bookmarks.length > 0 && !search && (
        <>
          <div style={{fontSize:11,color:C.gold,fontWeight:700,marginBottom:8}}>⭐ お気に入り</div>
          {allSpots.filter(g=>bookmarks.includes(g.id)).map(g=>(
            <div key={g.id} onClick={()=>setSelected(g)} style={{backgroundColor:C.card,border:`1px solid ${C.gold}44`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer"}}>
              <div style={{fontSize:14,fontWeight:700}}>{g.emoji} {g.name}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{g.peak||g.description?.slice(0,30)}</div>
            </div>
          ))}
          <div style={{height:1,backgroundColor:C.border,margin:"12px 0"}}/>
        </>
      )}

      {/* 件数 */}
      <div style={{fontSize:12,color:C.muted,marginBottom:10}}>
        {loading ? "読み込み中..." : search ? `「${search}」の検索結果: ${list.length}件` : `${list.length}件`}
      </div>

      {/* 結果なし */}
      {!loading && list.length === 0 && (
        <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
          <div style={{fontSize:32,marginBottom:10}}>🔍</div>
          <div style={{fontSize:14,marginBottom:8}}>
            {search ? `「${search}」に一致するスポットが見つかりませんでした` : "まだスポットがありません"}
          </div>
          {!search && <div style={{fontSize:12}}>最初の投稿者になろう！</div>}
          {search && <button onClick={()=>setSearch("")} style={{marginTop:8,padding:"7px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"none",color:C.accentLight,cursor:"pointer",fontSize:13}}>検索をクリア</button>}
        </div>
      )}

      {/* リスト */}
      {list.map(g=>(
        <div key={g.id} onClick={()=>setSelected(g)}
          style={{backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:12,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.backgroundColor=C.cardHover}
          onMouseLeave={e=>e.currentTarget.style.backgroundColor=C.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{fontSize:15,fontWeight:800}}>{g.emoji} {g.name}</div>
                {g.isMock && <span style={{fontSize:9,color:C.gold,backgroundColor:C.goldGlow,border:`1px solid ${C.gold}33`,borderRadius:99,padding:"1px 6px"}}>公式</span>}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {(g.tags||[]).map(t=><span key={t} style={{backgroundColor:C.accentLight+"15",color:C.accentLight,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99}}>{t}</span>)}
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();toggleBm(g.id);}} style={{backgroundColor:"transparent",border:"none",fontSize:20,cursor:"pointer",marginLeft:8}}>{bookmarks.includes(g.id)?"⭐":"☆"}</button>
          </div>

          {g.peak && (
            <div style={{backgroundColor:C.bg,borderRadius:8,padding:"7px 12px",marginBottom:8}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:2}}>⏰ ピーク</div>
              <div style={{fontSize:12,color:C.sub}}>{g.peak}</div>
            </div>
          )}
          {(g.lineup||g.description) && (
            <div style={{fontSize:12,color:C.muted,backgroundColor:C.surface,borderRadius:8,padding:"7px 10px",borderLeft:`3px solid ${C.accentLight}`,lineHeight:1.6,marginBottom:8}}>
              {(g.lineup||g.description).slice(0,60)}...
            </div>
          )}
          {g.contributor_name && (
            <div style={{fontSize:10,color:C.muted,marginBottom:6}}>👤 {g.contributor_name}</div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:C.accentLight}}>🔥 {g.demandScore||g.demand_score||"-"}</span>
              <span style={{color:C.gold,fontSize:11}}>⭐ {g.rating||0}</span>
              <span style={{color:C.muted,fontSize:11}}>({g.reviews||g.review_count||0}件)</span>
            </div>
            <span style={{fontSize:12,color:C.accentLight,fontWeight:700}}>詳細 →</span>
          </div>
        </div>
      ))}

      {showPost && (
        <PostModal
          defaultCategory={category}
          userAreas={userAreas.length ? userAreas : AREA_OPTIONS}
          onClose={()=>setShowPost(false)}
          onSave={handlePost}
        />
      )}
    </div>
  );
}
