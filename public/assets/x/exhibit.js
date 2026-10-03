/* A collection as an exhibition. Entry point for /<slug>/.
 *
 * Reads issue.json and catalog.json, builds the page from them, and wires the
 * rooms together. The shell HTML is the same for every exhibition; nothing
 * here knows which one it is showing.
 *
 *   preloader -> hero (light on water over the blurred pier, the wordmark) ->
 *   the grid, chapter by chapter -> walk the hall -> the palette -> the
 *   contents -> the footer, revealed from under the page
 *
 * with the reading view, the canvas, the menu, the finder and the game as
 * overlays, and the book and the atelier one page turn away.
 */
import { $, $$, h, esc, fetchJSON, hereDir, appUrl, APP, BB, mixHex, luma, clamp, listen, emit } from "./util.js";
import * as prefs from "./core/prefs.js";
import { initScroll, scroll, refresh } from "./core/scroll.js";
import { bindAll } from "./core/cursor.js";
import { split, marquee, axis } from "./core/type.js";
import { initReveals } from "./core/reveal.js";
import { sound } from "./core/sound.js";
import { startLive } from "./core/live.js";
import { track, preloader, reveal, bindLinks, arriving } from "./core/transition.js";
import { stage } from "./gl/stage.js";
import { setPaper } from "./gl/plates.js";
import { caustics } from "./gl/caustics.js";
import { initGrid } from "./exhibit/grid.js";
import { initSlider } from "./exhibit/slider.js";
import { initCanvas } from "./exhibit/canvasview.js";
import { initHall, initPalette, initStack } from "./exhibit/sections.js";
import { initMenu } from "./ui/menu.js";
import { initFinder } from "./ui/finder.js";
import { initGame } from "./ui/game.js";
import { model } from "./exhibit/model.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

boot().catch((e) => {
  BB("fail", "exhibit boot: " + e.message, { stack: e.stack });
  const pre = document.getElementById("pre");
  if (pre) {
    pre.classList.remove("is-gone");
    pre.innerHTML = `<div class="pre-lock"><p class="lbl">The exhibition could not open (${esc(e.message)}).</p>
      <p><a href="book/">Read the flat edition instead</a></p></div>`;
    const a = pre.querySelector("a");
    if (a) a.href = hereDir() + "book/";
  }
});

async function boot() {
  const root = hereDir();
  const slug = root.split("/").filter(Boolean).pop();
  prefs.apply();
  initScroll();
  scroll.lock();
  stage.init({ z: 30 });
  bindLinks();

  const pre = $("#pre");
  const pl = preloader(pre);
  pl.set(0.04);

  const [issue, catalog] = await Promise.all([
    fetchJSON(root + "issue.json"),
    fetchJSON(appUrl("catalog.json")).catch(() => null),
  ]);
  pl.set(0.12);
  const ex = issue.exhibit || {};
  const m = model(issue, catalog, root, slug);
  const b = document.body.style;
  b.setProperty("--hero-base", ex.hero || "#e5dfd5");
  b.setProperty("--hero-ink-base", ex.heroInk || "#7d7262");
  b.setProperty("--acc", ex.acc || (issue.theme && issue.theme.acc) || "#b5502f");
  b.setProperty("--wm", ex.font || "var(--disp)");
  b.setProperty("--wm-weight", ex.weight || 400);
  if (ex.variation) b.setProperty("--wm-var", ex.variation);
  document.title = `${issue.mark} · ${issue.issue} · Kiyono Creative Lab`;
  const first = issue.stories[0] && issue.stories[0].mood;
  const paper = (first && first.bg) || "#fbf8f2";
  setPaper(mixHex(paper, "#ffffff", 0.3), mixHex(paper, "#d9d2c5", 0.35));

  const booking = (subject) => `mailto:${ex.booking || ""}?subject=${encodeURIComponent(subject || "Booking enquiry")}`;
  const ctx = {
    root, slug, issue, ex, catalog, paper, booking,
    plates: m.plates, stories: m.stories, prints: m.prints, palette: m.palette, other: m.others,
    cover: root + issue.cover,
    menuTitle: `${issue.mark} · ${issue.issue}`,
    el: {},
  };

  render(ctx);
  sound.init(ex.sound || "cruise");

  // count what the first screen needs: fonts, cover, the first frames
  const firstImgs = $$(".fr-m img", ctx.el.grid).slice(0, 6);
  await track([ctx.cover, ...firstImgs], (p) => pl.set(0.12 + p * 0.88));
  await pl.finish();

  // rooms
  ctx.grid = initGrid(ctx);
  ctx.slider = initSlider(ctx);
  ctx.open = (i, from) => ctx.slider.open(i, from);
  ctx.canvas = initCanvas(ctx);
  ctx.emitView = (v) => syncView(ctx, v);
  ctx.moods = roomMoods(ctx);
  initHall(ctx, $("#hall"));
  initPalette(ctx, $("#palette"));
  initStack(ctx, $("#contents"));
  sectionMoods(ctx);
  ctx.menu = initMenu(ctx);
  ctx.finder = initFinder(ctx);
  ctx.game = initGame(ctx);
  wireHeader(ctx);
  wireHero(ctx);
  wireFooter(ctx);
  initReveals(document);
  bindAll(document);
  if (ex.place || ex.almanac) startLive(document, ex);

  scroll.unlock();
  refresh();
  // The hero takes its start state before the sheet lifts and rises under the
  // peel (the front door's rule too). Hidden after the peel, the wordmark
  // showed through it, vanished and came back: the intro running backwards.
  heroIntro(ctx);
  await reveal(pre, getComputedStyle(document.body).getPropertyValue("--hero").trim() || ex.hero);
  deepLink(ctx);
  BB("note", "exhibit ready", { slug });
}

