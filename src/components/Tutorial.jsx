// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tutorial.jsx — コーチマーク型チュートリアル
// オンボーディング直後に自動スタート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { C, saveS } from "../lib/constants";

const STEPS = [
  {
    id: "upload",
    target: '[data-tutorial="upload-tab"]',
    title: "📸 日報を登録する",
    desc: "真ん中の「＋」をタップ！日報を撮影するだけでAIが金額・乗車回数を自動で読み取ります。",
  },
  {
    id: "ride-record",
    target: '[data-tutorial="ride-record-btn"]',
    title: "🚕 乗車を記録する",
    desc: "「＋ 記録する」をタップして乗車ごとに記録。乗車場所・運賃・支払い方法を残せます。",
  },
];

// スポットライトの位置からツールチップの配置を決める
function calcTooltipStyle(spotRect) {
  if (!spotRect) return { left: 16, right: 16, bottom: 140 };
  const H = window.innerHeight;
  const centerY = spotRect.y + spotRect.h / 2;
  const PAD = 16;
  if (centerY > H * 0.55) {
    // 下半分 → ツールチップを上に
    return { left: PAD, right: PAD, bottom: H - spotRect.y + 24 };
  } else {
    // 上半分 → ツールチップを下に
    return { left: PAD, right: PAD, top: spotRect.y + spotRect.h + 24 };
  }
}

// ━━━ メイン ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Tutorial({ onComplete, onSetTarget }) {
  const [step,           setStep]           = useState(0);
  const [spotRect,       setSpotRect]       = useState(null);
  const [showTargetStep, setShowTargetStep] = useState(false);

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  // ターゲット要素の位置を取得
  const measureTarget = useCallback(() => {
    if (!current?.target) return;
    const el = document.querySelector(current.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpotRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [current?.target]);

  useLayoutEffect(() => {
    setSpotRect(null);
    const t = setTimeout(measureTarget, 300);
    return () => clearTimeout(t);
  }, [step, measureTarget]);

  // リサイズ対応
  useEffect(() => {
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [measureTarget]);

  const handleNext = () => {
    if (isLast) {
      setShowTargetStep(true);
    } else {
      setStep(s => s + 1);
    }
  };

  const handleFinish = () => {
    saveS("taxi_tutorial_done", true);
    onComplete();
  };

  // ━━━ Step 3: 月間目標（オプション） ━━━━━━━━━━━━━━
  if (showTargetStep) {
    return (
      <div style={{
        position:"fixed", inset:0, backgroundColor:"#000000bb", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center", padding:24,
      }}>
        <div style={{
          backgroundColor:C.surface, borderRadius:22, padding:"28px 24px",
          width:"100%", maxWidth:360, textAlign:"center",
        }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🎯</div>
          <div style={{ fontSize:17, fontWeight:800, marginBottom:10, color:C.text }}>
            月間目標を設定すると…
          </div>
          <div style={{
            fontSize:13, color:C.sub, lineHeight:1.9, marginBottom:24,
            backgroundColor:C.accentGlow, border:`1px solid ${C.accentLight}33`,
            borderRadius:12, padding:"12px 16px",
          }}>
            ✅ 「今日必要な売上」が自動で計算<br/>
            ✅ 達成率がグラフで確認できる<br/>
            ✅ あとからいつでも変更可能
          </div>
          <button
            onClick={() => { onSetTarget?.(); handleFinish(); }}
            style={{
              width:"100%", padding:"14px 0", borderRadius:12, fontSize:15,
              fontWeight:700, cursor:"pointer", border:"none",
              backgroundColor:C.accentLight, color:"#fff", marginBottom:12,
            }}>
            🎯 目標を設定する
          </button>
          <button
            onClick={handleFinish}
            style={{
              width:"100%", padding:"12px 0", borderRadius:12, fontSize:13,
              fontWeight:600, cursor:"pointer",
              border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted,
            }}>
            あとで設定する
          </button>
        </div>
      </div>
    );
  }

  // ━━━ Step 1・2: スポットライト型コーチマーク ━━━━━━
  const W = typeof window !== "undefined" ? window.innerWidth  : 390;
  const H = typeof window !== "undefined" ? window.innerHeight : 844;
  const PAD = 14, RADIUS = 16;
  const tooltipStyle = calcTooltipStyle(spotRect);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999 }}>

      {/* ── SVGオーバーレイ（スポットライト） ── */}
      <svg
        width={W} height={H}
        style={{ position:"absolute", inset:0, display:"block", pointerEvents:"none" }}
      >
        <defs>
          <mask id="tut-mask">
            <rect width={W} height={H} fill="white" />
            {spotRect && (
              <rect
                x={spotRect.x - PAD} y={spotRect.y - PAD}
                width={spotRect.w + PAD * 2} height={spotRect.h + PAD * 2}
                rx={RADIUS} fill="black"
              />
            )}
          </mask>
        </defs>
        {/* 暗幕 */}
        <rect width={W} height={H} fill="rgba(0,0,0,0.78)" mask="url(#tut-mask)" />
        {/* ハイライト枠 */}
        {spotRect && (
          <rect
            x={spotRect.x - PAD} y={spotRect.y - PAD}
            width={spotRect.w + PAD * 2} height={spotRect.h + PAD * 2}
            rx={RADIUS} fill="none"
            stroke={C.accentLight} strokeWidth={2.5}
            style={{ filter:`drop-shadow(0 0 8px ${C.accentLight}88)` }}
          />
        )}
      </svg>

      {/* ── ツールチップカード ── */}
      <div style={{ position:"absolute", pointerEvents:"auto", ...tooltipStyle }}>

        {/* ステップドット */}
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:10 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 7, height:7, borderRadius:99,
              backgroundColor: i === step ? C.accentLight : C.border,
              transition:"all 0.3s ease",
            }} />
          ))}
        </div>

        <div style={{
          backgroundColor:C.surface, borderRadius:18, padding:"20px 20px 16px",
          boxShadow:"0 8px 40px #00000066",
        }}>
          <div style={{ fontSize:16, fontWeight:800, marginBottom:8, color:C.text }}>
            {current.title}
          </div>
          <div style={{ fontSize:13, color:C.sub, lineHeight:1.8, marginBottom:18 }}>
            {current.desc}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button
              onClick={handleFinish}
              style={{
                flex:1, padding:"11px 0", borderRadius:10, fontSize:13,
                fontWeight:600, cursor:"pointer",
                border:`1px solid ${C.border}`, backgroundColor:"transparent", color:C.muted,
              }}>
              スキップ
            </button>
            <button
              onClick={handleNext}
              style={{
                flex:2, padding:"11px 0", borderRadius:10, fontSize:14,
                fontWeight:700, cursor:"pointer", border:"none",
                backgroundColor:C.accentLight, color:"#fff",
              }}>
              次へ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
