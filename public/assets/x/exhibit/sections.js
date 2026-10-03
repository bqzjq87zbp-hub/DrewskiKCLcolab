/* The rooms after the grid.
 *
 *   hall    /iw-webgl-world      walk the corridor; scroll is the camera
 *   palette /iw-horizontal-infinite + /iw-particles-physics
 *           each chapter's lead print on a pinned horizontal track (a native
 *           swipe rail on touch), opened by a tray of the colours measured
 *           from the photographs, which you can toss; tap one to find the
 *           photographs it came from, on the rail and in the grid
 *   reel    /iw-media-scrub + /iw-entrance-reveals + /iw-drag-gestures
 *           ten seconds under the pier, scrubbed by scroll inside a
 *           clip-path window that opens to full bleed, ending on a
 *           slide-to-confirm onto the pier walk
 *   stack   /iw-parallax-stack   the chapters as a deck of cards in their
 *           own moods, each settling under the next
 */
import { $, $$, h, esc, pad, clamp, lerp, damp, mixHex, luma, rgb01 } from "../util.js";
import { hall } from "../gl/hall.js";
import { stage } from "../gl/stage.js";
import { scrub, scroll, whenVisible } from "../core/scroll.js";
import { tilt } from "../core/cursor.js";
import { world } from "./physics.js";
import { go } from "../core/transition.js";
import { sound } from "../core/sound.js";
import * as prefs from "../core/prefs.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

/* ─── the hall ──────────────────────────────────────────────────────────── */
export function initHall(ctx, sec) {
  const pin = $(".hall-pin", sec);
  const cap = $(".hall-cur", sec), num = $(".hall-n", sec), bar = $(".hall-bar i", sec);
  const off = () => { sec.classList.add("is-off"); ScrollTrigger.refresh(); };
  if (!stage.ok || prefs.get().motion === "calm") return off();
  const coverPlate = ctx.plates.find((p) => p.src === ctx.cover);
  const c = hall({
    srcs: ctx.plates.map((p) => p.src), aspects: ctx.plates.map((p) => p.ar), cover: ctx.cover,
    coverAspect: coverPlate ? coverPlate.ar : 0.57, wall: mixHex(ctx.ex.hero || "#e5dfd5", "#0b0908", 0.74),
    rect: () => pin.getBoundingClientRect(),
  });
  if (!c) return off();
  whenVisible(sec, () => c.load(), "150% 0px 150% 0px");
  let last = -2;
  scrub(sec, (p) => {
    c.progress = p;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const i = c.plateAt(p);
    if (i !== last) {
      last = i;
      const pl = ctx.plates[i];
      cap.textContent = pl ? `${pl.kicker}. ${pl.caption}` : i === -1 && p > 0.85 ? `${ctx.issue.mark}, ${ctx.issue.issue}. The cover, at the end of the hall.` : "Scroll to walk. Move the pointer to look around.";
      num.textContent = pl ? `[${pad(pl.n)}]` : "";
    }
  }, { onToggle: (st) => { c.visible = st.isActive; } });
  ScrollTrigger.create({ trigger: sec, start: "top bottom", end: "bottom top", onToggle: (st) => { c.visible = st.isActive; } });
}

