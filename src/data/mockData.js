// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// モックデータ（Cowork移行時: Supabaseのシードデータに変換）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─────────────────────────────────────────
// 区・市レベルのエリアマスタ（単価統計用）
// 親エリア（AREA_MASTER）→ 子エリア（WORK_AREA_MASTER）の2段構造
// ─────────────────────────────────────────
export const WORK_AREA_MASTER = {
  // 東京都心 → 23区
  "港区":    { parent:"東京都心", color:"#8B5CF6" },
  "渋谷区":  { parent:"東京都心", color:"#8B5CF6" },
  "新宿区":  { parent:"東京都心", color:"#8B5CF6" },
  "千代田区":{ parent:"東京都心", color:"#8B5CF6" },
  "中央区":  { parent:"東京都心", color:"#8B5CF6" },
  "品川区":  { parent:"東京都心", color:"#8B5CF6" },
  "目黒区":  { parent:"東京都心", color:"#8B5CF6" },
  "世田谷区":{ parent:"東京都心", color:"#8B5CF6" },
  "台東区":  { parent:"東京都心", color:"#8B5CF6" },
  "墨田区":  { parent:"東京都心", color:"#8B5CF6" },
  "江東区":  { parent:"東京都心", color:"#8B5CF6" },
  "豊島区":  { parent:"東京都心", color:"#8B5CF6" },
  "文京区":  { parent:"東京都心", color:"#8B5CF6" },
  "荒川区":  { parent:"東京都心", color:"#8B5CF6" },
  "北区":    { parent:"東京都心", color:"#8B5CF6" },
  "足立区":  { parent:"東京都心", color:"#8B5CF6" },
  "葛飾区":  { parent:"東京都心", color:"#8B5CF6" },
  "江戸川区":{ parent:"東京都心", color:"#8B5CF6" },
  "板橋区":  { parent:"東京都心", color:"#8B5CF6" },
  "練馬区":  { parent:"東京都心", color:"#8B5CF6" },
  "杉並区":  { parent:"東京都心", color:"#8B5CF6" },
  "中野区":  { parent:"東京都心", color:"#8B5CF6" },
  "大田区":  { parent:"東京都心", color:"#8B5CF6" },
  // 横浜 → 市内の区
  "西区（横浜）":  { parent:"横浜", color:"#3B82F6" },
  "中区（横浜）":  { parent:"横浜", color:"#3B82F6" },
  "神奈川区":      { parent:"横浜", color:"#3B82F6" },
  "鶴見区":        { parent:"横浜", color:"#3B82F6" },
  "港北区":        { parent:"横浜", color:"#3B82F6" },
  "都筑区":        { parent:"横浜", color:"#3B82F6" },
  "青葉区":        { parent:"横浜", color:"#3B82F6" },
  "緑区（横浜）":  { parent:"横浜", color:"#3B82F6" },
  "保土ケ谷区":    { parent:"横浜", color:"#3B82F6" },
  "旭区":          { parent:"横浜", color:"#3B82F6" },
  "瀬谷区":        { parent:"横浜", color:"#3B82F6" },
  "泉区":          { parent:"横浜", color:"#3B82F6" },
  "戸塚区":        { parent:"横浜", color:"#3B82F6" },
  "栄区":          { parent:"横浜", color:"#3B82F6" },
  "港南区":        { parent:"横浜", color:"#3B82F6" },
  "磯子区":        { parent:"横浜", color:"#3B82F6" },
  "南区（横浜）":  { parent:"横浜", color:"#3B82F6" },
  "金沢区":        { parent:"横浜", color:"#3B82F6" },
  // 川崎 → 市内の区
  "川崎区":        { parent:"川崎", color:"#10B981" },
  "幸区":          { parent:"川崎", color:"#10B981" },
  "中原区":        { parent:"川崎", color:"#10B981" },
  "高津区":        { parent:"川崎", color:"#10B981" },
  "宮前区":        { parent:"川崎", color:"#10B981" },
  "多摩区":        { parent:"川崎", color:"#10B981" },
  "麻生区":        { parent:"川崎", color:"#10B981" },
  // 千葉・埼玉・大阪・名古屋 → 主要市区
  "千葉市中央区":  { parent:"千葉", color:"#F59E0B" },
  "船橋市":        { parent:"千葉", color:"#F59E0B" },
  "幕張・美浜区":  { parent:"千葉", color:"#F59E0B" },
  "成田市":        { parent:"千葉", color:"#F59E0B" },
  "さいたま市大宮区": { parent:"埼玉", color:"#EF4444" },
  "さいたま市浦和区": { parent:"埼玉", color:"#EF4444" },
  "川口市":        { parent:"埼玉", color:"#EF4444" },
  "大阪市北区":    { parent:"大阪", color:"#F97316" },
  "大阪市中央区":  { parent:"大阪", color:"#F97316" },
  "大阪市浪速区":  { parent:"大阪", color:"#F97316" },
  "名古屋市中区":  { parent:"名古屋", color:"#06B6D4" },
  "名古屋市中村区":{ parent:"名古屋", color:"#06B6D4" },
};

