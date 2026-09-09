/**
 * The archive: one page, four sections, no routes.
 *
 * After the pier walk you keep scrolling. Branding, Family portraits,
 * Professional headshots and Coastal photographs each arrive as one continuous
 * line of photographs carrying its own signature technique. Nothing navigates
 * away; the only overlay is the viewer.
 */
import { reveal, reduced, onFrame, clamp, el, splitWords } from "./motion.js";
import { initCursor, magnetic } from "./cursor.js";
import { pinnedScrub, infiniteDrift, velocitySkew, scrollShuttle } from "./strips.js";
import { buildChapters } from "./chapters.js";
import { createLightbox } from "./lightbox.js";
import { createSound, buildControls, runPreloader, loadPrefs } from "./chrome.js";

const ORDER = ["branding", "families", "headshots", "coastal"];
const BUILDER = [pinnedScrub, infiniteDrift, velocitySkew, scrollShuttle];

export async function createArchive() {
  const payload = await (await fetch("/categories.json")).json();
  const data = new Map(payload.categories.map((c) => [c.id, c]));
  const main = document.querySelector("main");

  const prefs = loadPrefs();
  const sound = createSound(prefs);
  const lightbox = createLightbox();
  initCursor();

  const enlarge = (c) => (i, trigger) => { sound.blip(700, 0.05, 0.03); lightbox.open(c, i, trigger); };

  // ---- the four sections, in order ---------------------------------------
  const intro = el("section", { class: "archive-intro", id: "archive" },
    el("p", { class: "intro-eyebrow", text: "The archive" }),
    el("h2", { class: "intro-title" }, splitWords("Keep going. Four collections, one line each.")),
    el("p", { class: "intro-lede", text: "Every photograph from the easels above, laid out end to end. Nothing to click through: just keep scrolling." }));
  reveal([...intro.children], { stagger: 90 });
  main.append(intro);

  const sections = ORDER.map((id, i) => {
    const c = data.get(id);
    if (!c) return null;
    const { section } = BUILDER[i]({ collection: c, onEnlarge: enlarge(c) });
    main.append(section);
    return { id, title: c.title, section };
  }).filter(Boolean);

  const footer = buildFooter({ collections: data, sound });
  main.append(footer);

  // ---- chrome ------------------------------------------------------------
  const jump = (id) => {
    sound.blip(560, 0.05, 0.03);
    document.getElementById(id)?.scrollIntoView({
      behavior: reduced() ? "instant" : "smooth", block: "start",
    });
  };
  buildChapters({ chapters: sections.map(({ id, title }) => ({ id, title })), onJump: jump });
  buildControls({
    sound,
    onMotion: () => location.reload(),   // motion mode is structural; a clean remount is honest
    onBandwidth: (v) => {
      for (const img of document.querySelectorAll(".shot-img")) img.loading = v ? "lazy" : "eager";
    },
  });

  // Quiet hover tone on the photographs, only once sound is opted into.
  main.addEventListener("pointerover", (e) => {
    if (e.target.closest?.(".shot")) sound.blip(880, 0.03, 0.014);
  }, { passive: true });

  await runPreloader();

  // Deep link straight to a section without a route.
  const hash = location.hash.replace(/^#/, "");
  if (sections.some((s) => s.id === hash)) {
    document.getElementById(hash)?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return { data, jump, sections };
}

// ---- footer ---------------------------------------------------------------
function buildFooter({ collections, sound }) {
  const list = [...collections.values()];
  const total = list.reduce((n, c) => n + c.items.length, 0);

  const top = el("button", { class: "foot-top", type: "button", dataset: { cursor: "up", cursorLabel: "Top" } },
    el("span", { class: "foot-top-arrow", text: "↑", "aria-hidden": "true" }), "Back to the pier");
  top.addEventListener("click", () => {
    sound.blip(480, 0.06, 0.03);
    scrollTo({ top: 0, behavior: reduced() ? "instant" : "smooth" });
  });
  magnetic(top);

  const nav = el("nav", { class: "foot-nav", "aria-label": "Sections" },
    list.map((c) => {
      const a = el("a", { href: "#" + c.id },
        el("span", { text: c.title }),
        el("span", { class: "foot-count", text: String(c.items.length).padStart(2, "0") }));
      a.addEventListener("click", () => sound.blip(600, 0.04, 0.025));
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

  if (reduced()) counter.textContent = String(total);
  else {
    let started = false;
    new IntersectionObserver((entries, obs) => {
      if (!entries.some((e) => e.isIntersecting) || started) return;
      started = true; obs.disconnect();
      const t0 = performance.now();
      onFrame(() => {
        const p = clamp((performance.now() - t0) / 1100);
        counter.textContent = String(Math.round(total * (1 - Math.pow(1 - p, 3))));
        return p < 1;
      });
    }, { threshold: 0.6 }).observe(counter);
  }

  reveal([footer.querySelector(".foot-eyebrow"), footer.querySelector(".foot-title"), nav,
    footer.querySelector(".foot-stat"), top, footer.querySelector(".foot-meta")], { stagger: 70 });
  return footer;
}