/* ─── the palette ───────────────────────────────────────────────────────── */
export function initPalette(ctx, sec) {
  const track = $(".range-track", sec);
  const prints = ctx.prints;
  const cards = $$(".gar", sec);
  cards.forEach((c) => tilt($(".gar-m", c), 6));

  // pinned horizontal track on wide pointer screens; native swipe rail elsewhere
  const wide = () => matchMedia("(min-width: 900px) and (hover: hover)").matches && prefs.get().motion === "full";
  let st = null;
  function setup() {
    if (st) { st.kill(); st = null; }
    gsap.set(track, { x: 0 });
    sec.classList.toggle("is-pinned", wide());
    if (!wide()) { sec.style.removeProperty("--range-h"); return; }
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    sec.style.setProperty("--range-h", `calc(100lvh + ${dist()}px)`);
    st = scrub(sec, (p) => gsap.set(track, { x: -dist() * p }));
  }
  setup();
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { setup(); ScrollTrigger.refresh(); }, 200); });
  prefs.onChange(({ key }) => { if (key === "motion") { setup(); ScrollTrigger.refresh(); } });

  /** Bring a chapter's card to the middle of the rail and pick out photographs in the grid. */
  function focusPrint(gi, hit) {
    const card = cards[gi];
    if (!card) return;
    cards.forEach((c, k) => c.classList.toggle("is-hit", k === gi));
    setTimeout(() => card.classList.remove("is-hit"), 3200);
    if (st) {
      const dist = Math.max(0, track.scrollWidth - innerWidth);
      const x = clamp(card.offsetLeft - innerWidth * 0.35, 0, dist);
      scroll.to(st.start + (dist ? (x / dist) * (st.end - st.start) : 0));
    } else {
      track.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
      scroll.to(sec, { offset: -60 });
    }
    const plates = hit && hit.length ? hit : [prints[gi].plate];
    ctx.grid.highlight(plates, { scroll: false, hold: 5000 });
    sound.play("chime");
  }
  /** A colour leads to the chapter that carries most of the photographs it came from. */
  function focusSwatch(sw) {
    const counts = prints.map((g) => sw.plates.filter((i) => ctx.plates[i].story === g.story).length);
    focusPrint(counts.indexOf(Math.max(...counts)), sw.plates);
  }
  ctx.focusPrint = focusPrint;
  ctx.focusSwatch = focusSwatch;
  sec.addEventListener("click", (e) => {
    const a = e.target.closest("[data-chapter]");
    if (!a) return;
    e.preventDefault();
    ctx.grid.goChapter(+a.dataset.chapter);
  });

  // the tray: the measured colours as bodies
  const tray = $(".tray", sec), cv = $("canvas", tray);
  const g2 = cv.getContext("2d");
  const W = world({ g: 2400, e: 0.35 });
  const swatches = ctx.palette.map((sw) => ({ sw, name: sw.name, cols: [sw.hex] }));
  let dpr = 1, running = false, dropped = false, held = null, downAt = null;
  function size() {
    const r = tray.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    W.resize(r.width, r.height);
  }
  function drop() {
    if (dropped) return;
    dropped = true;
    size();
    const r = Math.max(34, Math.min(58, W.w / 7.2));
    swatches.forEach((s, k) => {
      setTimeout(() => {
        s.body = W.add({ x: W.w * (0.2 + 0.6 * ((k * 0.37) % 1)), y: -r - k * 20, r: r * (0.88 + ((k * 7) % 5) * 0.05), vx: (k % 2 ? 1 : -1) * 90, spin: 0 });
        s.body.s = s;
        sound.play("thump", { gain: 0.08 });
      }, prefs.get().motion === "calm" ? 0 : k * 170);
    });
    start();
  }
  function draw() {
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, W.w, W.h);
    for (const b of W.bodies) {
      const s = b.s;
      g2.save();
      g2.translate(b.x, b.y);
      g2.rotate(b.a);
      g2.beginPath(); g2.arc(0, 0, b.r, 0, Math.PI * 2);
      g2.fillStyle = s.cols[0]; g2.fill();
      g2.lineWidth = 1; g2.strokeStyle = "rgba(0,0,0,.12)";
      g2.beginPath(); g2.arc(0, 0, b.r - 0.5, 0, Math.PI * 2); g2.stroke();
      g2.restore();
      // label stays upright
      const light = luma(s.cols[0]) > 0.45;
      g2.fillStyle = light ? "#1b1712" : "#f6f1e8";
      g2.font = `500 ${Math.max(9, b.r * 0.2)}px "Instrument Sans", sans-serif`;
      g2.textAlign = "center"; g2.textBaseline = "middle";
      const words = s.name.toUpperCase().split(" ");
      words.forEach((w, k) => g2.fillText(w, b.x, b.y + (k - (words.length - 1) / 2) * b.r * 0.24));
    }
  }
  function start() {
    if (running) return;
    running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      W.step(dt);
      draw();
      if (W.settled() && !held && W.bodies.length === swatches.length) { running = false; draw(); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", (e) => {
    const [x, y] = local(e);
    const b = W.pick(x, y);
    if (!b) return;
    e.preventDefault();
    held = b; downAt = { x, y, t: performance.now() };
    W.hold(b, x, y);
    cv.setPointerCapture(e.pointerId);
    start();
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    if (held) W.move(held, x, y);
    else cv.style.cursor = W.pick(x, y) ? "grab" : "";
  });
  const up = (e) => {
    if (!held) return;
    const [x, y] = local(e);
    const tap = downAt && Math.hypot(x - downAt.x, y - downAt.y) < 8 && performance.now() - downAt.t < 350;
    W.release(held);
    if (tap) focusSwatch(held.s.sw);
    else sound.play("thump", { gain: 0.12 });
    held = null;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  whenVisible(tray, drop, "0px 0px -20% 0px");
  // the tray's box settles after fonts, pinning and resizes; follow it
  new ResizeObserver(() => { if (dropped) { size(); start(); } }).observe(tray);
}

