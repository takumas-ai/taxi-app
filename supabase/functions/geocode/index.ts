import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Nominatim に問い合わせ（サーバーサイドなので CORS なし）
async function nominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = address.startsWith("東京") ? address : `東京都${address}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=jp&limit=1&accept-language=ja`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TakuroApp/1.0 (taxi-app-nine-eta.vercel.app)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { addresses } = await req.json() as { addresses: string[] };
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return new Response(JSON.stringify({}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // 1. DBキャッシュを一括取得
    const { data: cached } = await db
      .from("geocode_cache")
      .select("address, lat, lng")
      .in("address", addresses);

    const result: Record<string, { lat: number; lng: number }> = {};
    const cachedMap = new Map((cached ?? []).map((r: any) => [r.address, { lat: r.lat, lng: r.lng }]));

    // キャッシュヒット分を結果に追加
    for (const addr of addresses) {
      if (cachedMap.has(addr)) result[addr] = cachedMap.get(addr)!;
    }

    // 2. キャッシュミス分のみ Nominatim に問い合わせ（1秒間隔）
    const misses = addresses.filter(a => !cachedMap.has(a));
    const toInsert: { address: string; lat: number; lng: number }[] = [];

    for (let i = 0; i < misses.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1100));
      const coords = await nominatim(misses[i]);
      if (coords) {
        result[misses[i]] = coords;
        toInsert.push({ address: misses[i], ...coords });
      }
    }

    // 3. 新規取得分をDBにキャッシュ保存
    if (toInsert.length > 0) {
      await db.from("geocode_cache").upsert(toInsert, { onConflict: "address" });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
