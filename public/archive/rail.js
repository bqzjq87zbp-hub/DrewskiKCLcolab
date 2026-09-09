/**
 * The collections index: a scroll-pinned horizontal rail.
 *
 * Fine pointer  -> the section pins and vertical scroll drives lateral travel.
 * Coarse pointer -> a native scroll-snap carousel you swipe (its own model, not
 *                   a disabled desktop one).
 * Reduced motion -> a plain vertical stack, no pin, no parallax.
 *
 * Reads the shared frame loop; adds no scroll listener of its own.
 */
import { onFrame, clamp, damp, reduced, coarse, reveal, el, splitWords } from "./motion.js";
import { magnetic } from "./cursor.js";

export function buildRail({ collections, onOpen }) {
  const list = [...collections.values()];
  const stack = reduced() || coarse();

  const section = el("section", {
    class: "rail", id: "collections",
    "aria-label": "Photograph collections",
    dataset: { mode: reduced() ? "stack" : coarse() ? "swipe" : "pin" },
  });

  // --- heading ------------------------------------------------------------
  const head = el("header", { class: "rail-head" },
    el("p", { class: "rail-eyebrow", text: "The archive" }),
    el("h2", { class: "rail-title" }, splitWords("Four ways in.")),
    el("p", { class: "rail-lede", text: "Every photograph on the easels above, sorted. Open a collection to browse it full-bleed." }),
  );
  // --- viewport + track ---------------------------------------------------
  const track = el("div", { class: "rail-track" });
  const viewport = el("div", { class: "rail-viewport" }, head, track);
  section.append(viewport);

  const panels = list.map((c, i) => {
    const cover = c.items[0];
    const art = el("img", {
      class: "panel-art", src: cover.src, alt: "", loading: i > 1 ? "lazy" : "eager",
      decoding: "async", width: cover.width, height: cover.height, "aria-hidden": "true",
    });
    const open = el("button", {
      class: "panel-open", type: "button",
      dataset: { cursor: "open", cursorLabel: "Open" },
      "aria-label": `Open ${c.title}, ${c.items.length} photographs`,
    }, el("span", { text: "Open collection" }), el("span", { class: "panel-open-arrow", text: "→", "aria-hidden": "true" }));
    open.addEventListener("click", () => onOpen(c.id, open));

    const panel = el("article", {
      class: "panel", dataset: { id: c.id, cursor: stack ? "" : "drag", cursorLabel: stack ? "" : "Scroll" },
    },
      el("div", { class: "panel-frame" }, art, el("span", { class: "panel-scrim", "aria-hidden": "true" })),
      el("div", { class: "panel-body" },
        el("p", { class: "panel-index", text: String(i + 1).padStart(2, "0"), "aria-hidden": "true" }),
        el("h3", { class: "panel-title", text: c.title }),
        el("p", { class: "panel-count", text: `${c.items.length} photographs` }),
        open,
      ),
    );
    magnetic(open);
    track.append(panel);
    return { panel, art, data: c };
  });

  // --- chapter HUD --------------------------------------------------------
  const hudName = el("span", { class: "hud-name", text: list[0].title });
  const hudNum = el("span", { class: "hud-num", text: `01 / ${String(list.length).padStart(2, "0")}` });
  const hudFill = el("i", { class: "hud-fill" });
  const hud = el("div", { class: "rail-hud", "aria-hidden": "true" },
    hudNum, el("span", { class: "hud-track" }, hudFill), hudName);
  if (!reduced()) (stack ? section : viewport).append(hud);

  // --- behavior -----------------------------------------------------------
  let stop = null;
  let travel = 0, target = 0, active = -1;

  function paint() {
    track.style.transform = `translate3d(${-travel.toFixed(2)}px,0,0)`;
    const vw = viewport.clientWidth;
    for (const { panel, art } of panels) {
      // Counter-drift the photograph against its panel for depth.
      const left = panel.offsetLeft - travel;
      const t = clamp((left + panel.offsetWidth / 2) / vw, 0, 1) - 0.5;
      art.style.transform = `translate3d(${(-t * 46).toFixed(2)}px,0,0) scale(1.16)`;
    }
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    hudName.textContent = list[i].title;
    hudNum.textContent = `${String(i + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    panels.forEach((p, n) => p.panel.classList.toggle("is-active", n === i));
  }

  if (!stack) {
    // Pin distance: one viewport per panel beyond the first.
    const sizePin = () => {
      const span = Math.max(0, track.scrollWidth - viewport.clientWidth);
      section.style.setProperty("--pin-h", `${innerHeight + span}px`);
      return span;
    };
    let span = sizePin();
    new ResizeObserver(() => { span = sizePin(); paint(); }).observe(viewport);

    stop = onFrame((y, dt, vh) => {
      const top = section.offsetTop;
      const p = clamp((y - top) / Math.max(1, span));
      target = p * span;
      const before = travel;
      travel = damp(travel, target, 12, dt);
      if (Math.abs(travel - target) < 0.25) travel = target;
      paint();
      setActive(Math.round(p * (list.length - 1)));
      hudFill.style.transform = `scaleX(${p.toFixed(4)})`;
      const onScreen = y + vh > top && y < top + span + vh;
      return onScreen && Math.abs(travel - before) > 0.05;
    });
  } else if (coarse() && !reduced()) {
    // Swipe model: native snap scrolling, HUD follows the scroll position.
    viewport.addEventListener("scroll", () => {
      const p = viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth);
      setActive(Math.round(p * (list.length - 1)));
    }, { passive: true });
    setActive(0);
  }

  reveal([head.querySelector(".rail-eyebrow"), head.querySelector(".rail-title"), head.querySelector(".rail-lede")]);
  if (stack) reveal(panels.map((p) => p.panel), { stagger: 90 });

  return { section, destroy() { stop?.(); section.remove(); } };
}
