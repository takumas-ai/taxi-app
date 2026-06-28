import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'fs'

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    {
      // ビルドごとにタイムスタンプ入りのsw.jsをdist/に生成する
      name: 'generate-sw',
      closeBundle() {
        const BUILD = Date.now().toString();
        const sw = `
const BUILD = '${BUILD}';
const CACHE = 'takuro-' + BUILD;
const TILE_CACHE = 'takuro-tiles-v1';
const TILE_MAX   = 300;          // 最大キャッシュ枚数
const TILE_TTL   = 30 * 24 * 60 * 60 * 1000; // 30日（ms）

// 新しいSWをすぐにアクティブ化
self.addEventListener('install', () => self.skipWaiting());

// 古いアセットキャッシュを削除（タイルキャッシュは保持）
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// タイルキャッシュ: 上限超えたら古い順に削除
async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys  = await cache.keys();
  if (keys.length > TILE_MAX) {
    await Promise.all(keys.slice(0, keys.length - TILE_MAX).map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HTMLナビゲーション: 常にネットワークから取得
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 地図タイル: Cache First + TTL30日 + 上限300枚
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname.endsWith('.tile.openstreetmap.org')) {
    e.respondWith((async () => {
      const cache  = await caches.open(TILE_CACHE);
      const cached = await cache.match(e.request);
      if (cached) {
        const dateHeader = cached.headers.get('x-cached-at');
        if (dateHeader && Date.now() - Number(dateHeader) < TILE_TTL) {
          return cached;
        }
        // TTL切れ → 削除して再取得
        await cache.delete(e.request);
      }
      try {
        const res = await fetch(e.request);
        if (res.ok) {
          // x-cached-at ヘッダーを付けて保存
          const headers = new Headers(res.headers);
          headers.set('x-cached-at', Date.now().toString());
          const body = await res.arrayBuffer();
          const toStore = new Response(body, { status: res.status, headers });
          await cache.put(e.request, toStore);
          trimTileCache(); // 非同期で枚数整理
          return new Response(body, { status: res.status, headers: res.headers });
        }
        return res;
      } catch {
        return cached || new Response('', { status: 503 });
      }
    })());
    return;
  }

  // ハッシュ付きアセット: キャッシュ優先
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // その他: ネットワーク優先
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
`;
        const distDir = process.cwd() + '/dist';
        mkdirSync(distDir, { recursive: true });
        writeFileSync(distDir + '/sw.js', sw.trim());
      }
    }
  ],
})
