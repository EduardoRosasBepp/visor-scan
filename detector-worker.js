// Visor Scan: la IA corre aqui, en un hilo aparte, para que el video
// se dibuje siempre a 30 FPS aunque la deteccion tarde mas.
import { FilesetResolver, ObjectDetector, HandLandmarker }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
let fileset = null, detector = null, hands = null, delegate = "—", model = "", lastTs = 0;

async function create(kind, urls, opts) {
  const Task = kind === "hands" ? HandLandmarker : ObjectDetector;
  for (const url of urls) {
    for (const d of ["GPU", "CPU"]) {
      try {
        const t = await Task.createFromOptions(fileset, { baseOptions: { modelAssetPath: url, delegate: d }, ...opts });
        return [t, d];
      } catch (e) { /* siguiente opcion */ }
    }
  }
  throw new Error("no se pudo cargar " + kind);
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === "init") {
      if (!fileset) fileset = await FilesetResolver.forVisionTasks(WASM, true);   // modo modulo (worker)
      if (m.model !== model) {
        if (detector) detector.close();
        [detector, delegate] = await create("det", m.urls, { runningMode: "VIDEO", scoreThreshold: 0.2, maxResults: 30 });
        model = m.model;
      }
      if (m.hands && !hands) {
        [hands] = await create("hands", m.handUrls, { runningMode: "VIDEO", numHands: 2 });
      }
      self.postMessage({ type: "ready", delegate, model });
    } else if (m.type === "frame") {
      const t0 = performance.now();
      let ts = m.ts; if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
      const out = { type: "result", id: m.id, w: m.bitmap.width, h: m.bitmap.height, dets: [], hands: null };
      if (detector) {
        const r = detector.detectForVideo(m.bitmap, ts);
        out.dets = r.detections.map(d => ({
          x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height,
          name: d.categories[0].categoryName, score: d.categories[0].score }));
      }
      if (m.hands && hands) {
        const r = hands.detectForVideo(m.bitmap, ts);
        out.hands = r.landmarks.map(l => l.map(p => [p.x, p.y]));
      }
      m.bitmap.close();
      out.ms = performance.now() - t0;
      self.postMessage(out);
    }
  } catch (e) {
    if (m.bitmap) try { m.bitmap.close(); } catch (_) {}
    self.postMessage({ type: "error", id: m.id, message: String(e && e.message || e) });
  }
};
