/* Life Reboot — 轻量离线缓存
 * 策略：
 *  - 页面导航：网络优先，断网时回落到缓存的本页
 *  - /_next/static/（文件名带哈希，不会变化）：缓存优先
 *  - 其它同源 GET：正常走网络
 */
const VERSION = "v1";
const HTML_CACHE = `lr-html-${VERSION}`;
const ASSET_CACHE = `lr-assets-${VERSION}`;
const SHELL = new URL("./index.html", self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(HTML_CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("lr-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match(SHELL);
    if (shell) return shell;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});
