/* Runs in <head>, before first paint, so nothing flashes in the wrong theme
 * and an arriving page transition starts already covered. Classic script, not
 * a module: modules are deferred and would run after the first paint.
 * Mirrors the resolution rules in core/prefs.js; keep the two in step. */
(function () {
  var d = document.documentElement, p = {};
  try { p = JSON.parse(localStorage.getItem("x.prefs") || "{}") || {}; } catch (e) {}
  function mq(q) { try { return matchMedia(q).matches; } catch (e) { return false; } }
  var theme = p.theme || "light";
  if (theme === "system") theme = mq("(prefers-color-scheme: dark)") ? "dark" : "light";
  var motion = p.motion || "system";
  if (motion === "system") motion = mq("(prefers-reduced-motion: reduce)") ? "calm" : "full";
  d.setAttribute("data-theme", theme);
  d.setAttribute("data-motion", motion);
  d.setAttribute("data-grain", p.grain === "off" ? "off" : "on");
  d.setAttribute("data-effects", p.effects === "off" ? "off" : "on");
  d.setAttribute("data-pointer", mq("(hover: hover) and (pointer: fine)") ? "fine" : "coarse");
  try {
    var t = JSON.parse(sessionStorage.getItem("x.handoff") || "null");
    var here = location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "");
    if (t && Date.now() - t.t < 9000 && t.to === here) {
      d.setAttribute("data-arriving", t.mode || "curl");
      d.style.setProperty("--handoff", t.color || "#000");
      d.style.setProperty("--handoff-ink", t.ink || "#fff");
    }
  } catch (e) {}
  d.className += " js";
})();
