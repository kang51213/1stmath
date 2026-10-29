// 오프라인에서도 열리도록 앱 파일을 캐시한다. 파일을 고치면 VERSION 을 올린다.
const VERSION = "1stmath-v5";
const FILES = ["./", "index.html", "style.css", "data.js", "app.js", "manifest.webmanifest", "install.html",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
