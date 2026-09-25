// Visor Scan: guarda la app, el motor de vision y los modelos en el telefono
// para que funcione sin senal (metro, parque). Primera carga con internet.
//  - Archivos de la app (html/js/manifest): primero la red, para recibir
//    actualizaciones; si no hay senal, la copia guardada.
//  - Modelos, motor wasm y fuentes: primero la copia guardada (no cambian).
const CACHE = "visor-v5";
const CORE = [
  "./", "index.html", "detector-worker.js?v=5", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "models/efficientdet_lite0.tflite",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const put = (req, res) => {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.url.startsWith("blob:")) return;
  const url = new URL(req.url);
  const appFile = url.origin === location.origin && !url.pathname.includes("/models/");
  if (appFile) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => put(req, res)).catch(() => caches.match(req, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  }
});