// 親エリアごとのワークエリア一覧（選択UIで使用）
export const WORK_AREAS_BY_PARENT = Object.entries(WORK_AREA_MASTER).reduce((acc, [name, meta]) => {
  if (!acc[meta.parent]) acc[meta.parent] = [];
  acc[meta.parent].push(name);
  return acc;
}, {});

// エリア別単価統計モックデータ（本番: Supabaseの集計クエリに差し替え）
export const MOCK_AREA_STATS = [
  // 東京都心
  { area:"港区",     parent:"東京都心", avg_unit:3280, avg_occ:62, sample:142, trend:"up"   },
  { area:"渋谷区",   parent:"東京都心", avg_unit:3150, avg_occ:58, sample:98,  trend:"up"   },
  { area:"新宿区",   parent:"東京都心", avg_unit:2980, avg_occ:55, sample:134, trend:"flat" },
  { area:"千代田区", parent:"東京都心", avg_unit:3420, avg_occ:64, sample:87,  trend:"up"   },
  { area:"中央区",   parent:"東京都心", avg_unit:3200, avg_occ:60, sample:76,  trend:"flat" },
  { area:"品川区",   parent:"東京都心", avg_unit:2850, avg_occ:54, sample:112, trend:"down" },
  { area:"目黒区",   parent:"東京都心", avg_unit:3050, avg_occ:57, sample:63,  trend:"up"   },
  { area:"世田谷区", parent:"東京都心", avg_unit:2720, avg_occ:51, sample:89,  trend:"flat" },
  { area:"台東区",   parent:"東京都心", avg_unit:2900, avg_occ:56, sample:71,  trend:"up"   },
  { area:"豊島区",   parent:"東京都心", avg_unit:2680, avg_occ:50, sample:58,  trend:"down" },
  // 横浜
  { area:"西区（横浜）", parent:"横浜", avg_unit:2650, avg_occ:55, sample:94,  trend:"up"   },
  { area:"中区（横浜）", parent:"横浜", avg_unit:2580, avg_occ:53, sample:82,  trend:"flat" },
  { area:"神奈川区",     parent:"横浜", avg_unit:2320, avg_occ:48, sample:47,  trend:"flat" },
  { area:"鶴見区",       parent:"横浜", avg_unit:2280, avg_occ:47, sample:38,  trend:"down" },
  { area:"港北区",       parent:"横浜", avg_unit:2450, avg_occ:51, sample:56,  trend:"up"   },
  { area:"都筑区",       parent:"横浜", avg_unit:2180, avg_occ:44, sample:29,  trend:"flat" },
  { area:"青葉区",       parent:"横浜", avg_unit:2520, avg_occ:52, sample:34,  trend:"up"   },
  // 川崎
  { area:"川崎区",   parent:"川崎",    avg_unit:2350, avg_occ:49, sample:61,  trend:"flat" },
  { area:"幸区",     parent:"川崎",    avg_unit:2280, avg_occ:47, sample:33,  trend:"down" },
  { area:"中原区",   parent:"川崎",    avg_unit:2480, avg_occ:52, sample:44,  trend:"up"   },
  { area:"高津区",   parent:"川崎",    avg_unit:2310, avg_occ:48, sample:28,  trend:"flat" },
];

