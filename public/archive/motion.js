/**
 * The single motion system for the archive layer.
 *
 * One easing, one distance, one stagger, one rAF. Everything below the pier
 * walk subscribes here instead of adding its own scroll listener, so the aisle
 * keeps sole ownership of scroll behavior and nothing ever fights it.
 */

export const EASE = "cubic-bezier(.22,1,.36,1)";
export const DUR = 760;          // ms, the one entrance duration
export const DIST = 26;          // px, the one entrance distance
export const STAGGER = 80;       // ms between siblings

const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
const coarseQuery = matchMedia("(pointer: coarse)");
export const reduced = () => reducedQuery.matches;
export const coarse = () => coarseQuery.matches;
export const onMotionChange = (fn) => reducedQuery.addEventListener("change", fn);

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing: same feel at 60hz and 144hz. */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

// ---- one shared frame loop ------------------------------------------------
const readers = new Set();
let running = false, last = 0, lastY = 0;

/** Published scroll velocity in px/s, smoothed. Read by skew and drift layers. */
export const signal = { velocity: 0, direction: 1, y: 0 };

function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;
  const y = scrollY, vh = innerHeight;
  const raw = (y - lastY) / Math.max(dt, 0.001);
  lastY = y;
  signal.velocity = damp(signal.velocity, raw, 12, dt);
  if (Math.abs(raw) > 1) signal.direction = raw > 0 ? 1 : -1;
  signal.y = y;
  let wants = false;
  for (const r of readers) {
    try { if (r(y, dt, vh) !== false) wants = true; }
    catch { readers.delete(r); }
  }
  // Keep spinning while any subscriber reports unsettled state; otherwise idle
  // until the next scroll/resize so a still page costs nothing.
  // Keep the loop alive while the page is still decelerating so velocity
  // readers settle instead of freezing mid-skew.
  running = (wants || Math.abs(signal.velocity) > 2) && readers.size > 0;
  if (running) requestAnimationFrame(frame);
  else { last = 0; signal.velocity = 0; }
}

export function kick() {
  if (running || !readers.size) return;
  running = true;
  requestAnimationFrame(frame);
}

/** Subscribe to the shared loop. Return false from fn when settled. */
export function onFrame(fn) {
  readers.add(fn);
  kick();
  return () => readers.delete(fn);
}

addEventListener("scroll", kick, { passive: true });
addEventListener("resize", kick, { passive: true });
addEventListener("orientationchange", kick, { passive: true });

// ---- entrance reveals -----------------------------------------------------
let revealObserver = null;

/**
 * One-shot staggered entrance. Never re-fires, never hides anything when
 * reduced motion is on, and never runs before the element is in the document.
 */
export function reveal(nodes, { stagger = STAGGER, base = 0 } = {}) {
  const list = [...nodes].filter(Boolean);
  if (!list.length) return;
  if (reduced()) { list.forEach((n) => n.classList.add("is-in")); return; }

  revealObserver ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      revealObserver.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.1 });

  list.forEach((node, i) => {
    node.classList.add("will-in");
    node.style.setProperty("--in-delay", base + i * stagger + "ms");
    revealObserver.observe(node);
  });
}

// ---- small DOM helper -----------------------------------------------------
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
}

/** Split text into per-word spans for kinetic entrances. */
export function splitWords(text, cls = "kw") {
  return text.split(/(\s+)/).map((w, i) => {
    if (!w.trim()) return document.createTextNode(w);
    const s = el("span", { class: cls });
    s.style.setProperty("--kw-i", String(i));
    s.textContent = w;
    return s;
  });
}
