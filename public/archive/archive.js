/**
 * The archive: everything after the pier walk.
 *
 * Owns the collections index, the collection views, the viewer, and the footer,
 * and exposes the small surface the opener needs ({data, open, close, active,
 * section}) so the aisle keeps working untouched. Route changes run through the
 * View Transitions API where the browser has it, and fall back to a plain swap
 * where it does not.
 */
import { reveal, reduced, el, splitWords, onFrame, clamp } from "./motion.js";
import { initCursor, magnetic } from "./cursor.js";
import { buildRail } from "./rail.js";
import { buildStream } from "./stream.js";
import { createLightbox } from "./lightbox.js";

const HASH = /^#collection\//;
const idFromHash = () => decodeURIComponent(location.hash.replace(HASH, ""));

export async function createArchive() {
  const payload = await (await fetch("/categories.json")).json();
  const data = new Map(payload.categories.map((c) => [c.id, c]));
  const main = document.querySelector("main");

  const lightbox = createLightbox();
  initCursor();

  // ---- the collection view (one node, re-rendered per collection) ---------
  const section = el("section", {
    class: "collection", id: "collection", tabIndex: "-1",
    "aria-label": "Collection", hidden: true,
  });

  let active = null, returnY = 0, returnFocus = null, stream = null;

  function renderCollection(id) {
    const c = data.get(id);
    if (!c) return false;
    stream?.destroy();

    const back = el("button", { class: "col-back", type: "button", dataset: { cursor: "back", cursorLabel: "Back" } },
      el("span", { class: "col-back-arrow", text: "←", "aria-hidden": "true" }), "Back to the walk");
    back.addEventListener("click", () => close());
    magnetic(back);

    const switcher = el("nav", { class: "col-switch", "aria-label": "Collections" },
      [...data.values()].map((o) => {
        const a = el("a", { href: "#collection/" + o.id, text: o.title });
        if (o.id === id) a.setAttribute("aria-current", "page");
        a.addEventListener("click", (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); open(o.id, a);
        });
        return a;
      }));

    const heading = el("h1", { class: "col-title" }, splitWords(c.title));
    const meta = el("p", { class: "col-meta" },
      el("span", { text: `${c.items.length} photographs` }),
      el("span", { class: "col-hint", text: reduced() ? "Select a photograph to enlarge it" : "Drag, scroll or use arrow keys" }));

    stream = buildStream({
      collection: c,
      onEnlarge: (i, trigger) => lightbox.open(c, i, trigger),
    });

    section.replaceChildren(
      el("header", { class: "col-head" }, back, switcher),
      el("div", { class: "col-intro" }, heading, meta),
      stream.root,
    );
    reveal([heading, meta], { stagger: 90 });
    active = id;
    return true;
  }

  function swap(fn) {
    if (reduced() || !document.startViewTransition) { fn(); return; }
    document.startViewTransition(fn);
  }

  function show(id, { focus = true } = {}) {
    swap(() => {
      if (!renderCollection(id)) return;
      for (const node of main.children) if (node !== section) node.hidden = true;
      section.hidden = false;
      document.body.dataset.view = "collection";
      scrollTo({ top: 0, behavior: "instant" });
      if (focus) section.focus({ preventScroll: true });
    });
  }

  function open(id, trigger) {
    if (!data.has(id)) return;
    if (!active) {
      returnY = scrollY;
      returnFocus = trigger || document.activeElement;
      history.replaceState({ ...history.state, aisleY: returnY }, "", location.href);
    }
    const method = active ? "replaceState" : "pushState";
    history[method]({ localCollection: true, aisleY: returnY }, "", "#collection/" + id);
    show(id);
  }

  function restore() {
    swap(() => {
      active = null;
      stream?.destroy(); stream = null;
      section.hidden = true;
      for (const node of main.children) {
        if (node !== section && node.dataset.keepHidden !== "true") node.hidden = false;
      }
      document.body.dataset.view = "aisle";
      scrollTo({ top: returnY, behavior: "instant" });
    });
    // The aisle remeasures after its hidden parent reopens; give focus back
    // only once the target is really on screen and the visitor has not moved on.
    const target = returnFocus;
    let attempts = 0, stable = 0;
    (function settle() {
      if (active || !target?.isConnected || document.querySelector("dialog[open]") || attempts++ > 16) return;
      const focused = document.activeElement;
      if (focused !== document.body && focused !== section && focused !== target) return;
      const visible = target.getClientRects().length > 0 && !target.closest("[hidden]");
      stable = visible ? stable + 1 : 0;
      if (stable >= 3) { target.focus({ preventScroll: true }); return; }
      requestAnimationFrame(settle);
    })();
  }

  function close() {
    if (history.state?.localCollection) { history.back(); return; }
    history.replaceState(null, "", location.pathname + location.search);
    restore();
  }

  addEventListener("popstate", () => {
    const id = idFromHash();
    if (data.has(id)) show(id);
    else if (active) {
      if (Number.isFinite(history.state?.aisleY)) returnY = history.state.aisleY;
      restore();
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active && !document.querySelector("dialog[open]")) {
      e.preventDefault(); close();
    }
  });

  // ---- the below-the-walk layer ------------------------------------------
  const rail = buildRail({ collections: data, onOpen: open });
  const footer = buildFooter({ collections: data, onOpen: open });

  main.append(rail.section, section, footer);

  const initial = idFromHash();
  if (data.has(initial)) show(initial, { focus: false });

  return { data, open, close, section, get active() { return active; } };
}

