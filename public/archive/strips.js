/**
 * The four collection sections. Each is one continuous line of photographs,
 * and each carries a different signature technique so they never compete:
 *
 *   branding  -> pinned horizontal scrub   (scroll drives lateral travel)
 *   families  -> infinite drift marquee    (auto-drifts, throwable, wraps)
 *   headshots -> velocity skew + tilt      (the line leans with scroll speed)
 *   coastal   -> scroll-scrubbed shuttle   (one photograph at a time, pinned)
 *
 * Every builder degrades to the same place: a plain readable line you can swipe
 * on touch, and a static grid under reduced motion.
 */
import { onFrame, clamp, damp, reduced, coarse, reveal, signal, el, splitWords } from "./motion.js";

const shot = (item, i, onEnlarge) => {
  const btn = el("button", {
    class: "shot", type: "button",
    dataset: { i: String(i), cursor: "view", cursorLabel: "View" },
    "aria-label": `Enlarge ${item.title}`,
    style: { "--ar": (item.width / item.height).toFixed(4) },
  },
    el("img", {
      class: "shot-img", src: item.src, alt: item.alt,
      loading: i < 3 ? "eager" : "lazy", decoding: "async",
      width: item.width, height: item.height, draggable: "false",
    }),
    el("span", { class: "shot-num", text: String(i + 1).padStart(2, "0"), "aria-hidden": "true" }));
  btn.addEventListener("click", (e) => { if (!btn.dataset.dragged) onEnlarge(i, btn); });
  return btn;
};

function sectionShell(c, index, technique) {
  const head = el("header", { class: "sec-head" },
    el("p", { class: "sec-eyebrow" },
      el("span", { class: "sec-num", text: String(index + 1).padStart(2, "0") }),
      el("span", { text: technique })),
    el("h2", { class: "sec-title" }, splitWords(c.title)),
    el("p", { class: "sec-meta" },
      el("span", { text: `${c.items.length} photographs` }),
      el("span", { class: "sec-hint", text: hintFor(technique) })));
  const inner = el("div", { class: "sec-inner" }, head);
  const section = el("section", {
    class: "sec", id: c.id, dataset: { chapter: c.id },
    "aria-labelledby": `${c.id}-title`,
  }, inner);
  head.querySelector(".sec-title").id = `${c.id}-title`;
  reveal([head.querySelector(".sec-eyebrow"), head.querySelector(".sec-title"), head.querySelector(".sec-meta")]);
  return { section, head, inner };
}

const hintFor = (t) => reduced() ? "Select a photograph to enlarge it"
  : coarse() ? "Swipe the line, tap to enlarge"
  : { "Pinned scrub": "Keep scrolling to travel the line",
      "Infinite drift": "Drag to throw the line",
      "Velocity skew": "Keep scrolling: all 31 pass through here",
      "Scroll shuttle": "Scroll to advance one frame at a time" }[t];

// ---------------------------------------------------------------- 01 scrub --
export function pinnedScrub({ collection, onEnlarge }) {
  const { section, inner } = sectionShell(collection, 0, "Pinned scrub");
  const track = el("div", { class: "line-track" }, collection.items.map((it, i) => shot(it, i, onEnlarge)));
  const viewport = el("div", { class: "line line-scrub", dataset: { cursor: "drag", cursorLabel: "Scroll" } }, track);
  inner.append(el("div", { class: "sec-stage" }, viewport));

  if (reduced() || coarse()) { section.dataset.fallback = coarse() ? "swipe" : "grid"; return { section }; }

  // 1:1 with the line, matching the headshots pass: a pixel of scroll is a
  // pixel of travel, so every scrub section on the site is paced the same.
  const RATIO = 1.0;
  let travel = 0, span = 0;
  const size = () => {
    span = Math.max(0, track.scrollWidth - viewport.clientWidth);
    section.style.setProperty("--pin-h", `${innerHeight + span * RATIO}px`);
  };
  size();
  new ResizeObserver(size).observe(viewport);

  onFrame((y, dt, vh) => {
    const top = section.offsetTop;
    const p = clamp((y - top) / Math.max(1, span * RATIO));
    const before = travel;
    travel = damp(travel, p * span, 12, dt);
    if (Math.abs(travel - p * span) < 0.25) travel = p * span;
    track.style.transform = `translate3d(${-travel.toFixed(2)}px,0,0)`;
    return y + vh > top && y < top + span * RATIO + vh && Math.abs(travel - before) > 0.05;
  });
  return { section };
}

