/* /iw-agentic-interface: the exhibition talks back.
 *
 * A conversation as a second way through the site, never the only one: every
 * answer is also an action (scroll to a chapter, open a frame, pick out every
 * photograph that carries red, change a setting, walk the pier, start the
 * booking email) and the ordinary navigation stays exactly where it was. Replies stream in; the send button runs through
 * idle, thinking and answered (/iw-live-data-forms three-state submit).
 */
import { $, h, esc, pad, appUrl, sleep } from "../util.js";
import { makeBrain } from "./finder-brain.js";
import * as prefs from "../core/prefs.js";
import { sound } from "../core/sound.js";
import { go } from "../core/transition.js";
import { scroll } from "../core/scroll.js";

const gsap = window.gsap;

export function initFinder(ctx) {
  const brain = makeBrain({
    plates: ctx.plates, stories: ctx.stories, palette: ctx.palette, mark: ctx.issue.mark, slug: ctx.slug,
    other: ctx.other.map((o) => ({ mark: o.mark, slug: o.slug })),
  });
  const fab = h("button", { class: "fd-fab", type: "button", "aria-haspopup": "dialog", "aria-controls": "finder", "data-magnetic": "0.25" }, `<i aria-hidden="true"></i>Ask the exhibition`);
  const root = h("section", { class: "fd", id: "finder", role: "dialog", "aria-label": "Ask the exhibition" }, `
    <div class="fd-h"><b>${esc(ctx.issue.mark)}, answering</b><button type="button" class="lbl fd-x" aria-label="Close">Close</button></div>
    <div class="fd-log" aria-live="polite"></div>
    <form class="fd-f" autocomplete="off">
      <div class="fld"><input id="fd-q" type="text" placeholder=" " maxlength="200"><label for="fd-q">Ask for a place, a colour, a session&hellip;</label></div>
      <button class="send lbl" type="submit" data-state="idle">Ask</button>
    </form>
    <div class="fd-note">Answers come from this exhibition's own pages, worked out on your device. No AI service is called.</div>`);
  document.body.append(fab, root);
  const log = $(".fd-log", root), form = $("form", root), input = $("#fd-q", root), send = $(".send", root);
  let open = false, greeted = false, busy = false;

  function cardHTML(c) {
    const p = ctx.plates[c.plate];
    return `<button type="button" data-plate="${p.i}"><img src="${esc(p.src)}" alt="">[${pad(p.n)}] ${esc(p.kicker)}</button>`;
  }

  async function say(r) {
    const m = h("div", { class: "msg it" });
    log.appendChild(m);
    const calm = prefs.get().motion === "calm";
    const text = r.text || "";
    if (calm) m.textContent = text;
    else {
      for (let i = 0; i <= text.length; i += 2) { m.textContent = text.slice(0, i); log.scrollTop = log.scrollHeight; await sleep(9); }
      m.textContent = text;
    }
    if (r.cards && r.cards.length) m.insertAdjacentHTML("beforeend", `<div class="cards">${r.cards.map(cardHTML).join("")}</div>`);
    if (r.chips && r.chips.length) m.insertAdjacentHTML("beforeend", `<div class="chips">${r.chips.map((c) => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join("")}</div>`);
    log.scrollTop = log.scrollHeight;
  }

  function act(a) {
    if (!a) return;
    switch (a.type) {
      case "chapter": close(); ctx.grid.goChapter(a.si); break;
      case "highlight": ctx.grid.highlight(a.plates); break;
      case "canvas": close(); ctx.canvas.open(); break;
      case "section": { close(); const el = document.getElementById(a.id); if (el) scroll.to(el); break; }
      case "play": close(); ctx.game.open(); break;
      case "pref":
        if (a.key === "sound") { if ((a.value === "on") !== sound.wanted) sound.toggle(); }
        else prefs.set(a.key, a.value);
        break;
      case "book": setTimeout(() => { location.href = ctx.booking(a.subject); }, 400); break;
      case "go": {
        const to = a.to === "book" ? `${ctx.root}book/` : a.to === "atelier" ? `${ctx.root}atelier/` : a.to === "walk" ? ctx.walk
          : a.to === "issue" ? appUrl(a.slug + "/") : appUrl("");
        const other = a.to === "issue" && ctx.other.find((o) => o.slug === a.slug);
        const color = a.to === "walk" ? ctx.roomColor : other ? other.hero : a.to === "home" ? "#070707" : ctx.ex.hero;
        setTimeout(() => go(to, { color, label: a.to === "walk" ? "The Walk" : other ? other.mark : null }), 500);
        break;
      }
    }
  }

  async function ask(q) {
    if (busy) return;
    busy = true;
    const me = h("div", { class: "msg me" });
    me.textContent = q;
    log.appendChild(me);
    send.dataset.state = "busy"; send.innerHTML = `<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>`;
    sound.play("tick", { i: 3 });
    await sleep(prefs.get().motion === "calm" ? 0 : 380 + Math.random() * 280);
    let r;
    try { r = brain.reply(q); } catch (e) { r = { text: "That one tripped me up. Try asking another way." }; }
    send.dataset.state = "done"; send.textContent = "Answered";
    await say(r);
    act(r.action);
    setTimeout(() => { send.dataset.state = "idle"; send.textContent = "Ask"; }, 1400);
    busy = false;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    ask(q);
  });
  log.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      return ask(chip.dataset.chip);
    }
    const p = e.target.closest("[data-plate]");
    if (p) { close(); ctx.open(+p.dataset.plate, ctx.grid.media(+p.dataset.plate)); }
  });

  function show() {
    if (open) return;
    open = true;
    root.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    if (!greeted) { greeted = true; say(brain.intro()); }
    setTimeout(() => input.focus({ preventScroll: true }), 120);
  }
  function close() {
    if (!open) return;
    open = false;
    root.classList.remove("open");
    fab.setAttribute("aria-expanded", "false");
  }
  fab.addEventListener("click", () => (open ? close() : show()));
  $(".fd-x", root).addEventListener("click", close);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) close();
    const typing = /input|textarea|select/i.test((document.activeElement || {}).tagName || "");
    if (e.key === "/" && !typing && !open) { e.preventDefault(); show(); }
  });
  return { open: show, close, fab, ask };
}
