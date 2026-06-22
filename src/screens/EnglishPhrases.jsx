// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EnglishPhrases.jsx — 外国人客向けタクシー英語フレーズ集
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { useState } from "react";
import { C } from "../lib/constants";
import { Card } from "../components/UI";

const CATEGORIES = [
  {
    id: "passenger",
    label: "乗客フレーズ",
    icon: "🙋",
    phrases: [
      { jp: "〇〇まで行ってください。", en: "Please take me to [destination].", phonetic: "プリーズ テイク ミー トゥ [デスティネーション]。" },
      { jp: "急いでいます。", en: "I'm in a hurry.", phonetic: "アイム イン ア ハリー。" },
      { jp: "まっすぐ進んでください。", en: "Please go straight.", phonetic: "プリーズ ゴー ストレート。" },
      { jp: "次の角を左に曲がってください。", en: "Please turn left at the next corner.", phonetic: "プリーズ ターン レフト アット ザ ネクスト コーナー。" },
      { jp: "ここで止めてください。", en: "Please stop here.", phonetic: "プリーズ ストップ ヒア。" },
      { jp: "いくらかかりますか？", en: "How much will it cost?", phonetic: "ハウ マッチ ウィル イット コスト？" },
      { jp: "どのくらい時間がかかりますか？", en: "How long will it take?", phonetic: "ハウ ロング ウィル イット テイク？" },
      { jp: "クレジットカードは使えますか？", en: "Do you accept credit cards?", phonetic: "ドゥー ユー アクセプト クレジット カーズ？" },
      { jp: "領収書をください。", en: "Can I have a receipt?", phonetic: "キャナイ ハブ ア レシート？" },
      { jp: "おつりはいりません。", en: "Keep the change.", phonetic: "キープ ザ チェンジ。" },
      { jp: "英語は話せますか？", en: "Do you speak English?", phonetic: "ドゥー ユー スピーク イングリッシュ？" },
      { jp: "ナビに従ってください。", en: "Please follow the navigation.", phonetic: "プリーズ フォロー ザ ナビゲーション。" },
    ],
  },
  {
    id: "greeting",
    label: "あいさつ・乗車",
    icon: "👋",
    phrases: [
      { jp: "こんにちは。どちらへ行かれますか？", en: "Hello. Where would you like to go?", phonetic: "ハロー。ウェアー ウッジュー ライク トゥ ゴー？" },
      { jp: "どちらまでですか？（カジュアル）", en: "Where to?", phonetic: "ウェアー トゥ？" },
      { jp: "どちらへお連れしましょうか？", en: "Where may I take you?", phonetic: "ウェアー メイ アイ テイク ユー？" },
      { jp: "シートベルトをお締めください。", en: "Please fasten your seatbelt.", phonetic: "プリーズ ファッスン ユア シートベルト。" },
      { jp: "荷物をトランクに入れましょうか？", en: "Shall I put your luggage in the trunk?", phonetic: "シャライ プット ユア ラゲッジ イン ザ トランク？" },
      { jp: "了解です。", en: "Sure.", phonetic: "シュアー。" },
    ],
  },
  {
    id: "route",
    label: "ルート・道案内",
    icon: "🗺️",
    phrases: [
      { jp: "高速道路を使いますか？", en: "Would you like to take the expressway?", phonetic: "ウッジュー ライク トゥ テイク ジ エクスプレスウェイ？" },
      { jp: "高速は別料金になります。", en: "There will be an extra fee for the highway.", phonetic: "ゼア ウィル ビー アン エクストラ フィー フォー ザ ハイウェイ。" },
      { jp: "渋滞にはまっています。", en: "We are stuck in traffic.", phonetic: "ウィー アー スタック イン トラフィック。" },
      { jp: "渋滞を避けて別ルートを取ってもいいですか？", en: "Can I take a detour to avoid the traffic?", phonetic: "キャナイ テイク ア ディツアー トゥ アヴォイド ザ トラフィック？" },
      { jp: "どこで降りますか？", en: "Where would you like to get off?", phonetic: "ウェアー ウッジュー ライク トゥ ゲット オフ？" },
      { jp: "もうすぐ到着します。", en: "We will arrive soon.", phonetic: "ウィー ウィル アライブ スーン。" },
    ],
  },
  {
    id: "payment",
    label: "料金・支払い",
    icon: "💳",
    phrases: [
      { jp: "料金は〇〇円です。", en: "It's [amount] yen.", phonetic: "イッツ [アマウント] エン。" },
      { jp: "お支払い方法はどうしますか？", en: "How would you like to pay?", phonetic: "ハウ ウッジュー ライク トゥ ペイ？" },
      { jp: "クレジットカードをお取り扱いしています。", en: "We accept credit cards.", phonetic: "ウィー アクセプト クレジット カーズ。" },
      { jp: "現金のみとなります。", en: "Cash only, please.", phonetic: "キャッシュ オンリー、プリーズ。" },
      { jp: "おつりはこちらです。", en: "Here is your change.", phonetic: "ヒアー イズ ユア チェンジ。" },
      { jp: "領収書はいかがですか？", en: "Would you like a receipt?", phonetic: "ウッジュー ライク ア レシート？" },
    ],
  },
  {
    id: "trouble",
    label: "困ったとき",
    icon: "🆘",
    phrases: [
      { jp: "申し訳ありません、英語が得意ではありません。", en: "I'm sorry, my English is limited.", phonetic: "アイム ソーリー、マイ イングリッシュ イズ リミティッド。" },
      { jp: "住所を書いていただけますか？", en: "Could you write down the address?", phonetic: "クッジュー ライト ダウン ジ アドレス？" },
      { jp: "地図で目的地を見せていただけますか？", en: "Could you show me the destination on the map?", phonetic: "クッジュー ショーミー ザ デスティネーション オン ザ マップ？" },
      { jp: "地図を確認します。", en: "I'll check the map.", phonetic: "アイル チェック ザ マップ。" },
      { jp: "少々お待ちください。", en: "Just a moment, please.", phonetic: "ジャスト ア モーメント、プリーズ。" },
      { jp: "この辺は詳しくなくて申し訳ありません。", en: "I'm sorry, I'm not familiar with this area.", phonetic: "アイム ソーリー、アイム ナット ファミリアー ウィズ ジス エリア。" },
    ],
  },
  {
    id: "comfort",
    label: "快適な乗車",
    icon: "😊",
    phrases: [
      { jp: "エアコンの温度を調整しましょうか？", en: "Would you like me to adjust the temperature?", phonetic: "ウッジュー ライク ミー トゥ アジャスト ザ テンパラチャー？" },
      { jp: "左手に〇〇が見えます。", en: "You can see [landmark] on your left.", phonetic: "ユー キャン シー [ランドマーク] オン ユア レフト。" },
      { jp: "忘れ物はありませんか？", en: "Do you have everything?", phonetic: "ドゥー ユー ハブ エブリシング？" },
      { jp: "ご乗車ありがとうございました。", en: "Thank you for your ride.", phonetic: "サンキュー フォー ユア ライド。" },
      { jp: "よい一日を！", en: "Have a nice day!", phonetic: "ハブ ア ナイス デイ！" },
      { jp: "日本滞在をお楽しみください。", en: "Enjoy your stay in Japan.", phonetic: "エンジョイ ユア ステイ イン ジャパン。" },
    ],
  },
  {
    id: "airport",
    label: "空港・定額",
    icon: "✈️",
    phrases: [
      { jp: "どのターミナルですか？", en: "Which terminal?", phonetic: "ウィッチ ターミナル？" },
      { jp: "羽田空港は定額料金があります。", en: "There's a fixed fare for Haneda Airport.", phonetic: "ゼアーズ ア フィックスト フェアー フォー ハネダ エアポート。" },
      { jp: "成田空港まで約〇〇円です。", en: "It's about [amount] yen to Narita Airport.", phonetic: "イッツ アバウト [アマウント] エン トゥ ナリタ エアポート。" },
      { jp: "空港まで約〇〇分かかります。", en: "It takes about [X] minutes to the airport.", phonetic: "イット テイクス アバウト [X] ミニッツ トゥ ジ エアポート。" },
      { jp: "フライトはいかがでしたか？", en: "How was your flight?", phonetic: "ハウ ウォズ ユア フライト？" },
      { jp: "深夜料金が加算されます。", en: "There is an additional charge for late-night service.", phonetic: "ゼア イズ アン アディショナル チャージ フォー レイトナイト サービス。" },
    ],
  },
];

