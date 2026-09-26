// Visor Scan: la IA corre aqui, en un hilo aparte, para que el video
// se dibuje siempre a 30 FPS aunque la deteccion tarde mas.
// Cada worker usa un solo motor (GPU o procesador). Para cambiar de motor o de
// modelo, la app crea un worker nuevo: recrear tareas en el mismo motor wasm
// puede abortarlo.
import { FilesetResolver, ObjectDetector, HandLandmarker, FaceDetector }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
let fileset = null, detector = null, hands = null, face = null, delegate = "—", lastTs = 0;

async function create(Task, urls, opts, order, fs = fileset) {
  const errs = [];
  for (const url of urls) {
    for (const d of order) {
      try {
        const t = await Task.createFromOptions(fs, { baseOptions: { modelAssetPath: url, delegate: d }, ...opts });
        return [t, d];
      } catch (e) { errs.push(`${d} ${url.split("/").pop()}: ${e && e.message || e}`); }
    }
  }
  throw new Error("no se pudo cargar el modelo · " + errs.join(" | ").slice(0, 400));
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === "init") {
      fileset = await FilesetResolver.forVisionTasks(WASM, true);            // modo modulo (worker)
      const first = m.prefer || "GPU", order = [first, first === "GPU" ? "CPU" : "GPU"];
      if (m.task === "hands") {
        // worker dedicado a manos: responde rapido para que los gestos se sientan inmediatos
        [hands, delegate] = await create(HandLandmarker, m.urls,
          { runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 }, order);
        // modo senas: tambien la cara, para saber si la mano esta en la barbilla, frente, pecho...
        // el motor en modo modulo solo se inicializa una vez por URL: la cara usa su propia instancia
        if (m.face) {
          const fs2 = { ...fileset, wasmLoaderPath: fileset.wasmLoaderPath + "?face" };
          [face] = await create(FaceDetector, m.faceUrls, { runningMode: "VIDEO", minDetectionConfidence: 0.5 }, order, fs2);
        }
      } else {
        [detector, delegate] = await create(ObjectDetector, m.urls,
          { runningMode: "VIDEO", scoreThreshold: 0.2, maxResults: 30 }, order);
      }
      self.postMessage({ type: "ready", delegate });
    } else if (m.type === "frame") {
      let ts = m.ts; if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
      const out = { type: "result", id: m.id, w: m.bitmap.width, h: m.bitmap.height, dets: [], hands: null, delegate };
      const t0 = performance.now();
      if (detector) {
        const r = detector.detectForVideo(m.bitmap, ts);
        out.dets = r.detections.map(d => ({
          x: d.boundingBox.originX, y: d.boundingBox.originY, w: d.boundingBox.width, h: d.boundingBox.height,
          name: d.categories[0].categoryName, score: d.categories[0].score }));
      }
      if (hands) {
        const r = hands.detectForVideo(m.bitmap, ts);
        out.hands = r.landmarks.map((l, i) => ({
          pts: l.map(p => [p.x, p.y]),
          label: (r.handedness[i] && r.handedness[i][0] && r.handedness[i][0].categoryName) || "H" + i }));
      }
      if (face && m.faceBitmap) {
        // la cara se busca en un recorte cuadrado (el modelo trabaja a 128x128: sin deformar)
        const fb = m.faceBitmap;
        const r = face.detectForVideo(fb, ts), d = r.detections[0];
        if (d) {
          const bb = d.boundingBox, W = fb.width, H = fb.height;
          out.face = { kp: d.keypoints.map(k => [k.x, k.y]),
                       box: [bb.originX / W, bb.originY / H, bb.width / W, bb.height / H] };
        }
      }
      out.detMs = performance.now() - t0;
      m.bitmap.close();
      if (m.faceBitmap) m.faceBitmap.close();
      out.ms = performance.now() - t0;
      self.postMessage(out);
    }
  } catch (e) {
    if (m.bitmap) try { m.bitmap.close(); } catch (_) {}
    if (m.faceBitmap) try { m.faceBitmap.close(); } catch (_) {}
    self.postMessage({ type: "error", id: m.id, message: String(e && e.message || e) });
  }
};
