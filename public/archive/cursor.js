/**
 * Pointer magic: a state-aware cursor and magnetic controls.
 *
 * Fine-pointer devices only. Touch never sees any of this, and reduced motion
 * gets the plain system cursor back. Elements opt in with data-cursor="label".
 */
import { onFrame, damp, reduced, coarse, el } from "./motion.js";

export function initCursor(root = document.body) {
  if (coarse() || reduced() || !matchMedia("(hover: hover)").matches) return null;

  const dot = el("div", { class: "cur-dot", "aria-hidden": "true" });
  const ring = el("div", { class: "cur-ring", "aria-hidden": "true" },
    el("span", { class: "cur-label" }));
  const label = ring.firstChild;
  root.append(dot, ring);

  let tx = innerWidth / 2, ty = innerHeight / 2;   // target
  let rx = tx, ry = ty;                             // ring (trails)
  let visible = false, settled = false;

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    if (!visible) { visible = true; rx = tx; ry = ty; root.dataset.cursor = "on"; }
    settled = false; pump();
  }, { passive: true });

  addEventListener("pointerdown", () => { root.dataset.cursorDown = "true"; }, { passive: true });
  addEventListener("pointerup", () => { delete root.dataset.cursorDown; }, { passive: true });
  addEventListener("pointerleave", () => { visible = false; delete root.dataset.cursor; }, { passive: true });

  // Cursor state follows whatever is under the pointer, declared in markup.
  addEventListener("pointerover", (e) => {
    const host = e.target?.closest?.("[data-cursor]");
    const mode = host?.dataset.cursor || "";
    root.dataset.cursorMode = mode;
    label.textContent = host?.dataset.cursorLabel || "";
  }, { passive: true });

  let stop = null;
  function pump() {
    stop ??= onFrame((_, dt) => {
      dot.style.transform = `translate3d(${tx}px,${ty}px,0)`;
      rx = damp(rx, tx, 14, dt); ry = damp(ry, ty, 14, dt);
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      const close = Math.hypot(rx - tx, ry - ty) < 0.4;
      if (close && settled) { stop?.(); stop = null; return false; }
      settled = close;
      return true;
    });
  }
  pump();

  return { destroy() { stop?.(); dot.remove(); ring.remove(); } };
}

/**
 * Magnetic control: the element leans toward the pointer inside a radius, then
 * springs back. Pure transform, so it never triggers layout.
 */
export function magnetic(node, strength = 0.32, radius = 90) {
  if (coarse() || reduced()) return () => {};
  let raf = 0, cx = 0, cy = 0, tx2 = 0, ty2 = 0;

  const move = (e) => {
    const r = node.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const pull = d < radius + Math.max(r.width, r.height) / 2 ? strength : 0;
    tx2 = dx * pull; ty2 = dy * pull;
    if (!raf) raf = requestAnimationFrame(step);
  };
  const leave = () => { tx2 = 0; ty2 = 0; if (!raf) raf = requestAnimationFrame(step); };
  function step() {
    raf = 0;
    cx += (tx2 - cx) * 0.18; cy += (ty2 - cy) * 0.18;
    node.style.transform = Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05
      ? "" : `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
    if (Math.abs(cx - tx2) > 0.05 || Math.abs(cy - ty2) > 0.05) raf = requestAnimationFrame(step);
  }

  node.addEventListener("pointermove", move);
  node.addEventListener("pointerleave", leave);
  return () => {
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerleave", leave);
    if (raf) cancelAnimationFrame(raf);
    node.style.transform = "";
  };
}
