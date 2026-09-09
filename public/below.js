/* Below-the-walk motion: kinetic headline, one-shot entrance reveals, parallax
   card imagery, pointer glare, curtain-lift footer. Enhancement only — with JS
   off (this module never runs) or reduced motion, everything is simply visible. */
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

export function initBelow() {
  const gallery = document.querySelector("#photographs");
  if (!gallery) return;

  // --- eyebrow + lede around the headline -----------------------------------
  const h1 = gallery.querySelector("h1");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "The gallery beneath the pier";
  const lede = document.createElement("p");
  lede.className = "lede";
  lede.textContent = "Four collections, photographed at Newport Beach. Step into any of them, or walk the pier above first.";
  h1.before(eyebrow);
  h1.after(lede);

  // --- kinetic headline: split into words, rise on first sight --------------
  const words = h1.textContent.trim().split(/(\s+)/);
  h1.textContent = "";
  let wi = 0;
  for (const w of words) {
    const span = document.createElement("span");
    span.className = "kt-word";
    span.style.setProperty("--kt-i", String(wi));
    span.textContent = w;
    if (w.trim()) wi++;
    h1.append(span);
  }
  if (!reduced.matches) h1.classList.add("kt-ready");

  // --- card anatomy: count + arrow chrome on the live category cards --------
  const counts = window.PhotographicCollections
    ? new Map([...window.PhotographicCollections.collections.data.values()].map((c) => [c.title, c.items.length]))
    : new Map();
  for (const card of gallery.querySelectorAll(".category-card")) {
    const title = [...card.childNodes].find((n) => n.nodeType === 3);
    const label = document.createElement("span");
    label.className = "card-label";
    const name = document.createElement("span");
    name.textContent = title ? title.textContent : "";
    title?.remove();
    const right = document.createElement("span");
    right.style.display = "inline-flex";
    right.style.alignItems = "center";
    right.style.gap = "12px";
    const count = document.createElement("span");
    count.className = "card-count";
    const n = counts.get(name.textContent);
    if (n) count.textContent = n + " photographs";
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.textContent = "→";
    arrow.setAttribute("aria-hidden", "true");
    right.append(count, arrow);
    label.append(name, right);
    card.append(label);
    // pointer glare position
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(2) + "%");
      card.style.setProperty("--gy", ((e.clientY - r.top) / r.height * 100).toFixed(2) + "%");
    });
  }

  // --- footer ---------------------------------------------------------------
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  const inner = document.createElement("div");
  inner.className = "footer-inner";
  const ft = document.createElement("p");
  ft.className = "footer-title";
  ft.textContent = "Newport Pier, on foot.";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Footer");
  const back = document.createElement("a");
  back.href = "#aisle-journey";
  back.textContent = "Walk the pier";
  back.onclick = (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced.matches ? "instant" : "smooth" }); };
  nav.append(back);
  if (window.PhotographicCollections) {
    for (const c of window.PhotographicCollections.collections.data.values()) {
      const a = document.createElement("a");
      a.href = "#collection/" + c.id;
      a.textContent = c.title;
      a.onclick = (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.PhotographicCollections.collections.open(c.id, a);
      };
      nav.append(a);
    }
  }
  const meta = document.createElement("p");
  meta.className = "footer-meta";
  meta.textContent = "Photography by Kyle. Development preview.";
  inner.append(ft, nav, meta);
  footer.append(inner);
  document.querySelector("main").after(footer);

  // --- one-shot entrance reveals (never re-fire, never hide no-JS content) --
  const revealTargets = [eyebrow, lede, ...gallery.querySelectorAll(".photo-list li"), nav, meta];
  if (!reduced.matches) {
    revealTargets.forEach((el, i) => {
      el.classList.add("will-reveal");
      el.style.setProperty("--reveal-delay", (i % 4) * 90 + "ms");
    });
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add("revealed");
        if (en.target === h1) h1.classList.add("kt-in");
        io.unobserve(en.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    [h1, ...revealTargets].forEach((el) => io.observe(el));
  } else {
    h1.classList.add("kt-in");
  }

  // --- parallax: card imagery drifts against scroll; footer curtain lifts ---
  const cards = [...gallery.querySelectorAll(".category-card img")];
  let raf = 0;
  function tick() {
    raf = 0;
    const vh = innerHeight;
    for (const img of cards) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const t = (r.top + r.height / 2 - vh / 2) / vh;      // -0.5 .. 0.5 across the viewport
      img.style.setProperty("--py", (t * -30).toFixed(1)); // counter-drift, px
    }
    const fr = footer.getBoundingClientRect();
    if (fr.top < vh) {
      const p = Math.min(1, (vh - fr.top) / Math.min(vh * 0.6, fr.height || 1));
      inner.style.setProperty("--lift", ((1 - p) * 34).toFixed(1) + "px");
    }
  }
  function schedule() { if (!raf && !reduced.matches) raf = requestAnimationFrame(tick); }
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  schedule();
}
