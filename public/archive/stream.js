/**
 * A collection, browsed as a horizontal contact strip.
 *
 * Pointer drag with real inertia, wheel mapped to lateral travel, keyboard
 * arrows, and rubber-banded ends. Coarse pointers get native momentum
 * scrolling instead of a synthesized one; reduced motion gets a plain vertical
 * grid with no drag surface at all.
 */
import { onFrame, clamp, reduced, coarse, reveal, el } from "./motion.js";

const STRIP_H = 0.62;   // fraction of viewport height a photograph occupies

export function buildStream({ collection, onEnlarge }) {
  const grid = reduced();
  const native = coarse() && !grid;

  const root = el("div", {
    class: "stream", dataset: { mode: grid ? "grid" : native ? "native" : "drag" },
  });
  const track = el("div", { class: "stream-track" });
  root.append(track);

  const figures = collection.items.map((item, i) => {
    const img = el("img", {
      class: "shot-img", src: item.src, alt: item.alt,
      loading: i < 4 ? "eager" : "lazy", decoding: "async",
      width: item.width, height: item.height,
    });
    const btn = el("button", {
      class: "shot", type: "button",
      dataset: { i: String(i), cursor: "view", cursorLabel: "View" },
      "aria-label": `Enlarge ${item.title}`,
      style: { "--ar": (item.width / item.height).toFixed(4) },
    }, img, el("span", { class: "shot-num", text: String(i + 1).padStart(2, "0"), "aria-hidden": "true" }));
    btn.addEventListener("click", () => { if (!dragged) onEnlarge(i, btn); });
    track.append(btn);
    return btn;
  });

  // ---- reduced motion: nothing else to wire -------------------------------
  if (grid) {
    reveal(figures, { stagger: 60 });
    return { root, focusFirst: () => figures[0]?.focus(), destroy() { root.remove(); } };
  }
  if (native) {
    return { root, focusFirst: () => figures[0]?.focus(), destroy() { root.remove(); } };
  }

  // ---- drag model ---------------------------------------------------------
  let x = 0, vx = 0, max = 0, dragging = false, dragged = false, lastX = 0, lastT = 0, stop = null;

  const measure = () => {
    max = Math.max(0, track.scrollWidth - root.clientWidth);
    root.style.setProperty("--strip-h", `${Math.round(innerHeight * STRIP_H)}px`);
  };
  measure();
  new ResizeObserver(() => { measure(); x = clamp(x, 0, max); paint(); }).observe(root);

  function paint() { track.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`; }

  function run() {
    stop ??= onFrame((_, dt) => {
      if (dragging) return true;
      if (Math.abs(vx) > 0.5) {
        x += vx * dt;
        vx *= Math.exp(-4.2 * dt);              // inertia decay
      } else vx = 0;
      // Rubber band back inside the ends.
      if (x < 0) { x += (0 - x) * Math.min(1, dt * 12); vx = 0; }
      else if (x > max) { x += (max - x) * Math.min(1, dt * 12); vx = 0; }
      paint();
      const moving = Math.abs(vx) > 0.5 || x < -0.5 || x > max + 0.5;
      if (!moving) { stop?.(); stop = null; return false; }
      return true;
    });
  }

  root.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    dragging = true; dragged = false; vx = 0;
    lastX = e.clientX; lastT = performance.now();
    root.setPointerCapture?.(e.pointerId);
    root.dataset.dragging = "true";
  });
  root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    if (Math.abs(dx) > 2) dragged = true;
    const now = performance.now(), dt = Math.max(8, now - lastT) / 1000;
    vx = -dx / dt;                                // px per second
    lastX = e.clientX; lastT = now;
    x = x - dx;
    if (x < 0) x = x * 0.4;                       // resistance past the ends
    if (x > max) x = max + (x - max) * 0.4;
    paint();
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false; delete root.dataset.dragging;
    root.releasePointerCapture?.(e.pointerId);
    if (performance.now() - lastT > 120) vx = 0;  // released after a pause: no throw
    run();
    setTimeout(() => { dragged = false; }, 0);
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);

  root.addEventListener("wheel", (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    const next = clamp(x + d, 0, max);
    // Let the page scroll away at the ends instead of trapping the wheel.
    if (next === x) return;
    e.preventDefault();
    x = next; vx = 0; paint(); run();
  }, { passive: false });

  root.addEventListener("keydown", (e) => {
    const step = root.clientWidth * 0.7;
    if (e.key === "ArrowRight") { x = clamp(x + step, 0, max); }
    else if (e.key === "ArrowLeft") { x = clamp(x - step, 0, max); }
    else if (e.key === "Home") { x = 0; }
    else if (e.key === "End") { x = max; }
    else return;
    e.preventDefault(); vx = 0; paint(); run();
  });

  // Keyboard focus must always pull its photograph into view.
  track.addEventListener("focusin", (e) => {
    const btn = e.target.closest(".shot");
    if (!btn) return;
    const left = btn.offsetLeft, right = left + btn.offsetWidth;
    if (left < x) x = clamp(left - 24, 0, max);
    else if (right > x + root.clientWidth) x = clamp(right - root.clientWidth + 24, 0, max);
    vx = 0; paint();
  });

  paint();
  return {
    root,
    focusFirst: () => figures[0]?.focus(),
    scrollToIndex(i) {
      const btn = figures[i]; if (!btn) return;
      x = clamp(btn.offsetLeft - (root.clientWidth - btn.offsetWidth) / 2, 0, max);
      vx = 0; paint();
    },
    destroy() { stop?.(); root.remove(); },
  };
}