export default function EnglishPhrases({ onBack }) {
  const [activeCategory, setActiveCategory] = useState("passenger");
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState(null);

  const category = CATEGORIES.find(c => c.id === activeCategory);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const speak = (text, idx) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.82;
      utter.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.name === "Samantha") ||
        voices.find(v => /Karen|Daniel|Moira/.test(v.name) && v.lang.startsWith("en")) ||
        voices.find(v => v.name.includes("Google") && v.lang === "en-US") ||
        voices.find(v => v.lang === "en-US" && !v.name.includes("Compact")) ||
        voices.find(v => v.lang.startsWith("en"));
      if (preferred) utter.voice = preferred;
      utter.onstart = () => setSpeakingIdx(idx);
      utter.onend = () => setSpeakingIdx(null);
      utter.onerror = () => setSpeakingIdx(null);
      window.speechSynthesis.speak(utter);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    }
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
        <Card key={idx} style={{ marginBottom:10, position:"relative" }}>
          {/* 日本語 */}
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>{phrase.jp}</div>
          {/* 英語（メイン）＋アクションボタン */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:showPhonetic?4:0, lineHeight:1.4 }}>
                {phrase.en}
              </div>
              {showPhonetic && (
                <div style={{ fontSize:11, color:C.accentLight, fontWeight:500 }}>{phrase.phonetic}</div>
              )}
            </div>
            {/* ボタン群 */}
            <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
              {/* 読み上げボタン */}
              <div onClick={() => speak(phrase.en, idx)}
                style={{ width:34, height:34, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", fontSize:16,
                  backgroundColor: speakingIdx===idx ? C.accentLight+"33" : C.border+"33",
                  border:`1.5px solid ${speakingIdx===idx ? C.accentLight : C.border}` }}>
                {speakingIdx===idx ? "⏸" : "🔊"}
              </div>
              {/* コピーボタン */}
              <div onClick={() => copyToClipboard(phrase.en, idx)}
                style={{ width:34, height:34, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", fontSize:14,
                  backgroundColor: copiedIdx===idx ? "#22c55e22" : C.border+"33",
                  border:`1.5px solid ${copiedIdx===idx ? C.green : C.border}` }}>
                {copiedIdx===idx ? "✓" : "📋"}
              </div>
            </div>
          </div>
        </Card>
      ))}

      <div style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:8 }}>
        🔊 で読み上げ・📋 でコピー
      </div>
    </div>
  );
}
