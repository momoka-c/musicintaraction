const CACHE_NAME = 'zine-creator-v1';
const urlsToCache = [
  'index.html',
  'manifest.json',
  'icon.png'
];

// インストール時に基本ファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// リクエスト時はインターネットを優先し、ダメならキャッシュを返す（ネットワークファースト）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});