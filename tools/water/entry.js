/**
 * Living-water overlay. Renders the committed video frame through a WebGPU water
 * shader so the sea keeps moving while scroll is idle. Purely additive: it observes
 * the aisle's existing kclaisleframe events and the committed <img>; on any failure
 * it removes itself and the ordinary image pipeline continues untouched.
 */
import { init, effect, surface, sampler, frameLoop, frame } from "vgpu";
import { wgsl } from "./water.resolved.json";

const FRAME_W = 1280, FRAME_H = 960;

export async function mountWaterLayer(viewport) {
  if (new URLSearchParams(location.search).get("water") === "off") return null;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const canvas = document.createElement("canvas");
  canvas.className = "aisle-water";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    zIndex: "5", pointerEvents: "none",
  });
  canvas.hidden = true;
  viewport.append(canvas);

  let gpu, plane, canvasSurface, tex, loop = null, destroyed = false;
  let adoptSeq = 0; // generation counter: only the latest adoption may commit state
  let hasFrame = false, shownFrame = -1, inViewport = true;
  const teardown = () => {
    destroyed = true; adoptSeq++; loop?.stop(); loop = null;
    canvas.remove();
    try { gpu?.dispose?.(); } catch {}
  };

  try {
    gpu = await init();
    const coarse = matchMedia("(pointer: coarse)").matches;
    canvasSurface = surface(gpu, canvas, {
      dpr: coarse ? [1, 1.5] : [1, 2],
      // The overlay composites over the photograph instead of replacing it.
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });
    tex = gpu.device.createTexture({
      size: [FRAME_W, FRAME_H], format: "rgba8unorm",
      // copyExternalImageToTexture REQUIRES render_attachment on the destination.
      usage: ["texture_binding", "copy_dst", "render_attachment"],
    });
    plane = effect(gpu, wgsl, {
      set: {
        params: {
          time: 0, travel: 0, intensity: 0.22, strength: 0.006, shimmer: 0.55,
          waterline: 0.835, feather: 0.06,
          coverScale: [1, 1], coverOffset: [0, 0],
        },
        frameTex: tex,
        frameSamp: sampler(gpu, { magFilter: "linear", minFilter: "linear" }),
      },
    });
  } catch {
    teardown();
    return null; // no adapter: the ordinary image pipeline is already on screen
  }
  // A lost device (driver reset, GPU process crash) silently kills the loop while
  // the canvas keeps covering the live image pipeline. Fail over to the imgs.
  gpu.gpu.lost.then(() => { if (!destroyed) teardown(); });

  // Same object-fit:cover / 52% 86% mapping the frame <img> and easel projection use.
  function updateCover() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    if (!vw || !vh) return;
    const k = Math.max(vw / FRAME_W, vh / FRAME_H);
    const ox = (vw - FRAME_W * k) * 0.52, oy = (vh - FRAME_H * k) * 0.86;
    plane.set({ params: {
      coverScale: [vw / (FRAME_W * k), vh / (FRAME_H * k)],
      coverOffset: [-ox / (FRAME_W * k), -oy / (FRAME_H * k)],
    } });
  }

  const start = performance.now();
  let travelTarget = 0, travel = 0, lastTick = 0;
  function running() { return hasFrame && inViewport && !document.hidden && !destroyed; }
  function sync() {
    if (loop && !running()) { loop.stop(); loop = null; }
    if (!loop && running()) {
      lastTick = performance.now();
      loop = frameLoop(gpu, (f) => {
        const now = performance.now(), dt = Math.min(0.1, (now - lastTick) / 1000);
        lastTick = now;
        // Ease toward the committed frame's walk time so scrubbing streams the
        // water smoothly instead of stepping with each frame commit.
        travel += (travelTarget - travel) * Math.min(1, dt * 6);
        plane.set({ params: { time: (now - start) / 1000, travel } });
        f.pass(canvasSurface, plane);
      });
    }
    canvas.hidden = !hasFrame;
  }

  async function adoptFrame(img) {
    const index = Number(img?.dataset.sourceFrame ?? -1);
    if (!img || !img.complete || (index === shownFrame && hasFrame)) return;
    // The image and easels already committed this index together. Do not let an
    // older opaque water frame cover them while bitmap creation/upload awaits.
    // Reveal this overlay only after the matching frame is uploaded and painted.
    hasFrame = false;
    sync();
    const seq = ++adoptSeq;
    try {
      const bitmap = await createImageBitmap(img);
      // Stale check after the only await before the copy: an out-of-order decode
      // must never upload over a newer frame or resurrect a suppressed layer.
      if (destroyed || seq !== adoptSeq) { bitmap.close(); return; }
      // WebGPU reports upload problems asynchronously; without a scope a failed
      // copy leaves the texture black and the canvas would cover the site with it.
      gpu.gpu.pushErrorScope("validation");
      gpu.gpu.queue.copyExternalImageToTexture(
        { source: bitmap }, { texture: tex.gpu }, { width: FRAME_W, height: FRAME_H });
      const uploadError = await gpu.gpu.popErrorScope();
      bitmap.close();
      if (uploadError) throw uploadError;
      if (destroyed || seq !== adoptSeq) return;
      const firstFrame = shownFrame === -1;
      shownFrame = index; hasFrame = true;
      const mt = Number(img.dataset.mediaTime);
      if (Number.isFinite(mt)) { travelTarget = mt; if (firstFrame) travel = mt; } // snap, don't surge, on a mid-walk mount
      if (!loop) frame(gpu, (f) => f.pass(canvasSurface, plane)); // paint before sync starts the loop
      sync();
    } catch {
      teardown(); // decode/upload failure: fall back to the plain img silently
    }
  }

  viewport.addEventListener("kclaisleframe", (event) => {
    if (destroyed) return;
    if (event.detail.frameIndex === null) { adoptSeq++; hasFrame = false; shownFrame = -1; sync(); return; }
    if (Number.isFinite(event.detail.mediaTime)) travelTarget = event.detail.mediaTime;
    void adoptFrame(viewport.querySelector(".aisle-video-frame"));
  });
  new ResizeObserver(() => { if (!destroyed) updateCover(); }).observe(viewport);
  new IntersectionObserver((entries) => {
    inViewport = entries[0]?.isIntersecting ?? true; sync();
  }).observe(viewport);
  document.addEventListener("visibilitychange", sync);

  updateCover();
  void adoptFrame(viewport.querySelector(".aisle-video-frame")); // a frame may already be committed
  return { destroy: teardown, getState: () => ({ travel, travelTarget, shownFrame, hasFrame, looping: !!loop }) };
}
