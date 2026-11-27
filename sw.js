/* Radioenlace PtP — © 2026 Jaime Díaz Rodríguez (Jimmy-jdr). Licencia CC BY-NC-ND 4.0: https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es */
// =====================================================================
// sw.js — Service worker: permite abrir la app sin conexión y guarda
// en caché las teselas del mapa y el relieve ya consultados.
// Al publicar una versión nueva, cambia el número de VERSION.
// =====================================================================
const VERSION = 'radioenlace-v1.2.0';
const NUCLEO = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/radio.js', './js/terreno.js', './js/modelos.js', './js/mapa.js',
  './js/perfil.js', './js/explicacion.js', './js/ejemplos.js', './js/informe.js', './js/fuentes.js',
  './js/utm.js', './js/planos.js', './js/veredicto.js', './js/itm.js', './js/version.js',
  './iconos/icono-192.png', './iconos/icono-512.png', './iconos/apple-touch-icon.png', './iconos/favicon-32.png',
];
const TESELAS = `${VERSION}-teselas`;
const RELIEVE = `${VERSION}-relieve`;
const MAX_TESELAS = 600;
const MAX_RELIEVE = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function recortar(nombre, max) {
  const c = await caches.open(nombre);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Estadísticas (GoatCounter): nunca se guardan en caché; sin conexión, simplemente no se cuentan
  if (/goatcounter\.com$|(^|\.)zgo\.at$/.test(url.hostname)) return;

  // Archivos de la propia app: primero la red (para recibir mejoras), si no, la caché
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
    return;
  }

  // Teselas de mapa: primero la caché
  if (/wmts|tile\.openstreetmap\.org/.test(url.href)) {
    e.respondWith(caches.open(TESELAS).then(async (c) => {
      const guardada = await c.match(req);
      if (guardada) return guardada;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); recortar(TESELAS, MAX_TESELAS); }
      return r;
    }));
    return;
  }

  // Relieve (IGN y Open-Meteo): primero la red, la caché si no hay conexión
  if (/servicios\.idee\.es|api\.open-meteo\.com/.test(url.host)) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(RELIEVE).then((c) => { c.put(req, copia); recortar(RELIEVE, MAX_RELIEVE); }); }
      return r;
    }).catch(() => caches.open(RELIEVE).then((c) => c.match(req)).then((r) => r || Response.error())));
  }
});
