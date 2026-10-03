/* The exhibition grid: the heart of the page.
 *
 *   hang        layout.js decides where every frame goes (pure, tested)
 *   entrance    each frame lands as paper (gl/plates.js), or a clip-path fold
 *               where there is no WebGL
 *   hover       print loupe, a pentatonic tick, the [n] label decrypts
 *   depth       frames drift at their own rates (multi-rate parallax) and
 *               lean with a hard fling (velocity skew)
 *   chapters    each story swaps the page mood at its boundary; the HUD shows
 *               where you are, how far through, and how many frames you've seen
 *   zoom        + / - re-hangs the wall at 6, 8 or 10 columns and every frame
 *               glides to its new place (GSAP Flip), anchored on what you were
 *               looking at
 *   touch       press and hold a frame to peek at it full screen
 */
import { layout, columnsFor } from "./layout.js";
import { $, $$, h, esc, pad, clamp, damp, hashStr, luma, emit, ready, media } from "../util.js";
import { enter, hover } from "../gl/plates.js";
import { scroll, whenVisible } from "../core/scroll.js";
import { scramble } from "../core/type.js";
import { initReveals } from "../core/reveal.js";
import { sound } from "../core/sound.js";
import * as prefs from "../core/prefs.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Flip = window.Flip;

export function initGrid(ctx) {
  const el = ctx.el.grid;
  const hud = ctx.el.hud, zoomEl = ctx.el.zoom;
  let zoom = 0, cols = 0, rows = [];
  const seen = new Set();
  const entered = new WeakSet();
  const visible = new Set();
  const speeds = ctx.plates.map((p) => 1 + ((hashStr(p.src) % 1000) / 1000 - 0.5) * 0.14);
  let skew = 0, flipping = false;

  function frameHTML(p, it, r) {
    const eager = p.i < 6;
    const lab = `<span class="num" data-text="[${pad(p.n)}]">[${pad(p.n)}]</span><small>${esc(p.kicker)}</small>`;
    return `<figure class="fr is-waiting" id="p-${pad(p.n)}" data-i="${p.i}" style="grid-row:${r};grid-column:${it.start + 1} / span ${it.span};--drop:${it.drop}">
      <a class="fr-a" href="?view=slider&amp;id=${p.n}" data-cursor="view" aria-label="Plate ${pad(p.n)}, ${esc(p.kicker)}. ${esc(p.caption)}">
        <div class="fr-m" style="aspect-ratio:${p.w} / ${p.h}"><img src="${esc(p.src)}" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>
      </a>
      <figcaption class="fr-lab" data-side="${it.label}">${lab}</figcaption>
    </figure>`;
  }
  function chapterHTML(s, row, r) {
    return `<section class="ch" id="chapter-${s.i + 1}" data-story="${s.i}" data-side="${row.side}" style="grid-row:${r}" aria-labelledby="cht-${s.i}">
      <div class="ch-in">
        <div class="ch-n num" aria-hidden="true">${pad(s.i + 1)}</div>
        <h2 class="ch-t" id="cht-${s.i}" data-reveal="chars">${esc(s.title)}</h2>
        <p class="ch-d" data-reveal="lines">${esc(s.deck)}</p>
        <div class="ch-meta lbl" data-reveal="fade">${s.plates.length} photograph${s.plates.length > 1 ? "s" : ""}</div>
      </div>
    </section>`;
  }

  /** Build or re-hang. On a re-hang, existing nodes are moved, not rebuilt. */
  function hang(first) {
    cols = columnsFor(innerWidth, zoom);
    rows = layout(ctx.stories.map((s) => ({ plates: s.plates.length })), { cols, seed: ctx.slug });
    el.style.setProperty("--cols", cols);
    if (first) {
      let html = "";
      rows.forEach((row, r) => {
        if (row.type === "chapter") html += chapterHTML(ctx.stories[row.story], row, r + 1);
        else row.items.forEach((it) => { html += frameHTML(ctx.plates[it.index], it, r + 1); });
      });
      el.innerHTML = html;
      return;
    }
    rows.forEach((row, r) => {
      if (row.type === "chapter") {
        const c = $(`#chapter-${row.story + 1}`, el);
        c.style.gridRow = r + 1; c.dataset.side = row.side;
      } else row.items.forEach((it) => {
        const f = $(`#p-${pad(it.index + 1)}`, el);
        f.style.gridRow = r + 1;
        f.style.gridColumn = `${it.start + 1} / span ${it.span}`;
        f.style.setProperty("--drop", it.drop);
        $(".fr-lab", f).dataset.side = it.label;
      });
    });
  }

  hang(true);
  const frames = $$(".fr", el);
  const img = (f) => $("img", f);

  /* entrance ------------------------------------------------------------ */
  let batch = 0, batchT = 0;
  function land(f) {
    if (entered.has(f)) return;
    entered.add(f);
    const i = +f.dataset.i;
    const now = performance.now();
    if (now - batchT > 180) batch = 0;
    batchT = now;
    const delay = Math.min(batch++ * 0.09, 0.45);
    const im = img(f);
    ready(im).then(() => {
      if (!im.naturalWidth) { f.classList.remove("is-waiting"); return; }
      const calm = prefs.get().motion === "calm";
      const go = calm ? Promise.resolve(false) : enter(im, { box: $(".fr-m", f), delay });
      go.then((ok) => {
        seen.add(i); updateHud();
        if (ok) { f.classList.remove("is-waiting"); return; }
        f.classList.remove("is-waiting");
        if (!calm) { f.style.setProperty("animation-delay", delay + "s"); f.classList.add("is-css"); }
      });
      if (!calm) setTimeout(() => sound.play("paper", { dur: 0.28, gain: 0.035 }), delay * 1000);
      requestAnimationFrame(() => f.classList.remove("is-waiting"));
    });
  }
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) { visible.add(e.target); land(e.target); }
      else visible.delete(e.target);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.02 });
  frames.forEach((f) => io.observe(f));

  /* hover, click, long press ---------------------------------------------- */
  frames.forEach((f) => {
    const a = $(".fr-a", f), m = $(".fr-m", f), num = $(".fr-lab .num", f);
    const i = +f.dataset.i;
    a.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      hover(img(f), true, m);
      scramble(num);
      sound.play("tick", { i });
    });
    a.addEventListener("pointerleave", () => hover(img(f), false, m));
    a.addEventListener("focus", () => scramble(num));
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      if (a._peeked) { a._peeked = false; return; }
      hover(img(f), false, m);
      ctx.open(i, m);
    });
    // Touch: press and hold to peek, release to put it back.
    let t = 0, sx = 0, sy = 0;
    a.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      sx = e.clientX; sy = e.clientY;
      t = setTimeout(() => { a._peeked = true; peek(ctx.plates[i]); }, 430);
    });
    const cancel = (e) => {
      if (e && e.type === "pointermove" && Math.hypot(e.clientX - sx, e.clientY - sy) < 10) return;
      clearTimeout(t);
    };
    a.addEventListener("pointermove", cancel, { passive: true });
    a.addEventListener("pointerup", () => { clearTimeout(t); unpeek(); });
    a.addEventListener("pointercancel", () => { clearTimeout(t); unpeek(); });
    a.addEventListener("contextmenu", (e) => { if (a._peeked) e.preventDefault(); });
  });

  let peekEl = null;
  function peek(p) {
    if (!peekEl) { peekEl = h("div", { class: "peek", "aria-hidden": "true" }); document.body.appendChild(peekEl); }
    peekEl.innerHTML = `<img src="${esc(p.src)}" alt=""><div class="peek-t"><span class="num">[${pad(p.n)}]</span> ${esc(p.kicker)}</div>`;
    peekEl.classList.add("on");
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  }
  function unpeek() { if (peekEl) peekEl.classList.remove("on"); }

  /* depth: parallax + velocity skew --------------------------------------- */
  // Each frame's resting centre in document space, measured only when layout
  // changes (load, resize, re-hang), so scrolling never reads layout.
  const measure = () => {
    for (const f of frames) {
      const prev = f.style.transform;
      f.style.transform = "";
      const r = f.getBoundingClientRect();
      f._cy = r.top + scrollY + r.height / 2;
      f.style.transform = prev;
    }
  };
  measure();
  ScrollTrigger.addEventListener("refresh", measure);
  let lastSkew = 0;
  scroll.on((s, dt) => {
    const calm = prefs.get().motion === "calm";
    skew = damp(skew, calm ? 0 : clamp(s.v * 0.045, -1.8, 1.8), 8, dt);
    if (Math.abs(skew - lastSkew) > 0.002) { lastSkew = skew; el.style.setProperty("--skew", skew.toFixed(3) + "deg"); }
    if (calm || flipping) return;
    const mid = s.y + innerHeight / 2;
    for (const f of visible) {
      const off = (f._cy - mid) * (speeds[+f.dataset.i] - 1) * -1;
      if (Math.abs(off - (f._py || 0)) < 0.05) continue;
      f._py = off;
      f.style.transform = `translate3d(0,${off.toFixed(2)}px,0)`;
    }
  });
  prefs.onChange(({ key }) => { if (key === "motion" && prefs.get().motion === "calm") frames.forEach((f) => { f.style.transform = ""; f._py = 0; }); });

  /* chapters, moods, HUD --------------------------------------------------- */
  const heads = $$(".ch", el);
  let current = -1;
  function mood(si) {
    const s = ctx.stories[si];
    if (!s || !s.mood) return;
    const d = document.documentElement;
    d.style.setProperty("--bg", s.mood.bg);
    d.style.setProperty("--ink", s.mood.ink);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = prefs.get().theme === "dark" ? "#0d0c0b" : s.mood.bg;
    sound.mood(1 - luma(s.mood.bg));
  }
  function setChapter(si) {
    if (si === current) return;
    current = si;
    mood(si);
    const s = ctx.stories[si];
    $(".hud-ch", hud).innerHTML = `<span class="num">${pad(si + 1)}</span> &nbsp;${esc(s.title)}`;
    emit("chapter", si);
  }
  heads.forEach((c, k) => {
    const next = heads[k + 1];
    ScrollTrigger.create({
      trigger: c, start: "top 55%",
      endTrigger: next || el, end: next ? "top 55%" : "bottom 55%",
      // re-apply on every entry: a later room may have changed the mood since
      onToggle: (st) => { if (st.isActive) { mood(k); setChapter(k); } },
    });
  });
  mood(0);
  const bar = $(".hud-bar i", hud);
  ScrollTrigger.create({
    trigger: el, start: "top 60%", end: "bottom 40%",
    onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress.toFixed(4)})`; },
    onToggle: (st) => {
      hud.classList.toggle("is-in", st.isActive);
      zoomEl.classList.toggle("is-in", st.isActive);
      if (!st.isActive && st.direction < 0) setChapter(0);
    },
  });
  function updateHud() {
    const n = $(".hud-seen .num", hud);
    if (n) n.textContent = `${pad(seen.size)}/${pad(ctx.plates.length)}`;
  }
  updateHud();

  /* zoom -------------------------------------------------------------------- */
  const [zin, zout] = $$("button", zoomEl);
  function syncZoom() {
    const narrow = innerWidth < 760;
    zin.disabled = narrow || zoom <= -1;
    zout.disabled = narrow || zoom >= 1;
  }
  function rehang(nextZoom) {
    if (nextZoom === zoom) return;
    // anchor: the frame nearest the viewport centre stays put
    let anchor = null, best = 1e9;
    for (const f of frames) {
      const r = f.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (d < best) { best = d; anchor = f; }
    }
    const before = anchor ? anchor.getBoundingClientRect().top : 0;
    const calm = prefs.get().motion === "calm";
    const state = Flip && !calm ? Flip.getState(frames.concat(heads)) : null;
    zoom = nextZoom;
    frames.forEach((f) => { f.style.transform = ""; f._py = 0; });
    hang(false);
    measure();
    syncZoom();
    if (anchor) {
      const after = anchor.getBoundingClientRect().top;
      scroll.to(scrollY + (after - before), { immediate: true });
    }
    if (state) {
      flipping = true;
      Flip.from(state, { duration: 0.95, ease: "expo.inOut", stagger: 0.008, absolute: false, scale: false,
        onComplete: () => { flipping = false; ScrollTrigger.refresh(); } });
    }
    else ScrollTrigger.refresh();
    sound.play("paper", { dur: 0.4, gain: 0.08 });
  }
  zin.addEventListener("click", () => rehang(zoom - 1));
  zout.addEventListener("click", () => rehang(zoom + 1));
  syncZoom();

  let lastCols = cols, rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      syncZoom();
      if (columnsFor(innerWidth, zoom) !== lastCols) { const z = zoom; zoom = 99; rehang(z); lastCols = cols; }
    }, 180);
  });

  initReveals(el);

  /* API used by the slider, finder, range and menu ------------------------ */
  let hitT = 0;
  return {
    frame: (i) => $(`#p-${pad(i + 1)}`, el),
    media: (i) => $(`#p-${pad(i + 1)} .fr-m`, el),
    chapterEl: (si) => $(`#chapter-${si + 1}`, el),
    get chapter() { return Math.max(0, current); },
    seen,
    /** Pick out frames: everything else dims for a few seconds. */
    highlight(indices, opts = {}) {
      clearTimeout(hitT);
      const set = new Set(indices);
      frames.forEach((f) => {
        const i = +f.dataset.i;
        f.classList.toggle("is-dim", set.size > 0 && !set.has(i));
        f.classList.toggle("is-hit", set.has(i));
      });
      if (set.size && opts.scroll !== false) {
        const first = $(`#p-${pad(Math.min(...set) + 1)}`, el);
        if (first) scroll.to(first, { offset: -innerHeight * 0.25 });
      }
      hitT = setTimeout(() => frames.forEach((f) => f.classList.remove("is-dim", "is-hit")), opts.hold || 6000);
    },
    goChapter(si) {
      const c = $(`#chapter-${si + 1}`, el);
      if (c) scroll.to(c, { offset: -(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--hd")) || 52) - 20 });
    },
    /** Make sure a frame is on screen (used before the slider flies back to it). */
    reveal(i) {
      const f = $(`#p-${pad(i + 1)}`, el);
      if (!f) return;
      land(f);
      const r = f.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight - 20) scroll.to(scrollY + r.top - innerHeight / 2 + r.height / 2, { immediate: true });
    },
  };
}
