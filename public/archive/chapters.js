/**
 * Chapter flow: the orientation layer for the single page.
 *
 * Chapters are data. A fixed rail marks where you are, a hairline reads total
 * progress, the accent colour swaps per section, and the URL hash follows the
 * scroll so any section is deep-linkable without a route.
 */
import { onFrame, clamp, reduced, el } from "./motion.js";

const TINTS = {
  branding: "#e2604a", families: "#7fb069",
  headshots: "#d9534f", coastal: "#4aa3d9", walk: "#8fc6e2",
};

export function buildChapters({ chapters, onJump }) {
  const items = chapters.map((c, i) => {
    const dot = el("span", { class: "ch-dot", "aria-hidden": "true" });
    const name = el("span", { class: "ch-name", text: c.title });
    const b = el("button", {
      class: "ch-item", type: "button",
      "aria-label": `Jump to ${c.title}`, dataset: { id: c.id },
    }, dot, name);
    b.addEventListener("click", () => onJump(c.id, b));
    return b;
  });

  const fill = el("i", { class: "ch-fill" });
  const nav = el("nav", { class: "chapters", "aria-label": "Sections" },
    el("span", { class: "ch-rail", "aria-hidden": "true" }, fill),
    el("div", { class: "ch-list" }, items));

  const bar = el("div", { class: "progress-bar", "aria-hidden": "true" },
    el("i", { class: "progress-fill" }));
  const barFill = bar.firstChild;

  document.body.append(nav, bar);

  let current = null;
  function setCurrent(id) {
    if (id === current) return;
    current = id;
    for (const b of items) b.setAttribute("aria-current", String(b.dataset.id === id));
    document.body.dataset.chapter = id || "walk";
    document.documentElement.style.setProperty("--accent", TINTS[id] || TINTS.walk);
    // Deep-linkable without a route; replaceState keeps the back button clean.
    const hash = id ? "#" + id : "";
    if (location.hash !== hash) history.replaceState(history.state, "", hash || location.pathname + location.search);
  }

  onFrame((y, dt, vh) => {
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight - vh);
    barFill.style.transform = `scaleX(${clamp(y / total).toFixed(4)})`;

    let found = null, best = Infinity;
    for (const c of chapters) {
      const node = document.getElementById(c.id);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (r.top <= vh * 0.4 && r.bottom > vh * 0.35) {
        const d = Math.abs(r.top - vh * 0.3);
        if (d < best) { best = d; found = c.id; }
      }
    }
    setCurrent(found);
    nav.dataset.visible = String(y > vh * 0.6);
    return false;   // purely reactive; no animation of its own to settle
  });

  return { nav, setCurrent };
}
