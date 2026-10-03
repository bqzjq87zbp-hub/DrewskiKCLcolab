/* /iw-transitions-preloader: the site as one continuous film.
 *
 * Preloader: the ring is real. It draws itself (SVG line motion) as images
 * decode and fonts load, not on a timer, and shows no numbers. It hands off
 * straight into the page by peeling away as a sheet of paper.
 *
 * Page transitions: leaving lays a sheet in the destination's colour over the
 * screen (paper curl, WebGL), the next page opens already covered by that
 * same colour (head.js reads the handoff before first paint) and peels it off.
 * Both halves sweep the same way, so two page loads read as one page turn.
 * Without WebGL the same beats run as a diagonal CSS wipe.
 */
import { curl } from "../gl/curl.js";
import { stage } from "../gl/stage.js";
import { $, h, clamp, sleep, mixHex, luma, BB } from "../util.js";
import * as prefs from "./prefs.js";
import { sound } from "./sound.js";

const gsap = window.gsap;
const KEY = "x.handoff";
export const arriving = () => document.documentElement.hasAttribute("data-arriving");

const norm = (u) => new URL(u, location.href).pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "");

/** Count real loads. Each entry is an <img>, a URL, or a promise. */
export function track(items, onProgress) {
  let done = 0;
  const total = items.length + 1;
  const bump = () => { done++; onProgress && onProgress(done / total); };
  const ps = items.map((it) => {
    let p;
    if (typeof it === "string") p = new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = it; });
    else if (it && it.tagName === "IMG") p = it.complete && it.naturalWidth ? Promise.resolve() : new Promise((res) => { it.addEventListener("load", res, { once: true }); it.addEventListener("error", res, { once: true }); });
    else p = Promise.resolve(it).catch(() => {});
    return p.then(bump, bump);
  });
  const fonts = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(bump, bump);
  // Never hold the door for a slow straggler.
  return Promise.race([Promise.all([...ps, fonts]), sleep(9000)]);
}

/** Wire a preloader element: the ring follows progress smoothly. */
export function preloader(el) {
  const ring = $(".pre-ring circle", el);
  const len = ring ? ring.getTotalLength() : 0;
  if (ring) { ring.style.strokeDasharray = len; ring.style.strokeDashoffset = len; }
  const shown = { v: 0 };
  let target = 0;
  const render = () => { if (ring) ring.style.strokeDashoffset = len * (1 - shown.v); };
  return {
    set(p) {
      target = Math.max(target, clamp(p));
      gsap.to(shown, { v: target, duration: 0.6, ease: "power2.out", onUpdate: render, overwrite: true });
    },
    finish() {
      return new Promise((res) => gsap.to(shown, { v: 1, duration: arriving() ? 0.15 : 0.45, ease: "power2.inOut", onUpdate: render, onComplete: res, overwrite: true }));
    },
  };
}

/** Take the preloader (or an arriving cover) off the page. */
export async function reveal(el, color) {
  const calm = prefs.get().motion === "calm";
  sessionStorage.removeItem(KEY);
  const d = document.documentElement;
  if (!calm && stage.ok) {
    const run = curl({ origin: "br", from: 0, to: 1, front: color, back: mixHex(color, luma(color) > 0.4 ? "#000000" : "#ffffff", 0.08), duration: 1.25, ease: "power2.inOut", top: true });
    if (run) {
      // The GL sheet is drawn this frame in the same colour; swap under it.
      requestAnimationFrame(() => { el && el.classList.add("is-gone"); d.removeAttribute("data-arriving"); });
      sound.play("paper", { dur: 0.6, gain: 0.1 });
      await run;
      return;
    }
  }
  if (el) {
    el.classList.add("is-wiping");
    d.removeAttribute("data-arriving");
    await new Promise((res) => gsap.to(el, calm ? { autoAlpha: 0, duration: 0.4, onComplete: res } :
      { clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)", duration: 0.9, ease: "expo.inOut", onComplete: res }));
    el.classList.add("is-gone");
  } else d.removeAttribute("data-arriving");
}

let leaving = false, held = null;
/** Leave for `url` under a sheet of `color`. */
export async function go(url, opts = {}) {
  if (leaving) return;
  leaving = true;
  const color = opts.color || "#111111";
  const ink = opts.ink || (luma(color) > 0.4 ? "#111111" : "#f4efe6");
  try { sessionStorage.setItem(KEY, JSON.stringify({ to: norm(url), color, ink, t: Date.now() })); } catch (e) {}
  const calm = prefs.get().motion === "calm";
  sound.play("paper", { dur: 0.7, gain: 0.12 });
  let label = null;
  if (opts.label) {
    label = h("div", { class: "tx-label", style: `color:${ink};` + (opts.font ? `font-family:${opts.font};` : "") + (opts.weight ? `font-weight:${opts.weight};` : "") + (opts.variation ? `font-variation-settings:${opts.variation};` : "") }, opts.label);
  }
  if (!calm && stage.ok) {
    const run = curl({ origin: "tl", from: 1, to: 0, front: color, back: mixHex(color, luma(color) > 0.4 ? "#000000" : "#ffffff", 0.08), duration: 1.05, ease: "power2.inOut", hold: true, top: true });
    if (run) {
      held = await run;
      if (label) { document.body.appendChild(label); gsap.fromTo(label, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35 }); await sleep(260); }
      location.href = url;
      return;
    }
  }
  const cover = h("div", { class: "tx-cover", style: `background:${color}` });
  document.body.appendChild(cover);
  await new Promise((res) => gsap.fromTo(cover, calm ? { autoAlpha: 0 } : { clipPath: "polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)" },
    calm ? { autoAlpha: 1, duration: 0.3, onComplete: res } : { clipPath: "polygon(-60% 100%, 100% -60%, 100% 100%, 100% 100%)", duration: 0.85, ease: "expo.inOut", onComplete: res }));
  if (label) document.body.appendChild(label);
  location.href = url;
}

/** Links marked data-go="#hex" leave through the curl. */
export function bindLinks(scope = document) {
  scope.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[data-go]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === "_blank") return;
    e.preventDefault();
    go(a.href, { color: a.getAttribute("data-go"), label: a.getAttribute("data-go-label"), font: a.getAttribute("data-go-font"), weight: a.getAttribute("data-go-weight"), variation: a.getAttribute("data-go-variation") });
  });
}

// Coming back through the history cache restores this page exactly as it
// was left: covered. Uncover it.
addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  leaving = false;
  if (held) { held.release(); held = null; }
  document.querySelectorAll(".tx-cover,.tx-label").forEach((n) => n.remove());
  document.documentElement.removeAttribute("data-arriving");
  try { sessionStorage.removeItem(KEY); } catch (x) { BB("warn", "bfcache restore"); }
});