// ---- footer ---------------------------------------------------------------
function buildFooter({ collections, onOpen }) {
  const list = [...collections.values()];
  const total = list.reduce((n, c) => n + c.items.length, 0);

  const top = el("button", { class: "foot-top", type: "button", dataset: { cursor: "up", cursorLabel: "Top" } },
    el("span", { class: "foot-top-arrow", text: "↑", "aria-hidden": "true" }), "Walk the pier again");
  top.addEventListener("click", () => scrollTo({ top: 0, behavior: reduced() ? "instant" : "smooth" }));
  magnetic(top);

  const nav = el("nav", { class: "foot-nav", "aria-label": "Collections" },
    list.map((c) => {
      const a = el("a", { href: "#collection/" + c.id },
        el("span", { text: c.title }),
        el("span", { class: "foot-count", text: String(c.items.length).padStart(2, "0") }));
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); onOpen(c.id, a);
      });
      return a;
    }));

  const counter = el("strong", { class: "foot-total", text: "0" });
  const footer = el("footer", { class: "foot" },
    el("div", { class: "foot-inner" },
      el("p", { class: "foot-eyebrow", text: "Newport Beach, California" }),
      el("h2", { class: "foot-title" }, splitWords("Shot on the sand.")),
      nav,
      el("p", { class: "foot-stat" }, counter, el("span", { text: " photographs in the archive" })),
      top,
      el("p", { class: "foot-meta", text: "Photography by Kyle. Development preview." })));

  // Count up once, when the number is actually on screen.
  if (reduced()) counter.textContent = String(total);
  else {
    let started = false;
    new IntersectionObserver((entries, obs) => {
      if (!entries.some((e) => e.isIntersecting) || started) return;
      started = true; obs.disconnect();
      const t0 = performance.now();
      onFrame(() => {
        const p = clamp((performance.now() - t0) / 1100);
        const eased = 1 - Math.pow(1 - p, 3);
        counter.textContent = String(Math.round(total * eased));
        return p < 1;
      });
    }, { threshold: 0.6 }).observe(counter);
  }

  reveal([footer.querySelector(".foot-eyebrow"), footer.querySelector(".foot-title"), nav,
    footer.querySelector(".foot-stat"), top, footer.querySelector(".foot-meta")], { stagger: 70 });
  return footer;
}
