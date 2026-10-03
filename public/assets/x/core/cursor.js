/* /iw-pointer-magic: everything under the cursor answers back.
 *
 *   cursor     a dot that trails the pointer, and a disc that grows over
 *              anything marked data-cursor ("view", "drag", "enter", "close"
 *              or any label via data-cursor-label). Grain lives inside the
 *              disc so it reads as printed matter, not a UI chip.
 *   magnetic   [data-magnetic] leans toward the pointer and springs back.
 *   tilt       [data-tilt] turns in 3D under the pointer with a moving glare.
 *   preview    [data-preview] floats a muted looping video by the cursor.
 *
 * Fine pointers only. Touch devices get none of it, and calm motion keeps
 * the plain system cursor.
 */
import { $, h, clamp, damp, media } from "../util.js";
import * as prefs from "./prefs.js";

const gsap = window.gsap;
let root, dot, disc, label, preview, previewVid;
let px = -100, py = -100, dx = -100, dy = -100, cx = -100, cy = -100;
// hidden starts true so the very first move places the cursor on the pointer
let state = "", on = false, hidden = true, magnetsBusy = false;
const magnets = new Set();
const DISC = /^(view|drag|enter|close|play|label)\|/;

// Position goes on the `translate` property, never `transform`. The disc and
// the preview grow and shrink with the CSS `scale` property, which the browser
// applies on top of `transform`: a transform offset got scaled with them, so
// every shrink slid the disc toward the top-left corner of the page and every
// grow swung it back out. `translate` sits outside `scale`, so they grow in place.
function put() {
  dot.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  disc.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
  preview.style.translate = `${(cx + 28).toFixed(1)}px ${(cy + 28).toFixed(1)}px`;
}

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, down: false, moved: false };

// Pointer position is tracked on every device; the custom cursor is not.
addEventListener("pointermove", (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.moved = true;
}, { passive: true });
addEventListener("pointerdown", () => { pointer.down = true; }, { passive: true });
addEventListener("pointerup", () => { pointer.down = false; }, { passive: true });

export function initCursor() {
  if (!media.fine()) return;
  root = h("div", { class: "cur", "aria-hidden": "true" },
    '<div class="cur-disc"><div class="cur-grain"></div><span class="cur-label"></span>' +
    '<svg class="cur-plus" viewBox="0 0 24 24"><path d="M12 0v24M0 12h24"/></svg></div><div class="cur-dot"></div>');
  document.body.appendChild(root);
  dot = $(".cur-dot", root); disc = $(".cur-disc", root); label = $(".cur-label", root);
  preview = h("div", { class: "cur-preview", "aria-hidden": "true" }, "<video muted loop playsinline preload=\"none\"></video>");
  document.body.appendChild(preview);
  previewVid = $("video", preview);

  const sync = () => {
    on = prefs.get().motion === "full";
    document.documentElement.classList.toggle("has-cursor", on);
  };
  sync();
  prefs.onChange(sync);

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX; py = e.clientY;
    // First move on a page, or back into the window: start on the pointer.
    // Easing from the parked -100,-100 made the disc swoop in from the top-left.
    if (hidden) { hidden = false; root.classList.remove("is-out"); dx = cx = px; dy = cy = py; put(); }
    const t = e.target.closest ? e.target.closest("[data-cursor],a,button,input,textarea,label,[role=button]") : null;
    setState(t);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { hidden = true; root.classList.add("is-out"); });
  addEventListener("pointerdown", () => root.classList.add("is-down"));
  addEventListener("pointerup", () => root.classList.remove("is-down"));

  gsap.ticker.add((t, dtms) => {
    if (!on) return;
    const dt = Math.min(0.05, (dtms || 16) / 1000);
    const settled = Math.abs(dx - px) + Math.abs(dy - py) + Math.abs(cx - px) + Math.abs(cy - py) < 0.2;
    if (!settled) {
      dx = damp(dx, px, 38, dt); dy = damp(dy, py, 38, dt);
      cx = damp(cx, px, 13, dt); cy = damp(cy, py, 13, dt);
      put();
    }
    // magnets: measure all, then move all (no read/write interleaving), and
    // skip entirely once the pointer is still and everything has settled
    const moving = Math.abs(cx - px) + Math.abs(cy - py) > 0.3;
    if (moving || magnetsBusy) {
      magnetsBusy = false;
      for (const m of magnets) m.read();
      for (const m of magnets) if (m.write(dt)) magnetsBusy = true;
    }
  });
}