// エリアマスタ
export const AREA_MASTER = {
  "横浜":     { color:"#3B82F6", emoji:"🏯", lines:["東海道線","横浜市営地下鉄ブルーライン","京急本線","横浜線","相鉄本線"], roads:["首都高速湾岸線","横浜新道","国道1号 横浜市内"], desc:"横浜駅・みなとみらい・関内エリア" },
  "東京都心": { color:"#8B5CF6", emoji:"🗼", lines:["山手線","東京メトロ銀座線","東急東横線","中央線","東海道線"], roads:["首都高速都心環状線","国道246号","環状七号線"], desc:"新宿・渋谷・品川・六本木・銀座エリア" },
  "川崎":     { color:"#10B981", emoji:"🏭", lines:["東海道線","南武線","京急本線"], roads:["首都高速湾岸線","国道1号 川崎"], desc:"川崎駅・溝の口・武蔵小杉エリア" },
  "千葉":     { color:"#F59E0B", emoji:"🌊", lines:["総武線","京葉線","東武野田線"], roads:["首都高速湾岸線千葉","国道14号"], desc:"千葉・船橋・幕張・成田エリア" },
  "埼玉":     { color:"#EF4444", emoji:"🌸", lines:["京浜東北線","東武伊勢崎線","西武池袋線"], roads:["首都高速埼玉","国道17号"], desc:"大宮・浦和・川口・所沢エリア" },
  "大阪":     { color:"#F97316", emoji:"🏙️", lines:["大阪メトロ御堂筋線","JR大阪環状線","阪急神戸線"], roads:["阪神高速3号神戸線","御堂筋"], desc:"梅田・難波・心斎橋・天王寺エリア" },
  "名古屋":   { color:"#06B6D4", emoji:"🏯", lines:["名古屋市営地下鉄東山線","JR東海道本線","名鉄名古屋本線"], roads:["名古屋高速都心環状線","国道19号"], desc:"名古屋駅・栄・金山エリア" },
};
export const ALL_AREAS = Object.keys(AREA_MASTER);

// 初期日報データ
export const INITIAL_REPORTS = [
  { id:1, date:"2026-06-09", gross_sales:64200, cash_sales:38500, card_sales:19200, app_sales:6500, ride_count:31, total_distance:298, occupied_distance:157, work_hours:13.5, break_hours:1.0, highway_fee:800,  trouble_note:"",              ai_comment:"月平均より8%高い結果です。深夜帯の単価が高く効率的でした。" },
  { id:2, date:"2026-06-07", gross_sales:58400, cash_sales:35200, card_sales:16800, app_sales:6400, ride_count:28, total_distance:312, occupied_distance:141, work_hours:13.0, break_hours:1.0, highway_fee:0,    trouble_note:"",              ai_comment:"空車距離が長めでした。エリアの切り替えを早めに。" },
  { id:3, date:"2026-06-05", gross_sales:71800, cash_sales:42100, card_sales:22300, app_sales:7400, ride_count:34, total_distance:276, occupied_distance:178, work_hours:14.0, break_hours:1.0, highway_fee:1200, trouble_note:"",              ai_comment:"今月最高売上！実車率64%は非常に優秀です。" },
  { id:4, date:"2026-06-03", gross_sales:52100, cash_sales:31800, card_sales:14200, app_sales:6100, ride_count:24, total_distance:334, occupied_distance:128, work_hours:12.5, break_hours:1.5, highway_fee:0,    trouble_note:"雨天で混んでいた", ai_comment:"走行距離の割に売上が伸びませんでした。" },
  { id:5, date:"2026-06-01", gross_sales:60500, cash_sales:36200, card_sales:17800, app_sales:6500, ride_count:29, total_distance:301, occupied_distance:152, work_hours:13.0, break_hours:1.0, highway_fee:0,    trouble_note:"",              ai_comment:"月初としては安定した滑り出しです。" },
  { id:6, date:"2026-05-30", gross_sales:67300, cash_sales:39800, card_sales:20100, app_sales:7400, ride_count:32, total_distance:288, occupied_distance:169, work_hours:13.5, break_hours:1.0, highway_fee:600,  trouble_note:"",              ai_comment:"金曜日効果で単価が高く効率的でした。" },
  { id:7, date:"2026-05-28", gross_sales:55800, cash_sales:33400, card_sales:16200, app_sales:6200, ride_count:27, total_distance:320, occupied_distance:138, work_hours:13.0, break_hours:1.0, highway_fee:0,    trouble_note:"",              ai_comment:"水曜日は付け待ち中心が向いています。" },
  { id:8, date:"2026-05-26", gross_sales:62900, cash_sales:37500, card_sales:18600, app_sales:6800, ride_count:30, total_distance:294, occupied_distance:160, work_hours:13.5, break_hours:1.0, highway_fee:0,    trouble_note:"",              ai_comment:"安定した結果です。時間単価が高く効率よく稼げています。" },
];

