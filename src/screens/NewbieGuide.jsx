// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NewbieGuide.jsx — 新人コース（3章構成）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { Card } from "../components/UI";

const CHAPTERS = [
  {
    id: "basics",
    label: "第1章",
    title: "タクシードライバーの基本",
    icon: "🚕",
    color: "#3b82f6",
    sections: [
      {
        title: "乗客への第一印象",
        body: "お客様が乗り込んだ瞬間の印象が、その後の乗車体験を決めます。乗車時はすぐに「いらっしゃいませ、どちらまでですか？」と声をかけましょう。目線をミラー越しにお客様へ向けるだけでも好印象につながります。",
      },
      {
        title: "シートベルト・安全の声がけ",
        body: "発車前に「シートベルトをお締めください」と一言添えるのは義務であり、プロとしての基本です。外国人のお客様には「Please fasten your seatbelt.」と英語でも伝えましょう。",
      },
      {
        title: "目的地の確認",
        body: "行き先を告げられたら必ず復唱して確認します。「〇〇でよろしいですか？」この一言でトラブルを防げます。住所が分からない場合は「地図やナビで見せていただけますか？」と遠慮なく聞きましょう。",
      },
      {
        title: "車内での会話・沈黙",
        body: "会話を求めるお客様には自然に応じ、静かにしていたいお客様には無理に話しかけない。この空気を読む力が長くお客様に選ばれるドライバーの特徴です。音楽・ラジオは音量を控えめに。",
      },
      {
        title: "料金・お釣りの扱い",
        body: "到着時は料金をはっきり伝え、お釣りは素早く正確に渡します。「〇〇円になります」「お釣り〇〇円でございます」と声に出すと信頼感が増します。領収書は聞かれる前に「領収書はいかがですか？」と一言添えましょう。",
      },
      {
        title: "禁止事項・NG行動",
        body: "スマートフォンの操作・急ブレーキ・乗車拒否（正当な理由なし）・差別的な言動は厳禁です。特に乗車拒否は道路運送法違反となり、免許停止の対象になる場合があります。",
      },
    ],
  },
  {
    id: "earnings",
    label: "第2章",
    title: "売上を上げるコツ",
    icon: "💰",
    color: "#10b981",
    sections: [
      {
        title: "需要の高い時間帯を知る",
        body: "深夜0〜2時（終電後）・通勤ラッシュ（7〜9時・17〜19時）・雨天・連休前夜は需要が急増します。この時間帯に合わせてシフトを組むだけで売上は大きく変わります。",
      },
      {
        title: "需要の高いエリアを押さえる",
        body: "繁華街・駅前・ホテル周辺・空港は常に需要があります。自分の営業エリアでの「つけ場所」を見つけることが重要です。タクローの「マイポイント」機能で稼げた場所を記録し、パターンを掴みましょう。",
      },
      {
        title: "回転率 vs 長距離の判断",
        body: "短距離を多くこなす「回転重視」と、空港・郊外などの長距離を狙う「単価重視」、どちらが合うかは時間帯とエリアによります。まずは両方試して、自分の営業スタイルを見つけましょう。",
      },
      {
        title: "雨・イベント・特需を狙う",
        body: "雨の日はタクシー需要が1.5〜2倍になることも。コンサートやスポーツイベントの終了時刻に会場付近に居ると乗車率が上がります。地元のイベント情報を日頃からチェックしておきましょう。",
      },
      {
        title: "日報で振り返る習慣をつける",
        body: "稼げた日・稼げなかった日の違いは何だったか？乗車記録を振り返ると必ずパターンが見えてきます。タクローの日報記録・分析機能を使って、自分の「稼げる条件」を見つけましょう。",
      },
      {
        title: "目標を立てて逆算する",
        body: "「今月50万円稼ぎたい」なら、1日あたり・1時間あたりにいくら必要か計算します。タクローのホーム画面で目標額を設定すると、達成率がリアルタイムで確認できます。",
      },
    ],
  },
  {
    id: "app",
    label: "第3章",
    title: "タクローの使い方",
    icon: "🦉",
    color: "#8b5cf6",
    sections: [
      {
        title: "日報を記録する（手動）",
        body: "「＋記録」ボタンから日報を入力できます。勤務時間・乗車回数・売上・エリアを記録するだけでOK。毎日続けることで分析の精度が上がります。面倒なときは最低限「売上」だけでも入力しておきましょう。",
      },
      {
        title: "OCR読み取り機能を使う",
        body: "会社の日報（紙）をカメラで撮影すると、AIが自動で数字を読み取ります。「＋記録」→「日報写真から読み取る」から使えます。読み取り精度は日報のフォーマットによりますが、グリーンキャブ形式には対応済みです。",
      },
      {
        title: "略語を登録する（備考欄）",
        body: "日報の備考欄に「電」「ク」「Q」などの略語がある場合、初回読み取り時に意味を登録できます。一度登録すれば次回から自動で支払い方法に変換されます。",
      },
      {
        title: "分析画面を活用する",
        body: "ホーム画面のモード切替で「分析モード」にすると、日別・週別・月別のグラフやAIアドバイスが表示されます。どの時間帯・エリアが稼ぎやすいかが一目でわかります。",
      },
      {
        title: "英語フレーズを使う",
        body: "メニュー→「英語フレーズ」から、外国人乗客との会話に使えるフレーズが確認できます。🔊ボタンで発音を聞くこともできます。乗客が言いそうなフレーズも載っているので、ぜひ事前に確認しておきましょう。",
      },
      {
        title: "マイポイントで稼ぎ場所を記録",
        body: "メニュー→「マイポイント」から、GPSで現在地を記録できます。稼げた場所・時間帯をメモしておくと、後から振り返るときに役立ちます。経験が積まれるほど、あなただけの「勝ちパターン」ができていきます。",
      },
    ],
  },
];

