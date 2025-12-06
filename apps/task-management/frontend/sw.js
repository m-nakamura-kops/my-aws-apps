/**
 * Service Worker - オフライン対応とキャッシュ管理
 * 
 * このService Workerは以下の機能を提供します:
 * - 静的ファイルのキャッシュ（オフライン閲覧対応）
 * - ネットワーク優先、フォールバックでキャッシュを使用
 */

const CACHE_NAME = 'task-management-v1';
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

/**
 * インストール時の処理
 * 静的ファイルをキャッシュに保存
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static files');
        // キャッシュに失敗してもインストールは続行
        return cache.addAll(STATIC_CACHE_URLS).catch((error) => {
          console.warn('Some files failed to cache:', error);
        });
      })
      .then(() => {
        // インストール完了後、すぐにアクティベート
        return self.skipWaiting();
      })
  );
});

/**
 * アクティベート時の処理
 * 古いキャッシュを削除
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // すべてのクライアントを制御下に置く
      return self.clients.claim();
    })
  );
});

/**
 * フェッチ時の処理
 * ネットワーク優先、フォールバックでキャッシュを使用
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // APIリクエストは常にネットワークを使用（キャッシュしない）
  if (url.pathname.startsWith('/tasks') || url.pathname.includes('api')) {
    event.respondWith(
      fetch(request).catch(() => {
        // オフライン時はエラーメッセージを返す
        return new Response(
          JSON.stringify({ error: 'オフラインです。ネットワーク接続を確認してください。' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 静的ファイルはキャッシュ優先戦略を使用
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // キャッシュがある場合はそれを返す
      if (cachedResponse) {
        return cachedResponse;
      }

      // キャッシュがない場合はネットワークから取得
      return fetch(request).then((response) => {
        // レスポンスが有効な場合のみキャッシュに保存
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // レスポンスをクローンしてキャッシュに保存
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      }).catch(() => {
        // オフラインでキャッシュもない場合
        if (request.destination === 'document') {
          // HTMLファイルの場合はオフラインページを返す
          return caches.match('./index.html');
        }
        return new Response('オフラインです', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

/**
 * メッセージ受信時の処理
 * キャッシュのクリアなどに使用可能
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

