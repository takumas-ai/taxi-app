// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// オンボーディング（5ステップ）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";

const STEPS = [
  {
    emoji: "🦉",
    title: "はじめまして！",
    desc: "AIアシスタントのタクローだよ！一緒に売上を伸ばしていこう！",
    color: "#2563EB",
    sub: null,
  },
  {
    emoji: "📸",
    title: "日報を撮るだけでOK！",
    desc: "カメラで日報を撮るだけ！AIが金額・乗車回数・走行距離を自動で読み取るよ。",
    color: "#10B981",
    sub: "📸 カメラ撮影で自動入力 / ✏️ 手動入力も可",
  },
  {
    emoji: "📍",
    title: "乗り場情報をみんなで共有",
    desc: "乗り場のコツはみんなで共有！ドライバーが投稿・更新するリアルな情報が揃ってるよ。",
    color: "#F59E0B",
    sub: "🔥 需要スコア順・⭐ 評価順でソートできます",
  },
  {
    emoji: "🤖",
    title: "AIがアドバイスしてくれる",
    desc: "日報が3回分溜まったら、タクローがデータを分析して売上アップのアドバイスをするよ。",
    color: "#A855F7",
    sub: "💡 まず3回記録してみよう",
  },
  {
    emoji: "🎯",
    title: "準備完了！",
    desc: "疑問があればいつでも相談してね。さあ、はじめよう！",
    color: "#F59E0B",
    sub: null,
    bonus: true,
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: C.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "40px 28px 48px",
      fontFamily: "'Inter','Hiragino Sans',sans-serif",
      color: C.text,
    }}>
      {/* 上部：スキップ + ドット */}
      <div style={{ width: "100%", maxWidth: 400, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onComplete}
          style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
          スキップ
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 7,
              height: 7,
              borderRadius: 99,
              backgroundColor: i === step ? current.color : C.border,
              transition: "all 0.3s ease",
            }}/>
          ))}
        </div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 中央：メインコンテンツ */}
      <div style={{ textAlign: "center", maxWidth: 360, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

        {/* アイコン背景 */}
        <div style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          backgroundColor: current.color + "18",
          border: `2px solid ${current.color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 56,
          marginBottom: 28,
        }}>
          {current.emoji}
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 14, lineHeight: 1.3 }}>
          {current.title}
        </div>

        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.9, marginBottom: 16 }}>
          {current.desc}
        </div>

        {current.sub && (
          <div style={{
            backgroundColor: current.color + "12",
            border: `1px solid ${current.color}40`,
            borderRadius: 10,
            padding: "8px 16px",
            fontSize: 12,
            color: current.color,
            fontWeight: 600,
          }}>
            {current.sub}
          </div>
        )}

        {/* 最終ステップのXPボーナス表示 */}
        {current.bonus && (
          <div style={{
            marginTop: 20,
            backgroundColor: "#F59E0B18",
            border: "1px solid #F59E0B40",
            borderRadius: 14,
            padding: "16px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>チュートリアル完了ボーナス</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#F59E0B" }}>🏅 +50 XP</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>獲得しました！</div>
          </div>
        )}
      </div>

      {/* 下部：ボタン */}
      <div style={{ width: "100%", maxWidth: 400 }}>
        <button
          onClick={() => {
            if (isLast) onComplete();
            else setStep(s => s + 1);
          }}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
            border: "none",
            backgroundColor: current.color,
            color: "#fff",
            boxShadow: `0 4px 20px ${current.color}40`,
          }}>
          {isLast ? "🚀 さあ、はじめよう！" : "次へ →"}
        </button>

        {/* ステップ数表示 */}
        <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 12 }}>
          {step + 1} / {STEPS.length}
        </div>
      </div>
    </div>
  );
}