// イベント情報（実際はTicketmaster API等から取得）
export const MOCK_EVENTS = [
  { id:"e1", title:"サザンオールスターズ コンサート",  venue:"横浜アリーナ",     areas:["横浜"],     date:"2026-06-10", startTime:"18:00", endTime:"21:00", capacity:17000, demandScore:95, tip:"終演後21時〜22時に横浜駅周辺で需要急増。早めに移動を。",     category:"concert" },
  { id:"e2", title:"横浜DeNA vs 読売 ナイター",        venue:"横浜スタジアム",   areas:["横浜"],     date:"2026-06-10", startTime:"18:00", endTime:"21:30", capacity:30000, demandScore:88, tip:"関内・伊勢佐木エリアで試合前後に需要増。",                    category:"sports"  },
  { id:"e3", title:"みなとみらいイルミネーション",      venue:"みなとみらい地区", areas:["横浜"],     date:"2026-06-10", startTime:"17:00", endTime:"23:00", capacity:null,  demandScore:72, tip:"帰宅需要は21時以降がピーク。",                                category:"event"   },
  { id:"e4", title:"東京ドーム ライブ",                venue:"東京ドーム",       areas:["東京都心"], date:"2026-06-10", startTime:"18:30", endTime:"21:30", capacity:55000, demandScore:91, tip:"終演後は水道橋・後楽園エリアで需要急増。",                    category:"concert" },
  { id:"e5", title:"川崎フロンターレ ホームゲーム",    venue:"等々力競技場",     areas:["川崎"],     date:"2026-06-10", startTime:"19:00", endTime:"21:00", capacity:26000, demandScore:79, tip:"試合終了後の武蔵小杉・溝の口エリアで需要増。",                category:"sports"  },
];

// 電車遅延情報（実際は国土交通省API / 各社APIから取得）
export const MOCK_DELAYS = [
  { id:"d1", line:"東海道線",                  areas:["横浜","川崎","東京都心"], status:"delay", minutes:28, reason:"人身事故（平塚〜茅ヶ崎間）", since:"17:42", opportunity:true,  opportunityMsg:"平塚・茅ヶ崎〜横浜方面でタクシー需要が急増中！",   severity:"high"   },
  { id:"d2", line:"横浜市営地下鉄ブルーライン", areas:["横浜"],                  status:"delay", minutes:12, reason:"車両点検",                    since:"18:05", opportunity:true,  opportunityMsg:"関内・上大岡エリアで需要増の可能性。",             severity:"medium" },
  { id:"d3", line:"京急本線",                  areas:["横浜","川崎"],           status:"normal", minutes:0, reason:"",                            since:"",       opportunity:false, opportunityMsg:"",                                                severity:"low"    },
  { id:"d4", line:"東急東横線",                areas:["横浜","東京都心"],       status:"stop",   minutes:0, reason:"踏切トラブル（綱島付近）",     since:"18:15", opportunity:true,  opportunityMsg:"綱島・日吉〜渋谷方面で大幅な需要増！高単価期待。", severity:"high"   },
  { id:"d5", line:"山手線",                    areas:["東京都心"],              status:"delay", minutes:15, reason:"車両故障（品川付近）",          since:"17:30", opportunity:true,  opportunityMsg:"品川・目黒・新宿エリアで需要増中！",               severity:"medium" },
];

// 渋滞情報（実際はGoogle Maps Routes APIから取得）
export const MOCK_TRAFFIC = [
  { id:"t1", area:"首都高速湾岸線",    areas:["横浜","川崎"],     status:"jam",    level:3, desc:"大黒JCT付近 10km渋滞",   cause:"事故", since:"17:30", tip:"下道（産業道路）経由を推奨" },
  { id:"t2", area:"横浜新道",          areas:["横浜"],            status:"slow",   level:2, desc:"戸塚IC付近 やや混雑",     cause:"工事", since:"16:00", tip:"保土ヶ谷バイパスへ"       },
  { id:"t3", area:"国道1号 横浜市内",  areas:["横浜","川崎"],     status:"normal", level:1, desc:"おおむね順調",             cause:"",     since:"",       tip:""                        },
  { id:"t4", area:"首都高速都心環状線",areas:["東京都心"],        status:"jam",    level:3, desc:"代官山付近 8km渋滞",      cause:"事故", since:"17:10", tip:"一般道の外苑西通りへ"     },
  { id:"t5", area:"国道246号",          areas:["東京都心","川崎"], status:"slow",   level:2, desc:"三軒茶屋付近 渋滞",       cause:"交通集中",since:"16:30",tip:"駒沢通りが比較的スムーズ"},
];

