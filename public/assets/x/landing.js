/* The front door, after the Hearst exhibit's.
 *
 *   black lockup    THE / Kiyono / creative lab / EXHIBITIONS, with a real
 *                   loading counter under it
 *   the covers      flip in on an oblique axis and land (gl/plates.js flip)
 *   the choice      "Choose which exhibition you want to explore"; hover tilts
 *                   the cover and lays its photograph across the room behind
 *                   every cover; click turns the page into it
 *
 * Everything comes from catalog.json: a fifth exhibition is a fifth cover.
 */
import { $, $$, h, esc, fetchJSON, appUrl, BB } from "./util.js";
import * as prefs from "./core/prefs.js";
import { initScroll } from "./core/scroll.js";
import { initCursor, bindAll } from "./core/cursor.js";
import { slot } from "./core/type.js";
import { sound } from "./core/sound.js";
import { startLive } from "./core/live.js";
import { track, preloader, go, bindLinks, arriving } from "./core/transition.js";
import { stage } from "./gl/stage.js";
import { enter } from "./gl/plates.js";
import { initMenu } from "./ui/menu.js";

const gsap = window.gsap;

boot().catch((e) => {
  BB("fail", "landing boot: " + e.message, { stack: e.stack });
  const pre = $("#pre");
  if (pre) pre.classList.add("is-gone");
  const m = $("#ld-main");
  if (m) m.hidden = false;
});

async function boot() {
  prefs.apply();
  initScroll();
  initCursor();
  stage.init({ z: 1 });
  bindLinks();
  sound.init("river");
  const pre = $("#pre");
  const pl = preloader(pre);
  pl.set(0.05);
  const cat = await fetchJSON(appUrl("catalog.json"));
  const issues = cat.issues || [];
  pl.set(0.15);

  const main = $("#ld-main");
  const pick = $(".ld-pick", main);
  pick.innerHTML = issues.map((i) => {
    const base = appUrl(i.slug + "/");
    return `<div class="iss" data-slug="${esc(i.slug)}" style="--f:${esc(i.font)};--w:${i.weight || 400};--v:${esc(i.variation || "normal")}">
      <a class="iss-a" href="${esc(base)}" data-cursor="enter" aria-label="${esc(i.mark)}, ${esc(i.issue)}: enter the exhibition">
        <div class="iss-m" data-tilt="8"><img src="${esc(appUrl(i.cover))}" alt="${esc(i.mark)} cover, ${esc(i.issue)}" decoding="async"></div>
        <div class="iss-t"><b>${esc(i.mark)}</b><span>${esc(i.issue)}. ${esc(i.blurb || "")}</span></div>
      </a>
      <nav class="iss-l lbl" aria-label="${esc(i.mark)}, other ways in">
        <a href="${esc(base)}book/">Book</a><a href="${esc(base)}atelier/">Atelier</a>
      </nav>
    </div>`;
  }).join("");
  const total = issues.reduce((a, b) => a + (b.plates || 0), 0);
  $(".ld-count", main).textContent = `${issues.length} exhibition${issues.length > 1 ? "s" : ""} · ${total} photographs`;

  const covers = $$(".iss-m img", pick);
  await track(covers, (p) => pl.set(0.15 + p * 0.85));
  await pl.finish();

  const here = { place: (cat.site && cat.site.place) || { name: "Newport Beach", lat: 33.6073, lon: -117.9289, tz: "America/Los_Angeles" }, almanac: "sun" };
  const menu = initMenu({ catalog: cat, menuTitle: "The Exhibitions", ex: here });
  $(".menu-btn", main).addEventListener("click", () => menu.open());
  const calm = prefs.get().motion === "calm";
  const backdrop = photoBackdrop(issues);
  wire();
  startLive(document, here);

  // hand off: the lockup lifts away and the covers flip in
  main.hidden = false;
  if (calm) {
    pre.classList.add("is-gone");
  } else {
    await new Promise((res) => gsap.to($(".lock", pre), { y: -30, autoAlpha: 0, duration: 0.7, ease: "power3.in", onComplete: res }));
    await new Promise((res) => gsap.to(pre, { autoAlpha: 0, duration: 0.5, onComplete: res }));
    pre.classList.add("is-gone");
  }
  document.documentElement.removeAttribute("data-arriving");
  sessionStorage.removeItem("x.handoff");
  if (!calm) {
    slot($(".ld-q", main), { type: "words", stagger: 0.04, rotate: 0 });
    gsap.from([$(".ld-top", main), $(".ld-bot", main)], { autoAlpha: 0, y: 12, duration: 1, stagger: 0.08, delay: 0.3, ease: "expo.out" });
    // clearProps hands each caption back to its stylesheet opacity when it lands;
    // without it the links under the covers finished at opacity 0 and never showed
    $$(".iss-t, .iss-l", pick).forEach((t, k) => gsap.from(t, { autoAlpha: 0, y: 14, duration: 1, delay: 0.9 + k * 0.08, ease: "expo.out", clearProps: "opacity,visibility,transform,translate" }));
  }
  covers.forEach((img, k) => {
    if (calm) return;
    enter(img, { mode: "flip", delay: 0.15 + k * 0.18, duration: 1.6 }).then((ok) => {
      if (!ok) gsap.from(img.closest(".iss-m"), { autoAlpha: 0, rotateY: -70, duration: 1.2, delay: k * 0.15, ease: "expo.out", transformPerspective: 900 });
    });
  });
  bindAll(document);

  function wire() {
    $$(".iss", pick).forEach((box) => {
      const i = issues.find((x) => x.slug === box.dataset.slug);
      const a = $(".iss-a", box);
      a.addEventListener("pointerenter", () => {
        backdrop.show(i.slug);
        sound.play("tick", { i: issues.indexOf(i) * 3 });
      });
      a.addEventListener("pointerleave", () => backdrop.show(null));
      a.addEventListener("focus", () => backdrop.show(i.slug));
      a.addEventListener("blur", () => backdrop.show(null));
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        go(a.href, { color: i.hero, label: i.mark, font: i.font, weight: i.weight, variation: i.variation });
      });
    });
    const snd = $(".snd-btn", main);
    const sync = () => { snd.setAttribute("aria-pressed", sound.wanted ? "true" : "false"); $(".snd", snd).classList.toggle("on", sound.wanted); };
    snd.addEventListener("click", () => sound.toggle());
    prefs.onChange(({ key }) => key === "sound" && sync());
    sync();
  }
}

/* Hovering a cover lays its photograph across the whole room, dimmed so the
 * covers and captions stay readable. Moving from one cover to the next
 * crossfades; leaving waits a beat, so crossing the gap between two covers
 * does not flash back to black. */
function photoBackdrop(issues) {
  const el = h("div", { class: "ld-photo", "aria-hidden": "true" },
    issues.map((i) => `<img src="${esc(appUrl(i.cover))}" alt="" decoding="async" data-slug="${esc(i.slug)}">`).join(""));
  $(".ld-bg").after(el);
  const imgs = $$("img", el);
  let t = 0;
  const set = (slug) => imgs.forEach((im) => im.classList.toggle("on", im.dataset.slug === slug));
  return {
    show(slug) {
      clearTimeout(t);
      if (slug) set(slug); else t = setTimeout(() => set(null), 220);
    },
  };
}