// ---------------------------------------------------------------- 02 drift --
export function infiniteDrift({ collection, onEnlarge }) {
  const { section, inner } = sectionShell(collection, 1, "Infinite drift");
  const build = (copy) => collection.items.map((it, i) => {
    const s = shot(it, i, onEnlarge);
    if (copy) { s.setAttribute("aria-hidden", "true"); s.tabIndex = -1; }
    return s;
  });
  // Two copies make the wrap seamless; only the first is in the a11y tree.
  const track = el("div", { class: "line-track" }, build(false), build(true));
  const viewport = el("div", { class: "line line-drift", dataset: { cursor: "grab", cursorLabel: "Drag" } }, track);
  inner.append(el("div", { class: "sec-stage" }, viewport));

  if (reduced()) { section.dataset.fallback = "grid"; return { section }; }
  if (coarse()) { section.dataset.fallback = "swipe"; return { section }; }

  let x = 0, vx = 0, half = 0, dragging = false, lastX = 0, lastT = 0, inView = false;
  const size = () => { half = track.scrollWidth / 2; };
  size();
  new ResizeObserver(size).observe(track);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0 }).observe(section);

  onFrame((_, dt) => {
    if (!inView) return false;
    if (!dragging) {
      x += (vx || 26) * dt;                       // idle drift, or the throw
      vx *= Math.exp(-1.6 * dt);
      if (Math.abs(vx) < 26) vx = 0;
    }
    if (half) x = ((x % half) + half) % half;     // seamless wrap
    track.style.transform = `translate3d(${-x.toFixed(2)}px,0,0)`;
    return true;
  });

  viewport.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    dragging = true; lastX = e.clientX; lastT = performance.now();
    viewport.setPointerCapture?.(e.pointerId);
    viewport.dataset.dragging = "true";
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, now = performance.now();
    if (Math.abs(dx) > 2) viewport.querySelectorAll(".shot").forEach((s) => (s.dataset.dragged = "1"));
    vx = -dx / Math.max(0.008, (now - lastT) / 1000);
    lastX = e.clientX; lastT = now;
    x -= dx;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false; delete viewport.dataset.dragging;
    viewport.releasePointerCapture?.(e.pointerId);
    setTimeout(() => viewport.querySelectorAll(".shot").forEach((s) => delete s.dataset.dragged), 0);
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  return { section };
}

