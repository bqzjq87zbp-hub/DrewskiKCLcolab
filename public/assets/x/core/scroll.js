/* /iw-scroll-engine: one scroll transport for the whole page.
 *
 * One Lenis instance driven from the GSAP ticker, one ScrollTrigger registry,
 * and the pin + scrub grammar every other module reads from:
 *
 *   pin     is CSS `position: sticky` inside a tall section. It never jumps,
 *           costs nothing, and survives the fixed-footer reveal.
 *   scrub   is ScrollTrigger progress over that section, handed to a callback.
 *
 * Lenis only smooths the wheel. Touch stays native (syncTouch off), which is
 * what people expect on a phone, and calm motion turns smoothing off entirely.
 */
import { clamp, damp } from "../util.js";
import * as prefs from "./prefs.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

const listeners = new Set();
export const scroll = {
  y: 0,
  v: 0,          // smoothed velocity, px per frame at 60fps
  dir: 1,
  max: 0,
  lenis: null,
  locked: 0,
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  to(target, opts = {}) {
    const calm = prefs.get().motion === "calm";
    if (this.lenis && !calm && !opts.immediate) {
      this.lenis.scrollTo(target, { offset: opts.offset || 0, duration: opts.duration || 1.4, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: opts.onComplete });
    } else {
      let y = typeof target === "number" ? target : target.getBoundingClientRect().top + scrollY;
      y += opts.offset || 0;
      window.scrollTo({ top: y, behavior: calm || opts.immediate ? "auto" : "smooth" });
      if (this.lenis) this.lenis.scrollTo(y, { immediate: true });
      opts.onComplete && setTimeout(opts.onComplete, calm || opts.immediate ? 0 : 700);
    }
  },
  /** Overlays (menu, slider, game) lock the page; counted so they can nest. */
  lock() {
    if (this.locked++ === 0) {
      this.lenis && this.lenis.stop();
      document.documentElement.classList.add("is-locked");
    }
  },
  unlock() {
    if (this.locked === 0) return;
    if (--this.locked === 0) {
      this.lenis && this.lenis.start();
      document.documentElement.classList.remove("is-locked");
    }
  },
};

let last = 0, lastT = 0;

export function initScroll() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const makeLenis = () => {
    if (scroll.lenis || prefs.get().motion === "calm" || !window.Lenis) return;
    scroll.lenis = new window.Lenis({ lerp: 0.105, smoothWheel: true, syncTouch: false, wheelMultiplier: 0.95, touchMultiplier: 1 });
    scroll.lenis.on("scroll", ScrollTrigger.update);
    if (scroll.locked) scroll.lenis.stop();
  };
  makeLenis();
  prefs.onChange(({ key }) => {
    if (key !== "motion") return;
    if (prefs.get().motion === "calm" && scroll.lenis) { scroll.lenis.destroy(); scroll.lenis = null; }
    else makeLenis();
  });

  gsap.ticker.add((time) => {
    if (scroll.lenis) scroll.lenis.raf(time * 1000);
    const y = scroll.lenis ? scroll.lenis.animatedScroll : window.scrollY;
    const dt = Math.min(0.05, Math.max(0.001, time - lastT || 0.016));
    lastT = time;
    const instant = (y - last) / (dt * 60);
    scroll.v = damp(scroll.v, clamp(instant, -120, 120), 10, dt);
    if (Math.abs(y - last) > 0.5) scroll.dir = y > last ? 1 : -1;
    last = y;
    scroll.y = y;
    for (const fn of listeners) fn(scroll, dt);
  });
  gsap.ticker.lagSmoothing(0);
  // page height only changes with layout, so measure it then, not every frame
  const measure = () => { scroll.max = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  measure();
  ScrollTrigger.addEventListener("refresh", measure);
  addEventListener("resize", measure);
  return scroll;
}

/**
 * Scrub a tall section whose first child is `position: sticky`. The callback
 * gets 0..1 progress from the moment the section's top meets the viewport top
 * until its bottom meets the viewport bottom.
 */
export function scrub(section, onProgress, opts = {}) {
  return ScrollTrigger.create({
    trigger: section,
    start: opts.start || "top top",
    end: opts.end || "bottom bottom",
    onUpdate: (st) => onProgress(st.progress, st),
    onToggle: opts.onToggle,
    onRefresh: (st) => onProgress(st.progress, st),
  });
}

/** Fires once per element entering, for reveals and lazy work. */
export function whenVisible(el, fn, margin = "0px 0px -8% 0px") {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.disconnect(); fn(e); }
  }, { rootMargin: margin, threshold: 0.01 });
  io.observe(el);
  return () => io.disconnect();
}

export const refresh = () => ScrollTrigger.refresh();
