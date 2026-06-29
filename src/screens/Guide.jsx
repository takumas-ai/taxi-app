// 乗り場・空港・休憩・飲食店ガイド（Phase 1: テンプレート投稿 + 参考になったボタン）
import { useState, useEffect } from "react";
import { C } from "../lib/constants";
import { Card, Btn } from "../components/UI";
import { TRAFFIC_ZONES_BY_REGION } from "../data/trafficZones";
import { loadS, saveS } from "../lib/constants";
import {
  fetchGuideSpots, insertGuideSpot,
  voteGuideSpot, fetchUserVotes,
  flagGuideSpot,
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

const TIME_SLOTS = [
  { id:"morning",   label:"朝 6〜9時" },
  { id:"forenoon",  label:"午前 9〜12時" },
  { id:"noon",      label:"昼 12〜15時" },
  { id:"afternoon", label:"午後 15〜18時" },
  { id:"evening",   label:"夜 18〜21時" },
  { id:"night",     label:"深夜 21〜24時" },
  { id:"midnight",  label:"深夜 0〜6時" },
];

const FACILITY_OPTIONS = [
  { id:"convenience", emoji:"🏪", label:"コンビニ" },
  { id:"restaurant",  emoji:"🍜", label:"飲食店" },
  { id:"smoking",     emoji:"🚬", label:"喫煙所" },
  { id:"street_park", emoji:"🚗", label:"路駐OK" },
  { id:"parking",     emoji:"🅿️", label:"パーキング" },
  { id:"meter",       emoji:"⏱",  label:"Pメーター" },
];

const PRICE_RANGE_OPTIONS = ["〜500円", "500〜1000円", "1000〜1500円", "1500円〜"];
const XP_GUIDE_POST = 20;

const SORT_OPTIONS = [
  { id:"newest", label:"🆕 新着順" },
  { id:"votes",  label:"👍 参考になった順" },
  { id:"name",   label:"🔤 名前順" },
  { id:"area",   label:"📍 エリア順" },
];

// mockData → 共通形式に正規化
const normalizeMock = (g) => ({
  ...g,
  category:    g.type,
  subcategory: null,
  access_note: g.access || null,
  description: null,
  address:     null,
  isMock:      true,
});

// ─── 参考になったボタン ───────────────────────────────────────────────────────
function VoteButton({ spotId, user, initialCount, userVoted }) {
  const [voted,   setVoted]   = useState(userVoted || false);
  const [count,   setCount]   = useState(initialCount || 0);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!user)          { alert("ログインが必要です"); return; }
    if (voted || loading) return;
    setLoading(true);
    const { error } = await voteGuideSpot(spotId, user.id);
    if (!error) { setVoted(true); setCount(c => c + 1); }
    setLoading(false);
  };

  return (
    <button onClick={handle} disabled={voted || !user}
      style={{
        width:"100%", padding:"14px 0", borderRadius:12, fontSize:15, fontWeight:700,
        cursor: voted || !user ? "default" : "pointer",
        border: `1.5px solid ${voted ? C.gold : C.accentLight}`,
        backgroundColor: voted ? C.gold + "22" : C.accentLight + "15",
        color: voted ? C.gold : C.accentLight,
      }}>
      {voted
        ? `👍 参考になった！（${count}人）`
        : `👍 参考になった${count > 0 ? `（${count}人）` : ""}`}
    </button>
  );
}

