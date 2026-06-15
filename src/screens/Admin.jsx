// 管理画面（よしと専用）
// アクセス: /?admin=takuro2026 または管理者メールでログイン後に表示
import { useState, useEffect, useCallback } from "react";
import { C, fmt } from "../lib/constants";
import {
  adminFetchUsers, adminFetchFeedback, adminMarkFeedbackRead,
  adminFetchReferrals, adminGrantXP, adminResolveDeleteRequest,
  adminCreateNotification, adminFetchNotifications, adminFetchMetrics,
} from "../lib/supabase";

const ADMIN_EMAIL = "white-t@hotmail.co.jp";

const card = { backgroundColor:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:12, padding:"16px 18px", marginBottom:12 };
const badge = (color) => ({ display:"inline-block", padding:"2px 10px", borderRadius:99, fontSize:11, fontWeight:700, backgroundColor:color+"22", color });
const btn = (color="#4f8ef7") => ({ padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:700, border:"none", backgroundColor:color, color:"#fff", cursor:"pointer" });
const input = { backgroundColor:"#0d0d1a", border:"1px solid #2a2a4a", borderRadius:8, padding:"9px 12px", color:"#e0e0ff", fontSize:13, outline:"none", width:"100%" };

const TABS = [
  { id:"metrics",   label:"📊 メトリクス" },
  { id:"users",     label:"👥 ユーザー" },
  { id:"feedback",  label:"💬 意見箱" },
  { id:"referrals", label:"🎁 紹介管理" },
  { id:"notify",    label:"📢 お知らせ" },
  { id:"delete",    label:"🗑️ 削除申請" },
];

export default function AdminScreen({ user, onExit }) {
  const [tab, setTab] = useState("metrics");
  const [loading, setLoading] = useState(false);

  // 管理者チェック
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ minHeight:"100vh", backgroundColor:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center", color:"#e0e0ff", fontFamily:"monospace" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>アクセス拒否</div>
          <div style={{ fontSize:13, color:"#666", marginBottom:20 }}>管理者アカウントでログインしてください</div>
          <button onClick={onExit} style={btn()}>戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#0a0a1a", color:"#e0e0ff", fontFamily:"'Inter','Hiragino Sans',sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ backgroundColor:"#12122a", borderBottom:"1px solid #2a2a4a", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🦉</span>
          <span style={{ fontSize:15, fontWeight:800, letterSpacing:"-0.5px" }}>タクロー 管理画面</span>
        </div>
        <button onClick={onExit} style={{ ...btn("#333"), fontSize:12, padding:"6px 14px" }}>← アプリに戻る</button>
      </div>

      {/* タブ */}
      <div style={{ display:"flex", gap:4, padding:"12px 16px", overflowX:"auto", borderBottom:"1px solid #2a2a4a", backgroundColor:"#0d0d1a" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:700, border:"none", cursor:"pointer", whiteSpace:"nowrap",
              backgroundColor: tab===t.id ? "#4f8ef7" : "#1a1a2e",
              color: tab===t.id ? "#fff" : "#888" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"16px", maxWidth:900, margin:"0 auto", paddingBottom:60 }}>
        {tab === "metrics"   && <MetricsTab />}
        {tab === "users"     && <UsersTab />}
        {tab === "feedback"  && <FeedbackTab />}
        {tab === "referrals" && <ReferralsTab />}
        {tab === "notify"    && <NotifyTab />}
        {tab === "delete"    && <DeleteTab />}
      </div>
    </div>
  );
}

