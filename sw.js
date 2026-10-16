/* ZULU Logistics app helper (service worker).
   - Always loads the newest portal from GitHub when online, so updates reach everyone at once.
   - Keeps the last copy of the portal so the app still opens without signal and says it is offline.
   - Never stores database data: requests to Supabase and other sites pass straight through.
   - Opens the app when someone taps one of its notifications. */
var CACHE = 'zulu-shell-v1';
var SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('zulu-shell-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

var OFFLINE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>ZULU Logistics</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14305a;color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}' +
  'button{margin-top:16px;font:inherit;padding:10px 20px;border-radius:6px;border:0;background:#8fd9ba;color:#13202b;font-weight:600}</style></head>' +
  '<body><div><h1 style="font-size:1.4rem">You are offline</h1><p>The ZULU portal needs an internet connection.<br>Check your signal or Wi-Fi, then try again.</p>' +
  '<button onclick="location.reload()">Try again</button></div></body></html>';

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, CDN: untouched
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./', copy); }); }
      return res;
    }).catch(function () {
      return caches.match('./').then(function (hit) {
        return hit || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      });
    }));
    return;
  }
  if (SHELL.some(function (p) { return url.pathname.endsWith(p.replace('./', '/')) && p !== './'; })) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
      return hit || net;
    }));
  }
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var tag = e.notification.tag || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0) {
        c.postMessage({ type: 'zulu-notification-click', tag: tag });
        return c.focus ? c.focus() : c;
      }
    }
    return self.clients.openWindow('./');
  }));
});
