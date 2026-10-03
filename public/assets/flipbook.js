/* Runtime flipbook renderer.
   Reads issue.json from the current directory and builds the book from it, so
   adding a plate is a JSON edit plus an image drop with no rebuild step. */
(function () {
  var stage = document.getElementById("stage");
  var indEl = document.getElementById("ind");
  var hint = document.getElementById("hint");
  var loading = document.getElementById("loading");
  var pf = null, SRC = "", TOTAL = 0, isPortrait = false;

  // cleanUrls serves this at /<slug>/book with NO trailing slash, so bare
  // relative URLs resolve one level too high. Normalise to a trailing slash,
  // then walk up by data-root to reach the issue folder that holds issue.json.
  var HERE = location.pathname.replace(/\/+$/, "") + "/";
  var BASE = new URL(document.body.getAttribute("data-root") || "./",
                     location.origin + HERE).pathname;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function theme(t) {
    if (!t) return;
    var r = document.documentElement.style;
    var map = {paper: "--paper", ink: "--ink", acc: "--acc", acc2: "--acc2",
               edge: "--edge", deep: "--deep", display: "--disp", mono: "--mono"};
    Object.keys(map).forEach(function (k) { if (t[k]) r.setProperty(map[k], t[k]); });
  }

  function pagesFrom(d) {
    var out = [];
    out.push({cls: "pg cover", hard: true,
              html: '<div class="bleed"><img src="' + esc(RES(d.cover)) + '" alt=""></div>'});

    var toc = d.stories.map(function (s, i) {
      return '<li><span class="tn">' + ("0" + (i + 1)).slice(-2) +
             '</span><span class="tt">' + esc(s.title) + "</span></li>";
    }).join("");

    out.push({cls: "pg paper", html:
      '<div class="mast"><div class="mast-mark">' + esc(d.mark) + "</div>" +
      '<h1 class="mast-title">' + esc(d.issue) + "</h1>" +
      '<div class="mast-rule"></div>' +
      '<p class="mast-standfirst">' + esc(d.standfirst) + "</p>" +
      '<div class="toc-h">In this exhibition</div><ol class="toc">' + toc + "</ol>" +
      '<div class="mast-foot">' + esc(d.footer) + "</div></div>"});

    d.stories.forEach(function (s, i) {
      out.push({cls: "pg section", html:
        '<div class="sec"><div class="sec-n">' + ("0" + (i + 1)).slice(-2) + "</div>" +
        '<h2 class="sec-t">' + esc(s.title) + "</h2>" +
        '<div class="sec-rule"></div><p class="sec-d">' + esc(s.deck) + "</p></div>"});
      (s.plates || []).forEach(function (p) {
        var cap = p.caption
          ? '<div class="cap"><span class="cap-k">' + esc(p.kicker) + "</span>" + esc(p.caption) + "</div>"
          : "";
        // Not loading="lazy": StPageFlip transforms/offsets its pages, so the
        // browser treats them as offscreen and never loads the plates.
        // a landscape photograph sits whole on the portrait page, not cropped to it
        out.push({cls: "pg plate" + ((p.w || 0) > (p.h || 0) ? " land" : ""), html:
          '<div class="bleed"><img src="' + esc(RES(p.img)) + '" alt="" decoding="async"></div>' + cap});
      });
    });

    out.push({cls: "pg back", hard: true, html:
      '<div class="bk"><div class="bk-mark">' + esc(d.mark) + "</div>" +
      '<p class="bk-line">' + esc(d.backline) + "</p>" +
      '<div class="bk-rule"></div><p class="bk-small">' + esc(d.footer) + "</p></div>"});
    return out;
  }

  function getBook() {
    // StPageFlip's destroy() tears down its container, so recreate if needed
    // and always re-clone the pages from SRC rather than reusing live DOM.
    var b = document.getElementById("book");
    if (!b) { b = document.createElement("div"); b.id = "book"; stage.appendChild(b); }
    return b;
  }

  function size() {
    var W = Math.min(stage.clientWidth, window.innerWidth);
    var H = Math.min(stage.clientHeight, window.innerHeight);
    var portrait = W < 820, r = 1.40, pw, ph;
    if (portrait) { pw = Math.min(W - 14, 520); ph = pw * r; if (ph > H - 14) { ph = H - 14; pw = ph / r; } }
    else { pw = Math.min(W - 36, 1120) / 2; ph = pw * r; if (ph > H - 20) { ph = H - 20; pw = ph / r; } }
    return {pw: Math.floor(pw), ph: Math.floor(ph), portrait: portrait};
  }

  function fit() {
    // Measure #book itself: this StPageFlip build wraps in .stf__wrapper which
    // reports height 0, so selecting the wrapper makes fit() bail out silently.
    var book = getBook();
    book.style.transform = "";
    var r = book.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var s = Math.min((stage.clientWidth - 6) / r.width, (stage.clientHeight - 6) / r.height, 1);
    if (s < 0.999) book.style.transform = "scale(" + s + ")";
  }

  var settleTries = 0;
  function build() {
    if (pf) { try { pf.destroy(); } catch (e) {} pf = null; }
    var book = getBook();
    book.style.transform = "";
    book.innerHTML = SRC;
    var z = size();

    // A container with no box yet yields a zero page size and StPageFlip
    // throws "Invalid width or height". Wait for real layout instead of
    // failing permanently: this happens when the page loads in a background
    // tab and is only looked at later.
    if (z.pw < 2 || z.ph < 2) {
      if (settleTries++ < 40) setTimeout(build, 150);
      return;
    }
    settleTries = 0;
    isPortrait = z.portrait;
    var pgs = book.querySelectorAll(".pg");
    for (var i = 0; i < pgs.length; i++) {
      pgs[i].style.width = z.pw + "px";
      pgs[i].style.height = z.ph + "px";
    }
    pf = new St.PageFlip(book, {
      width: z.pw, height: z.ph, size: "fixed", autoSize: false,
      usePortrait: z.portrait, showCover: true, mobileScrollSupport: true,
      useMouseEvents: true, drawShadow: true, maxShadowOpacity: 0.5,
      flippingTime: 850, swipeDistance: 18
    });
    pf.loadFromHTML(pgs);
    function upd() { indEl.textContent = (pf.getCurrentPageIndex() + 1) + " / " + TOTAL; }
    pf.on("flip", function () { upd(); if (hint) hint.style.opacity = 0; armFold(); });
    pf.on("changeState", fit);
    upd(); fit(); armFold();
    setTimeout(fit, 120); setTimeout(fit, 400);
    loading.style.display = "none";
    window.__pf = pf;
  }

  /* ── end-of-book pop-out ───────────────────────────────────────────────
     On the back cover a prompt appears. Taking it stands flat panels upright
     like a pop-up spread, blacks out, then hands off to the pier walk, which
     opens on the same dark water so the two pages read as one move. */
  // The walk lives at the site root, one level above every exhibition.
  var walkHref = function () { return BASE.replace(/[^/]+\/$/, "") + "walk/"; };
  var fold = null, popped = false;

  function buildFold() {
    if (fold) return fold;
    fold = document.createElement("div");
    fold.id = "fold";
    var easels = "";
    for (var i = 0; i < 5; i++) {
      easels += '<div class="easel" style="left:' + (12 + i * 18) + '%"></div>';
    }
    fold.innerHTML =
      '<div id="stand">' +
        '<div class="flap" style="height:38%;animation-delay:0s">' +
          '<div class="railline"></div>' + easels + "</div>" +
        '<div class="flap" style="height:60%;animation-delay:.1s;opacity:.72"></div>' +
        '<div class="flap" style="height:80%;animation-delay:.2s;opacity:.5">' +
          '<div class="lbl">The Walk</div></div>' +
      "</div>" +
      '<div class="prompt"><button type="button">Walk the pier</button>' +
      "<small>the last page opens onto the water</small></div>";
    document.body.appendChild(fold);
    fold.querySelector("button").addEventListener("click", popOut);
    return fold;
  }

  function armFold() {
    if (!pf || popped) return;
    // In a spread, getCurrentPageIndex() is the LEFT page, so the back cover is
    // on screen one index early. In portrait it is the current page itself.
    var edge = TOTAL - (isPortrait ? 1 : 2);
    buildFold().classList.toggle("armed", pf.getCurrentPageIndex() >= edge);
  }

  function popOut() {
    if (popped) return;
    popped = true;
    fold.querySelector(".prompt").style.display = "none";
    fold.classList.add("popping");
    var black = document.createElement("div");
    black.id = "blackout";
    document.body.appendChild(black);
    setTimeout(function () { black.classList.add("on"); }, 900);
    setTimeout(function () { location.href = walkHref(); }, 1750);
  }

  document.getElementById("prev").onclick = function () { window.__pf && window.__pf.flipPrev(); };
  document.getElementById("next").onclick = function () { window.__pf && window.__pf.flipNext(); };
  document.addEventListener("keydown", function (e) {
    if (!window.__pf) return;
    if (e.key === "ArrowRight") window.__pf.flipNext();
    if (e.key === "ArrowLeft") window.__pf.flipPrev();
  });
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 320); });
  window.addEventListener("orientationchange", function () { clearTimeout(rt); rt = setTimeout(build, 380); });

  // The book now lives at /<slug>/book/, one level below the issue root, and
  // declares that with data-root="../" on <body>. A shell without it (an older
  // copy sitting at the issue root) resolves to its own folder as before.
  var RES = function (u) { return /^https?:|^\//.test(u) ? u : BASE + u; };

  fetch(BASE + "issue.json", {cache: "no-cache"})
    .then(function (r) { if (!r.ok) throw new Error("issue.json " + r.status); return r.json(); })
    .then(function (d) {
      document.title = d.title;
      theme(d.theme);
      var ps = pagesFrom(d);
      TOTAL = ps.length;
      SRC = ps.map(function (p, n) {
        return '<div class="' + p.cls + '"' + (p.hard ? ' data-density="hard"' : "") +
               '><div class="pi">' + p.html + "</div>" +
               (p.hard ? "" : '<div class="fol">' + n + "</div>") + "</div>";
      }).join("");
      build();
    })
    .catch(function (e) {
      try { window.BB && window.BB.fail("flipbook: " + e.message, { src: BASE + "issue.json" }); } catch (x) {}
      loading.className = "err";
      loading.textContent = "Could not load issue.json (" + e.message +
        "). This page must be served over http, not opened as a local file.";
    });
})();