// ── メトリクス ──────────────────────────────────────
function MetricsTab() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    adminFetchMetrics().then(m => { setMetrics(m); setLoading(false); });
  }, []);

  const KPI = ({ label, value, sub, color="#4f8ef7" }) => (
    <div style={{ ...card, textAlign:"center" }}>
      <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:36, fontWeight:900, color }}>{loading ? "—" : value}</div>
      {sub && <div style={{ fontSize:11, color:"#666", marginTop:4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>📊 アプリ全体メトリクス</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        <KPI label="総ユーザー数" value={metrics?.totalUsers ?? 0} color="#4f8ef7"/>
        <KPI label="MAU（30日）" value={metrics?.mau ?? 0} color="#22c55e"/>
        <KPI label="総日報数" value={metrics?.totalReports ?? 0} color="#f59e0b"/>
        <KPI label="有料ユーザー" value={metrics?.paidUsers ?? 0} color="#a855f7"/>
      </div>
      <div style={{ ...card, fontSize:12, color:"#888", lineHeight:1.8 }}>
        ℹ️ メトリクスはリアルタイムでSupabaseから取得しています。<br/>
        MAUはupdated_atまたはcreated_atが直近30日以内のユーザーを集計。
      </div>
    </div>
  );
}

// ── ユーザー一覧 ────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantXp, setGrantXp] = useState("100");
  const [granting, setGranting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminFetchUsers().then(({ data }) => { setUsers(data); setLoading(false); });
  }, []);

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleGrant = async () => {
    if (!grantTarget) return;
    setGranting(true);
    const { error } = await adminGrantXP(grantTarget.id, parseInt(grantXp) || 0);
    setGranting(false);
    setMsg(error ? "エラー: " + error.message : `✓ ${grantTarget.name} に +${grantXp} XP 付与`);
    setGrantTarget(null);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>👥 ユーザー一覧（{users.length}人）</div>
      {msg && <div style={{ backgroundColor:"#22c55e22", border:"1px solid #22c55e44", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#22c55e" }}>{msg}</div>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・メールで検索" style={{ ...input, marginBottom:12 }}/>
      {loading ? <div style={{ color:"#666", textAlign:"center", padding:40 }}>読み込み中...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ ...card, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{u.name || "（名前なし）"}</div>
                <div style={{ fontSize:11, color:"#888" }}>{u.email}</div>
                <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{u.company_name || ""} · {(u.areas||[]).join(", ") || "エリア未設定"}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <span style={badge(u.plan==="paid"?"#a855f7":"#4f8ef7")}>{u.plan==="paid"?"有料":"無料"}</span>
                <span style={badge("#f59e0b")}>XP {u.xp ?? 0}</span>
                <span style={badge("#22c55e")}>{u.monthly_upload_count ?? 0}件</span>
                {u.deletion_requested && <span style={badge("#ef4444")}>削除申請中</span>}
              </div>
              <button onClick={() => setGrantTarget(u)} style={{ ...btn("#22c55e"), fontSize:11, padding:"5px 12px" }}>XP付与</button>
            </div>
          ))}
        </div>
      )}

      {/* XP付与モーダル */}
      {grantTarget && (
        <div style={{ position:"fixed", inset:0, backgroundColor:"#00000090", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ backgroundColor:"#12122a", border:"1px solid #2a2a4a", borderRadius:16, padding:24, width:"100%", maxWidth:360 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🎁 XP を付与: {grantTarget.name}</div>
            <input type="number" value={grantXp} onChange={e=>setGrantXp(e.target.value)} style={{ ...input, marginBottom:14, fontSize:18, textAlign:"center" }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setGrantTarget(null)} style={{ ...btn("#333"), flex:1 }}>キャンセル</button>
              <button onClick={handleGrant} disabled={granting} style={{ ...btn("#22c55e"), flex:1 }}>
                {granting ? "付与中..." : `+${grantXp} XP 付与`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 意見箱 ──────────────────────────────────────────
function FeedbackTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    adminFetchFeedback().then(({ data }) => { setItems(data); setLoading(false); });
  }, []);

  const markRead = async (id) => {
    await adminMarkFeedbackRead(id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read_at: new Date().toISOString() } : i));
  };

  const CATEGORY_COLOR = { bug:"#ef4444", request:"#f59e0b", praise:"#22c55e", other:"#888" };
  const filtered = items.filter(i => filter === "all" ? true : filter === "unread" ? !i.read_at : i.category === filter);
  const unreadCount = items.filter(i => !i.read_at).length;

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>💬 意見箱（{items.length}件 / 未読{unreadCount}件）</div>
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {[["all","すべて"],["unread","未読"],["bug","バグ"],["request","要望"],["praise","ほめる"],["other","その他"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)}
            style={{ padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:"none", cursor:"pointer",
              backgroundColor: filter===v ? "#4f8ef7" : "#1a1a2e", color: filter===v ? "#fff" : "#888" }}>
            {l}
          </button>
        ))}
      </div>
      {loading ? <div style={{ color:"#666", textAlign:"center", padding:40 }}>読み込み中...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.length === 0 && <div style={{ color:"#666", textAlign:"center", padding:40 }}>該当なし</div>}
          {filtered.map(item => (
            <div key={item.id} style={{ ...card, opacity: item.read_at ? 0.6 : 1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:8 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={badge(CATEGORY_COLOR[item.category] || "#888")}>{item.category || "その他"}</span>
                  {item.anonymous && <span style={badge("#888")}>匿名</span>}
                  {!item.read_at && <span style={badge("#4f8ef7")}>未読</span>}
                </div>
                <div style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
              </div>
              <div style={{ fontSize:13, color:"#ccc", lineHeight:1.7, marginBottom:item.read_at ? 0 : 10 }}>{item.body}</div>
              {!item.read_at && (
                <button onClick={() => markRead(item.id)} style={{ ...btn("#333"), fontSize:11, padding:"4px 12px" }}>既読にする</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 紹介管理 ────────────────────────────────────────
function ReferralsTab() {
  const [referrals, setReferrals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminFetchReferrals(), adminFetchUsers()]).then(([r, u]) => {
      setReferrals(r.data);
      setUsers(u.data);
      setLoading(false);
    });
  }, []);

  // 紹介コードからユーザーを特定
  const refCodeToUser = (code) => {
    if (!code) return null;
    return users.find(u => ("TAKURO-" + u.id.slice(-6).toUpperCase()) === code);
  };

  // 紹介者ごとにグループ化
  const grouped = {};
  referrals.forEach(r => {
    const code = r.referred_by;
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(r);
  });

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>🎁 紹介管理（{referrals.length}件）</div>
      {loading ? <div style={{ color:"#666", textAlign:"center", padding:40 }}>読み込み中...</div> : (
        Object.keys(grouped).length === 0
          ? <div style={{ color:"#666", textAlign:"center", padding:40 }}>紹介経由の登録なし</div>
          : Object.entries(grouped).map(([code, referred]) => {
            const recruiter = refCodeToUser(code);
            return (
              <div key={code} style={card}>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>招待者: {recruiter?.name || "不明"}</div>
                  <div style={{ fontSize:11, color:"#888" }}>コード: {code} · {referred.length}人を招待</div>
                </div>
                {referred.map(r => (
                  <div key={r.id} style={{ padding:"8px 12px", backgroundColor:"#0d0d1a", borderRadius:8, marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{r.name}</div>
                      <div style={{ fontSize:11, color:"#666" }}>{new Date(r.created_at).toLocaleDateString("ja-JP")} 登録</div>
                    </div>
                    <span style={badge("#22c55e")}>XP {r.xp ?? 0}</span>
                  </div>
                ))}
              </div>
            );
          })
      )}
    </div>
  );
}

// ── お知らせ作成 ─────────────────────────────────────
function NotifyTab() {
  const [form, setForm] = useState({ title:"", body:"", area:"", severity:"info" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    adminFetchNotifications().then(({ data }) => { setHistory(data); setLoadingHistory(false); });
  }, []);

  const handleSend = async () => {
    if (!form.title || !form.body) { setMsg("タイトルと本文は必須です"); return; }
    setSending(true); setMsg("");
    const { data, error } = await adminCreateNotification(form);
    setSending(false);
    if (error) { setMsg("エラー: " + error.message); return; }
    setMsg("✓ お知らせを配信しました");
    setHistory(prev => [data, ...prev]);
    setForm({ title:"", body:"", area:"", severity:"info" });
    setTimeout(() => setMsg(""), 3000);
  };

  const SEV_COLOR = { info:"#4f8ef7", warning:"#f59e0b", alert:"#ef4444" };

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>📢 お知らせ作成</div>
      {msg && <div style={{ backgroundColor: msg.startsWith("✓") ? "#22c55e22" : "#ef444422", border:`1px solid ${msg.startsWith("✓")?"#22c55e44":"#ef444444"}`, borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color: msg.startsWith("✓") ? "#22c55e" : "#ef4444" }}>{msg}</div>}
      <div style={card}>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>タイトル</div>
          <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="例：横浜エリアで需要急増中" style={input}/>
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>本文</div>
          <textarea value={form.body} onChange={e=>setForm(p=>({...p,body:e.target.value}))} placeholder="詳細な内容..." rows={4}
            style={{ ...input, resize:"vertical", lineHeight:1.6 }}/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>対象エリア（空白=全員）</div>
            <input value={form.area} onChange={e=>setForm(p=>({...p,area:e.target.value}))} placeholder="例：横浜" style={input}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>種別</div>
            <select value={form.severity} onChange={e=>setForm(p=>({...p,severity:e.target.value}))} style={{ ...input }}>
              <option value="info">ℹ️ お知らせ</option>
              <option value="warning">⚠️ 警告</option>
              <option value="alert">🚨 緊急</option>
            </select>
          </div>
        </div>
        <button onClick={handleSend} disabled={sending} style={{ ...btn(), width:"100%" }}>
          {sending ? "配信中..." : "📢 配信する"}
        </button>
      </div>

      <div style={{ fontSize:13, fontWeight:700, color:"#888", marginBottom:10, marginTop:20 }}>配信履歴</div>
      {loadingHistory ? <div style={{ color:"#666", textAlign:"center", padding:20 }}>読み込み中...</div> : (
        history.length === 0
          ? <div style={{ color:"#666", textAlign:"center", padding:20 }}>配信履歴なし</div>
          : history.map(n => (
            <div key={n.id} style={{ ...card }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={badge(SEV_COLOR[n.severity] || "#4f8ef7")}>{n.severity}</span>
                  {n.area && <span style={badge("#888")}>{n.area}</span>}
                </div>
                <div style={{ fontSize:11, color:"#666" }}>{new Date(n.created_at).toLocaleDateString("ja-JP")}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{n.title}</div>
              <div style={{ fontSize:12, color:"#999" }}>{n.body}</div>
            </div>
          ))
      )}
    </div>
  );
}

// ── 削除申請 ─────────────────────────────────────────
function DeleteTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminFetchUsers().then(({ data }) => {
      setUsers(data.filter(u => u.deletion_requested));
      setLoading(false);
    });
  }, []);

  const handleResolve = async (u) => {
    setResolving(u.id);
    await adminResolveDeleteRequest(u.id);
    setUsers(prev => prev.filter(x => x.id !== u.id));
    setMsg(`✓ ${u.name} の削除申請を処理済みにしました（Supabaseから手動削除も忘れずに）`);
    setResolving(null);
    setTimeout(() => setMsg(""), 5000);
  };

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>🗑️ アカウント削除申請（{users.length}件）</div>
      {msg && <div style={{ backgroundColor:"#22c55e22", border:"1px solid #22c55e44", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#22c55e" }}>{msg}</div>}
      <div style={{ ...card, fontSize:12, color:"#888", marginBottom:16, lineHeight:1.7 }}>
        ⚠️ 「処理済みにする」ボタンはフラグをオフにするだけです。<br/>
        実際のデータ削除は Supabase Dashboard → Authentication → Users から行ってください。
      </div>
      {loading ? <div style={{ color:"#666", textAlign:"center", padding:40 }}>読み込み中...</div>
        : users.length === 0
          ? <div style={{ color:"#22c55e", textAlign:"center", padding:40 }}>✓ 削除申請はありません</div>
          : users.map(u => (
            <div key={u.id} style={{ ...card, borderColor:"#ef444444" }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{u.name || "（名前なし）"}</div>
                <div style={{ fontSize:12, color:"#888" }}>{u.email}</div>
                <div style={{ fontSize:11, color:"#666", marginTop:4 }}>登録日: {new Date(u.created_at).toLocaleDateString("ja-JP")} · XP: {u.xp ?? 0}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button
                  onClick={() => navigator.clipboard.writeText(u.id).catch(()=>{})}
                  style={{ ...btn("#333"), fontSize:11, padding:"6px 12px" }}>
                  IDコピー
                </button>
                <button
                  onClick={() => handleResolve(u)}
                  disabled={resolving === u.id}
                  style={{ ...btn("#ef4444"), fontSize:11, padding:"6px 12px" }}>
                  {resolving === u.id ? "処理中..." : "処理済みにする"}
                </button>
              </div>
            </div>
          ))
      }
    </div>
  );
}
