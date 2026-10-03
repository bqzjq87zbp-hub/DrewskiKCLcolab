/* The exhibition grid: the heart of the page.
 *
 *   hang        layout.js decides where every frame goes (pure, tested)
 *   entrance    each print rises a little into place as it fades up, flat
 *               and level the whole way (x.css)
 *   hover       print loupe, a pentatonic tick, the kicker beside the frame
 *   depth       frames drift gently at their own rates (multi-rate parallax);
 *               they never lean or skew, so every portrait stays level
 *   chapters    each story swaps the page mood at its boundary; the HUD shows
 *               which chapter you are in and how far through the wall you are
 *   zoom        + / - re-hangs the wall at 6, 8 or 10 columns and every frame
 *               glides to its new place (GSAP Flip), anchored on what you were
 *               looking at
 *   touch       press and hold a frame to peek at it full screen
 */
import { layout, columnsFor } from "./layout.js";
import { $, $$, h, esc, pad, clamp, hashStr, luma, emit, ready, media } from "../util.js";
import { hover } from "../gl/plates.js";
import { scroll, whenVisible } from "../core/scroll.js";
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
  const entered = new WeakSet();
  const visible = new Set();
  // a gentle drift: each frame within 3.5% of the scroll rate
  const speeds = ctx.plates.map((p) => 1 + ((hashStr(p.src) % 1000) / 1000 - 0.5) * 0.07);
  let flipping = false;

  function frameHTML(p, it, r) {
    const eager = p.i < 6;
    return `<figure class="fr is-waiting" id="p-${pad(p.n)}" data-i="${p.i}" style="grid-row:${r};grid-column:${it.start + 1} / span ${it.span};--drop:${it.drop}">
      <a class="fr-a" href="?view=slider&amp;id=${p.n}" aria-label="Plate ${pad(p.n)}, ${esc(p.kicker)}. ${esc(p.caption)}">
        <div class="fr-m" style="aspect-ratio:${p.w} / ${p.h}"><img src="${esc(p.src)}" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>
      </a>
      <figcaption class="fr-lab" data-side="${it.label}"><small>${esc(p.kicker)}</small></figcaption>
    </figure>`;
  }
  function chapterHTML(s, row, r) {
    return `<section class="ch" id="chapter-${s.i + 1}" data-story="${s.i}" data-side="${row.side}" style="grid-row:${r}" aria-labelledby="cht-${s.i}">
      <div class="ch-in">
        <h2 class="ch-t" id="cht-${s.i}" data-reveal="chars">${esc(s.title)}</h2>
        <p class="ch-d" data-reveal="lines">${esc(s.deck)}</p>
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
    const now = performance.now();
    if (now - batchT > 180) batch = 0;
    batchT = now;
    const delay = Math.min(batch++ * 0.09, 0.45);
    const im = img(f);
    ready(im).then(() => {
      f.classList.remove("is-waiting");
      if (!im.naturalWidth || prefs.get().motion === "calm") return;
      // a custom property, because the animation runs on the frame's child
      f.style.setProperty("--in-delay", delay + "s");
      f.classList.add("is-in");
      setTimeout(() => sound.play("paper", { dur: 0.28, gain: 0.035 }), delay * 1000);
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
    const a = $(".fr-a", f), m = $(".fr-m", f);
    const i = +f.dataset.i;
    a.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      hover(img(f), true, m);
      sound.play("tick", { i });
    });
    a.addEventListener("pointerleave", () => hover(img(f), false, m));
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
    peekEl.innerHTML = `<img src="${esc(p.src)}" alt=""><div class="peek-t">${esc(p.kicker)}</div>`;
    peekEl.classList.add("on");
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  }
  function unpeek() { if (peekEl) peekEl.classList.remove("on"); }

  /* depth: parallax ------------------------------------------------------- */
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
  scroll.on((s) => {
    if (prefs.get().motion === "calm" || flipping) return;
    const mid = s.y + innerHeight / 2;
    for (const f of visible) {
      // A hard fling outruns the observer: a frame already far off screen can
      // still be in `visible` and would keep a big offset into its next entry
      // (a visible jump). Distance is capped at a screen height so it cannot.
      const off = clamp(f._cy - mid, -innerHeight, innerHeight) * (speeds[+f.dataset.i] - 1) * -1;
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
    $(".hud-ch", hud).textContent = ctx.stories[si].title;
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
