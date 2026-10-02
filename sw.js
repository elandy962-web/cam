/* Service worker: la app abre sin internet. Sube el número de V cuando cambies archivos. */
const V = 'softball-v4';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const SDK = ['app', 'auth', 'database'].map(n => 'https://www.gstatic.com/firebasejs/10.12.2/firebase-' + n + '-compat.js');
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    await c.addAll(CORE);
    /* Las librerías de Firebase solo se guardan si la descarga fue buena (res.ok). */
    await Promise.all(SDK.map(u => fetch(u).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'www.gstatic.com') {
    e.respondWith(caches.match(r.url).then(async hit => {
      if (hit && hit.ok) return hit;
      try {
        const res = await fetch(r.url);
        if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r.url, cp)); }
        return res;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
