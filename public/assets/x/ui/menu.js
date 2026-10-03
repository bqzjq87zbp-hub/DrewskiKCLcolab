/* The menu: navigation, search, and the visitor's own settings.
 *
 *   exhibits   every exhibition and its three ways in
 *   chapters   scrollspy: the chapter you are in is marked
 *   search     floating label, live results with matches highlighted, and a
 *              word when nothing matches (/iw-live-data-forms); Enter opens
 *              the first
 *   settings   theme, motion, effects, sound (/iw-viewer-controls)
 *   live       the issue's clock and light, ticking
 */
import { $, $$, h, esc, listen, appUrl } from "../util.js";
import * as prefs from "../core/prefs.js";
import { scroll } from "../core/scroll.js";
import { startLive } from "../core/live.js";
import { bindAll } from "../core/cursor.js";
import { sound } from "../core/sound.js";
import { searchPlates } from "./search.js";

const gsap = window.gsap;

function mark(text, q) {
  let s = esc(text);
  const terms = q.toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length > 1);
  for (const t of terms) s = s.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>");
  return s;
}

export function initMenu(ctx) {
  const issues = (ctx.catalog && ctx.catalog.issues) || [];
  const segs = Object.keys(prefs.OPTIONS).map((k) => `
    <div class="seg"><span class="lbl">${k}</span><div role="group" aria-label="${k}">
      ${prefs.OPTIONS[k].map(([v, l]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="false">${l}</button>`).join("")}
    </div></div>`).join("");

  const issueHTML = issues.map((i) => {
    const base = appUrl(i.slug + "/");
    const cur = i.slug === ctx.slug;
    return `<div class="mn-iss" ${cur ? 'aria-current="true"' : ""}>
      <img src="${esc(appUrl(i.cover))}" alt="" loading="lazy">
      <div>
        <a class="wm" href="${esc(base)}" data-go="${esc(i.hero)}" data-go-label="${esc(i.mark)}" data-go-font="${esc(i.font)}" data-go-weight="${i.weight || 400}" data-go-variation="${esc(i.variation || "normal")}"
          style="--f:${esc(i.font)};--w:${i.weight || 400};--v:${esc(i.variation || "normal")}">${esc(i.mark)}</a>
        <div class="lbl" style="margin-top:6px;color:var(--mut)">${esc(i.issue)}</div>
        <ul>
          <li><a href="${esc(base)}" data-go="${esc(i.hero)}">The exhibition</a></li>
          <li><a href="${esc(base)}book/">The book</a></li>
          <li><a href="${esc(base)}atelier/">The atelier</a></li>
        </ul>
      </div>
    </div>`;
  }).join("");

  const chaptersHTML = ctx.stories ? `<div class="mn-col mn-ch"><h3 class="lbl">Chapters</h3><ol>${ctx.stories.map((s) =>
    `<li><a href="#chapter-${s.i + 1}" data-chapter="${s.i}"><b>${esc(s.title)}</b></a></li>`).join("")}</ol></div>` : "";
  const searchHTML = ctx.plates ? `<div class="mn-col mn-search"><h3 class="lbl">Search the exhibition</h3>
      <div class="fld"><input id="mn-q" type="search" placeholder=" " autocomplete="off" spellcheck="false" aria-describedby="mn-cnt"><label for="mn-q">A place, a colour, a time&hellip;</label><span class="cnt lbl" id="mn-cnt" aria-live="polite"></span></div>
      <ul class="res" id="mn-res"></ul></div>` : "";

  const root = h("div", { class: "mn", id: "menu", role: "dialog", "aria-modal": "true", "aria-label": "Menu" }, `
    <div class="mn-top"><span class="lbl">${esc(ctx.menuTitle || "The Exhibitions")}</span>
      <button type="button" class="hd-btn mn-close" data-magnetic="0.3">Close</button></div>
    <div class="mn-in">
      <div class="mn-col mn-issues"><h3 class="lbl">The exhibitions</h3>${issueHTML}
        <div class="chips" style="margin-top:4px">
          ${ctx.plates ? '<button type="button" data-act="ask">Plan a session</button><button type="button" data-act="play">Play</button>' : ""}
          <a class="chipa" href="${esc(appUrl(""))}" data-go="#070707">The front door</a>
        </div>
      </div>
      ${chaptersHTML}
      ${searchHTML}
      <div class="mn-col mn-set"><h3 class="lbl">Viewing</h3>${segs}</div>
      <div class="mn-live lbl">${ctx.ex && ctx.ex.place ? '<span data-live="all"></span>' : "<span></span>"}<span>Kiyono Creative Lab &middot; The Exhibitions</span></div>
    </div>`);
  document.body.appendChild(root);
  bindAll(root);

  const syncSegs = () => {
    const raw = prefs.raw();
    $$(".seg button", root).forEach((b) => b.setAttribute("aria-pressed", raw[b.dataset.k] === b.dataset.v ? "true" : "false"));
  };
  syncSegs();
  prefs.onChange(syncSegs);
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".seg button");
    if (b) {
      // sound needs this click to unlock audio, so it goes through the gesture
      if (b.dataset.k === "sound") { if ((b.dataset.v === "on") !== sound.wanted) sound.toggle(); }
      else prefs.set(b.dataset.k, b.dataset.v);
      return;
    }
    const ch = e.target.closest("[data-chapter]");
    if (ch) { e.preventDefault(); close().then(() => ctx.grid.goChapter(+ch.dataset.chapter)); return; }
    const act = e.target.closest("[data-act]");
    if (act) { close().then(() => (act.dataset.act === "ask" ? ctx.finder.open() : ctx.game.open())); return; }
    const r = e.target.closest("[data-plate]");
    if (r) { close().then(() => ctx.open(+r.dataset.plate, null)); }
  });
  $(".mn-close", root).addEventListener("click", () => close());

  if (ctx.stories) listen("chapter", (si) => $$(".mn-ch a", root).forEach((a) => a.setAttribute("aria-current", +a.dataset.chapter === si ? "true" : "false")));

  if (ctx.plates) {
    const q = $("#mn-q", root), res = $("#mn-res", root), cnt = $("#mn-cnt", root);
    const run = () => {
      const v = q.value.trim();
      const hits = v ? searchPlates(ctx.plates, v) : [];
      cnt.textContent = v && !hits.length ? "No match" : "";
      res.innerHTML = hits.slice(0, 8).map((p) => `<li><button type="button" data-plate="${p.i}">
        <img src="${esc(p.src)}" alt=""><span><b>${mark(p.kicker, v)}</b><br><small>${mark(p.caption, v)}</small></span></button></li>`).join("");
    };
    q.addEventListener("input", run);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { const b = $("button", res); if (b) b.click(); } });
  }

  if (ctx.ex && (ctx.ex.place || ctx.ex.almanac)) startLive(root, ctx.ex);

  let open = false, busy = false, opener = null, pendingClose = false;
  async function show() {
    if (open || busy) return;
    open = true; busy = true; opener = document.activeElement;
    scroll.lock();
    root.classList.add("open");
    document.documentElement.classList.add("mn-open");
    const calm = prefs.get().motion === "calm";
    // the columns rise while the panel wipes in. Started after the wipe, they
    // showed through it, vanished and came back.
    if (!calm) gsap.fromTo($$(".mn-col, .mn-live", root), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, delay: 0.1, ease: "power4.out", overwrite: true });
    await new Promise((res) => gsap.fromTo(root, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: calm ? 0.01 : 0.5, ease: "power4.out", onComplete: res }));
    $(".mn-close", root).focus({ preventScroll: true });
    sound.play("paper", { dur: 0.4, gain: 0.07 });
    busy = false;
    if (pendingClose) { pendingClose = false; close(); }
  }
  async function close() {
    if (!open) return;
    if (busy) { pendingClose = true; return; }
    busy = true; open = false;
    const calm = prefs.get().motion === "calm";
    await new Promise((res) => gsap.to(root, { clipPath: "inset(100% 0 0% 0)", duration: calm ? 0.01 : 0.4, ease: "power4.out", onComplete: res }));
    root.classList.remove("open");
    document.documentElement.classList.remove("mn-open");
    gsap.set(root, { clipPath: "inset(0 0 100% 0)" });
    scroll.unlock();
    busy = false;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) { e.preventDefault(); close(); }
    // keep Tab inside the open menu
    if (e.key === "Tab" && open) {
      const f = $$("a[href],button:not([disabled]),input", root).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  return { open: show, close, get isOpen() { return open; } };
}
