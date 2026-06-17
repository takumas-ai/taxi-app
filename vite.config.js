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

// 新しいSWをすぐにアクティブ化
self.addEventListener('install', () => self.skipWaiting());

// 古いキャッシュを削除してすべてのクライアントを掌握
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HTMLナビゲーション: 常にネットワークから取得（キャッシュを使わない）
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ハッシュ付きアセット: キャッシュ優先（ハッシュが変われば自動的に別ファイル）
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