/* ─── DOM ──────────────────────────────────────────────────────────────── */
function render(ctx) {
  const { issue, ex, plates, stories, prints, root } = ctx;
  const others = ctx.other;
  const wm = esc(ex.wordmark || issue.mark);
  const live = ex.place || ex.almanac ? `<div class="hero-live lbl"><span data-live="place"></span> <span class="num" data-live="time"></span><br><span data-live="line"></span></div>` : "<div></div>";

  // the intro is the one place that says to scroll; the cue below it is a line, not a third "Scroll"
  const hero = h("header", { class: "hero", "aria-label": `${issue.mark}, ${issue.issue}` }, `
    <div class="hero-mid"><div>
      <h1 class="hero-wm">${wm}</h1>
      <div class="hero-sub">${esc(issue.issue)}</div>
    </div></div>
    <div class="hero-bot">
      <p>${esc(ex.intro || issue.standfirst)}</p>
      <div class="hero-cue" aria-hidden="true"><i></i></div>
      ${live}
    </div>`);

  const header = h("div", { class: "hd", id: "hd" }, `
    <div class="hd-l">
      <button type="button" class="hd-btn vtoggle" aria-haspopup="true" aria-expanded="false" data-magnetic="0.25">
        <svg viewBox="0 0 12 12" aria-hidden="true"><g fill="currentColor"><rect width="4" height="4"/><rect x="8" width="4" height="4"/><rect y="8" width="4" height="4"/><rect x="8" y="8" width="4" height="4"/></g></svg>View</button>
      <div class="vmenu" role="menu">
        <button type="button" role="menuitemradio" data-view="grid" aria-pressed="true">Grid <small>exhibit</small></button>
        <button type="button" role="menuitemradio" data-view="slider" aria-pressed="false">Slider <small>one by one</small></button>
        <button type="button" role="menuitemradio" data-view="canvas" aria-pressed="false">Canvas <small>drag it</small></button>
        <a class="hd-btn" role="menuitem" href="${esc(root)}book/">Book <small>flip it</small></a>
      </div>
    </div>
    <a class="hd-wm" href="${esc(appUrl(""))}" data-go="#070707" aria-label="The front door, all exhibitions">${wm}</a>
    <div class="hd-r">
      <a class="hd-btn hd-book" href="${esc(ctx.booking(`Booking enquiry: ${issue.mark}`))}" data-magnetic="0.3">Book<span class="hd-long"> a session</span></a>
      <button type="button" class="hd-btn snd-btn" aria-pressed="false" aria-label="Sound" data-magnetic="0.3"><span class="snd" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="snd-l">Sound</span></button>
      <button type="button" class="hd-btn menu-btn" aria-haspopup="dialog" aria-controls="menu" data-magnetic="0.3">Menu</button>
    </div>`);

  const hud = h("div", { class: "hud lbl", "aria-hidden": "true" }, `<span class="hud-ch"></span><span class="hud-bar"><i></i></span>`);
  const zoom = h("div", { class: "zoom", role: "group", "aria-label": "Zoom the wall" }, `
    <button type="button" aria-label="Zoom in: fewer, larger frames" data-magnetic="0.4"><svg viewBox="0 0 12 12"><path d="M6 1v10M1 6h10"/></svg></button>
    <button type="button" aria-label="Zoom out: more, smaller frames" data-magnetic="0.4"><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></button>`);

  const hallSec = `<section class="sec hall" id="hall" aria-label="Walk the hall" data-hall-phase="walk">
    <div class="hall-pin"><div class="hall-ui">
      <div><div class="lbl" style="opacity:.7">A room, not a page</div><h2>Walk the hall</h2></div>
      <div class="hall-cap"><p class="hall-cur"></p></div>
    </div><div class="hall-bar"><i></i></div></div>
  </section>`;

  const paletteSec = `<section class="sec range" id="palette" aria-label="The palette">
    <div class="range-pin">
      <div class="sec-h"><h2 data-reveal="lines">The <em>palette</em></h2><p data-reveal="up">Every colour here was measured from the photographs themselves. Throw one, or follow each chapter's lead print along the rail.</p></div>
      <div class="range-track">
        <div class="tray"><div class="tray-t"><div class="lbl">Measured colours</div><h3>Throw a colour</h3><p>Pick one up, toss it around. Tap one to find the photographs it came from.</p></div>
          <canvas aria-label="Colour swatches you can drag and throw"></canvas></div>
        ${prints.map((g) => {
          const p = plates[g.plate];
          return `<article class="gar" data-g="${g.id}">
          <div class="gar-m"><img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></div>
          <div class="gar-b"><h3>${esc(g.name)}</h3><span class="sw">${g.swatch.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span>
            <dl><dt>Chapter</dt><dd>${esc(stories[g.story].title)}</dd>
              <dt>Lead</dt><dd>${esc(p.kicker)}</dd><dt>Format</dt><dd>${esc(p.shape)}</dd></dl>
            <p>${esc(g.note)}</p>
            <a class="card-go" style="margin-top:10px;font-size:15px" href="#chapter-${g.story + 1}" data-chapter="${g.story}">Read the chapter &rarr;</a>
          </div></article>`;
        }).join("")}
      </div>
    </div>
  </section>`;

  const stackSec = `<section class="sec stack" id="contents" aria-label="Contents">
    <div class="sec-h"><h2 data-reveal="lines">The exhibition, <em>wall to wall</em></h2><p data-reveal="up">${esc(issue.standfirst)}</p></div>
    <ol class="stack-list">${stories.map((s, k) => {
      const bg = (s.mood && s.mood.bg) || "#f4efe6", ink = (s.mood && s.mood.ink) || "#1b1712";
      return `<li class="card" style="--i:${k};--card-bg:${esc(bg)};--card-ink:${esc(ink)}"><div class="card-in">
        <div><h3>${esc(s.title)}</h3><p>${esc(s.deck)}</p>
          <a class="card-go" href="#chapter-${k + 1}" data-chapter="${k}">Read the chapter &rarr;</a></div>
        <div class="card-th">${s.plates.slice(0, 3).map((i) => `<img src="${esc(plates[i].src)}" alt="" loading="lazy" decoding="async">`).join("")}</div>
      </div></li>`;
    }).join("")}</ol>
  </section>`;

  const main = h("main", { class: "sheet", id: "main" }, `
    <div class="sheet-in"><div class="grid" id="grid"></div></div>
    ${hallSec}${paletteSec}${stackSec}`);

  const back = esc(issue.backline || issue.issue);
  const footer = h("footer", { class: "ft", "aria-label": "Footer" }, `
    <div class="mq" aria-hidden="true"><div class="mq-track"><span>${wm} <em>${back}</em></span></div></div>
    <div class="ft-cols">
      <div><h4 class="lbl">This exhibition</h4><ul>
        <li><a href="${esc(root)}book/">The book</a></li>
        <li><a href="${esc(root)}atelier/">The atelier</a></li></ul></div>
      <div><h4 class="lbl">Chapters</h4><ul>${stories.map((s) => `<li><a href="#chapter-${s.i + 1}" data-chapter="${s.i}">${esc(s.title)}</a></li>`).join("")}</ul></div>
      <div><h4 class="lbl">Other exhibitions</h4><ul>${others.map((o) => `<li><a href="${esc(appUrl(o.slug + "/"))}" data-go="${esc(o.hero || "#111")}" data-go-label="${esc(o.mark)}" data-go-font="${esc(o.font || "")}" data-go-weight="${o.weight || 400}" data-go-variation="${esc(o.variation || "normal")}">${esc(o.mark)}</a></li>`).join("")}
        <li><a href="${esc(appUrl(""))}" data-go="#070707">The front door</a></li></ul></div>
      <div><h4 class="lbl">Sessions</h4><ul>
        <li><a href="${esc(ctx.booking(`Booking enquiry: ${issue.mark}`))}">Book a session</a></li>
        <li><button type="button" data-act="ask">Plan a session</button></li>
        <li><button type="button" data-act="play">Skip a stone</button></li>
        <li><button type="button" data-act="menu">Settings</button></li></ul></div>
    </div>
    <div class="ft-base lbl"><span>${esc(issue.footer || "")}</span>${ex.place ? '<span data-live="all"></span>' : ""}<span>The Exhibitions</span></div>`);

  const app = $("#app") || document.body;
  app.append(footer, hero, main, header, hud, zoom);
  Object.assign(ctx.el, { hero, header, hud, zoom, main, footer, grid: $("#grid", main) });
}

/* ─── wiring ───────────────────────────────────────────────────────────── */
function syncView(ctx, v) {
  $$(".vmenu [data-view]", ctx.el.header).forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === v ? "true" : "false"));
}

function wireHeader(ctx) {
  const hd = ctx.el.header;
  const vt = $(".vtoggle", hd), vm = $(".vmenu", hd);
  const setOpen = (o) => { vm.classList.toggle("open", o); vt.setAttribute("aria-expanded", o ? "true" : "false"); };
  vt.addEventListener("click", (e) => { e.stopPropagation(); setOpen(!vm.classList.contains("open")); });
  addEventListener("click", (e) => { if (!e.target.closest(".vmenu")) setOpen(false); });
  vm.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    setOpen(false);
    const v = b.dataset.view;
    if (v === "canvas") ctx.canvas.open();
    else if (v === "slider") {
      // open on the frame nearest the middle of the screen
      let best = 0, bd = 1e9;
      ctx.plates.forEach((p) => {
        const r = ctx.grid.media(p.i).getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
        if (d < bd) { bd = d; best = p.i; }
      });
      ctx.open(best, ctx.grid.media(best));
    } else { if (ctx.canvas.isOpen) ctx.canvas.close(); if (ctx.slider.isOpen) ctx.slider.close(); }
    syncView(ctx, v);
  });
  const snd = $(".snd-btn", hd);
  const syncSnd = () => {
    const on = sound.wanted;
    snd.setAttribute("aria-pressed", on ? "true" : "false");
    $(".snd", snd).classList.toggle("on", on);
    $(".snd-l", snd).textContent = on ? "Sound on" : "Sound";
  };
  snd.addEventListener("click", () => { sound.toggle(); });
  prefs.onChange(({ key }) => key === "sound" && syncSnd());
  syncSnd();
  $(".menu-btn", hd).addEventListener("click", () => ctx.menu.open());

  // the header comes in once the sheet has covered most of the hero
  ScrollTrigger.create({ trigger: ctx.el.main, start: "top 45%", onToggle: (st) => hd.classList.toggle("is-in", st.isActive) });
  // the finder button comes in with it, and steps aside as the footer rises: it
  // sat on the footer's last line, and the footer has its own "Plan a session"
  ScrollTrigger.create({
    trigger: ctx.el.main, start: "top 45%", end: "bottom bottom",
    onToggle: (st) => ctx.finder.fab.classList.toggle("is-in", st.isActive),
  });
}

/** Any full-screen overlay hides the page, so effects behind it should rest. */
const overlayOpen = () => /\b(sl|cv|mn|gm)-open\b/.test(document.documentElement.className);

/** Size the wordmark to the viewport by measuring it, whatever the font. */
function fitWordmark(el) {
  el.style.fontSize = "";
  const base = parseFloat(getComputedStyle(el).fontSize) || 100;
  const w = el.scrollWidth || 1, hgt = el.scrollHeight || 1;
  const narrow = innerWidth < 760;
  const k = Math.min((innerWidth * (narrow ? 0.9 : 0.8)) / w, (innerHeight * (narrow ? 0.3 : 0.44)) / hgt);
  el.style.fontSize = (base * k).toFixed(1) + "px";
}

function wireHero(ctx) {
  const hero = ctx.el.hero, wmEl = $(".hero-wm", hero), main = ctx.el.main;
  const calm = () => prefs.get().motion === "calm";
  fitWordmark(wmEl);
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => fitWordmark(wmEl), 120); });
  // hero recedes as the sheet slides over it; the sheet's top edge is cached
  // (it only moves when layout does) so scrolling reads no layout
  let mainTop = 0;
  const measure = () => { mainTop = main.getBoundingClientRect().top + scrollY; };
  measure();
  ScrollTrigger.addEventListener("refresh", measure);
  ctx.sheetTop = () => mainTop - scroll.y;
  let lastP = -1;
  scroll.on(() => {
    const top = mainTop - scroll.y;
    // decided every frame: behind the dedupe below, a frame that stopped a
    // fraction of a pixel short could leave the hero covering the footer
    hero.classList.toggle("is-past", top <= 0);
    const p = clamp(1 - top / innerHeight);
    if (Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    if (calm()) { wmEl.style.transform = ""; wmEl.style.opacity = ""; return; }
    wmEl.style.transform = `translate3d(0,${(-p * 12).toFixed(2)}vh,0) scale(${(1 - p * 0.06).toFixed(4)})`;
    wmEl.style.opacity = (1 - p * 0.55).toFixed(3);
  });
  // pool light on the hero, only where the sheet has not covered it yet: a
  // faint play of light under the wordmark, never a net over the photograph
  if (ctx.ex.hero) {
    caustics(() => ({ left: 0, top: 0, width: innerWidth, height: Math.max(0, Math.min(innerHeight, ctx.sheetTop())) }),
      () => !calm() && !overlayOpen() && ctx.sheetTop() > 2 && !document.hidden,
    { tint: ctx.ex.sound === "river" ? "#d8efe9" : "#ffe7b3", amount: luma(ctx.ex.hero) > 0.5 ? 0.045 : 0.08 });
  }
  // variable-font breathing on the issue line, driven by scroll speed
  axis($(".hero-sub", hero), () => Math.abs(scroll.v) / 30, { wght: 300, opsz: 24 }, { wght: 700, opsz: 72 });
}

/* The rooms after the grid carry their own mood, like the chapters do. The
 * hall is a bright gallery in the issue's own warm white; the palette takes
 * the lightest chapter's mood (the hall hands over to it when its end wall
 * gives); the contents go back to the first chapter's. */
function roomMoods(ctx) {
  const moods = ctx.stories.map((s) => s.mood).filter(Boolean);
  const lightest = moods.slice().sort((a, b) => luma(b.bg) - luma(a.bg))[0] || { bg: "#f7f3ec", ink: "#1c1812" };
  return {
    hall: { bg: mixHex("#f4efe7", ctx.ex.hero || "#e5dfd5", 0.3), ink: "#1d1914" },
    palette: lightest, contents: ctx.stories[0].mood || lightest,
  };
}

function sectionMoods(ctx) {
  const d = document.documentElement;
  ctx.setMood = (m) => {
    d.style.setProperty("--bg", m.bg);
    d.style.setProperty("--ink", m.ink);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = prefs.get().theme === "dark" ? "#0d0c0b" : m.bg;
    sound.mood(1 - luma(m.bg));
  };
  // the palette slides a screen up under the hall (x.css): with the hall on,
  // its mood starts where the hall's ends, not where its own box starts
  const hall = $("#hall"), under = hall && !hall.classList.contains("is-off");
  [["#hall", () => (ctx.hallMood ? ctx.hallMood() : ctx.moods.hall)], ["#palette", () => ctx.moods.palette], ["#contents", () => ctx.moods.contents]]
    .forEach(([sel, m]) => {
      const el = $(sel);
      if (!el || el.classList.contains("is-off")) return;
      const from = sel === "#palette" && under ? { trigger: hall, start: "bottom 50%", endTrigger: el } : { trigger: el, start: "top 50%" };
      ScrollTrigger.create({ ...from, end: "bottom 50%", onToggle: (st) => { if (st.isActive) ctx.setMood(m()); } });
    });
}

/** The wordmark rises out of its masks, then the issue line and the intro.
 *  fromTo renders the start state at once; the rise waits until the sheet
 *  has uncovered the middle of the screen, so it is seen, and seen once. */
function heroIntro(ctx) {
  if (prefs.get().motion === "calm") return;
  const hero = ctx.el.hero, wm = $(".hero-wm", hero), s = split(wm, "chars");
  gsap.timeline({ delay: 0.5 })
    .fromTo(s ? s.chars : wm, { yPercent: 150, rotate: 6, autoAlpha: 0 },
      { yPercent: 0, rotate: 0, autoAlpha: 1, duration: 1.4, ease: "expo.out", stagger: { each: 0.045, from: "center" } })
    .fromTo([$(".hero-sub", hero), $(".hero-bot", hero)], { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1, ease: "expo.out" }, 0.45);
}

function wireFooter(ctx) {
  const ft = ctx.el.footer;
  marquee($(".mq", ft), { speed: 0.9, active: () => ft.style.visibility !== "hidden" });
  ft.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) {
      const act = a.dataset.act;
      if (act === "play") ctx.game.open(); else if (act === "ask") ctx.finder.open(); else ctx.menu.open();
      return;
    }
    const c = e.target.closest("[data-chapter]");
    if (c) { e.preventDefault(); ctx.grid.goChapter(+c.dataset.chapter); }
  });
  // footer is only visible once the page has scrolled past everything
  const upd = () => { const v = scroll.max - scroll.y < innerHeight * 1.05 ? "visible" : "hidden"; if (ft.style.visibility !== v) ft.style.visibility = v; };
  scroll.on(upd); upd();
  // typing "hop" or "skip" anywhere is the secret way in
  let buf = "";
  addEventListener("keydown", (e) => {
    if (/input|textarea/i.test((document.activeElement || {}).tagName || "")) return;
    buf = (buf + e.key.toLowerCase()).slice(-4);
    if (buf.endsWith(ctx.ex.game === "skip" ? "skip" : "hop")) ctx.game.open();
  });
}

function deepLink(ctx) {
  const q = new URLSearchParams(location.search);
  const v = q.get("view");
  if (v === "slider") {
    const n = clamp(parseInt(q.get("id"), 10) || 1, 1, ctx.plates.length);
    history.replaceState({ v: "slider", id: n }, "", location.href);
    ctx.slider.open(n - 1, null, { push: false });
  } else if (v === "canvas") {
    // the link is already the canvas entry, as with the slider: pushing a second
    // one left ?view=canvas in the address after Close, so a reload reopened it
    history.replaceState({ v: "canvas" }, "", location.href);
    ctx.canvas.open({ push: false });
  } else if (/^#chapter-\d+$/.test(location.hash)) {
    ctx.grid.goChapter(parseInt(location.hash.slice(9), 10) - 1);
  }
}
