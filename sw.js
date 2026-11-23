/**
 * Service worker: cho phép mở app và học đầy đủ khi không có mạng.
 *
 * Đổi CACHE_VERSION mỗi lần sửa file tĩnh — service worker mới sẽ tải lại
 * toàn bộ và xoá cache cũ. Trang sẽ hiện thông báo "có bản mới" để bạn tải lại.
 */

const CACHE_VERSION = 'v2';
const CACHE = `dela-${CACHE_VERSION}`;

/** Toàn bộ app shell + dữ liệu bài học — sau khi cache là chạy offline được. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/daily.js',
  './js/speech.js',
  './js/scoring.js',
  './js/feedback.js',
  './js/ai.js',
  './js/ui.js',
  './js/pwa.js',
  './js/ex1-vocab.js',
  './js/ex2-listening.js',
  './js/ex3-pronounce.js',
  './data/words.json',
  './data/dialogues.json',
  './data/sentences.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Không dùng cache.addAll: chỉ một file lỗi là hỏng toàn bộ lần cài đặt.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch((err) => console.warn('[sw] không cache được', url, err)),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Điều hướng nhanh hơn khi đã có cache sẵn.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

/** Trang gọi postMessage khi người dùng bấm "Tải lại" để nhận bản mới ngay. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Tuyệt đối không đụng vào request tới api.anthropic.com (hoặc bất kỳ host nào
  // khác): cache lại phản hồi API là vô nghĩa và có thể lộ dữ liệu.
  if (url.origin !== self.location.origin) return;

  // Công cụ gửi báo cáo Zalo là trang riêng, không thuộc app học tiếng Anh:
  // để trình duyệt tải thẳng, không cache và không rơi về index.html khi mất mạng.
  if (url.pathname.includes('/zalo-report/')) return;

  // Điều hướng: ưu tiên mạng để nhận bản mới, mất mạng thì trả trang đã cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Tài nguyên tĩnh: trả cache ngay cho nhanh, đồng thời cập nhật ngầm phía sau.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      return cached || (await network) || Response.error();
    })(),
  );
});