// 休憩スポット
export const MOCK_SPOTS = [
  { id:"s1", name:"ファミリーマート 横浜みなとみらい店",  category:"conbini", area:"横浜",     address:"横浜市西区みなとみらい2-2",    hours:"24時間",      parking:"大型OK・無料・30分",  features:["駐車場広め","トイレ清潔","電子レンジあり"],     rating:4.2, reviews:18 },
  { id:"s2", name:"松屋 横浜関内店",                      category:"food",    area:"横浜",     address:"横浜市中区太田町2-23",          hours:"24時間",      parking:"近隣コインP",         features:["24時間営業","Wi-Fiあり","充電コンセントあり"],   rating:3.8, reviews:12 },
  { id:"s3", name:"道の駅 横浜",                          category:"rest",    area:"横浜",     address:"横浜市保土ヶ谷区境木町57-1",   hours:"8:00〜20:00", parking:"大型専用・無料",      features:["専用P広め","シャワーあり","仮眠室あり"],        rating:4.6, reviews:34 },
  { id:"s4", name:"横浜ドライバーズカフェ",               category:"cafe",    area:"横浜",     address:"横浜市鶴見区鶴見中央3-10",    hours:"6:00〜23:00", parking:"大型OK・無料・60分",  features:["運転手割引あり","仮眠ソファあり","充電あり"],   rating:4.8, reviews:56 },
  { id:"s5", name:"すき家 新宿歌舞伎町店",                category:"food",    area:"東京都心", address:"新宿区歌舞伎町1-2-3",          hours:"24時間",      parking:"近隣コインP",         features:["24時間","テイクアウト可"],                      rating:3.6, reviews:9  },
  { id:"s6", name:"セブンイレブン 渋谷道玄坂店",          category:"conbini", area:"東京都心", address:"渋谷区道玄坂1-10",             hours:"24時間",      parking:"なし（荷捌きスペース可）",features:["ATMあり","ホットスナック充実"],                rating:3.9, reviews:14 },
  { id:"s7", name:"川崎ドライバー休憩所",                 category:"rest",    area:"川崎",     address:"川崎市川崎区港町1-1",           hours:"0:00〜24:00", parking:"大型OK・無料・60分",  features:["仮眠室あり","シャワーあり","自販機充実"],       rating:4.3, reviews:28 },
];