// ─── PostModal（カテゴリ別テンプレート） ─────────────────────────────────────
function PostModal({ defaultCategory, userAreas, onClose, onSave }) {
  const [form, setForm] = useState({
    category:    defaultCategory || "stand",
    name:        "",
    area:        userAreas[0] || "",
    address:     "",
    map_url:     "",
    wait_times:  {},
    lineup:      "",
    caution:     "",
    description: "",
    facilities:  {},
    open_hours:  "",
    price_range: "",
    tips:        "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isStandOrAirport = ["stand","airport"].includes(form.category);
  const isRestOrFood     = ["rest","food"].includes(form.category);

  const inp = {
    backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 11px", color: C.text, fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const Label = ({ children, required }) => (
    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>
      {children}{required && <span style={{ color:C.red }}> *</span>}
    </div>
  );

  const handleSave = async () => {
    if (!form.name.trim()) { alert("スポット名は必須です"); return; }
    if (!form.area.trim()) { alert("エリアは必須です"); return; }
    setSaving(true);
    await onSave({
      ...form,
      tips:  form.tips ? form.tips.split("\n").map(t => t.trim()).filter(Boolean) : [],
      emoji: form.category === "stand" ? "🚕"
           : form.category === "airport" ? "✈️"
           : form.category === "rest"    ? "😴" : "🍜",
    });
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,backgroundColor:"#00000090",zIndex:200,display:"flex",alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor:C.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,paddingBottom:36,maxHeight:"92vh",overflowY:"auto",position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", fontSize:28, color:C.muted, cursor:"pointer", lineHeight:1, padding:"8px" }}>×</button>
        <div style={{ width:40,height:4,backgroundColor:C.border,borderRadius:99,margin:"0 auto 16px" }}/>
        <div style={{ fontSize:15,fontWeight:800,marginBottom:12 }}>📍 スポットを投稿する</div>
        <div style={{ fontSize:11,color:C.accentLight,backgroundColor:C.accentGlow,borderRadius:8,padding:"6px 10px",marginBottom:14 }}>
          ✨ 投稿すると {XP_GUIDE_POST} XP獲得！
        </div>

        {/* カテゴリー */}
        <div style={{ marginBottom:12 }}>
          <Label required>カテゴリー</Label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
            {CATEGORIES.map(c => (
              <div key={c.id} onClick={() => set("category", c.id)}
                style={{ textAlign:"center",padding:"8px 0",borderRadius:9,cursor:"pointer",
                  border:`1.5px solid ${form.category===c.id ? C.accentLight : C.border}`,
                  backgroundColor:form.category===c.id ? C.accentGlow : "transparent",
                  fontSize:13, fontWeight:form.category===c.id ? 700 : 400,
                  color:form.category===c.id ? C.accentLight : C.muted }}>
                {c.emoji} {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* 共通：名称・エリア・住所・MapURL */}
        <div style={{ marginBottom:10 }}>
          <Label required>{form.category === "food" ? "店名" : "スポット名称"}</Label>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder={form.category === "food" ? "例: 松屋 新橋店" : "例: 六本木ヒルズ前 タクシー乗り場"} style={inp}/>
        </div>
        <div style={{ marginBottom:10 }}>
          <Label required>エリア</Label>
          <input list="area-list" value={form.area} onChange={e => set("area", e.target.value)} placeholder="例: 特別区・武三交通圏" style={inp}/>
          <datalist id="area-list">
            {TRAFFIC_ZONES_BY_REGION.flatMap(r => r.zones).map(z => <option key={z} value={z}/>)}
          </datalist>
        </div>
        <div style={{ marginBottom:10 }}>
          <Label>住所</Label>
          <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="例: 港区六本木6-10-1" style={inp}/>
        </div>
        <div style={{ marginBottom:14 }}>
          <Label>Google マップ URL（任意）</Label>
          <input value={form.map_url} onChange={e => set("map_url", e.target.value)}
            placeholder="https://maps.google.com/..." style={inp}/>
          <div style={{ fontSize:10,color:C.muted,marginTop:4 }}>Googleマップでスポットを開き→共有→URLをコピー</div>
        </div>

        {/* 乗り場・空港：待ち時間テーブル + 並び方 */}
        {isStandOrAirport && (
          <>
            <div style={{ marginBottom:12 }}>
              <Label>時間帯別 平均待ち時間（知っている時間帯だけでOK）</Label>
              <div style={{ backgroundColor:C.bg,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}` }}>
                {TIME_SLOTS.map((slot, i) => (
                  <div key={slot.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderBottom:i < TIME_SLOTS.length-1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontSize:12,color:C.sub,flex:1,whiteSpace:"nowrap" }}>{slot.label}</div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <input
                        type="number" min="0" max="120"
                        value={form.wait_times[slot.id] || ""}
                        onChange={e => set("wait_times", { ...form.wait_times, [slot.id]: e.target.value })}
                        placeholder="—"
                        style={{ width:56,backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.text,fontSize:13,outline:"none",textAlign:"center" }}
                      />
                      <span style={{ fontSize:11,color:C.muted }}>分</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <Label>並び方・ルール</Label>
              <textarea value={form.lineup} onChange={e => set("lineup", e.target.value)} rows={3}
                placeholder="並び方、係員の有無、乗り場の場所など" style={{ ...inp,resize:"vertical",lineHeight:1.6 }}/>
            </div>
          </>
        )}

        {/* 休憩・飲食：施設チェック */}
        {isRestOrFood && (
          <div style={{ marginBottom:12 }}>
            <Label>近くの施設</Label>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {FACILITY_OPTIONS.map(f => {
                const checked = !!form.facilities[f.id];
                return (
                  <div key={f.id} onClick={() => set("facilities", { ...form.facilities, [f.id]: !checked })}
                    style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,cursor:"pointer",
                      border:`1.5px solid ${checked ? C.accentLight : C.border}`,
                      backgroundColor:checked ? C.accentGlow : "transparent",
                      color:checked ? C.accentLight : C.muted,fontSize:12,fontWeight:checked ? 700 : 400 }}>
                    <span>{f.emoji}</span><span>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 飲食：営業時間・価格帯 */}
        {form.category === "food" && (
          <>
            <div style={{ marginBottom:10 }}>
              <Label>営業時間</Label>
              <input value={form.open_hours} onChange={e => set("open_hours", e.target.value)} placeholder="例: 24時間 / 11:00〜23:00" style={inp}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <Label>価格帯（だいたいの目安）</Label>
              <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                {PRICE_RANGE_OPTIONS.map(p => (
                  <div key={p} onClick={() => set("price_range", p)}
                    style={{ padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:form.price_range===p ? 700 : 400,
                      border:`1.5px solid ${form.price_range===p ? C.accentLight : C.border}`,
                      backgroundColor:form.price_range===p ? C.accentGlow : "transparent",
                      color:form.price_range===p ? C.accentLight : C.muted }}>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 休憩・飲食：説明 */}
        {isRestOrFood && (
          <div style={{ marginBottom:10 }}>
            <Label>特徴・説明</Label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              placeholder={form.category === "rest" ? "静か、混雑、Wi-Fiあり など" : "安い、早い、タクシードライバー多い など"}
              style={{ ...inp,resize:"vertical",lineHeight:1.6 }}/>
          </div>
        )}

        {/* 共通：コツ・注意 */}
        <div style={{ marginBottom:10 }}>
          <Label>コツ・ポイント（1行1つ）</Label>
          <textarea value={form.tips} onChange={e => set("tips", e.target.value)} rows={3}
            placeholder={"終電後は需要爆発\n外国人客は地図を見せてもらう"} style={{ ...inp,resize:"vertical",lineHeight:1.6 }}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <Label>注意事項</Label>
          <textarea value={form.caution} onChange={e => set("caution", e.target.value)} rows={2}
            placeholder="例: 夜間は警察の巡回あり・駐停車禁止に注意" style={{ ...inp,resize:"vertical",lineHeight:1.6 }}/>
        </div>

        <Btn onClick={handleSave} disabled={saving} style={{ marginBottom:8 }}>
          {saving ? "投稿中..." : `投稿する（+${XP_GUIDE_POST} XP）`}
        </Btn>
        <Btn onClick={onClose} variant="ghost">キャンセル</Btn>
      </div>
    </div>
  );
}

// ─── DetailView ───────────────────────────────────────────────────────────────
function DetailView({ g, user, userVotedSpots, onBack }) {
  const [flagging, setFlagging] = useState(false);

  const handleFlag = async () => {
    if (!user) return;
    setFlagging(true);
    await flagGuideSpot(g.id, user.id, "情報が古い/誤りがある");
    setFlagging(false);
    alert("報告しました。ありがとうございます。");
  };

  const waitEntries  = Object.entries(g.wait_times  || {}).filter(([, v]) => v);
  const facilities   = g.facilities || {};
  const activeFacs   = FACILITY_OPTIONS.filter(f => facilities[f.id]);

  return (
    <div style={{ maxWidth:480,margin:"0 auto",padding:"16px 16px 100px" }}>
      {/* ヘッダー */}
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
        <button onClick={onBack} style={{ backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:C.sub,cursor:"pointer",fontSize:13 }}>← 戻る</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15,fontWeight:800 }}>{g.emoji} {g.name}</div>
          <div style={{ fontSize:11,color:C.muted }}>{g.area}</div>
        </div>
      </div>

      {g.isMock
        ? <div style={{ fontSize:11,color:C.gold,backgroundColor:C.goldGlow,border:`1px solid ${C.gold}44`,borderRadius:8,padding:"4px 10px",marginBottom:12,display:"inline-block" }}>⭐ 公式キュレーションスポット</div>
        : g.contributor_name && <div style={{ fontSize:11,color:C.muted,marginBottom:12 }}>👤 投稿: {g.contributor_name}</div>
      }

      {/* Google Map リンク */}
      {g.map_url && (
        <a href={g.map_url} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,textDecoration:"none" }}>
          <span style={{ fontSize:16 }}>🗺</span>
          <span style={{ fontSize:13,color:C.accentLight,fontWeight:600 }}>Google マップで開く</span>
          <span style={{ marginLeft:"auto",fontSize:11,color:C.muted }}>↗</span>
        </a>
      )}

      {g.address && (
        <Card>
          <div style={{ fontSize:11,color:C.muted,fontWeight:700,marginBottom:4 }}>📍 住所</div>
          <div style={{ fontSize:13 }}>{g.address}</div>
        </Card>
      )}

      {/* 時間帯別待ち時間 */}
      {waitEntries.length > 0 && (
        <Card>
          <div style={{ fontSize:11,color:C.accentLight,fontWeight:700,marginBottom:10 }}>⏱ 時間帯別 平均待ち時間</div>
          {waitEntries.map(([slotId, minutes]) => {
            const slot = TIME_SLOTS.find(s => s.id === slotId);
            return (
              <div key={slotId} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${C.border}44` }}>
                <span style={{ fontSize:12,color:C.sub }}>{slot?.label || slotId}</span>
                <span style={{ fontSize:14,fontWeight:700,color:C.accentLight }}>約{minutes}分</span>
              </div>
            );
          })}
        </Card>
      )}

      {(g.access_note||g.access) && (
        <Card style={{ borderColor:C.purple+"44" }}>
          <div style={{ fontSize:11,color:C.purple,fontWeight:700,marginBottom:6 }}>🛣️ 進入路・アクセス</div>
          <div style={{ fontSize:13,color:C.sub,lineHeight:1.8 }}>{g.access_note||g.access}</div>
        </Card>
      )}

      {g.peak && (
        <Card style={{ borderColor:C.gold+"44" }}>
          <div style={{ fontSize:11,color:C.gold,fontWeight:700,marginBottom:6 }}>⏰ ピーク時間帯</div>
          <div style={{ fontSize:13 }}>{g.peak}</div>
        </Card>
      )}

      {g.lineup && (
        <Card style={{ borderColor:C.green+"44" }}>
          <div style={{ fontSize:11,color:C.green,fontWeight:700,marginBottom:8 }}>🚕 並び方・ルール</div>
          <div style={{ fontSize:13,color:C.sub,lineHeight:1.8 }}>{g.lineup}</div>
        </Card>
      )}

      {g.description && (
        <Card>
          <div style={{ fontSize:11,color:C.accentLight,fontWeight:700,marginBottom:8 }}>📝 特徴・説明</div>
          <div style={{ fontSize:13,color:C.sub,lineHeight:1.8 }}>{g.description}</div>
        </Card>
      )}

      {/* 施設情報 */}
      {activeFacs.length > 0 && (
        <Card>
          <div style={{ fontSize:11,color:C.muted,fontWeight:700,marginBottom:8 }}>🏪 近くの施設</div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {activeFacs.map(f => (
              <span key={f.id} style={{ fontSize:12,padding:"4px 10px",borderRadius:99,backgroundColor:C.accentGlow,color:C.accentLight,fontWeight:600 }}>
                {f.emoji} {f.label}
              </span>
            ))}
          </div>
        </Card>
      )}

      {g.open_hours && (
        <Card>
          <div style={{ fontSize:11,color:C.muted,fontWeight:700,marginBottom:4 }}>🕐 営業時間</div>
          <div style={{ fontSize:13 }}>{g.open_hours}</div>
        </Card>
      )}

      {g.price_range && (
        <Card>
          <div style={{ fontSize:11,color:C.muted,fontWeight:700,marginBottom:4 }}>💴 価格帯</div>
          <div style={{ fontSize:13 }}>{g.price_range}</div>
        </Card>
      )}

      {g.flow?.length > 0 && (
        <Card>
          <div style={{ fontSize:11,color:C.accentLight,fontWeight:700,marginBottom:10 }}>🔢 入港ステップ</div>
          {g.flow.map((s, i) => (
            <div key={i} style={{ display:"flex",gap:10,marginBottom:8 }}>
              <div style={{ width:22,height:22,borderRadius:"50%",backgroundColor:C.accentLight,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{i+1}</div>
              <div style={{ fontSize:13,color:C.sub,paddingTop:2 }}>{s}</div>
            </div>
          ))}
        </Card>
      )}

      {g.tips?.length > 0 && (
        <Card>
          <div style={{ fontSize:11,color:C.gold,fontWeight:700,marginBottom:10 }}>💡 稼ぐためのコツ</div>
          {g.tips.map((t, i) => (
            <div key={i} style={{ display:"flex",gap:10,marginBottom:8,paddingBottom:8,borderBottom:i < g.tips.length-1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize:14,flexShrink:0 }}>✓</span>
              <div style={{ fontSize:13,color:C.sub,lineHeight:1.7 }}>{t}</div>
            </div>
          ))}
        </Card>
      )}

      {g.caution && (
        <Card style={{ borderColor:C.orange+"44",backgroundColor:C.orangeGlow }}>
          <div style={{ fontSize:11,color:C.orange,fontWeight:700,marginBottom:6 }}>⚠️ 注意</div>
          <div style={{ fontSize:13,color:C.sub,lineHeight:1.7 }}>{g.caution}</div>
        </Card>
      )}

      {/* 参考になったボタン（コミュニティスポットのみ） */}
      {!g.isMock && (
        <div style={{ marginTop:16 }}>
          <VoteButton
            spotId={g.id}
            user={user}
            initialCount={g.vote_count || 0}
            userVoted={userVotedSpots?.includes(g.id)}
          />
        </div>
      )}

      {/* 報告ボタン */}
      {!g.isMock && user && (
        <button onClick={handleFlag} disabled={flagging}
          style={{ width:"100%",marginTop:10,padding:"10px 0",borderRadius:10,fontSize:12,color:C.muted,cursor:"pointer",border:`1px solid ${C.border}44`,backgroundColor:"transparent" }}>
          {flagging ? "報告中..." : "🚩 情報が古い・誤りがある"}
        </button>
      )}
    </div>
  );
}

// ─── GuideScreen（メイン） ─────────────────────────────────────────────────────
export default function GuideScreen({ userAreas = [], user }) {
  const [category, setCategory]   = useState("stand");
  const [search, setSearch]       = useState("");
  const [sort, setSort]           = useState("newest");
  const [selected, setSelected]   = useState(null);
  const [bookmarks, setBookmarks] = useState(() => loadS("taxi_guide_bm", []));
  const [dbSpots, setDbSpots]     = useState([]);
  const [areaFilter, setAreaFilter] = useState(userAreas[0] || null);
  const [regionFilter, setRegionFilter] = useState(() => {
    const initial = userAreas[0] || null;
    return initial ? (TRAFFIC_ZONES_BY_REGION.find(r => r.zones.includes(initial))?.region || null) : null;
  });
  const [showPost, setShowPost]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [userVotedSpots, setUserVotedSpots] = useState([]);

  useEffect(() => saveS("taxi_guide_bm", bookmarks), [bookmarks]);
  const toggleBm = id => setBookmarks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  useEffect(() => {
    if (!SUPABASE_READY) return;
    setLoading(true);
    fetchGuideSpots(areaFilter).then(({ data }) => { setDbSpots(data || []); setLoading(false); });
  }, [areaFilter]);

  useEffect(() => {
    if (!SUPABASE_READY || !user?.id) return;
    fetchUserVotes(user.id).then(({ data }) => {
      if (data) setUserVotedSpots(data.map(v => v.spot_id));
    });
  }, [user?.id]);

  const allSpots = [...dbSpots];

  const q = search.trim().toLowerCase();
  const filtered = allSpots.filter(g => {
    if (g.category !== category && g.type !== category) return false;
    if (areaFilter && g.area !== areaFilter) return false;
    if (!q) return true;
    const hay = [g.name, g.area, g.peak, g.lineup, g.description, ...(g.tips||[])].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  const list = [...filtered].sort((a, b) => {
    if (sort === "newest") return new Date(b.created_at||0) - new Date(a.created_at||0);
    if (sort === "votes")  return (b.vote_count||0) - (a.vote_count||0);
    if (sort === "name")   return a.name.localeCompare(b.name, "ja");
    if (sort === "area")   return a.area.localeCompare(b.area, "ja");
    return 0;
  });

  const handlePost = async (spot) => {
    if (!SUPABASE_READY || !user) { alert("ログインが必要です"); return; }
    const { data, error } = await insertGuideSpot(user.id, user.name || "匿名", spot);
    if (error) { alert("投稿に失敗しました"); return; }
    await upsertProfile({ id: user.id, xp: (user.xp || 0) + XP_GUIDE_POST });
    setDbSpots(prev => [data, ...prev]);
    setShowPost(false);
    alert(`✨ 投稿完了！+${XP_GUIDE_POST} XP獲得！`);
  };

  if (selected) {
    return (
      <DetailView
        g={selected}
        user={user}
        userVotedSpots={userVotedSpots}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth:480,margin:"0 auto",padding:"16px 16px 100px" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:13,fontWeight:700 }}>📍 スポットガイド</div>
        <div style={{ fontSize:11,color:C.muted }}>ドライバー同士のノウハウ共有</div>
      </div>

      {/* エリア選択（2段階） */}
      {(() => {
        const selSt = {
          backgroundColor:C.card, border:`1px solid ${C.border}`, borderRadius:10,
          padding:"9px 28px 9px 10px", fontSize:12, color:C.text, outline:"none",
          appearance:"none", cursor:"pointer", width:"100%",
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center",
        };
        const zonesInRegion = regionFilter
          ? TRAFFIC_ZONES_BY_REGION.find(r => r.region === regionFilter)?.zones || []
          : [];
        return (
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {/* 1段目：地域 */}
            <select value={regionFilter || ""} onChange={e => {
              const r = e.target.value || null;
              setRegionFilter(r);
              setAreaFilter(null);
            }} style={{ ...selSt, flex:"0 0 38%" }}>
              <option value="">全地域</option>
              {TRAFFIC_ZONES_BY_REGION.map(r => (
                <option key={r.region} value={r.region}>{r.emoji} {r.region}</option>
              ))}
            </select>
            {/* 2段目：交通圏 */}
            <select value={areaFilter || ""} onChange={e => setAreaFilter(e.target.value || null)}
              style={{ ...selSt, flex:1 }} disabled={!regionFilter}>
              <option value="">{regionFilter ? "全交通圏" : "—"}</option>
              {zonesInRegion.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        );
      })()}

      {/* カテゴリータブ */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12 }}>
        {CATEGORIES.map(c => (
          <div key={c.id} onClick={() => { setCategory(c.id); setSearch(""); }}
            style={{ textAlign:"center",padding:"10px 0",borderRadius:11,cursor:"pointer",transition:"all 0.15s",
              border:`1.5px solid ${category===c.id ? C.accentLight : C.border}`,
              backgroundColor:category===c.id ? C.accentGlow : C.surface,
              fontSize:13, fontWeight:category===c.id ? 700 : 400,
              color:category===c.id ? C.accentLight : C.muted }}>
            {c.emoji} {c.label}
          </div>
        ))}
      </div>

      {/* 検索 */}
      <div style={{ position:"relative",marginBottom:10 }}>
        <span style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted,pointerEvents:"none" }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="名前・エリアで検索..."
          style={{ width:"100%",boxSizing:"border-box",backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px 9px 34px",fontSize:13,color:C.text,outline:"none" }}/>
        {search && <button onClick={() => setSearch("")} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16 }}>×</button>}
      </div>

      {/* ソート */}
      <div style={{ display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2 }}>
        {SORT_OPTIONS.map(o => (
          <button key={o.id} onClick={() => setSort(o.id)}
            style={{ flexShrink:0,padding:"5px 10px",borderRadius:99,fontSize:11,fontWeight:sort===o.id ? 700 : 400,
              border:`1px solid ${sort===o.id ? C.accentLight : C.border}`,
              backgroundColor:sort===o.id ? C.accentGlow : "transparent",
              color:sort===o.id ? C.accentLight : C.muted,cursor:"pointer",whiteSpace:"nowrap" }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* 投稿ボタン */}
      <button onClick={() => setShowPost(true)}
        style={{ width:"100%",backgroundColor:C.surface,border:`1.5px dashed ${C.accentLight}66`,borderRadius:11,padding:"10px 0",fontSize:13,color:C.accentLight,fontWeight:600,cursor:"pointer",marginBottom:12 }}>
        ＋ スポットを投稿する（+{XP_GUIDE_POST} XP）
      </button>

      {/* お気に入り */}
      {bookmarks.length > 0 && !search && (
        <>
          <div style={{ fontSize:11,color:C.gold,fontWeight:700,marginBottom:8 }}>⭐ お気に入り</div>
          {allSpots.filter(g => bookmarks.includes(g.id)).map(g => (
            <div key={g.id} onClick={() => setSelected(g)} style={{ backgroundColor:C.card,border:`1px solid ${C.gold}44`,borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:"pointer" }}>
              <div style={{ fontSize:14,fontWeight:700 }}>{g.emoji} {g.name}</div>
              <div style={{ fontSize:11,color:C.muted,marginTop:4 }}>{g.peak || g.description?.slice(0,30)}</div>
            </div>
          ))}
          <div style={{ height:1,backgroundColor:C.border,margin:"12px 0" }}/>
        </>
      )}

      {/* 件数 */}
      <div style={{ fontSize:12,color:C.muted,marginBottom:10 }}>
        {loading ? "読み込み中..." : `${list.length}件`}
      </div>

      {/* 空 */}
      {!loading && list.length === 0 && (
        <div style={{ textAlign:"center",padding:"40px 20px",color:C.muted }}>
          <div style={{ fontSize:32,marginBottom:10 }}>🔍</div>
          <div style={{ fontSize:14,marginBottom:8 }}>
            {search ? `「${search}」に一致するスポットなし` : "まだスポットがありません"}
          </div>
          {!search && <div style={{ fontSize:12 }}>最初の投稿者になろう！</div>}
        </div>
      )}

      {/* スポット一覧 */}
      {list.map(g => (
        <div key={g.id} onClick={() => setSelected(g)}
          style={{ backgroundColor:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:12,cursor:"pointer" }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cardHover}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = C.card}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                <div style={{ fontSize:15,fontWeight:800 }}>{g.emoji} {g.name}</div>
                {g.isMock && <span style={{ fontSize:9,color:C.gold,backgroundColor:C.goldGlow,border:`1px solid ${C.gold}33`,borderRadius:99,padding:"1px 6px" }}>公式</span>}
              </div>
              <div style={{ fontSize:11,color:C.muted }}>{g.area}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); toggleBm(g.id); }} style={{ backgroundColor:"transparent",border:"none",fontSize:20,cursor:"pointer",marginLeft:8 }}>
              {bookmarks.includes(g.id) ? "⭐" : "☆"}
            </button>
          </div>

          {g.peak && (
            <div style={{ backgroundColor:C.bg,borderRadius:8,padding:"6px 10px",marginBottom:6 }}>
              <div style={{ fontSize:11,color:C.muted,marginBottom:2 }}>⏰ ピーク</div>
              <div style={{ fontSize:12,color:C.sub }}>{g.peak}</div>
            </div>
          )}
          {(g.lineup || g.description) && (
            <div style={{ fontSize:12,color:C.muted,backgroundColor:C.surface,borderRadius:8,padding:"6px 10px",borderLeft:`3px solid ${C.accentLight}`,lineHeight:1.6,marginBottom:6 }}>
              {(g.lineup || g.description).slice(0, 60)}...
            </div>
          )}

          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              {(g.vote_count || 0) > 0 && <span style={{ fontSize:11,color:C.gold }}>👍 {g.vote_count}</span>}
              {g.contributor_name && <span style={{ fontSize:10,color:C.muted }}>by {g.contributor_name}</span>}
            </div>
            <span style={{ fontSize:12,color:C.accentLight,fontWeight:700 }}>詳細 →</span>
          </div>
        </div>
      ))}

      {showPost && (
        <PostModal
          defaultCategory={category}
          userAreas={userAreas.length ? userAreas : AREA_OPTIONS}
          onClose={() => setShowPost(false)}
          onSave={handlePost}
        />
      )}
    </div>
  );
}
