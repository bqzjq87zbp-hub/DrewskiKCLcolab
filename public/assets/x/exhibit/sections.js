/* The rooms after the grid.
 *
 *   hall    /iw-webgl-world      walk a bright gallery to Kyle Kiyono's name on
 *           the end wall, then break through it into the palette below
 *   palette /iw-horizontal-infinite + /iw-particles-physics
 *           each chapter's lead print on a pinned horizontal track (a native
 *           swipe rail on touch), opened by a tray of the colours measured
 *           from the photographs, which you can toss; tap one to find the
 *           photographs it came from, on the rail and in the grid
 *   stack   /iw-parallax-stack   the chapters as a deck of cards in their
 *           own moods, each settling under the next
 */
import { $, $$, clamp, smooth, luma, appUrl, media } from "../util.js";
import { hall } from "../gl/hall.js";
import { stage } from "../gl/stage.js";
import { scrub, scroll, whenVisible } from "../core/scroll.js";
import { world } from "./physics.js";
import { sound } from "../core/sound.js";
import * as prefs from "../core/prefs.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

/* ─── the hall ──────────────────────────────────────────────────────────── */
export function initHall(ctx, sec) {
  const pin = $(".hall-pin", sec), ui = $(".hall-ui", sec), head = ui.firstElementChild;
  const cap = $(".hall-cur", sec), bar = $(".hall-bar", sec), fill = $("i", bar);
  const off = () => { sec.classList.add("is-off"); ScrollTrigger.refresh(); };
  if (!stage.ok || prefs.get().motion === "calm") return off();
  const tone = ctx.moods.hall.bg;
  const c = hall({
    srcs: ctx.plates.map((p) => p.src), aspects: ctx.plates.map((p) => p.ar),
    tone, accent: ctx.ex.acc, logo: appUrl("brand/kiyono-logo.png"),
    rect: () => pin.getBoundingClientRect(),
  });
  if (!c) return off();
  // looking around follows a mouse; a finger on a phone is scrolling the page
  const idle = media.fine() ? "Scroll to walk. Move the pointer to look around." : "Scroll to walk.";
  cap.textContent = idle;
  // the walk keeps one pace whatever the size of the issue
  sec.style.setProperty("--hall-h", Math.round(clamp(300 + ctx.plates.length * 10, 420, 640)) + "lvh");
  whenVisible(sec, () => c.load(), "150% 0px 150% 0px");
  const T = c.T;
  let last = -2, phase = "", open = false;
  const after = [];
  sec.style.setProperty("--hall-bg", tone);
  // a bright room until its end wall gives; then it wears the mood of the room below,
  // which is what shows through the break (the header reads it from the page)
  ctx.hallMood = () => (open ? ctx.moods.palette : ctx.moods.hall);
  /** The palette's first screen waits under the end wall (x.css): what it
   *  does on being seen waits for the wall to give. */
  ctx.afterHall = (fn) => (open ? fn() : after.push(fn));
  const centred = () => { const r = sec.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; };
  scrub(sec, (p) => {
    c.progress = p;
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    // the title steps aside for the end wall; caption and bar go when it gives
    head.style.opacity = (1 - smooth(clamp((p - 0.62) / 0.08))).toFixed(3);
    ui.style.opacity = bar.style.opacity = (1 - smooth(clamp((p - T.crack) / 0.03))).toFixed(3);
    const ph = c.phaseAt(p);
    if (ph !== phase) { phase = ph; sec.dataset.hallPhase = ph; }
    // the room opens at the burst, not the crack: until then its cream wall
    // fills the screen, and a header already in the palette's colour sat over it
    if ((p >= T.burst) !== open) {
      open = !open;
      sec.classList.toggle("is-open", open);
      sec.style.setProperty("--hall-bg", open ? "transparent" : tone);
      if (ctx.setMood && centred()) ctx.setMood(ctx.hallMood());
      // a soft thump as the wall gives (heard only if the visitor turned sound on)
      if (open) { sound.play("thump", { gain: 0.22 }); after.splice(0).forEach((fn) => fn()); }
    }
    const i = ph === "walk" ? c.plateAt(p) : -3;
    if (i !== last) {
      last = i;
      const pl = ctx.plates[i];
      cap.textContent = pl ? `${pl.kicker}. ${pl.caption}` : i === -3 ? "Kyle Kiyono, Kiyono Creative Lab" : idle;
    }
  });
  ScrollTrigger.create({ trigger: sec, start: "top bottom", end: "bottom top", onToggle: (st) => { c.visible = st.isActive; } });
}

/* ─── the palette ───────────────────────────────────────────────────────── */
export function initPalette(ctx, sec) {
  const track = $(".range-track", sec);
  const prints = ctx.prints;
  const cards = $$(".gar", sec);

  // pinned horizontal track on wide pointer screens; native swipe rail elsewhere
  const wide = () => matchMedia("(min-width: 900px) and (hover: hover)").matches && prefs.get().motion === "full";
  // through the hall's end wall you arrive in the palette, and it holds still a
  // quarter screen before the rail moves (x.css holds the unpinned one the same)
  const hold = () => (ctx.afterHall ? Math.round(innerHeight * 0.25) : 0);
  let st = null;
  function setup() {
    if (st) { st.kill(); st = null; }
    gsap.set(track, { x: 0 });
    sec.classList.toggle("is-pinned", wide());
    if (!wide()) { sec.style.removeProperty("--range-h"); return; }
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    sec.style.setProperty("--range-h", `calc(100lvh + ${dist() + hold()}px)`);
    st = scrub(sec, (p) => gsap.set(track, { x: -dist() * p }), { start: () => `top+=${hold()} top` });
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
  // under the hall's end wall the tray is on screen but unseen: the colours fall in as it gives
  whenVisible(tray, () => (ctx.afterHall ? ctx.afterHall(drop) : drop()), "0px 0px -20% 0px");
  // the tray's box settles after fonts, pinning and resizes; follow it
  new ResizeObserver(() => { if (dropped) { size(); start(); } }).observe(tray);
}

/* ─── the stack ─────────────────────────────────────────────────────────── */
export function initStack(ctx, sec) {
  const cards = $$(".card", sec);
  cards.forEach((c, k) => {
    const next = cards[k + 1];
    if (!next) return;
    // settles back under a wash of the page colour (x.css), not opacity: a
    // see-through card let the cards beneath show through it, text over text
    gsap.to($(".card-in", c), {
      scale: 0.93, "--wash": 0.45, ease: "none",
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
