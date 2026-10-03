/* /iw-horizontal-infinite: the wall with no edges.
 *
 * Every plate, tiled forever in both directions, dragged around with inertia
 * (mouse, touch, trackpad, wheel or arrow keys). Only the tiles on screen
 * exist: a small pool is recycled as cells scroll in and out, so it costs the
 * same at any distance from the origin. Columns are offset by half a tile so
 * the wall reads as hung, not gridded, and it pulls back a little while you
 * drag, the way deck.gallery does. A click that did not drag opens the plate.
 */
import { $, h, esc, pad, clamp, damp } from "../util.js";
import { scroll } from "../core/scroll.js";
import { hover } from "../gl/plates.js";
import { sound } from "../core/sound.js";
import * as prefs from "../core/prefs.js";

const gsap = window.gsap;

export function initCanvas(ctx) {
  // a visible Close, like the reading view's: "Esc to close" meant nothing on a phone
  const root = h("div", { class: "cv", role: "dialog", "aria-modal": "true", "aria-label": "Canvas view: drag to explore every photograph", tabindex: "-1" },
    `<div class="cv-t"></div><button class="sl-close lbl" type="button" data-magnetic="0.25">Close</button><div class="cv-hint lbl">Drag to explore</div>`);
  document.body.appendChild(root);
  const track = $(".cv-t", root);
  const N = ctx.plates.length;
  let open = false, ox = 0, oy = 0, vx = 0, vy = 0, tx = 0, ty = 0, zoom = 1, dragging = false, moved = 0;
  let cw = 0, ch = 0, gap = 0;
  const pool = [];

  function metrics() {
    const w = innerWidth;
    cw = clamp(w * (w < 760 ? 0.42 : 0.16), 140, 280);
    gap = clamp(w * 0.022, 12, 34);
    ch = cw * 1.75;
  }
  const idx = (cx, cy) => ((((cx * 7 + cy * 5) % N) + N) % N);

  function tile(k) {
    if (!pool[k]) {
      const t = h("button", { class: "tile", type: "button", tabindex: "-1" }, `<img alt="" decoding="async">`);
      track.appendChild(t);
      pool[k] = t;
    }
    return pool[k];
  }

  function render() {
    const W = innerWidth, H = innerHeight;
    const sx = cw + gap, sy = ch + gap;
    const cx0 = Math.floor((-ox - W * (1 / zoom - 1) / 2) / sx) - 1;
    const cx1 = Math.ceil((-ox + W + W * (1 / zoom - 1) / 2) / sx) + 1;
    let k = 0;
    for (let cx = cx0; cx <= cx1; cx++) {
      const colOff = (((cx % 2) + 2) % 2) * sy * 0.5;
      const cy0 = Math.floor((-oy - colOff - H * (1 / zoom - 1) / 2) / sy) - 1;
      const cy1 = Math.ceil((-oy - colOff + H + H * (1 / zoom - 1) / 2) / sy) + 1;
      for (let cy = cy0; cy <= cy1; cy++) {
        const t = tile(k++);
        const i = idx(cx, cy);
        if (t._i !== i) {
          const p = ctx.plates[i];
          t._i = i;
          t.firstChild.src = p.src;
          t.setAttribute("aria-label", `Plate ${pad(p.n)}, ${p.kicker}`);
        }
        t.style.width = cw + "px";
        t.style.transform = `translate3d(${(cx * sx + ox).toFixed(1)}px,${(cy * sy + colOff + oy).toFixed(1)}px,0)`;
        t.style.display = "";
      }
    }
    for (let j = k; j < pool.length; j++) pool[j].style.display = "none";
    track.style.transform = `translate3d(${W / 2}px,${H / 2}px,0) scale(${zoom.toFixed(4)}) translate3d(${-W / 2}px,${-H / 2}px,0)`;
  }

  const tick = (t, dtms) => {
    if (!open) return;
    const dt = Math.min(0.05, (dtms || 16) / 1000);
    if (!dragging) {
      tx += vx * dt * 60; ty += vy * dt * 60;
      vx *= Math.pow(0.9, dt * 60); vy *= Math.pow(0.9, dt * 60);
    }
    ox = damp(ox, tx, 18, dt); oy = damp(oy, ty, 18, dt);
    zoom = damp(zoom, dragging && prefs.get().motion === "full" ? 0.93 : 1, 6, dt);
    render();
  };

  let px = 0, py = 0, lx = 0, ly = 0, lt = 0;
  root.addEventListener("pointerdown", (e) => {
    // capturing this pointer would retarget the Close button's click to the wall
    if (e.target.closest(".sl-close")) return;
    dragging = true; moved = 0; px = lx = e.clientX; py = ly = e.clientY; lt = performance.now(); vx = vy = 0;
    root.classList.add("dragging");
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    const now = performance.now(), dtm = Math.max(1, now - lt);
    tx += dx / zoom; ty += dy / zoom;
    vx = (dx / dtm) * 16; vy = (dy / dtm) * 16;
    moved += Math.abs(dx) + Math.abs(dy);
    lx = e.clientX; ly = e.clientY; lt = now;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("dragging");
    if (moved < 6) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const t = hit && hit.closest && hit.closest(".tile");
      if (t && t._i != null) { const i = t._i; close(false).then(() => ctx.open(i, null)); }
    } else sound.play("paper", { dur: 0.25, gain: 0.04 });
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("wheel", (e) => { if (!open) return; e.preventDefault(); tx -= e.deltaX; ty -= e.deltaY; }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!open) return;
    const s = 120;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") tx += s; else if (e.key === "ArrowRight") tx -= s;
    else if (e.key === "ArrowUp") ty += s; else if (e.key === "ArrowDown") ty -= s;
  });
  root.addEventListener("pointerover", (e) => {
    const t = e.target.closest && e.target.closest(".tile");
    if (t && e.pointerType === "mouse" && !dragging) { hover(t.firstChild, true, t); sound.play("tick", { i: t._i }); }
  });
  root.addEventListener("pointerout", (e) => {
    const t = e.target.closest && e.target.closest(".tile");
    if (t) hover(t.firstChild, false, t);
  });

  $(".sl-close", root).addEventListener("click", () => close());
  gsap.ticker.add(tick);
  addEventListener("resize", () => { if (open) { metrics(); render(); } });

  let pushed = false;
  async function show(opts = {}) {
    if (open) return;
    metrics();
    open = true;
    scroll.lock();
    root.classList.add("open");
    document.documentElement.classList.add("cv-open");
    if (opts.push !== false) { history.pushState({ v: "canvas" }, "", `${location.pathname}?view=canvas`); pushed = true; }
    tx = ox = -(cw + gap) * 0.5; ty = oy = -(ch + gap) * 0.25;
    render();
    const calm = prefs.get().motion === "calm";
    gsap.fromTo(root, { clipPath: calm ? "inset(0 0 0 0)" : "inset(50% 50% 50% 50%)", autoAlpha: calm ? 0 : 1 },
      { clipPath: "inset(0% 0% 0% 0%)", autoAlpha: 1, duration: calm ? 0.3 : 0.6, ease: "power4.out" });
    if (!calm) { vx = -6; vy = -3; }
    root.focus({ preventScroll: true });
    sound.play("paper", { dur: 0.5, gain: 0.08 });
    ctx.emitView && ctx.emitView("canvas");
  }
  async function close(fromUser = true, fromPop = false) {
    if (!open) return;
    open = false;
    if (!fromPop) { if (pushed && fromUser) history.back(); else history.replaceState({}, "", location.pathname); }
    pushed = false;
    for (const t of pool) if (t._i != null) hover(t.firstChild, false, t);
    gsap.killTweensOf(root);
    await new Promise((res) => gsap.to(root, { clipPath: "inset(50% 50% 50% 50%)", duration: prefs.get().motion === "calm" ? 0.01 : 0.4, ease: "power3.out", onComplete: res }));
    root.classList.remove("open");
    document.documentElement.classList.remove("cv-open");
    // autoAlpha leaves an inline visibility behind that would beat the CSS
    // and keep a closed canvas catching clicks; clear everything it set
    gsap.set(root, { clearProps: "clipPath,opacity,visibility" });
    scroll.unlock();
    ctx.emitView && ctx.emitView("grid");
  }
  addEventListener("popstate", (e) => {
    const st = e.state;
    if (open && !(st && st.v === "canvas")) close(false, true);
    else if (!open && st && st.v === "canvas") show({ push: false });
  });
  return { open: show, close: () => close(), get isOpen() { return open; } };
}
