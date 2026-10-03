/* /iw-pointer-magic: the page answers the pointer without replacing it.
 *
 *   pointer    where the pointer is, read by the GL layers (hall, pool light)
 *   magnetic   [data-magnetic] leans toward the pointer and springs back, a
 *              few pixels at most, so it never lands on its neighbour
 *
 * Nothing here turns or skews a photograph: covers and prints stay level.
 *
 * The system pointer is never hidden or replaced. The engine's custom cursor
 * (a trailing dot, a disc that grew over links and a video that floated by
 * it) is gone: the plain pointer reads cleaner. The stylesheet gives each
 * action its native cursor instead (zoom-in on a photograph, grab on what you
 * can drag). Fine pointers only; touch gets none of this, and calm motion
 * keeps everything still.
 */
import { clamp, damp, media } from "../util.js";
import * as prefs from "./prefs.js";

const gsap = window.gsap;
const magnets = new Set();
let px = -1e4, py = -1e4, moved = false, busy = false, ticking = false;
const live = () => prefs.get().motion === "full";

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, down: false, moved: false };

// Pointer position is tracked on every device.
addEventListener("pointermove", (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = (e.clientX / innerWidth) * 2 - 1;
  pointer.ny = (e.clientY / innerHeight) * 2 - 1;
  pointer.moved = true;
  if (e.pointerType === "mouse") { px = e.clientX; py = e.clientY; moved = true; }
}, { passive: true });
addEventListener("pointerdown", () => { pointer.down = true; }, { passive: true });
addEventListener("pointerup", () => { pointer.down = false; }, { passive: true });

// Magnets: measure all, then move all (no read/write interleaving), and skip
// the work entirely once the pointer is still and everything has settled.
function tick(t, dtms) {
  if (!moved && !busy) return;
  const dt = Math.min(0.05, (dtms || 16) / 1000);
  moved = false; busy = false;
  for (const m of magnets) m.read();
  for (const m of magnets) if (m.write(dt)) busy = true;
}

// The furthest a magnet moves on each axis, in px. Magnetic neighbours sit at
// least 12px apart (the phone header), so even two pulled toward each other
// never touch; a still neighbour, like the wordmark, keeps at least 8px.
const PULL = 5;

/** Lean toward the pointer within a radius, spring back on leave. */
export function magnetic(el, strength = 0.32, radius = 1.5) {
  if (!media.fine()) return () => {};
  if (!ticking) { ticking = true; gsap.ticker.add(tick); }
  let tx = 0, ty = 0, x = 0, y = 0, r = null;
  const m = {
    read() { r = live() ? el.getBoundingClientRect() : null; },
    /** Returns true while still moving. */
    write(dt) {
      if (!r || !r.width) { if (x || y) { x = y = 0; el.style.transform = ""; } return false; }
      // The rect includes our own translation; measure from the rest position.
      const mx = r.left + r.width / 2 - x, my = r.top + r.height / 2 - y;
      const ddx = px - mx, ddy = py - my;
      const reach = Math.max(r.width, r.height) * radius;
      const d = Math.hypot(ddx, ddy);
      if (d < reach) { const f = 1 - d / reach; tx = clamp(ddx * strength * (0.4 + f), -PULL, PULL); ty = clamp(ddy * strength * (0.4 + f), -PULL, PULL); }
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

export function bindAll(scope = document) {
  scope.querySelectorAll("[data-magnetic]").forEach((el) => { if (!el._mag) el._mag = magnetic(el, +el.dataset.magnetic || 0.32); });
}
