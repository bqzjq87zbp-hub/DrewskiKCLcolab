/* /iw-kinetic-type: type as the primary animated object.
 *
 *   slot      characters rise out of a mask, staggered (SplitText)
 *   lines     lines rise out of their own masks, for paragraphs
 *   marquee   an endless strip whose speed and direction follow the scroll
 *   axis      drives variable-font axes (wght, SOFT, opsz) from a signal
 */
import { clamp, damp } from "../util.js";
import * as prefs from "./prefs.js";
import { scroll } from "./scroll.js";

const gsap = window.gsap;
const SplitText = window.SplitText;
const calm = () => prefs.get().motion === "calm";

export function split(el, type = "chars", mask) {
  if (el._split) return el._split;
  if (!SplitText) return null;
  gsap.registerPlugin(SplitText);
  el._split = SplitText.create(el, {
    type: type === "chars" ? "words,chars" : type === "lines" ? "lines" : type,
    mask: mask || (type === "chars" ? "words" : "lines"),
    linesClass: "sl", wordsClass: "sw", charsClass: "sc",
    aria: "auto",
  });
  return el._split;
}

/** Characters (or words) rise out of a mask. Returns the tween. */
export function slot(el, opts = {}) {
  if (calm()) { gsap.set(el, { autoAlpha: 1 }); return gsap.from(el, { autoAlpha: 0, duration: 0.5, delay: opts.delay || 0 }); }
  const s = split(el, opts.type || "chars");
  gsap.set(el, { autoAlpha: 1 });
  const targets = s ? (opts.type === "words" ? s.words : s.chars) : [el];
  return gsap.from(targets, {
    yPercent: opts.from || 110, rotate: opts.rotate != null ? opts.rotate : 4, autoAlpha: 0,
    duration: opts.duration || 1.1, ease: opts.ease || "expo.out",
    stagger: opts.stagger != null ? opts.stagger : { each: 0.028, from: opts.fromEdge || "start" },
    delay: opts.delay || 0,
  });
}

export function lines(el, opts = {}) {
  if (calm()) return gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, delay: opts.delay || 0 });
  const s = split(el, "lines");
  gsap.set(el, { autoAlpha: 1 });
  return gsap.from(s ? s.lines : [el], {
    yPercent: 105, duration: opts.duration || 1.05, ease: "expo.out",
    stagger: opts.stagger || 0.08, delay: opts.delay || 0,
  });
}

/**
 * Endless strip. Content is cloned until it overfills twice the container,
 * then wrapped with modulo so it never visibly resets. Scroll velocity pushes
 * it and scroll direction turns it around.
 */
export function marquee(el, opts = {}) {
  const track = el.querySelector(".mq-track");
  if (!track) return () => {};
  const unit = track.innerHTML;
  const fill = () => {
    track.innerHTML = unit;
    let guard = 0;
    while (track.scrollWidth < el.clientWidth * 2.2 && guard++ < 30) track.insertAdjacentHTML("beforeend", unit);
    track.insertAdjacentHTML("beforeend", track.innerHTML);
  };
  fill();
  let x = 0, speed = opts.speed || 0.6, boost = 0, dir = -1;
  const onResize = () => fill();
  addEventListener("resize", onResize);
  const tick = (t, dtms) => {
    const dt = Math.min(0.05, (dtms || 16) / 1000);
    if (opts.active && !opts.active()) return;
    if (calm()) { if (x) { x = 0; track.style.transform = "translate3d(0,0,0)"; } return; }
    if (opts.followScroll !== false) {
      boost = damp(boost, Math.abs(scroll.v) * 0.9, 6, dt);
      if (Math.abs(scroll.v) > 0.5) dir = scroll.dir > 0 ? -1 : 1;
    }
    x += dir * (speed + boost) * dt * 60;
    const half = track.scrollWidth / 2;
    if (half > 0) { x = ((x % half) + half) % half; }
    track.style.transform = `translate3d(${-x}px,0,0)`;
  };
  gsap.ticker.add(tick);
  return () => { gsap.ticker.remove(tick); removeEventListener("resize", onResize); };
}

/**
 * Variable-font axes as a live signal. `get` returns 0..1 each frame; the axes
 * interpolate between from/to. Uses font-variation-settings so any axis works.
 */
export function axis(el, get, from, to, opts = {}) {
  let v = 0;
  const tick = (t, dtms) => {
    const dt = Math.min(0.05, (dtms || 16) / 1000);
    v = damp(v, calm() ? 0 : clamp(get()), opts.lambda || 5, dt);
    const parts = Object.keys(from).map((k) => `'${k}' ${(from[k] + (to[k] - from[k]) * v).toFixed(0)}`).join(", ");
    // only touch the style when an axis actually moved: re-shaping text is not free
    if (parts !== el._fvs) { el._fvs = parts; el.style.fontVariationSettings = parts; }
  };
  gsap.ticker.add(tick);
  return () => gsap.ticker.remove(tick);
}