function setState(el) {
  let s = "", l = "";
  if (el) {
    s = el.getAttribute("data-cursor") || (el.matches("input,textarea") ? "text" : "link");
    l = el.getAttribute("data-cursor-label") || "";
    const pv = el.getAttribute("data-preview");
    showPreview(pv);
  } else showPreview(null);
  const key = s + "|" + l;
  if (key === state) return;
  // the disc grows where the pointer is, never slides in from where it trailed
  if (DISC.test(key) && !DISC.test(state)) { cx = px; cy = py; put(); }
  state = key;
  root.setAttribute("data-state", s);
  label.textContent = l || (s === "drag" ? "Drag" : s === "enter" ? "Enter" : s === "close" ? "Close" : s === "play" ? "Play" : "");
}

let pvSrc = null;
function showPreview(src) {
  if (src === pvSrc) return;
  pvSrc = src;
  if (!src || prefs.get().effects === "off") { preview.classList.remove("on"); previewVid.pause(); return; }
  // Every preview is encoded twice; use whichever this browser decodes.
  if (/\.mp4$/.test(src) && !previewVid.canPlayType('video/mp4; codecs="avc1.4D401E"')) src = src.replace(/\.mp4$/, ".webm");
  if (previewVid.getAttribute("src") !== src) previewVid.src = src;
  previewVid.play().catch(() => {});
  preview.classList.add("on");
}

/** Lean toward the pointer within a radius, spring back on leave. */
export function magnetic(el, strength = 0.32, radius = 1.5) {
  if (!media.fine()) return () => {};
  let tx = 0, ty = 0, x = 0, y = 0, r = null;
  const m = {
    read() { r = on ? el.getBoundingClientRect() : null; },
    /** Returns true while still moving. */
    write(dt) {
      if (!on || !r || !r.width) { if (x || y) { x = y = 0; el.style.transform = ""; } return false; }
      // The rect includes our own translation; measure from the rest position.
      const mx = r.left + r.width / 2 - x, my = r.top + r.height / 2 - y;
      const ddx = px - mx, ddy = py - my;
      const reach = Math.max(r.width, r.height) * radius;
      const d = Math.hypot(ddx, ddy);
      if (d < reach) { const f = 1 - d / reach; tx = ddx * strength * (0.4 + f); ty = ddy * strength * (0.4 + f); }
      else { tx = 0; ty = 0; }
      x = damp(x, tx, 9, dt); y = damp(y, ty, 9, dt);
      if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && !tx && !ty) { if (el.style.transform) el.style.transform = ""; x = y = 0; return false; }
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      return true;
    },
  };
  magnets.add(m);
  return () => { magnets.delete(m); el.style.transform = ""; };
}

/** 3D card tilt with a glare that tracks the pointer. */
export function tilt(el, max = 9) {
  if (!media.fine()) return () => {};
  let glare = el.querySelector(".tilt-glare");
  if (!glare) { glare = h("span", { class: "tilt-glare", "aria-hidden": "true" }); el.appendChild(glare); }
  const qx = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
  const qy = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
  gsap.set(el, { transformPerspective: 900, transformStyle: "preserve-3d" });
  const move = (e) => {
    if (!on) return;
    const r = el.getBoundingClientRect();
    const u = clamp((e.clientX - r.left) / r.width), v = clamp((e.clientY - r.top) / r.height);
    qx((u - 0.5) * 2 * max); qy(-(v - 0.5) * 2 * max);
    glare.style.setProperty("--gx", (u * 100).toFixed(1) + "%");
    glare.style.setProperty("--gy", (v * 100).toFixed(1) + "%");
    glare.style.opacity = "1";
  };
  const leave = () => { qx(0); qy(0); glare.style.opacity = "0"; };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
}

export function bindAll(scope = document) {
  scope.querySelectorAll("[data-magnetic]").forEach((el) => { if (!el._mag) el._mag = magnetic(el, +el.dataset.magnetic || 0.32); });
  scope.querySelectorAll("[data-tilt]").forEach((el) => { if (!el._tilt) el._tilt = tilt(el, +el.dataset.tilt || 9); });
}

export function hideCursor(v) { if (root) root.classList.toggle("is-hidden", !!v); }
/** Overlays opening under a still pointer: drop whatever state it was in. */
export function resetCursor() { if (root) setState(null); }
