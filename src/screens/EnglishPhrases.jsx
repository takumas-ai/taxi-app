// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EnglishPhrases.jsx — 外国人客向けタクシー英語フレーズ集
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { Card } from "../components/UI";

const CATEGORIES = [
  {
    id: "greeting",
    label: "あいさつ・乗車",
    icon: "👋",
    phrases: [
      { jp: "いらっしゃいませ、どちらまでですか？", en: "Welcome! Where would you like to go?", phonetic: "ウェルカム！ウェアー ウッジュー ライク トゥ ゴー？" },
      { jp: "行き先を教えてください。", en: "Could you tell me your destination?", phonetic: "クッジュー テルミー ユア デスティネーション？" },
      { jp: "地図で示していただけますか？", en: "Could you show me on the map?", phonetic: "クッジュー ショーミー オン ザ マップ？" },
      { jp: "了解しました。出発します。", en: "Got it. Let's go!", phonetic: "ガリット。レッツ ゴー！" },
      { jp: "シートベルトをお締めください。", en: "Please fasten your seatbelt.", phonetic: "プリーズ ファッスン ユア シートベルト。" },
    ],
  },
  {
    id: "route",
    label: "ルート・道案内",
    icon: "🗺️",
    phrases: [
      { jp: "高速道路を使ってもよいですか？", en: "Is it okay to use the expressway?", phonetic: "イジット オーケー トゥ ユーズ ジ エクスプレスウェイ？" },
      { jp: "高速料金は別途かかります。", en: "There's an additional toll fee.", phonetic: "ゼアーズ アン アディショナル トール フィー。" },
      { jp: "渋滞しています。別のルートを使ってもよいですか？", en: "There's traffic. Can I take an alternate route?", phonetic: "ゼアーズ トラフィック。キャナイ テイク アン オルタネート ルート？" },
      { jp: "もうすぐ到着します。", en: "We're almost there.", phonetic: "ウィアー オールモスト ゼア。" },
      { jp: "ここで止めますか？", en: "Should I stop here?", phonetic: "シュダイ ストップ ヒア？" },
    ],
  },
  {
    id: "payment",
    label: "料金・支払い",
    icon: "💳",
    phrases: [
      { jp: "料金は〇〇円です。", en: "The fare is [amount] yen.", phonetic: "ザ フェアー イズ [アマウント] エン。" },
      { jp: "現金のみとなります。", en: "Cash only, please.", phonetic: "キャッシュ オンリー、プリーズ。" },
      { jp: "クレジットカードは使えます。", en: "We accept credit cards.", phonetic: "ウィー アクセプト クレジット カーズ。" },
      { jp: "おつりはこちらです。", en: "Here's your change.", phonetic: "ヒアーズ ユア チェンジ。" },
      { jp: "領収書は必要ですか？", en: "Would you like a receipt?", phonetic: "ウッジュー ライク ア レシート？" },
    ],
  },
  {
    id: "trouble",
    label: "困ったとき",
    icon: "🆘",
    phrases: [
      { jp: "申し訳ありません、英語があまり得意ではありません。", en: "I'm sorry, my English is limited.", phonetic: "アイム ソーリー、マイ イングリッシュ イズ リミティッド。" },
      { jp: "住所を書いていただけますか？", en: "Could you write down the address?", phonetic: "クッジュー ライト ダウン ジ アドレス？" },
      { jp: "グーグルマップで目的地を見せてください。", en: "Please show me the destination on Google Maps.", phonetic: "プリーズ ショーミー ザ デスティネーション オン グーグル マップス。" },
      { jp: "少々お待ちください。", en: "Just a moment, please.", phonetic: "ジャスト ア モーメント、プリーズ。" },
      { jp: "到着しました。", en: "We have arrived.", phonetic: "ウィー ハブ アライブド。" },
    ],
  },
  {
    id: "comfort",
    label: "快適な乗車",
    icon: "😊",
    phrases: [
      { jp: "エアコンの温度を変えましょうか？", en: "Would you like me to adjust the temperature?", phonetic: "ウッジュー ライク ミー トゥ アジャスト ザ テンパラチャー？" },
      { jp: "荷物をトランクに入れましょうか？", en: "Shall I put your luggage in the trunk?", phonetic: "シャライ プット ユア ラゲッジ イン ザ トランク？" },
      { jp: "写真を撮りたいですか？少し待ちましょうか？", en: "Would you like to take a photo? Should I wait?", phonetic: "ウッジュー ライク トゥ テイク ア フォト？シュダイ ウェイト？" },
      { jp: "ありがとうございました。良い旅を！", en: "Thank you! Have a great trip!", phonetic: "サンキュー！ハブ ア グレート トリップ！" },
    ],
  },
  {
    id: "airport",
    label: "空港・定額",
    icon: "✈️",
    phrases: [
      { jp: "どのターミナルですか？", en: "Which terminal?", phonetic: "ウィッチ ターミナル？" },
      { jp: "羽田空港は定額料金です。", en: "There's a fixed fare for Haneda Airport.", phonetic: "ゼアーズ ア フィックスト フェアー フォー ハネダ エアポート。" },
      { jp: "成田空港まで約〇〇円かかります。", en: "It costs about [amount] yen to Narita Airport.", phonetic: "イット コスツ アバウト [アマウント] エン トゥ ナリタ エアポート。" },
      { jp: "フライトは何時ですか？時間は大丈夫そうです。", en: "What time is your flight? You should make it in time.", phonetic: "ワットタイム イズ ユア フライト？ユー シュッド メイキット イン タイム。" },
    ],
  },
];