// 乗り場・空港ガイド
export const STAND_GUIDES = [
  { id:"g1", type:"stand",   name:"銀座 数寄屋橋",        area:"東京都心", emoji:"🏙️", tags:["定番","夜強い","長距離多い"],      peak:"🌙 夜〜深夜◎",    lineup:"一方通行に沿って1列。前詰め厳守。係員22時以降不在。",          tips:["21時以降が回転早い","歌舞伎座帰り18時前後が狙い","雨の日は単価も上がる"],                                               caution:"昼間は回転遅い。周辺ひと流しの方が効率的。",                                                                                       rating:4.5, reviews:42 },
  { id:"g2", type:"stand",   name:"新橋駅 SL広場口",      area:"東京都心", emoji:"🚂", tags:["終電後狙い","短距離注意"],         peak:"🌙 19〜24時◎",    lineup:"SL側に1列縦隊。烏森口側の2番乗り場も確認を。",                tips:["終電後0時30分〜需要爆発","金曜21時から並んでも稼げる","烏森口側が穴場"],                                                        caution:"短距離が多い時間帯は効率低下。",                                                                                                    rating:4.3, reviews:58 },
  { id:"g3", type:"stand",   name:"六本木ヒルズ",          area:"東京都心", emoji:"🌆", tags:["高単価","深夜強","外国人多"],      peak:"🌙 深夜◎◎",       lineup:"地下タクシーベイに1列。係員誘導に従う。",                       tips:["深夜2時以降が最効率","外国人客は地図を見せてもらう","週末は15分前に到着推奨"],                                                    caution:"深夜1時前は空回りになりがち。",                                                                                                     rating:4.7, reviews:37 },
  { id:"g4", type:"stand",   name:"新宿駅 西口",           area:"東京都心", emoji:"🗼", tags:["大型乗り場","朝も使える"],         peak:"🕐 朝◎ 🌙 夜◎",  lineup:"1〜4番乗り場に分かれる。4番は神奈川方面が多い。",              tips:["朝7〜9時も稼げる数少ない乗り場","4番で横浜・川崎方面の長距離が出る"],                                                          caution:"昼間は近距離ばかり。",                                                                                                              rating:4.1, reviews:51 },
  { id:"g5", type:"stand",   name:"東京駅 丸の内南口",     area:"東京都心", emoji:"🚅", tags:["ビジネス客","高単価","朝夕強い"],  peak:"☀️ 朝夕◎◎",      lineup:"丸の内南口を出て右手。誘導員常駐。",                            tips:["朝7〜9時のビジネス客は空港・郊外の長距離が多い","新幹線帰りはトランクを先に開けると好印象","外国人観光客も多い"],                 caution:"行き先を断ることは原則禁止。乗車拒否にならないよう注意。",                                                                         rating:4.4, reviews:44 },
  { id:"g6", type:"stand",   name:"横浜駅 西口",           area:"横浜",     emoji:"🏯", tags:["昼夜安定","神奈川広域"],           peak:"☀️ 昼○ 🌙 夜◎",  lineup:"西口ロータリー。1番一般客、2番予約・配車アプリ客。",            tips:["神奈川県内の長距離が出やすい","夕方17〜19時は回転が早い"],                                                                         caution:"東口と西口で乗り場が異なる。",                                                                                                      rating:4.2, reviews:33 },
  { id:"g7", type:"stand",   name:"みなとみらい クイーンズスクエア", area:"横浜", emoji:"🎡", tags:["観光客多","週末強い"],      peak:"🌙 夜○（週末◎◎）",lineup:"クイーンズスクエア東棟地下1階。イベント時係員誘導あり。",   tips:["コンサート・花火後は需要爆発","観光客は遠方（都内・空港）ロングが多い"],                                                           caution:"みなとみらいは乗り場以外での乗降禁止区域が多い。",                                                                                  rating:4.0, reviews:19 },
  { id:"a1", type:"airport", name:"羽田空港 第1T（JAL系）",area:"東京都心", emoji:"✈️", tags:["国内線","朝夕強"],                peak:"到着便多い 7〜9時・18〜21時", lineup:"到着ロビー1階の指定乗り場。係員誘導。空港タクシー協会ステッカー確認あり。", tips:["都内・横浜・川崎が行き先中心","深夜は需要激減","行き先は聞かれない。乗車拒否厳禁"],           caution:"待機場は無料だが時間制限あり。会社に確認を。", access:"首都高1号羽田線 空港中央ICから約5分。左レーンがタクシー専用。", flow:["空港中央ICで降りる","タクシー専用レーン左へ","待機場で待機","係員の呼び出しで乗り場へ"], rating:4.3, reviews:67 },
  { id:"a2", type:"airport", name:"羽田空港 第3T（国際線）",area:"東京都心",emoji:"🛫", tags:["外国人多","深夜強","ロング率高"],  peak:"深夜便到着後 1〜3時",         lineup:"到着ロビー1階。国際線到着に合わせた需要。係員常駐。",           tips:["深夜便後は高単価の長距離が多い","外国人客にはクレカ対応必須","都心・横浜方面など超ロングも"],                                        caution:"外国人客の行き先が不明確な場合は地図アプリを見せてもらう。", access:"第1・2Tとは少し離れている。専用ルートで進入。",               flow:["空港中央ICから第3T方面へ","国際線タクシー乗り場案内板に従う","待機場で待機後、係員誘導"], rating:4.4, reviews:45 },
  { id:"a3", type:"airport", name:"成田空港 第1T",          area:"千葉",     emoji:"🛫", tags:["超ロング","有料待機"],             peak:"国際線到着便に依存。昼・夕・深夜に波", lineup:"到着ロビー1階外。南・北ウイングで乗り場が異なる。到着便のウイングを事前確認。", tips:["都内まで15,000〜20,000円が相場","外国人客が多い。英語あいさつは用意","帰りに都内で客を拾うルートを計算"],             caution:"待機場は有料。長時間待機は費用対効果を計算すること。",       access:"東関東自動車道 成田ICから約15分。タクシー専用レーン必須。",    flow:["成田ICから案内板に従い進入","有料待機場に入る（30分以降課金）","係員の無線連絡で乗り場へ"], rating:4.1, reviews:43 },
  { id:"a4", type:"airport", name:"関西国際空港",            area:"大阪",     emoji:"🛫", tags:["連絡橋通行料","外国人多"],         peak:"国際線到着便に依存。深夜が多い",      lineup:"到着ロビー1階。国際線到着口前の乗り場。係員常駐。",              tips:["大阪市内まで約1時間・6,000〜8,000円が相場","連絡橋通行料は乗客負担（往復約1,500円）","乗車前に通行料を説明しておくとトラブル防止"], caution:"連絡橋通行料の精算を乗車前に説明しておくこと。",              access:"阪神高速湾岸線 りんくうJCTから連絡橋経由。タクシー専用路で進入。", flow:["りんくうJCTから関西空港方面へ","連絡橋を渡りターミナル前へ","タクシー待機場（有料）に入る","係員誘導で乗り場へ"], rating:3.9, reviews:22 },
];

