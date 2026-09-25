// Visor Scan: guarda la app, el motor de vision y los modelos en el telefono
// para que funcione sin senal (metro, parque). Primera carga con internet.
const CACHE = "visor-v1";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png",
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

// cache primero; lo que no este guardado se baja y se guarda (wasm, modelos, fuentes)
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.url.startsWith("blob:")) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
