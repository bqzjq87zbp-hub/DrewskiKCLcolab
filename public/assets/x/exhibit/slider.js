/* The reading view: one plate at a time, like the Hearst lightbox.
 *
 *   open    the frame you clicked flies from its place in the grid to the
 *           reading position (FLIP) while the room fades up behind it
 *   turn    next / previous is a page turn: the current photograph peels off
 *           as paper (gl/curl.js) revealing the next one underneath, its back
 *           showing the print faintly through. Clip wipe without WebGL.
 *   read    index, place, caption and chapter, then the print's format, its
 *           measured colours and a way to book a session like it
 *   shape   the frame takes each photograph's own proportions; a turn between
 *           two shapes re-cuts the frame instead of curling
 *   input   arrows and Escape; wheel; swipe sideways to turn, pull down to
 *           close (/iw-drag-gestures); thumbnails down the right edge
 *   history each open is a real history entry: Back closes it, and
 *           ?view=slider&id=7 opens straight onto plate 7
 */
import { $, $$, h, esc, pad, clamp, loadImage, sleep, BB } from "../util.js";
import { curl } from "../gl/curl.js";
import { stage } from "../gl/stage.js";
import { scroll } from "../core/scroll.js";
import { scramble, slot } from "../core/type.js";
import { sound } from "../core/sound.js";
import { resetCursor } from "../core/cursor.js";
import * as prefs from "../core/prefs.js";

const gsap = window.gsap;

