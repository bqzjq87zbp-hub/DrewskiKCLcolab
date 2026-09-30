/**
 * The photograph viewer.
 *
 * Native <dialog> for focus trapping and Escape, then a real inspection layer
 * on top: click or wheel to zoom about the pointer, drag to pan while zoomed,
 * swipe or drag down to dismiss while not, arrow keys throughout, and a
 * filmstrip that tracks position. Neighbours preload so paging never blanks.
 */
import { onFrame, clamp, damp, reduced, el } from "./motion.js";

const MAX_Z = 4;

export function createLightbox() {
  const img = el("img", { class: "lb-img", alt: "", draggable: "false" });
  const stage = el("div", { class: "lb-stage", dataset: { cursor: "zoom", cursorLabel: "Zoom" } }, img);
  const title = el("strong", { class: "lb-title", id: "lb-title" });
  const counter = el("span", { class: "lb-counter" });
  const status = el("p", { class: "lb-status", role: "status", "aria-live": "polite" });

  const prev = el("button", { class: "lb-nav lb-prev", type: "button", "aria-label": "Previous photograph" }, "←");
  const next = el("button", { class: "lb-nav lb-next", type: "button", "aria-label": "Next photograph" }, "→");
  const close = el("button", { class: "lb-close", type: "button", "aria-label": "Close viewer" }, "Close");
  const zoomOut = el("button", { class: "lb-zoom", type: "button", "aria-label": "Zoom out" }, "−");
  const zoomIn = el("button", { class: "lb-zoom", type: "button", "aria-label": "Zoom in" }, "+");
  const strip = el("div", { class: "lb-strip", role: "tablist", "aria-label": "Photographs in this collection" });

  const dialog = el("dialog", { class: "lb", "aria-labelledby": "lb-title" },
    el("div", { class: "lb-bar" }, counter, title, el("div", { class: "lb-tools" }, zoomOut, zoomIn, close)),
    stage, prev, next,
    el("div", { class: "lb-foot" }, strip, status),
  );
  document.body.append(dialog);

  let items = [], index = 0, thumbs = [];
  let z = 1, tz = 1, px = 0, py = 0, tpx = 0, tpy = 0;   // zoom + pan, current/target
  let stop = null, dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, dismiss = 0;

  const settled = () =>
    Math.abs(z - tz) < 0.001 && Math.abs(px - tpx) < 0.2 && Math.abs(py - tpy) < 0.2;

  function paint() {
    img.style.transform = `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0) scale(${z.toFixed(4)})`;
    stage.dataset.zoomed = z > 1.02 ? "true" : "false";
  }
  function run() {
    if (reduced()) { z = tz; px = tpx; py = tpy; paint(); return; }
    stop ??= onFrame((_, dt) => {
      z = damp(z, tz, 16, dt); px = damp(px, tpx, 16, dt); py = damp(py, tpy, 16, dt);
      paint();
      if (settled()) { z = tz; px = tpx; py = tpy; paint(); stop?.(); stop = null; return false; }
      return true;
    });
  }
  function clampPan() {
    const r = stage.getBoundingClientRect();
    const limX = Math.max(0, (r.width * (tz - 1)) / 2);
    const limY = Math.max(0, (r.height * (tz - 1)) / 2);
    tpx = clamp(tpx, -limX, limX); tpy = clamp(tpy, -limY, limY);
  }
  function setZoom(nz, cx, cy) {
    const r = stage.getBoundingClientRect();
    const prevZ = tz;
    tz = clamp(nz, 1, MAX_Z);
    if (tz === 1) { tpx = 0; tpy = 0; }
    else if (cx != null) {
      // Keep the point under the cursor fixed while scaling.
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const k = tz / prevZ;
      tpx = (tpx - dx) * k + dx; tpy = (tpy - dy) * k + dy;
      clampPan();
    }
    run();
  }

  function preload(i) {
    const it = items[i]; if (!it) return;
    const p = new Image(); p.decoding = "async"; p.src = it.full || it.src;
  }

  function show(i, { announce = true } = {}) {
    index = (i + items.length) % items.length;
    const it = items[index];
    tz = 1; tpx = 0; tpy = 0; z = 1; px = 0; py = 0; paint();
    img.alt = it.alt || "";
    img.src = it.full || it.src;
    title.textContent = it.title;
    counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    if (announce) status.textContent = "Loading photograph…";
    img.decode?.().then(() => { status.textContent = ""; }).catch(() => {
      status.textContent = "This photograph could not load.";
    });
    thumbs.forEach((t, n) => {
      const on = n === index;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) t.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced() ? "instant" : "smooth" });
    });
    preload(index + 1); preload(index - 1);
  }

  const go = (d) => show(index + d);

  // ---- pointer: zoom, pan, swipe, drag-to-dismiss -------------------------
  stage.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY; ox = tpx; oy = tpy; dismiss = 0;
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    if (tz > 1.02) { tpx = ox + dx; tpy = oy + dy; clampPan(); run(); }
    else {
      dismiss = dy;
      dialog.style.setProperty("--drag-y", `${dy * 0.6}px`);
      dialog.style.setProperty("--drag-o", String(clamp(1 - Math.abs(dy) / 420, 0.25, 1)));
      dialog.dataset.dragging = "true";
    }
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    stage.releasePointerCapture?.(e.pointerId);
    delete dialog.dataset.dragging;
    dialog.style.removeProperty("--drag-y"); dialog.style.removeProperty("--drag-o");
    if (tz <= 1.02 && moved) {
      const dx = e.clientX - sx;
      if (Math.abs(dismiss) > 130) { hide(); return; }         // drag down to dismiss
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dismiss)) { go(dx < 0 ? 1 : -1); return; }
    }
    if (!moved) setZoom(tz > 1.02 ? 1 : 2.4, e.clientX, e.clientY);  // tap toggles zoom
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    setZoom(tz * (e.deltaY < 0 ? 1.16 : 1 / 1.16), e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener("dblclick", (e) => { e.preventDefault(); setZoom(tz > 1.02 ? 1 : MAX_Z, e.clientX, e.clientY); });

  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  close.addEventListener("click", () => hide());
  zoomIn.addEventListener("click", () => setZoom(tz * 1.5));
  zoomOut.addEventListener("click", () => setZoom(tz / 1.5));

  dialog.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowRight") { e.preventDefault(); go(1); }
    else if (k === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (k === "+" || k === "=") { e.preventDefault(); setZoom(tz * 1.5); }
    else if (k === "-") { e.preventDefault(); setZoom(tz / 1.5); }
    else if (k === "0") { e.preventDefault(); setZoom(1); }
  });
  // Clicking the letterbox area (never the photograph) closes.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) hide(); });

  function hide() { if (dialog.open) dialog.close(); }
  dialog.addEventListener("close", () => {
    stop?.(); stop = null;
    document.documentElement.classList.remove("lb-open");
    returnFocus?.isConnected && returnFocus.focus({ preventScroll: true });
  });

  let returnFocus = null;

  function open(collection, i, trigger) {
    items = collection.items;
    returnFocus = trigger || document.activeElement;
    strip.replaceChildren();
    thumbs = items.map((it, n) => {
      const t = el("button", {
        class: "lb-thumb", type: "button", role: "tab",
        "aria-label": it.title, "aria-selected": "false", tabIndex: -1,
      }, el("img", { src: it.src, alt: "", loading: "lazy", decoding: "async" }));
      t.addEventListener("click", () => show(n));
      strip.append(t);
      return t;
    });
    show(i, { announce: true });
    document.documentElement.classList.add("lb-open");
    if (!dialog.open) dialog.showModal();
  }

  return { open, close: hide, dialog, get open$() { return dialog.open; } };
}