// 匿名投稿
export const MOCK_POSTS = [
  { id:"p1", areas:["横浜"],     time:"18:42", text:"横浜アリーナ終演後、駅前が激混み。待機して正解でした",         likes:23, liked:false },
  { id:"p2", areas:["横浜"],     time:"17:55", text:"東海道線止まってるせいで関内がすごいことになってる。今がチャンス", likes:41, liked:false },
  { id:"p3", areas:["東京都心"], time:"18:10", text:"山手線遅れてて品川・目黒エリアが熱い。今すぐ南下推奨",           likes:33, liked:false },
  { id:"p4", areas:["横浜"],     time:"16:30", text:"みなとみらいは17時以降に入ると流れが悪い。元町側から攻めた方がいい", likes:15, liked:false },
  { id:"p5", areas:["川崎"],     time:"15:10", text:"川崎駅東口、工事で一方通行変わってる。注意",                     likes:9,  liked:false },
];

// シフトデータ（6月）
export const MOCK_SHIFTS = [
  { id:"s1",  date:"2026-06-01", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s2",  date:"2026-06-03", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s3",  date:"2026-06-05", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"研修あり" },
  { id:"s4",  date:"2026-06-07", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s5",  date:"2026-06-09", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s6",  date:"2026-06-11", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s7",  date:"2026-06-13", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s8",  date:"2026-06-15", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s9",  date:"2026-06-17", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s10", date:"2026-06-19", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s11", date:"2026-06-21", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s12", date:"2026-06-23", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s13", date:"2026-06-25", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s14", date:"2026-06-27", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
  { id:"s15", date:"2026-06-29", clockIn:"12:00", clockOut:"翌08:00", isNight:true, note:"" },
];

// 昨日の集計結果（翌日発表機能）
export const MOCK_YESTERDAY_SUMMARY = {
  date: "2026-06-09",
  announceDate: "2026-06-10",
  totalDrivers: 287,
  areaStats: [
    { area:"横浜",     avg:61200, count:98,  trend:"up"   },
    { area:"東京都心", avg:67800, count:112, trend:"up"   },
    { area:"川崎",     avg:54300, count:41,  trend:"down" },
    { area:"千葉",     avg:49800, count:22,  trend:"flat" },
    { area:"埼玉",     avg:51200, count:14,  trend:"flat" },
  ],
  topSales: [
    { rank:1, driverCode:"DRV-A", area:"東京都心", sales:98400, badge:"🥇" },
    { rank:2, driverCode:"DRV-B", area:"横浜",     sales:91200, badge:"🥈" },
    { rank:3, driverCode:"DRV-C", area:"東京都心", sales:87600, badge:"🥉" },
    { rank:4, driverCode:"DRV-D", area:"川崎",     sales:84300, badge:"4位" },
    { rank:5, driverCode:"DRV-E", area:"横浜",     sales:81100, badge:"5位" },
  ],
  myResult: { rank:3, percentile:1.0, sales:64200, areaAvg:61200, diffFromAvg:3000, diffFromTop:34200 },
};