export default function EnglishPhrases({ onBack }) {
  const [activeCategory, setActiveCategory] = useState("greeting");
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showPhonetic, setShowPhonetic] = useState(true);

  const category = CATEGORIES.find(c => c.id === activeCategory);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
      {/* ヘッダー */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        {onBack && (
          <div onClick={onBack} style={{ cursor:"pointer", fontSize:20, padding:"4px 8px", borderRadius:8, color:C.muted }}>←</div>
        )}
        <div>
          <div style={{ fontSize:18, fontWeight:800 }}>🌏 外国人客向け英語フレーズ</div>
          <div style={{ fontSize:12, color:C.muted }}>タップでコピー・音読みも表示できます</div>
        </div>
      </div>

      {/* カテゴリタブ */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:16, paddingBottom:4 }}>
        {CATEGORIES.map(cat => (
          <div key={cat.id} onClick={() => setActiveCategory(cat.id)}
            style={{ flexShrink:0, padding:"7px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
              border:`1.5px solid ${activeCategory===cat.id?C.accentLight:C.border}`,
              backgroundColor:activeCategory===cat.id?C.accentLight+"22":"transparent",
              color:activeCategory===cat.id?C.accentLight:C.muted, whiteSpace:"nowrap" }}>
            {cat.icon} {cat.label}
          </div>
        ))}
      </div>

      {/* 音読みトグル */}
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <div onClick={() => setShowPhonetic(p => !p)}
          style={{ fontSize:12, color:C.muted, cursor:"pointer", padding:"4px 10px",
            border:`1px solid ${C.border}`, borderRadius:20,
            backgroundColor:showPhonetic?C.accentLight+"22":"transparent" }}>
          {showPhonetic ? "🔤 音読みを非表示" : "🔤 音読みを表示"}
        </div>
      </div>

      {/* フレーズ一覧 */}
      {category?.phrases.map((phrase, idx) => (
        <Card key={idx} style={{ marginBottom:10, cursor:"pointer", position:"relative" }}
          onClick={() => copyToClipboard(phrase.en, idx)}>
          {/* コピー完了表示 */}
          {copiedIdx === idx && (
            <div style={{ position:"absolute", top:8, right:10, fontSize:11, color:C.green, fontWeight:700 }}>✓ コピー</div>
          )}
          {/* 日本語 */}
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>{phrase.jp}</div>
          {/* 英語（メイン） */}
          <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:showPhonetic?4:0, lineHeight:1.4 }}>
            {phrase.en}
          </div>
          {/* 音読み */}
          {showPhonetic && (
            <div style={{ fontSize:11, color:C.accentLight, fontWeight:500 }}>{phrase.phonetic}</div>
          )}
          {/* コピーヒント */}
          {copiedIdx !== idx && (
            <div style={{ position:"absolute", top:10, right:10, fontSize:11, color:C.border }}>📋</div>
          )}
        </Card>
      ))}

      <div style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:8 }}>
        英語部分をタップするとクリップボードにコピーされます
      </div>
    </div>
  );
}