export function initSlider(ctx) {
  const back = h("div", { class: "sl-back", "aria-hidden": "true" });
  const frame = h("div", { class: "sl-img" }, `<img alt="" decoding="async">`);
  const ui = h("div", { class: "sl-ui", role: "dialog", "aria-modal": "true", "aria-label": "Reading view" }, `
    <button class="sl-close lbl" type="button" data-cursor="close" data-magnetic="0.25">Close</button>
    <div class="sl-text" aria-live="polite">
      <div class="sl-idx"><span class="num sl-n"></span> &nbsp;<span class="sl-story"></span></div>
      <h2 class="sl-k"></h2>
      <p class="sl-c"></p>
      <dl class="sl-g" hidden></dl>
    </div>
    <div class="sl-thumbs" role="list"></div>
    <div class="sl-nav">
      <span class="sl-count num"></span>
      <button type="button" class="sl-prev" aria-label="Previous plate" data-magnetic="0.3">&larr;</button>
      <button type="button" class="sl-next" aria-label="Next plate" data-magnetic="0.3">&rarr;</button>
    </div>`);
  document.body.append(back, frame, ui);
  const im = $("img", frame);
  const thumbs = $(".sl-thumbs", ui);
  thumbs.innerHTML = ctx.plates.map((p) => `<button type="button" role="listitem" data-i="${p.i}" aria-label="Plate ${pad(p.n)}, ${esc(p.kicker)}"><img src="${esc(p.src)}" alt="" loading="lazy" decoding="async"></button>`).join("");

  let cur = 0, open = false, busy = false, pushed = false;
  // A close asked for mid-animation (Escape, or Back during a turn) is queued,
  // never dropped: dropping it leaves the view open under a URL that says closed.
  let pendingClose = null;
  const settle = () => { busy = false; if (pendingClose !== null) { const p = pendingClose; pendingClose = null; close(p); } };
  const N = ctx.plates.length;

  function target(i) {
    const p = ctx.plates[i == null ? cur : i];
    const r = p ? p.h / p.w : 1.75;   // height over width
    const vw = innerWidth, vh = innerHeight, hd = 52;
    if (vw < 760) {
      let w = vw - 32, hh = w * r;
      const room = vh - hd - 200;
      if (hh > room) { hh = room; w = hh / r; }
      return { left: (vw - w) / 2, top: hd + 6, width: w, height: hh };
    }
    // keep a band clear at the bottom for the counter and arrows
    const band = 72;
    let hh = vh - hd - band - 24, w = hh / r;
    const textR = 24 + Math.min(vw * 0.3, 380) + 36, thumbsL = vw - 24 - 64 - 36;
    if (w > thumbsL - textR) { w = thumbsL - textR; hh = w * r; }
    let left = (vw - w) / 2;
    left = clamp(left, textR, thumbsL - w);
    return { left, top: hd + (vh - hd - band - hh) / 2 + 8, width: w, height: hh };
  }
  const place = (r) => gsap.set(frame, { left: r.left, top: r.top, width: r.width, height: r.height, x: 0, y: 0, scale: 1 });

  function fill(i) {
    const p = ctx.plates[i];
    $(".sl-n", ui).textContent = `[${pad(p.n)}]`;
    $(".sl-story", ui).textContent = `${pad(p.story + 1)} · ${p.storyTitle}`;
    $(".sl-k", ui).textContent = p.kicker;
    $(".sl-c", ui).textContent = p.caption;
    $(".sl-count", ui).textContent = `${pad(p.n)} / ${pad(N)}`;
    const g = $(".sl-g", ui);
    g.innerHTML = [["Exhibition", ctx.issue.mark], ["Chapter", `${pad(p.story + 1)} · ${p.storyTitle}`], ["Format", p.shape]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("") +
      (p.palette.length ? `<dt>Colours</dt><dd class="sl-sw">${p.palette.map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join("")}</dd>` : "") +
      `<a href="${esc(ctx.booking(`Booking enquiry: ${ctx.issue.mark}, like plate ${pad(p.n)} (${p.kicker})`))}" data-cursor="label" data-cursor-label="Email">Book a session like this &rarr;</a>`;
    g.hidden = false;
    im.alt = p.alt;
    $$("button", thumbs).forEach((b) => {
      const on = +b.dataset.i === i;
      b.setAttribute("aria-current", on ? "true" : "false");
      if (on && open) b.scrollIntoView({ block: "nearest", behavior: prefs.get().motion === "calm" ? "auto" : "smooth" });
    });
  }

  function url(i) { return `${location.pathname}?view=slider&id=${ctx.plates[i].n}`; }

  async function show(i, from, opts = {}) {
    if (open || busy) return;
    busy = true; open = true; cur = i;
    scroll.lock();
    fill(i);
    const p = ctx.plates[i];
    im.src = p.src;
    document.documentElement.classList.add("sl-open");
    resetCursor();
    const t = target();
    const calm = prefs.get().motion === "calm";
    const src = from && from.getBoundingClientRect();
    const srcImg = from && $("img", from);
    if (srcImg) srcImg.style.visibility = "hidden";
    pushed = opts.push !== false;
    if (pushed) history.pushState({ v: "slider", id: p.n }, "", url(i));
    gsap.set([back, ui], { autoAlpha: 0 });
    if (src && src.width && !calm) {
      place(src);
      await Promise.all([
        new Promise((res) => gsap.to(frame, { left: t.left, top: t.top, width: t.width, height: t.height, duration: 1.0, ease: "expo.inOut", onComplete: res })),
        new Promise((res) => gsap.to(back, { autoAlpha: 1, duration: 0.7, ease: "power2.out", onComplete: res })),
      ]);
    } else {
      place(t);
      gsap.fromTo(frame, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out" });
      await new Promise((res) => gsap.to(back, { autoAlpha: 1, duration: 0.45, onComplete: res }));
    }
    gsap.to(ui, { autoAlpha: 1, duration: 0.5 });
    if (!calm) { slot($(".sl-k", ui), { type: "words", stagger: 0.05, rotate: 0 }); scramble($(".sl-n", ui)); }
    $(".sl-close", ui).focus({ preventScroll: true });
    sound.play("paper", { dur: 0.45, gain: 0.08 });
    settle();
  }

  async function go(j, dir) {
    if (!open || busy) return;
    j = (j + N) % N;
    if (j === cur) return;
    busy = true;
    dir = dir || (j > cur ? 1 : -1);
    const p = ctx.plates[j];
    const calm = prefs.get().motion === "calm";
    let next;
    try { next = await loadImage(p.src); } catch (e) { BB("warn", "slider image " + p.src); }
    const prev = cur;
    cur = j;
    history.replaceState({ v: "slider", id: p.n }, "", url(j));
    const dest = target(j), was = frame.getBoundingClientRect();
    const reshape = Math.abs(dest.width / dest.height - was.width / was.height) > 0.04;
    let run = null;
    if (!calm && stage.ok && !reshape) {
      run = curl({
        rect: () => frame.getBoundingClientRect(), origin: dir > 0 ? "br" : "bl", from: 0, to: 1,
        front: im, back: ctx.paper, show: 0.14, duration: 1.0, ease: "power2.inOut", shadow: 0.3, slant: [1, 0.3],
      });
    }
    if (run) {
      await new Promise((r) => requestAnimationFrame(r));
      im.src = p.src;
      fill(j);
      scramble($(".sl-n", ui));
      sound.play("paper", { dur: 0.6, gain: 0.1 });
      await run;
    } else {
      const ghost = h("img", { src: ctx.plates[prev].src, alt: "", style: "position:absolute;inset:0;width:100%;height:100%;object-fit:cover" });
      frame.appendChild(ghost);
      im.src = p.src;
      fill(j);
      if (reshape) {
        // another shape: the frame re-cuts itself to the next print while the last one fades
        await Promise.all([
          new Promise((res) => gsap.to(frame, { left: dest.left, top: dest.top, width: dest.width, height: dest.height, duration: calm ? 0.01 : 0.8, ease: "expo.inOut", onComplete: res })),
          new Promise((res) => gsap.to(ghost, { autoAlpha: 0, duration: calm ? 0.25 : 0.6, ease: "power2.inOut", onComplete: res })),
        ]);
        sound.play("paper", { dur: 0.4, gain: 0.07 });
      } else {
        await new Promise((res) => gsap.to(ghost, calm ? { autoAlpha: 0, duration: 0.3, onComplete: res } :
          { clipPath: dir > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)", duration: 0.7, ease: "expo.inOut", onComplete: res }));
      }
      ghost.remove();
    }
    settle();
  }

  async function close(fromPop) {
    if (!open) return;
    if (busy) { pendingClose = !!fromPop || pendingClose === true; return; }
    busy = true; open = false;
    if (!fromPop) { if (pushed) history.back(); else history.replaceState({}, "", location.pathname); }
    pushed = false;
    const calm = prefs.get().motion === "calm";
    // make sure the frame we fly back to is on screen (the page is covered, so this is invisible)
    ctx.grid.reveal(cur);
    const dest = ctx.grid.media(cur);
    const r = dest && dest.getBoundingClientRect();
    gsap.to(ui, { autoAlpha: 0, duration: 0.25 });
    if (r && r.width && !calm) {
      await Promise.all([
        new Promise((res) => gsap.to(frame, { left: r.left, top: r.top, width: r.width, height: r.height, x: 0, y: 0, scale: 1, duration: 0.9, ease: "expo.inOut", onComplete: res })),
        new Promise((res) => gsap.to(back, { autoAlpha: 0, duration: 0.8, delay: 0.1, ease: "power2.inOut", onComplete: res })),
      ]);
    } else {
      await new Promise((res) => gsap.to([frame, back], { autoAlpha: 0, duration: 0.35, onComplete: res }));
    }
    $$(".fr-m img").forEach((x) => { x.style.visibility = ""; });
    document.documentElement.classList.remove("sl-open");
    gsap.set(frame, { clearProps: "opacity,visibility" });
    scroll.unlock();
    busy = false;
    const f = ctx.grid.frame(cur);
    if (f) $(".fr-a", f).focus({ preventScroll: true });
  }

  /* input -------------------------------------------------------------------- */
  $(".sl-close", ui).addEventListener("click", () => close());
  $(".sl-prev", ui).addEventListener("click", () => go(cur - 1, -1));
  $(".sl-next", ui).addEventListener("click", () => go(cur + 1, 1));
  thumbs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(+b.dataset.i); });
  addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(cur + 1, 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(cur - 1, -1); }
  });
  let acc = 0, cool = 0;
  addEventListener("wheel", (e) => {
    if (!open) return;
    if (e.target.closest && e.target.closest(".sl-thumbs")) return;
    e.preventDefault();
    const now = performance.now();
    if (now < cool) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 50) { go(cur + (acc > 0 ? 1 : -1), acc > 0 ? 1 : -1); acc = 0; cool = now + 900; }
  }, { passive: false });
  // swipe to turn, pull down to close
  let sx = 0, sy = 0, dragging = false, axis = null;
  const down = (e) => { if (!open || busy) return; dragging = true; axis = null; sx = e.clientX; sy = e.clientY; };
  const move = (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
    if (axis === "y" && dy > 0) {
      gsap.set(frame, { y: dy * 0.9, scale: 1 - Math.min(dy, 400) / 1600 });
      gsap.set(back, { autoAlpha: 1 - Math.min(dy, 500) / 700 });
    }
  };
  const up = (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (axis === "y" && dy > 110) close();
    else {
      gsap.to(frame, { y: 0, scale: 1, duration: 0.5, ease: "expo.out" });
      gsap.to(back, { autoAlpha: 1, duration: 0.4 });
      if (axis === "x" && Math.abs(dx) > 55) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };
  for (const el of [frame, back]) { el.addEventListener("pointerdown", down); }
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  frame.style.touchAction = "none"; back.style.touchAction = "none";

  addEventListener("resize", () => { if (open && !busy) place(target()); });
  addEventListener("popstate", (e) => {
    const st = e.state;
    if (open && !(st && st.v === "slider")) close(true);
    else if (!open && st && st.v === "slider") show(Math.max(0, st.id - 1), ctx.grid.media(st.id - 1), { push: false });
  });

  return {
    open: (i, from, opts) => show(i, from, opts),
    close: () => close(),
    get isOpen() { return open; },
    get current() { return cur; },
  };
}
