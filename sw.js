
const CACHE_NAME = 'milestone-x-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// fetch 이벤트를 구독하지 않음으로써 브라우저의 기본 네트워크 동작에 간섭하지 않습니다.
// 이를 통해 'Failed to fetch' TypeError를 원천적으로 차단합니다.

self.addEventListener('notificationclick', (event) => {
  const jobId = event.notification?.data?.jobId;
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (allClients.length > 0) {
      for (const client of allClients) {
        try {
          await client.focus();
        } catch {}
        if (jobId) {
          client.postMessage({ type: 'OPEN_MEETING', jobId });
        }
        return;
      }
    }
    const url = jobId ? `/?openJob=${encodeURIComponent(jobId)}` : '/';
    if (clients.openWindow) {
      await clients.openWindow(url);
    }
  })());
});
