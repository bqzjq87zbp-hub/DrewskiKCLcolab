/* /iw-entrance-reveals: the baseline motion grammar.
 *
 * Declarative: mark an element and it enters once, when it first scrolls in.
 *
 *   data-reveal="up"      children rise and fade, staggered
 *   data-reveal="lines"   text lines rise out of masks
 *   data-reveal="chars"   characters slot in
 *   data-reveal="clip"    a clip-path window opens from the bottom edge
 *   data-reveal="wipe"    a curtain in the accent colour wipes across and off
 *   data-reveal="fade"    plain fade, for anything delicate
 *
 * data-delay adds seconds. Calm motion collapses everything to short fades,
 * and nothing is ever left hidden if JS or a tween fails: the hidden state is
 * only applied by the class this module adds itself.
 */
import { lines, slot } from "./type.js";
import * as prefs from "./prefs.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

function play(el) {
  const kind = el.getAttribute("data-reveal") || "up";
  const delay = +el.getAttribute("data-delay") || 0;
  const calm = prefs.get().motion === "calm";
  el.classList.add("rv-in");
  if (calm) return gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, delay, clearProps: "opacity,visibility" });
  switch (kind) {
    case "lines": return lines(el, { delay });
    case "chars": return slot(el, { delay });
    case "clip":
      return gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.inOut", delay, clearProps: "clipPath" });
    case "wipe": {
      const c = document.createElement("span");
      c.className = "rv-curtain";
      el.appendChild(c);
      gsap.set(el, { autoAlpha: 1 });
      return gsap.timeline({ delay, onComplete: () => c.remove() })
        .fromTo(c, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.55, ease: "expo.in" })
        .set(el, { "--rv-o": 1 })
        .to(c, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.7, ease: "expo.out" });
    }
    case "fade": return gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, delay, ease: "power2.out" });
    default: {
      const kids = el.children.length ? Array.from(el.children) : [el];
      gsap.set(el, { autoAlpha: 1 });
      return gsap.fromTo(kids, { y: 34, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 1.05, ease: "expo.out", stagger: 0.075, delay, clearProps: "transform,opacity,visibility",
      });
    }
  }
}

export function initReveals(scope = document) {
  const els = Array.from(scope.querySelectorAll("[data-reveal]:not(.rv-armed)"));
  if (!els.length) return;
  els.forEach((el) => el.classList.add("rv-armed"));
  ScrollTrigger.batch(els, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => batch.forEach((el, i) => {
      if (!el.hasAttribute("data-delay") && i) el.setAttribute("data-delay", (i * 0.08).toFixed(2));
      play(el);
    }),
  });
}

/** Imperative entrance for elements built after load (overlays, panels). */
export function reveal(el) { el.classList.add("rv-armed"); return play(el); }
