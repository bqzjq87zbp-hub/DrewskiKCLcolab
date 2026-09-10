/**
 * Entry point.
 *
 * Two halves: the opener (the photographic pier walk, unchanged in behavior)
 * and the archive (everything after it). The archive owns collections, the
 * viewer and the footer, and hands the opener the small data surface it needs.
 */
import { createWrappedCanvas } from "./canvas-wrap.js";
import { attachAisle } from "./aisle-integration.js";
import { createArchive } from "./archive/archive.js";

const $ = (s) => document.querySelector(s);
const slots = await (await fetch("/slots.json")).json();
const archive = await createArchive();

// The static composition is the no-JavaScript proof and the aisle's fallback.
// The aisle hides it once the walk is live; it is never a second index.
const layers = $("#layers"), composition = $("#composition");
const categoryMap = ["families", "families", "families", "headshots", "branding", "branding", "coastal", "branding", "branding", "coastal"];
const enriched = slots.map((s, i) => ({ ...s, category: categoryMap[i] }));

// This easel introduces the professional-client collection, not Kyle's own portraits.
const headshot = archive.data.get("headshots")?.items[0];
if (headshot) Object.assign(enriched[3], {
  src: headshot.src, full: headshot.full, title: headshot.title,
  alt: headshot.alt, objectPosition: headshot.objectPosition || "50% 40%",
});

// One page: the easels and signs travel to their section, they never route away.
const enterCategory = (slot) => archive.jump(slot.category);

for (const [index, slot] of enriched.entries()) {
  const canvas = createWrappedCanvas(slot, index, { onSelect: (i, a) => enterCategory(enriched[i], a) });
  const link = canvas.querySelector("a");
  link.setAttribute("aria-label", "Explore " + archive.data.get(slot.category).title);
  link.href = "#" + slot.category;
  layers.append(canvas);
}

const signLayer = document.createElement("div");
signLayer.className = "category-signs";
composition.append(signLayer);
const signs = [];
for (const slot of enriched) {
  const category = archive.data.get(slot.category);
  if (!category) continue;
  const a = document.createElement("a");
  a.className = "category-sign";
  a.href = "#" + slot.category;
  a.textContent = category.title;
  a.dataset.slot = slot.id;
  a.setAttribute("aria-label", "Explore " + category.title);
  a.onclick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); enterCategory(slot);
  };
  signLayer.append(a);
  signs.push({ slot, a });
}
function resize() {
  const scale = composition.clientWidth / 2528;
  layers.style.transform = `scale(${scale})`;
  for (const { slot, a } of signs) {
    a.style.left = (slot.quad[0][0] + slot.quad[1][0]) / 2 * scale + "px";
    a.style.top = (Math.min(slot.quad[0][1], slot.quad[1][1]) - 20) * scale + "px";
    a.hidden = slot.depth !== 1;
  }
}
new ResizeObserver(resize).observe(composition);
resize();

// The static list stays in the markup for no-JavaScript visitors; with the
// archive mounted it would be a duplicate index, so it steps aside for good.
const staticList = $("#photographs");
if (staticList) { staticList.hidden = true; staticList.dataset.keepHidden = "true"; }

// ---- menu ------------------------------------------------------------------
const menu = $("#menu"), panel = $("#menu-panel"), toggle = $("#menu-toggle");
panel.setAttribute("aria-label", "Portfolio collections");
$("#show-plate").hidden = true;
$("#show-original").hidden = true;

const closeMenu = (focus = false) => {
  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  if (focus) toggle.focus({ preventScroll: true });
};
toggle.onclick = () => {
  panel.hidden = !panel.hidden;
  toggle.setAttribute("aria-expanded", String(!panel.hidden));
};
document.addEventListener("pointerdown", (e) => { if (!menu.contains(e.target)) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) closeMenu(true); });

const allLink = panel.querySelector("a");
allLink.textContent = "All collections";
allLink.onclick = (e) => {
  e.preventDefault(); closeMenu();
  archive.jump("archive");
};
for (const c of [...archive.data.values()].reverse()) {
  const a = document.createElement("a");
  a.href = "#" + c.id;
  a.textContent = c.title;
  a.onclick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); closeMenu(); archive.jump(c.id);
  };
  panel.prepend(a);
}

$("#appearance").onchange = (e) => {
  menu.dataset.appearance = e.target.value;
  document.body.dataset.appearance = e.target.value;
  try { sessionStorage.setItem("kcl-preview-appearance", e.target.value); } catch {}
};
let appearance = "clear";
try {
  const saved = sessionStorage.getItem("kcl-preview-appearance");
  if (["clear", "solid", "system"].includes(saved)) appearance = saved;
} catch {}
document.body.dataset.appearance = appearance;
menu.dataset.appearance = appearance;
$("#appearance").value = appearance;

// ---- the walk ---------------------------------------------------------------
window.PhotographicCollections = { slots: enriched, collections: archive, enterCategory, menu, signLayer };
window.PhotographicAisle = attachAisle(window.PhotographicCollections);

// The walk builds its invitation during attach; upgrade it into the hero now
// that it exists, so the opener's own module stays untouched.
archive.enhanceHero();
