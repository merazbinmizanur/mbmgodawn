/* MBM Enterprise — Service Worker
   Basic app-shell caching so the app opens instantly and installs
   as a PWA. Does not cache Telegram API calls (always network). */

const CACHE_NAME = "mbm-enterprise-v2";
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./premium.css",
  "./script.js",
  "./premium.js",
  "./manifest.json",
  "./img/logo.png"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event)=>{
  const url = event.request.url;
  // Never cache Telegram API traffic — always go to network.
  if(url.includes("api.telegram.org")) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        if(event.request.method === "GET" && response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(()=> cached);
    })
  );
});