/* ─── the reel ──────────────────────────────────────────────────────────── */
export function initReel(ctx, sec) {
  const win = $(".reel-win", sec), vid = $("video", sec), tc = $(".reel-t", sec), fr = $(".reel-f", sec), cta = $(".reel-cta", sec);
  const calm = () => prefs.get().motion === "calm";
  let dur = 10.04, target = 0, ready = false;
  const FPS = 24;
  whenVisible(sec, () => { vid.preload = "auto"; vid.load(); }, "120% 0px 120% 0px");
  vid.addEventListener("loadedmetadata", () => { dur = vid.duration || dur; ready = true; });
  // iOS paints a seeked frame only after the video has played once; do that
  // silently on the first touch.
  const prime = () => { vid.play().then(() => vid.pause()).catch(() => {}); removeEventListener("touchstart", prime); };
  addEventListener("touchstart", prime, { passive: true });

  let lastSet = -1;
  gsap.ticker.add(() => {
    if (!ready || vid.seeking) return;
    if (Math.abs(target - lastSet) > 1 / (FPS * 2)) {
      lastSet = target;
      try { vid.currentTime = target; } catch (e) {}
    }
  });
  scrub(sec, (p) => {
    const open = clamp(p / 0.22);
    const e = 1 - Math.pow(1 - open, 3);
    const inset = calm() ? 0 : lerp(1, 0, e);
    win.style.clipPath = `inset(${(inset * 22).toFixed(2)}% ${(inset * 30).toFixed(2)}% ${(inset * 22).toFixed(2)}% ${(inset * 30).toFixed(2)}%)`;
    const vp = clamp((p - 0.12) / 0.8);
    target = vp * Math.max(0, dur - 0.05);
    const f = Math.round(vp * (dur * FPS - 1));
    const s = Math.floor(target), ff = Math.round((target - s) * FPS);
    tc.textContent = `00:${pad(s)}:${pad(ff)}`;
    fr.textContent = `frame ${pad(f, 3)} / ${pad(Math.round(dur * FPS), 3)}`;
    cta.classList.toggle("is-in", p > 0.9);
    sound.drive(Math.abs(scroll.v) / 40);
  });
  // calm motion: no scrubbing, just a player
  if (calm()) { vid.controls = true; vid.loop = true; }

  // slide to confirm, then the curl onto the pier
  const sl = $(".slide", sec), knob = $(".slide-k", sl), fill = $(".slide-fill", sl);
  let dragging = false, x0 = 0, x = 0, max = 0;
  const setX = (v) => { x = clamp(v, 0, max); sl.style.setProperty("--x", x + "px"); fill.style.transform = `scaleX(${max ? x / max : 0})`; };
  knob.addEventListener("pointerdown", (e) => {
    dragging = true; max = sl.clientWidth - knob.offsetWidth - 8; x0 = e.clientX - x;
    knob.setPointerCapture(e.pointerId); e.preventDefault();
  });
  knob.addEventListener("pointermove", (e) => { if (dragging) setX(e.clientX - x0); });
  const done = () => {
    sl.classList.add("done");
    sound.play("chime");
    go(ctx.walk, { color: ctx.roomColor, label: "The Walk" });
  };
  knob.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    if (x > max * 0.86) { setX(max); done(); }
    else gsap.to({ v: x }, { v: 0, duration: 0.5, ease: "expo.out", onUpdate() { setX(this.targets()[0].v); } });
  });
  // keyboard: the knob is a button; Enter or Space confirms
  knob.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); max = sl.clientWidth - knob.offsetWidth - 8; setX(max); done(); } });
}

/* ─── the stack ─────────────────────────────────────────────────────────── */
export function initStack(ctx, sec) {
  const cards = $$(".card", sec);
  cards.forEach((c, k) => {
    const next = cards[k + 1];
    if (!next) return;
    gsap.to($(".card-in", c), {
      scale: 0.93, opacity: 0.55, ease: "none",
      scrollTrigger: { trigger: next, start: "top 90%", end: "top 30%", scrub: true },
    });
  });
  sec.addEventListener("click", (e) => {
    const a = e.target.closest("[data-chapter]");
    if (!a) return;
    e.preventDefault();
    ctx.grid.goChapter(+a.dataset.chapter);
  });
}