// ----------------------------------------------------------------- 03 skew --
export function velocitySkew({ collection, onEnlarge }) {
  const { section, inner } = sectionShell(collection, 2, "Velocity skew");
  const shots = collection.items.map((it, i) => shot(it, i, onEnlarge));
  const track = el("div", { class: "line-track" }, shots);
  const viewport = el("div", { class: "line line-skew", dataset: { cursor: "drag", cursorLabel: "Scroll" } }, track);
  inner.append(el("div", { class: "sec-stage" }, viewport));

  if (reduced()) { section.dataset.fallback = "grid"; return { section }; }
  if (coarse()) { section.dataset.fallback = "swipe"; return { section }; }

  // Pinned like the scrub so all 31 photographs pass before the page moves on.
  // 1:1 with the line: a pixel of scroll is a pixel of travel, the slowest and
  // most deliberate pass on the site. The skew is what makes it its own.
  const RATIO = 1.0;
  let travel = 0, span = 0, skew = 0;
  const size = () => {
    span = Math.max(0, track.scrollWidth - viewport.clientWidth);
    section.style.setProperty("--pin-h", `${innerHeight + span * RATIO}px`);
  };
  size();
  new ResizeObserver(size).observe(viewport);

  onFrame((y, dt, vh) => {
    const top = section.offsetTop;
    const p = clamp((y - top) / Math.max(1, span * RATIO));
    const before = travel;
    travel = damp(travel, p * span, 10, dt);
    if (Math.abs(travel - p * span) < 0.25) travel = p * span;
    const want = clamp(signal.velocity / 210, -6, 6);
    skew = damp(skew, want, 9, dt);
    track.style.transform = `translate3d(${-travel.toFixed(2)}px,0,0) skewY(${skew.toFixed(2)}deg)`;
    return y + vh > top && y < top + span * RATIO + vh
      && (Math.abs(travel - before) > 0.05 || Math.abs(skew) > 0.02);
  });

  // 3D tilt under the pointer, fine pointers only.
  for (const s of shots) {
    s.addEventListener("pointermove", (e) => {
      const r = s.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      s.style.setProperty("--tilt-x", `${(-dy * 11).toFixed(2)}deg`);
      s.style.setProperty("--tilt-y", `${(dx * 11).toFixed(2)}deg`);
    });
    s.addEventListener("pointerleave", () => {
      s.style.setProperty("--tilt-x", "0deg"); s.style.setProperty("--tilt-y", "0deg");
    });
  }
  return { section };
}

// -------------------------------------------------------------- 04 shuttle --
export function scrollShuttle({ collection, onEnlarge }) {
  const { section, inner } = sectionShell(collection, 3, "Scroll shuttle");
  const shots = collection.items.map((it, i) => shot(it, i, onEnlarge));
  const track = el("div", { class: "line-track" }, shots);
  const viewport = el("div", { class: "line line-shuttle" }, track);
  const readout = el("p", { class: "shuttle-readout", "aria-hidden": "true" },
    el("strong", { class: "shuttle-i", text: "01" }),
    el("span", { text: ` / ${String(collection.items.length).padStart(2, "0")}` }));
  inner.append(el("div", { class: "sec-stage" }, viewport, readout));

  if (reduced() || coarse()) { section.dataset.fallback = coarse() ? "swipe" : "grid"; return { section }; }

  const n = collection.items.length;
  let cur = 0, shown = -1, span = 0;

  // Same 1:1 law as the other pinned lines: a pixel of scroll is a pixel of
  // lateral travel. Here travel is measured between centred frames, which is
  // what this section actually moves.
  const RATIO = 1.0;
  const centreOf = (b) => b.offsetLeft + b.offsetWidth / 2 - viewport.clientWidth / 2;
  const size = () => {
    span = Math.max(0, centreOf(shots[n - 1]) - centreOf(shots[0]));
    section.style.setProperty("--pin-h", `${innerHeight + span * RATIO}px`);
  };
  size();
  new ResizeObserver(size).observe(viewport);

  onFrame((y, dt, vh) => {
    const top = section.offsetTop;
    const p = clamp((y - top) / Math.max(1, span * RATIO));
    cur = damp(cur, p * (n - 1), 14, dt);
    const i = Math.round(cur);
    if (i !== shown) {
      shown = i;
      shots.forEach((s, k) => s.classList.toggle("is-current", k === i));
      readout.querySelector(".shuttle-i").textContent = String(i + 1).padStart(2, "0");
    }
    // The whole line slides so the current frame sits centred.
    const target = shots[i];
    if (target) {
      const offset = target.offsetLeft + target.offsetWidth / 2 - viewport.clientWidth / 2;
      track.style.transform = `translate3d(${-offset.toFixed(2)}px,0,0)`;
    }
    return y + vh > top && y < top + span * RATIO + vh && Math.abs(cur - p * (n - 1)) > 0.005;
  });
  return { section };
}

export const BUILDERS = { pinnedScrub, infiniteDrift, velocitySkew, scrollShuttle };
