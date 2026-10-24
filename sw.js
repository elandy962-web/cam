/* Service worker: la app abre sin internet y se actualiza sola.
   Cada vez que cambies archivos, sube V aquí y APP_VERSION en index.html (el mismo número).
   La versión nueva se descarga en segundo plano y queda esperando; la app muestra
   "Nueva versión disponible · Actualizar" y al tocarlo se cambia sin reinstalar nada. */
const V = 'softball-3.2.0';
const MAIN = ['./', 'index.html'];
const EXTRA = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const SDK = ['app', 'auth', 'database'].map(n => 'https://www.gstatic.com/firebasejs/10.12.2/firebase-' + n + '-compat.js');

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    /* cache:'reload' = siempre la copia nueva del servidor, nunca una guardada por el navegador. */
    await c.addAll(MAIN.map(u => new Request(u, { cache: 'reload' })));
    /* Lo demás no es imprescindible: si un archivo falla, la actualización sigue. */
    await Promise.all(EXTRA.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})));
    /* Las librerías de Firebase solo se guardan si la descarga fue buena (res.ok). */
    await Promise.all(SDK.map(u => fetch(u).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})));
  }));
  /* No se activa sola: espera a que toques "Actualizar" (o a que cierres la app del todo). */
});

self.addEventListener('message', e => {
  const d = e.data;
  if (d === 'skip') self.skipWaiting();
  else if (d && d.type === 'ver' && e.ports && e.ports[0]) e.ports[0].postMessage(V);
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
  /* El marcador de la transmisión y la búsqueda de versión nueva siempre van a internet. */
  if (u.pathname.endsWith('marcador.html') || u.searchParams.has('upd')) return;
  /* Cada versión usa solo su propia copia: nunca se mezclan archivos de dos versiones. */
  e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
    if (res && res.ok && res.type === 'basic') c.put(r, res.clone());
    return res;
  }).catch(() => r.mode === 'navigate' ? c.match('index.html') : Response.error()))));
});
