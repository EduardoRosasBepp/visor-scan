// Visor Scan: la IA corre aqui, en un hilo aparte, para que el video
// se dibuje siempre a 30 FPS aunque la deteccion tarde mas.
// Cada worker usa un solo motor (GPU o procesador). Para cambiar de motor o de
// modelo, la app crea un worker nuevo: recrear tareas en el mismo motor wasm
// puede abortarlo.
import { FilesetResolver, ObjectDetector, HandLandmarker }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
let fileset = null, detector = null, hands = null, delegate = "—", lastTs = 0;

async function create(Task, urls, opts, order) {
  for (const url of urls) {
    for (const d of order) {
      try {
        const t = await Task.createFromOptions(fileset, { baseOptions: { modelAssetPath: url, delegate: d }, ...opts });
        return [t, d];
      } catch (e) { /* siguiente opcion */ }
    }
  }
  throw new Error("no se pudo cargar el modelo");
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === "init") {
      fileset = await FilesetResolver.forVisionTasks(WASM, true);            // modo modulo (worker)
      const first = m.prefer || "GPU";
      [detector, delegate] = await create(ObjectDetector, m.urls,
        { runningMode: "VIDEO", scoreThreshold: 0.2, maxResults: 30 }, [first, first === "GPU" ? "CPU" : "GPU"]);
      if (m.hands) [hands] = await create(HandLandmarker, m.handUrls, { runningMode: "VIDEO", numHands: 2 }, [delegate]);
      self.postMessage({ type: "ready", delegate });
    } else if (m.type === "frame") {
      let ts = m.ts; if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
      const out = { type: "result", id: m.id, w: m.bitmap.width, h: m.bitmap.height, dets: [], hands: null, delegate };
      const t0 = performance.now();
      const r = detector.detectForVideo(m.bitmap, ts);
      out.dets = r.detections.map(d => ({
        x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height,
        name: d.categories[0].categoryName, score: d.categories[0].score }));
      out.detMs = performance.now() - t0;
      if (m.hands && hands) out.hands = hands.detectForVideo(m.bitmap, ts).landmarks.map(l => l.map(p => [p.x, p.y]));
      m.bitmap.close();
      out.ms = performance.now() - t0;
      self.postMessage(out);
    }
  } catch (e) {
    if (m.bitmap) try { m.bitmap.close(); } catch (_) {}
    self.postMessage({ type: "error", id: m.id, message: String(e && e.message || e) });
  }
};
