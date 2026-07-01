// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MyPage.jsx — マイページ（QRフレンド・日報共有）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useRef } from "react";
import { C } from "../lib/constants";
import {
  addFriend,
  fetchFriends,
  removeFriend,
  fetchFriendNotifs,
  markFriendNotifsRead,
  toggleShareReport,
  fetchFriendsReports,
  fetchFriendsShifts,
  searchUserByDisplayId,
  sendShiftShareRequest,
  respondShiftShareRequest,
  fetchIncomingShiftShareRequests,
  fetchShiftShareStatuses,
  updateDisplayId,
  respondFriendRequest,
  fetchIncomingFriendRequests,
  fetchMyReferralStats,
} from "../lib/supabase";
import { UserAvatar } from "../components/AvatarPicker";
import QRCode from "qrcode";

// ── ユーティリティ ────────────────────────
function fmt(n) { return n != null ? Number(n).toLocaleString() : "—"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}

// ── QR表示モーダル ────────────────────────
function QRModal({ userId, userName, onClose }) {
  const [qrUrl, setQrUrl] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(`takuro:friend:${userId}`, {
      width: 240,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    }).then(setQrUrl).catch(console.error);
  }, [userId]);

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000000aa", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:20, padding:28, textAlign:"center", maxWidth:300, width:"90%" }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>マイQRコード</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>相手にスキャンしてもらってください</div>
        {qrUrl ? (
          <img src={qrUrl} alt="QR" style={{ width:200, height:200, borderRadius:12, border:`2px solid ${C.border}` }}/>
        ) : (
          <div style={{ width:200, height:200, backgroundColor:C.card, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto" }}>
            <span style={{ color:C.muted, fontSize:12 }}>生成中...</span>
          </div>
        )}
        <div style={{ marginTop:14, fontSize:13, fontWeight:700, color:C.text }}>{userName || "あなた"}</div>
        <button onClick={onClose} style={{ marginTop:16, width:"100%", padding:"12px 0", borderRadius:12, fontSize:14, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer" }}>閉じる</button>
      </div>
    </div>
  );
}

// ── QRスキャナー ──────────────────────────
function QRScanner({ onScanned, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        const jsQR = (await import("jsqr")).default;
        const scan = () => {
          if (!active || !scanning) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data?.startsWith("takuro:friend:")) {
              const targetId = code.data.replace("takuro:friend:", "");
              if (targetId && active) {
                active = false;
                onScanned(targetId);
              }
              return;
            }
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        setError("カメラへのアクセスが許可されていません");
      }
    })();
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, backgroundColor:"#000", zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:16 }}>QRコードをスキャン</div>
      {error ? (
        <div style={{ color:C.red, fontSize:13, textAlign:"center", padding:"0 24px" }}>{error}</div>
      ) : (
        <>
          <div style={{ position:"relative", width:280, height:280 }}>
            <video ref={videoRef} style={{ width:280, height:280, objectFit:"cover", borderRadius:16 }} playsInline muted />
            <canvas ref={canvasRef} style={{ display:"none" }}/>
            {/* コーナーフレーム */}
            {["topLeft","topRight","bottomLeft","bottomRight"].map(pos => {
              const isTop = pos.includes("top");
              const isLeft = pos.includes("Left");
              return (
                <div key={pos} style={{
                  position:"absolute",
                  [isTop?"top":"bottom"]: 8,
                  [isLeft?"left":"right"]: 8,
                  width:32, height:32,
                  borderTop: isTop ? `3px solid ${C.accentLight}` : "none",
                  borderBottom: !isTop ? `3px solid ${C.accentLight}` : "none",
                  borderLeft: isLeft ? `3px solid ${C.accentLight}` : "none",
                  borderRight: !isLeft ? `3px solid ${C.accentLight}` : "none",
                  borderRadius: isTop&&isLeft?"6px 0 0 0":isTop&&!isLeft?"0 6px 0 0":!isTop&&isLeft?"0 0 0 6px":"0 0 6px 0",
                }}/>
              );
            })}
          </div>
          <div style={{ color:"#ffffff88", fontSize:12, marginTop:14 }}>相手のQRコードにカメラを向けてください</div>
        </>
      )}
      <button onClick={onClose} style={{ marginTop:28, padding:"12px 32px", borderRadius:12, fontSize:14, fontWeight:700, border:"none", backgroundColor:"#ffffff22", color:"#fff", cursor:"pointer" }}>キャンセル</button>
    </div>
  );
}