export default function NewbieGuide({ onBack }) {
  const [activeChapter, setActiveChapter] = useState("basics");
  const [openSection, setOpenSection] = useState(null);

  const chapter = CHAPTERS.find(c => c.id === activeChapter);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 100px" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {onBack && (
          <div onClick={onBack} style={{ cursor: "pointer", fontSize: 20, padding: "4px 8px", borderRadius: 8, color: C.muted }}>←</div>
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🎓 新人コース</div>
          <div style={{ fontSize: 12, color: C.muted }}>タクシードライバーの基礎を3章で学ぼう</div>
        </div>
      </div>

      {/* 章タブ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {CHAPTERS.map(ch => (
          <div key={ch.id} onClick={() => { setActiveChapter(ch.id); setOpenSection(null); }}
            style={{
              flex: 1, padding: "10px 6px", borderRadius: 12, textAlign: "center",
              cursor: "pointer", border: `2px solid ${activeChapter === ch.id ? ch.color : C.border}`,
              backgroundColor: activeChapter === ch.id ? ch.color + "18" : "transparent",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>{ch.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: activeChapter === ch.id ? ch.color : C.muted }}>{ch.label}</div>
          </div>
        ))}
      </div>

      {/* 章タイトル */}
      <div style={{
        padding: "14px 16px", borderRadius: 14, marginBottom: 16,
        backgroundColor: chapter.color + "18", border: `1.5px solid ${chapter.color}44`,
      }}>
        <div style={{ fontSize: 11, color: chapter.color, fontWeight: 700, marginBottom: 2 }}>{chapter.label}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{chapter.icon} {chapter.title}</div>
      </div>

      {/* セクション一覧（アコーディオン） */}
      {chapter.sections.map((sec, idx) => {
        const isOpen = openSection === idx;
        return (
          <Card key={idx} style={{ marginBottom: 10, cursor: "pointer", padding: "14px 16px" }}
            onClick={() => setOpenSection(isOpen ? null : idx)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                backgroundColor: chapter.color + "22", color: chapter.color,
                fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              }}>{idx + 1}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{sec.title}</div>
              <div style={{ fontSize: 12, color: C.muted, flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</div>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.sub, lineHeight: 1.75 }}>
                {sec.body}
              </div>
            )}
          </Card>
        );
      })}

      {/* 章ナビボタン */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 10 }}>
        {CHAPTERS.findIndex(c => c.id === activeChapter) > 0 && (
          <div onClick={() => {
            const idx = CHAPTERS.findIndex(c => c.id === activeChapter);
            setActiveChapter(CHAPTERS[idx - 1].id);
            setOpenSection(null);
          }} style={{ flex: 1, padding: "13px 0", textAlign: "center", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.muted, cursor: "pointer" }}>
            ← 前の章
          </div>
        )}
        {CHAPTERS.findIndex(c => c.id === activeChapter) < CHAPTERS.length - 1 && (
          <div onClick={() => {
            const idx = CHAPTERS.findIndex(c => c.id === activeChapter);
            setActiveChapter(CHAPTERS[idx + 1].id);
            setOpenSection(null);
          }} style={{ flex: 1, padding: "13px 0", textAlign: "center", borderRadius: 12, backgroundColor: chapter.color, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            次の章 →
          </div>
        )}
      </div>
    </div>
  );
}
