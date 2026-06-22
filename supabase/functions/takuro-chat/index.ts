import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── 認証チェック ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── レート制限チェック ────────────────────────────────
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const { data: userData } = await supabase
      .from("users")
      .select("chat_count, chat_reset_date")
      .eq("id", user.id)
      .single();

    const isNewDay = !userData?.chat_reset_date || userData.chat_reset_date !== today;
    const currentCount = isNewDay ? 0 : (userData?.chat_count ?? 0);

    if (currentCount >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "rate_limit",
          message: "今日はたくさん話しましたね！1日30件が上限です。また明日話しかけてください 🦉",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── カウントをインクリメント ───────────────────────────
    await supabase.from("users").update({
      chat_count: currentCount + 1,
      chat_reset_date: today,
    }).eq("id", user.id);

    // ── リクエストボディ取得 ──────────────────────────────
    const { messages, userContext } = await req.json();

    // ── コンテキスト文字列構築 ────────────────────────────
    const ctxParts: string[] = [];
    if (userContext?.name)            ctxParts.push(`ドライバー名: ${userContext.name}`);
    if (userContext?.todaySales != null) ctxParts.push(`今日の売上: ${Number(userContext.todaySales).toLocaleString()}円`);
    if (userContext?.todayRides  != null) ctxParts.push(`今日の乗車回数: ${userContext.todayRides}回`);
    if (userContext?.monthSales  != null) ctxParts.push(`今月の累計売上: ${Number(userContext.monthSales).toLocaleString()}円`);
    if (userContext?.target > 0)      ctxParts.push(`月目標: ${Number(userContext.target).toLocaleString()}円`);
    if (userContext?.streak  != null) ctxParts.push(`連続記録日数: ${userContext.streak}日`);
    if (userContext?.workType)        ctxParts.push(`勤務スタイル: ${userContext.workType}`);

    const contextStr = ctxParts.length > 0
      ? `\n\n【現在のドライバー状況】\n${ctxParts.join("\n")}`
      : "";

    const system = `あなたは「タクロー」というフクロウのキャラクターです。タクシードライバー向けアプリ「タクロー」のAIアシスタントとして、ドライバーの日々の相談相手になります。

【キャラクター】
- 親しみやすく温かい口調。敬語と話し言葉を自然に混ぜる
- ドライバーの頑張りをしっかり認め、具体的に褒める
- 愚痴・つらい話には「それはきつかったですね」と共感してから話す
- タクシー業界・稼ぎ方・接客・深夜需要などの知識が豊富
- アプリ「タクロー」の使い方（日報記録・OCR・英語フレーズ・新人コース）も案内できる
- 返答は短め（2〜4文）。長い説明が必要なときも要点を絞る
- 「🦉」を文末に1回使うことがある（多用しない）

【禁止事項】
- 根拠のない情報を断言しない
- 「すごいですね！」だけの空虚な褒め方はしない
- ユーザーの判断を否定したり批判したりしない${contextStr}`;

    // ── AI呼び出し ────────────────────────────────────────
    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages,
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const remaining = DAILY_LIMIT - (currentCount + 1);

    return new Response(JSON.stringify({ text, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