// ── フレンドの日報カード ──────────────────
function FriendReportCard({ report }) {
  const occ = report.total_distance > 0
    ? Math.round((report.occupied_distance / report.total_distance) * 100)
    : null;
  return (
    <div style={{ backgroundColor:C.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:"50%", backgroundColor:C.accentGlow, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
          {report.avatarPreset || "🚕"}
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{report.userName}</div>
          <div style={{ fontSize:11, color:C.muted }}>{fmtDate(report.report_date)}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.muted }}>売上</div>
          <div style={{ fontSize:15, fontWeight:800, color:C.accentLight }}>¥{fmt(report.gross_sales)}</div>
        </div>
        {report.ride_count != null && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted }}>乗車</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{report.ride_count}回</div>
          </div>
        )}
        {report.work_hours != null && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted }}>勤務</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{Number(report.work_hours).toFixed(1)}h</div>
          </div>
        )}
        {occ != null && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted }}>実車率</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{occ}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 友達招待セクション
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const REWARD_TIERS = [
  { count:1,  label:"1人招待ごとに", benefit:"有料化時1ヶ月無料",        icon:"🎟️", cash:false },
  { count:3,  label:"3人達成",       benefit:"Amazonギフト券 ¥500",      icon:"🎁", cash:true  },
  { count:5,  label:"5人達成",       benefit:"Amazonギフト券 ¥1,000",    icon:"🎁", cash:true  },
  { count:10, label:"10人達成",      benefit:"Amazonギフト券 ¥1,500",    icon:"🎁", cash:true  },
];

function ReferralSection({ user }) {
  const APP_URL   = "https://taxi-app-nine-eta.vercel.app";
  const myCode    = user?.referral_code || null;
  const refUrl    = myCode ? `${APP_URL}/?ref=${myCode}` : APP_URL;
  const shareText = `タクシードライバー向けアプリ「タクロー」を使ってみて！日報記録・売上分析・AIアドバイスが全部ひとつ🦉\n招待コード: ${myCode}\n${refUrl}`;

  const [copied, setCopied]         = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refQrUrl, setRefQrUrl]     = useState(null);
  const [showRefQr, setShowRefQr]   = useState(false);

  useEffect(() => {
    if (!user?.id || !myCode) { setLoading(false); return; }
    fetchMyReferralStats(user.id, myCode)
      .then(s => { setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user?.id]);

  const total         = stats?.events?.length ?? 0;
  const MILESTONES    = [1, 3, 6, 9, 12];
  const nextMilestone = MILESTONES.find(m => m > total) ?? null;
  const lastMilestone = [...MILESTONES].reverse().find(m => m <= total) ?? 0;

  const copyCode  = () => { navigator.clipboard.writeText(myCode || "").catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false), 2000); };
  const copyLink  = () => { navigator.clipboard.writeText(refUrl).catch(()=>{}); setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 2000); };
  const shareLine = () => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`, "_blank");
  const shareX    = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
  const shareOther = () => navigator.share
    ? navigator.share({ title:"タクロー", text: shareText, url: refUrl }).catch(()=>{})
    : copyLink();
  const openRefQr = () => {
    if (!refQrUrl && myCode) {
      QRCode.toDataURL(refUrl, { width:240, margin:2, color:{ dark:"#1a1a2e", light:"#ffffff" } })
        .then(url => { setRefQrUrl(url); setShowRefQr(true); })
        .catch(console.error);
    } else {
      setShowRefQr(true);
    }
  };

  if (!myCode && !loading) return null;

  return (
    <div style={{ margin:"0 16px 14px", backgroundColor:C.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:12 }}>🎁 タクローを友達に紹介する</div>

      {/* 累計カウント */}
      <div style={{ background:`linear-gradient(135deg, ${C.accentLight}18, ${C.accentLight}08)`, border:`1px solid ${C.accentLight}33`, borderRadius:12, padding:"12px", marginBottom:12, textAlign:"center" }}>
        <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>累計招待人数</div>
        <div style={{ fontSize:32, fontWeight:900, color:C.text }}>
          {loading ? "—" : total}
          <span style={{ fontSize:14, color:C.muted, marginLeft:4 }}>人</span>
        </div>
        {!loading && nextMilestone && (
          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>あと{nextMilestone - total}人で次の特典！</div>
        )}
        {!loading && !nextMilestone && total > 0 && (
          <div style={{ fontSize:12, color:C.green, fontWeight:700, marginTop:2 }}>🏆 全マイルストーン達成！</div>
        )}
      </div>

      {/* 招待コード */}
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:6 }}>あなたの招待コード</div>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ flex:1, backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px" }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.accentLight, letterSpacing:"2px", fontFamily:"monospace" }}>{myCode || "..."}</div>
        </div>
        <button onClick={copyCode} style={{ padding:"0 14px", borderRadius:10, border:`1px solid ${copied?C.green:C.border}`, backgroundColor:copied?C.greenGlow||"#0f04":C.card, color:copied?C.green:C.sub||C.muted, fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
          {copied ? "✓ 済" : "コピー"}
        </button>
      </div>

      {/* シェアボタン */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <button onClick={shareLine} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:11, border:"1px solid #06C75544", backgroundColor:"#06C75514", color:"#06C755", fontSize:13, fontWeight:800, cursor:"pointer" }}>
          💬 LINEで送る
        </button>
        <button onClick={copyLink} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:11, border:`1px solid ${copiedLink?C.green:C.border}`, backgroundColor:copiedLink?C.greenGlow||"#0f04":C.card, color:copiedLink?C.green:C.muted, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          {copiedLink ? "✓ コピー済" : "🔗 リンクをコピー"}
        </button>
        <button onClick={shareX} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:11, border:"1px solid #33333344", backgroundColor:"#00000010", color:C.text, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          𝕏 でシェア
        </button>
        <button onClick={openRefQr} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:11, border:`1px solid ${C.border}`, backgroundColor:C.surface, color:C.muted, fontSize:13, fontWeight:700, cursor:"pointer" }}>
          📱 QRコード
        </button>
      </div>

      {/* 招待QRコードモーダル */}
      {showRefQr && (
        <div style={{ position:"fixed", inset:0, backgroundColor:"#000000aa", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => setShowRefQr(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ backgroundColor:C.surface, borderRadius:20, padding:28, textAlign:"center", maxWidth:300, width:"90%" }}>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>招待QRコード</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>新規登録者にスキャンしてもらうと<br/>あなたのコードが自動入力されます</div>
            {refQrUrl ? (
              <img src={refQrUrl} alt="招待QR" style={{ width:200, height:200, borderRadius:12, border:`2px solid ${C.border}` }}/>
            ) : (
              <div style={{ width:200, height:200, backgroundColor:C.card, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto" }}>
                <span style={{ color:C.muted, fontSize:12 }}>生成中...</span>
              </div>
            )}
            <div style={{ marginTop:14, fontSize:12, color:C.accentLight, fontWeight:700, fontFamily:"monospace", letterSpacing:1 }}>{myCode}</div>
            <button onClick={() => setShowRefQr(false)} style={{ marginTop:16, padding:"10px 32px", borderRadius:12, border:"none", backgroundColor:C.accentLight, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>閉じる</button>
          </div>
        </div>
      )}

      {/* 特典ティア */}
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginBottom:6 }}>🎁 招待特典</div>
      <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:10 }}>
        {REWARD_TIERS.map((tier, i) => {
          const achieved = tier.count === 1 ? total >= 1 : total >= tier.count;
          return (
            <div key={tier.count} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom: i < REWARD_TIERS.length-1 ? `1px solid ${C.border}` : "none", backgroundColor: achieved ? `${C.accentLight}08` : "transparent" }}>
              <div style={{ fontSize:18, flexShrink:0 }}>{tier.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color: achieved ? C.text : C.muted }}>{tier.label}</div>
                <div style={{ fontSize:10, color: tier.cash ? (achieved ? "#f59e0b" : C.muted) : (achieved ? C.green : C.muted), marginTop:1 }}>{tier.benefit}</div>
              </div>
              {achieved && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓</span>}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:10, color:C.muted, lineHeight:1.7 }}>
        ※ 招待した相手が登録完了した時点でカウントされます。<br/>
        ※ 招待された方は登録時に+30日の無料期間が付与されます。
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン：MyPageScreen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function MyPageScreen({ user, reports = [], onBack, onMarkNotifsRead }) {
  // ゲストはマイページ使用不可
  if (user?._isGuest) {
    return (
      <div style={{ minHeight:"100vh", backgroundColor:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>👥</div>
        <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>マイページはログイン後にご利用いただけます</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:24, textAlign:"center", lineHeight:1.7 }}>フレンド機能・日報共有はアカウント登録が必要です</div>
        <button onClick={onBack} style={{ padding:"10px 28px", borderRadius:99, backgroundColor:C.accent, color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer" }}>戻る</button>
      </div>
    );
  }

  const [tab, setTab] = useState("friends"); // friends | feed
  const [friends, setFriends] = useState([]);
  const [friendReports, setFriendReports] = useState([]);
  const [friendShifts, setFriendShifts] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState(null); // { type:"success"|"error", text }
  const [removingId, setRemovingId] = useState(null);

  // フレンド申請（受信）
  const [incomingFriendRequests, setIncomingFriendRequests] = useState([]);
  const [friendReqLoading, setFriendReqLoading] = useState(null);

  // シフト共有関連
  const [shiftShareStatuses, setShiftShareStatuses] = useState({}); // { [friendId]: { id, status, isSender } }
  const [shiftShareLoading, setShiftShareLoading] = useState(null);
  const [incomingShareRequests, setIncomingShareRequests] = useState([]);

  // ID検索
  const [idSearch, setIdSearch] = useState("");
  const [idSearchResult, setIdSearchResult] = useState(null); // null | "notfound" | userObject
  const [idSearchLoading, setIdSearchLoading] = useState(false);

  // 自分のID編集
  const [editingId, setEditingId] = useState(false);
  const [idEditValue, setIdEditValue] = useState("");
  const [idEditError, setIdEditError] = useState("");
  const [idEditLoading, setIdEditLoading] = useState(false);
  const [myDisplayId, setMyDisplayId] = useState(user?.display_id || "");

  // 共有済みレポートID管理（ローカル反映用）
  const [sharedIds, setSharedIds] = useState(
    () => new Set(reports.filter(r => r.is_shared).map(r => r.id))
  );
  const [shareLoading, setShareLoading] = useState(null);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [friendsRes, notifsRes, incomingRes, incomingFriendRes] = await Promise.all([
        fetchFriends(user.id),
        fetchFriendNotifs(user.id),
        fetchIncomingShiftShareRequests(user.id),
        fetchIncomingFriendRequests(user.id),
      ]);
      const friendsList = friendsRes.data ?? [];
      setFriends(friendsList);
      setNotifs(notifsRes.data ?? []);
      setIncomingShareRequests(incomingRes.data ?? []);
      setIncomingFriendRequests(incomingFriendRes.data ?? []);
      // シフト共有ステータスを取得
      if (friendsList.length > 0) {
        const statuses = await fetchShiftShareStatuses(user.id, friendsList.map(f => f.id));
        setShiftShareStatuses(statuses);
      }
      setLoading(false);
      await markFriendNotifsRead(user.id);
      onMarkNotifsRead?.();
    })();
  }, [user?.id]);

  useEffect(() => {
    if (tab === "feed" && user?.id) {
      fetchFriendsReports(user.id).then(({ data }) => setFriendReports(data ?? []));
    }
    if (tab === "shifts" && user?.id) {
      fetchFriendsShifts(user.id).then(({ data }) => setFriendShifts(data ?? []));
    }
  }, [tab, user?.id]);

  // ID検索
  const handleIdSearch = async () => {
    if (!idSearch.trim()) return;
    setIdSearchLoading(true);
    setIdSearchResult(null);
    const { data } = await searchUserByDisplayId(idSearch.trim());
    setIdSearchResult(data || "notfound");
    setIdSearchLoading(false);
  };

  // 自分のID編集
  const handleStartEditId = () => {
    setIdEditValue(myDisplayId || "");
    setIdEditError("");
    setEditingId(true);
  };
  const handleSaveId = async () => {
    setIdEditLoading(true);
    setIdEditError("");
    const { error, clean } = await updateDisplayId(user.id, idEditValue);
    if (error) {
      setIdEditError(error.message);
      setIdEditLoading(false);
      return;
    }
    setMyDisplayId(clean);
    setEditingId(false);
    setIdEditLoading(false);
  };

  // フレンド申請に承認・拒否
  const handleRespondFriendRequest = async (req, status) => {
    setFriendReqLoading(req.id);
    await respondFriendRequest(req.id, status, req.from_user_id, user.id, user.name);
    setIncomingFriendRequests(prev => prev.filter(r => r.id !== req.id));
    if (status === "accepted") {
      // フレンド一覧を再取得
      const { data } = await fetchFriends(user.id);
      setFriends(data ?? []);
    }
    setFriendReqLoading(null);
  };

  // シフト共有申請を送る
  const handleSendShiftShare = async (friendId) => {
    if (!user?.id) return;
    const friend = friends.find(f => f.id === friendId);
    const fname = friend?.name || "フレンド";
    if (!confirm(`${fname}さんとシフトを共有しますか？\n相手の承認後、互いのシフトが見られるようになります。`)) return;
    setShiftShareLoading(friendId);
    const { error, existing } = await sendShiftShareRequest(user.id, friendId, user.name);
    if (existing) {
      setScanMsg({ type:"info", text: existing.status === "accepted" ? "すでにシフト共有中です" : "申請済みです（相手の承認待ち）" });
    } else if (error) {
      setScanMsg({ type:"error", text: "申請に失敗しました" });
    } else {
      setScanMsg({ type:"success", text: `${fname}さんに申請を送りました！` });
      setShiftShareStatuses(prev => ({ ...prev, [friendId]: { status:"pending", isSender:true } }));
    }
    setShiftShareLoading(null);
    setTimeout(() => setScanMsg(null), 3000);
  };

  // シフト共有申請に応答
  const handleRespondShiftShare = async (req, status) => {
    setShiftShareLoading(req.from_user_id);
    await respondShiftShareRequest(req.id, status, user.id, req.from_user_id, user.name);
    setIncomingShareRequests(prev => prev.filter(r => r.id !== req.id));
    if (status === "accepted") {
      setShiftShareStatuses(prev => ({ ...prev, [req.from_user_id]: { id: req.id, status:"accepted", isSender:false } }));
      setScanMsg({ type:"success", text: `${req.fromName}さんとシフト共有を開始しました！` });
    }
    setShiftShareLoading(null);
    setTimeout(() => setScanMsg(null), 3000);
  };

  // QRスキャン後の処理
  const handleScanned = async (targetId) => {
    setShowScanner(false);
    if (!user?.id) return;
    const { error, alreadyFriend, requested } = await addFriend(user.id, targetId);
    if (error) {
      setScanMsg({ type:"error", text: error.message || "追加に失敗しました" });
    } else if (alreadyFriend) {
      setScanMsg({ type:"info", text: "すでにフレンドです" });
    } else if (requested) {
      setScanMsg({ type:"success", text: "フレンド申請を送りました！相手が承認すると追加されます 👋" });
    }
    setTimeout(() => setScanMsg(null), 4000);
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm("フレンドを削除しますか？")) return;
    setRemovingId(friendId);
    await removeFriend(user.id, friendId);
    setFriends(prev => prev.filter(f => f.id !== friendId));
    setRemovingId(null);
  };

  const handleToggleShare = async (reportId) => {
    const next = !sharedIds.has(reportId);
    setShareLoading(reportId);
    const { error } = await toggleShareReport(reportId, next);
    if (!error) {
      setSharedIds(prev => {
        const s = new Set(prev);
        next ? s.add(reportId) : s.delete(reportId);
        return s;
      });
    }
    setShareLoading(null);
  };

  const unreadNotifs = notifs.filter(n => !n.read);

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"0 0 120px" }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 16px 12px" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.text, padding:"4px 8px", borderRadius:8 }}>←</button>
        <div style={{ flex:1, fontSize:17, fontWeight:800 }}>マイページ</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setShowScanner(true)}
            style={{ padding:"8px 14px", borderRadius:10, fontSize:13, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer" }}>
            📷 スキャン
          </button>
          <button onClick={() => setShowQR(true)}
            style={{ padding:"8px 14px", borderRadius:10, fontSize:13, fontWeight:700, border:`1.5px solid ${C.accentLight}`, backgroundColor:C.accentGlow, color:C.accentLight, cursor:"pointer" }}>
            QR表示
          </button>
        </div>
      </div>

      {/* プロフィール行 */}
      <div style={{ display:"flex", alignItems:"center", gap:12, margin:"0 16px 16px", backgroundColor:C.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.border}` }}>
        <UserAvatar avatarUrl={user?.avatarUrl} avatarPreset={user?.avatarPreset} size={44} />
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{user?.name || "ゲスト"}</div>
          {editingId ? (
            <div style={{ marginTop:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input
                  value={idEditValue}
                  onChange={e => { setIdEditValue(e.target.value.replace(/[^A-Za-z0-9]/g,"")); setIdEditError(""); }}
                  maxLength={12}
                  placeholder="英数字4〜12文字"
                  style={{ width:120, padding:"4px 8px", borderRadius:8, border:`1.5px solid ${C.accentLight}`, backgroundColor:C.bg, color:C.text, fontSize:13, fontWeight:700, outline:"none" }}
                  autoFocus
                />
                <button onClick={handleSaveId} disabled={idEditLoading || idEditValue.length < 4}
                  style={{ padding:"4px 10px", borderRadius:8, fontSize:12, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer", opacity: idEditValue.length < 4 ? 0.5 : 1 }}>
                  {idEditLoading ? "…" : "保存"}
                </button>
                <button onClick={() => setEditingId(false)}
                  style={{ padding:"4px 8px", borderRadius:8, fontSize:12, border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>
                  ✕
                </button>
              </div>
              {idEditError && <div style={{ fontSize:11, color:"#f87171", marginTop:4 }}>{idEditError}</div>}
            </div>
          ) : (
            <div onClick={handleStartEditId} style={{ fontSize:12, color:C.accentLight, fontWeight:700, marginTop:2, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              🪪 {myDisplayId || "IDを設定する"} <span style={{ fontSize:10, opacity:0.7 }}>✏️</span>
            </div>
          )}
          {user?.workType && <div style={{ fontSize:11, color:C.muted }}>{user.workType}</div>}
        </div>
        <div style={{ marginLeft:"auto", textAlign:"right" }}>
          <div style={{ fontSize:12, color:C.muted }}>フレンド</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.accentLight }}>{friends.length}</div>
        </div>
      </div>

      {/* ID検索 */}
      <div style={{ margin:"0 16px 14px", backgroundColor:C.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.border}` }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:10 }}>🔍 IDでフレンドを探す</div>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={idSearch}
            onChange={e => { setIdSearch(e.target.value.toUpperCase()); setIdSearchResult(null); }}
            onKeyDown={e => e.key === "Enter" && handleIdSearch()}
            placeholder="TK-XXXXXX"
            style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, backgroundColor:C.bg, color:C.text, fontSize:14, fontWeight:700, letterSpacing:"0.05em", outline:"none" }}
          />
          <button onClick={handleIdSearch} disabled={idSearchLoading || !idSearch.trim()}
            style={{ padding:"10px 16px", borderRadius:10, fontSize:13, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer", opacity: idSearch.trim() ? 1 : 0.5 }}>
            {idSearchLoading ? "…" : "検索"}
          </button>
        </div>
        {idSearchResult && idSearchResult !== "notfound" && (
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:12, padding:"12px 14px", backgroundColor:C.bg, borderRadius:12, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:24, flexShrink:0 }}>{idSearchResult.avatar_preset || "🚕"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{idSearchResult.name}</div>
              <div style={{ fontSize:11, color:C.accentLight }}>{idSearchResult.display_id}</div>
            </div>
            {idSearchResult.id === user?.id ? (
              <div style={{ fontSize:12, color:C.muted }}>自分</div>
            ) : (
              <button onClick={() => handleScanned(idSearchResult.id)}
                style={{ padding:"8px 14px", borderRadius:10, fontSize:12, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer" }}>
                追加
              </button>
            )}
          </div>
        )}
        {idSearchResult === "notfound" && (
          <div style={{ marginTop:10, fontSize:12, color:C.muted, textAlign:"center" }}>見つかりませんでした</div>
        )}
      </div>

      {/* スキャン結果メッセージ */}
      {scanMsg && (
        <div style={{ margin:"0 16px 12px", padding:"12px 16px", borderRadius:12, backgroundColor: scanMsg.type==="success"?C.green+"22":scanMsg.type==="error"?C.red+"22":C.accentGlow, border:`1px solid ${scanMsg.type==="success"?C.green:scanMsg.type==="error"?C.red:C.accentLight}44`, color: scanMsg.type==="success"?C.green:scanMsg.type==="error"?C.red:C.accentLight, fontSize:13, fontWeight:700, textAlign:"center" }}>
          {scanMsg.text}
        </div>
      )}

      {/* 友達を招待（紹介コード） */}
      <ReferralSection user={user} />

      {/* タブ */}
      <div style={{ display:"flex", gap:4, margin:"0 16px 14px", backgroundColor:C.card, borderRadius:12, padding:4, border:`1px solid ${C.border}` }}>
        {[["friends","👥 フレンド"],["feed","📋 日報"],["shifts","📅 シフト"],["share","🔗 共有"]].map(([v,l])=>(
          <div key={v} onClick={()=>setTab(v)} style={{ flex:1, textAlign:"center", padding:"8px 0", borderRadius:9, fontSize:10, fontWeight:tab===v?700:400, backgroundColor:tab===v?C.accentLight:C.surface, color:tab===v?"#fff":C.muted, cursor:"pointer", transition:"all 0.15s" }}>{l}</div>
        ))}
      </div>

      {/* ─── フレンド一覧 ─── */}
      {tab === "friends" && (
        <div style={{ padding:"0 16px" }}>
          {/* フレンド申請（受信） */}
          {incomingFriendRequests.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>👥 フレンド申請が届いています</div>
              {incomingFriendRequests.map(req => (
                <div key={req.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, marginBottom:6 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>👋</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{req.fromName}</div>
                    {req.fromDisplayId && <div style={{ fontSize:11, color:C.accentLight }}>🪪 {req.fromDisplayId}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => handleRespondFriendRequest(req, "accepted")} disabled={friendReqLoading === req.id}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer" }}>
                      {friendReqLoading === req.id ? "…" : "承認"}
                    </button>
                    <button onClick={() => handleRespondFriendRequest(req, "rejected")} disabled={friendReqLoading === req.id}
                      style={{ padding:"6px 10px", borderRadius:8, fontSize:12, fontWeight:700, border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>
                      拒否
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* シフト共有申請（受信） */}
          {incomingShareRequests.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6 }}>📅 シフト共有の申請が届いています</div>
              {incomingShareRequests.map(req => (
                <div key={req.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, marginBottom:6 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>📅</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{req.fromName}さん</div>
                    <div style={{ fontSize:11, color:C.muted }}>シフトを共有したいと申請しています</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => handleRespondShiftShare(req, "accepted")} disabled={shiftShareLoading === req.from_user_id}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:700, border:"none", backgroundColor:C.accentLight, color:"#fff", cursor:"pointer" }}>
                      {shiftShareLoading === req.from_user_id ? "…" : "承認"}
                    </button>
                    <button onClick={() => handleRespondShiftShare(req, "rejected")} disabled={shiftShareLoading === req.from_user_id}
                      style={{ padding:"6px 10px", borderRadius:8, fontSize:12, fontWeight:700, border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>
                      拒否
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* フレンド追加通知 */}
          {unreadNotifs.filter(n => n.type === "friend_added" || !n.type).length > 0 && (
            <div style={{ marginBottom:12 }}>
              {unreadNotifs.filter(n => n.type === "friend_added" || !n.type).map(n => (
                <div key={n.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}44`, borderRadius:12, marginBottom:6 }}>
                  <span style={{ fontSize:16 }}>🎉</span>
                  <div style={{ fontSize:13, color:C.accentLight }}><b>{n.from_name}</b>さんとフレンドになりました</div>
                  <div style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>NEW</div>
                </div>
              ))}
            </div>
          )}

          {/* シフト共有承認通知 */}
          {unreadNotifs.filter(n => n.type === "shift_share_accepted").map(n => (
            <div key={n.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", backgroundColor:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:12, marginBottom:6 }}>
              <span style={{ fontSize:16 }}>📅</span>
              <div style={{ fontSize:13, color:C.green }}><b>{n.from_name}</b>さんがシフト共有を承認しました</div>
            </div>
          ))}

          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:13 }}>読込中...</div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign:"center", padding:40 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>まだフレンドがいません</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>上のID検索か「スキャン」でフレンドを追加してください</div>
            </div>
          ) : (
            friends.map(f => {
              const shareStatus = shiftShareStatuses[f.id];
              const isAccepted = shareStatus?.status === "accepted";
              const isPending  = shareStatus?.status === "pending";
              return (
                <div key={f.id} style={{ backgroundColor:C.card, borderRadius:12, border:`1px solid ${C.border}`, marginBottom:8, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", backgroundColor:C.accentGlow, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                      {f.avatar_preset || "🚕"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{f.name || "ドライバー"}</div>
                      {f.display_id && <div style={{ fontSize:10, color:C.accentLight }}>{f.display_id}</div>}
                      {f.areas?.length > 0 && <div style={{ fontSize:11, color:C.muted }}>{f.areas[0]}</div>}
                    </div>
                    <button onClick={() => handleRemoveFriend(f.id)} disabled={removingId === f.id}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:11, fontWeight:600, border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted, cursor:"pointer" }}>
                      {removingId === f.id ? "…" : "削除"}
                    </button>
                  </div>
                  {/* シフト共有ボタン */}
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"8px 14px" }}>
                    <button
                      onClick={() => !isAccepted && !isPending && handleSendShiftShare(f.id)}
                      disabled={isAccepted || isPending || shiftShareLoading === f.id}
                      style={{
                        width:"100%", padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:700, cursor: isAccepted||isPending ? "default" : "pointer",
                        border:`1.5px solid ${isAccepted ? C.green : isPending ? C.accentLight : C.border}`,
                        backgroundColor: isAccepted ? C.green+"22" : isPending ? C.accentGlow : "transparent",
                        color: isAccepted ? C.green : isPending ? C.accentLight : C.muted,
                      }}>
                      {shiftShareLoading === f.id ? "…"
                        : isAccepted ? "✓ シフト共有中"
                        : isPending && shareStatus?.isSender ? "📅 承認待ち"
                        : isPending ? "📅 申請が届いています"
                        : "📅 シフトを共有する"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── フレンドの日報 ─── */}
      {tab === "feed" && (
        <div style={{ padding:"0 16px" }}>
          {friends.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:13 }}>フレンドを追加すると日報が見られます</div>
          ) : friendReports.length === 0 ? (
            <div style={{ textAlign:"center", padding:40 }}>
              <div style={{ fontSize:13, color:C.muted }}>フレンドがまだ日報を共有していません</div>
            </div>
          ) : (
            friendReports.map(r => <FriendReportCard key={r.id} report={r} />)
          )}
        </div>
      )}

      {/* ─── フレンドのシフト ─── */}
      {tab === "shifts" && (
        <div style={{ padding:"0 16px" }}>
          {friends.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:13 }}>フレンドを追加するとシフトが見られます</div>
          ) : friendShifts.length === 0 ? (
            <div style={{ textAlign:"center", padding:40 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
              <div style={{ fontSize:13, color:C.muted }}>フレンドがまだシフトを共有していません</div>
            </div>
          ) : (
            friendShifts.map(s => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", backgroundColor:C.card, borderRadius:12, border:`1px solid ${C.border}`, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", backgroundColor:C.green+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                  {s.avatarPreset || "🚕"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.userName}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{fmtDate(s.shift_date)}</div>
                  {(s.clock_in || s.clock_out) && (
                    <div style={{ fontSize:12, color:C.green, marginTop:2 }}>
                      🕐 {s.clock_in||"—"}〜{s.clock_out||"—"}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 日報を共有 ─── */}
      {tab === "share" && (
        <div style={{ padding:"0 16px" }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.7 }}>
            共有した日報はフレンド全員に公開されます。<br/>売上・乗車回数・勤務時間・実車率が表示されます。
          </div>
          {reports.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:C.muted, fontSize:13 }}>日報がまだありません</div>
          ) : (
            reports.slice(0, 30).map(r => {
              const isShared = sharedIds.has(r.id);
              const isLoading = shareLoading === r.id;
              return (
                <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", backgroundColor:C.card, borderRadius:12, border:`1px solid ${isShared?C.accentLight+"66":C.border}`, marginBottom:8, transition:"border 0.15s" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmtDate(r.date || r.report_date)}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>¥{fmt(r.gross_sales)}{r.ride_count != null ? ` / ${r.ride_count}回` : ""}</div>
                  </div>
                  <button onClick={() => handleToggleShare(r.id)} disabled={isLoading || !r.id}
                    style={{ padding:"8px 16px", borderRadius:10, fontSize:12, fontWeight:700, border:`1.5px solid ${isShared?C.accentLight:C.border}`, backgroundColor:isShared?C.accentLight:C.card, color:isShared?"#fff":C.muted, cursor:r.id?"pointer":"not-allowed", transition:"all 0.15s", opacity:isLoading?0.5:1 }}>
                    {isLoading ? "…" : isShared ? "✓ 共有中" : "共有"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* QRモーダル */}
      {showQR && <QRModal userId={user?.id} userName={user?.name} onClose={() => setShowQR(false)} />}

      {/* スキャナー */}
      {showScanner && <QRScanner onScanned={handleScanned} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
