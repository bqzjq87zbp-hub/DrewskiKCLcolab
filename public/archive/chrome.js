/**
 * The chrome cluster: sound, viewer controls, preloader.
 *
 * Sound is procedural Web Audio (no asset downloads), never autoplays, unlocks
 * only on a real gesture, and its mute state is the visitor's to keep.
 * Viewer controls are a visible feature, not a silent branch: motion, sound and
 * a low-bandwidth mode all live in one panel and persist for the session.
 */
import { el, reduced, coarse } from "./motion.js";

const STORE = "kcl-archive-prefs";
const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch { return {}; } };
const save = (p) => { try { sessionStorage.setItem(STORE, JSON.stringify(p)); } catch {} };

// ---- procedural sound ------------------------------------------------------
export function createSound(prefs) {
  let ctx = null, bed = null, on = prefs.sound === true;   // opt-in, never default

  const ensure = () => {
    if (ctx || !on) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  };

  function blip(freq = 620, dur = 0.05, gain = 0.03) {
    if (!on) return;
    const c = ensure(); if (!c || c.state === "closed") return;
    if (c.state === "suspended") c.resume?.();
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  }

  function setOn(v) {
    on = v;
    if (!on && ctx) { ctx.close?.(); ctx = null; bed = null; }
    prefs.sound = on; save(prefs);
  }

  return { blip, setOn, get on() { return on; } };
}

// ---- viewer controls -------------------------------------------------------
export function buildControls({ sound, onMotion, onBandwidth }) {
  const prefs = load();
  const panel = el("div", { class: "vc-panel", id: "vc-panel", hidden: true, role: "group", "aria-label": "Display settings" });

  const row = (label, hint, initial, fn) => {
    const sw = el("button", {
      class: "vc-switch", type: "button", role: "switch",
      "aria-checked": String(initial), "aria-label": label,
    }, el("i", { class: "vc-knob", "aria-hidden": "true" }));
    sw.addEventListener("click", () => {
      const next = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(next));
      fn(next);
    });
    panel.append(el("div", { class: "vc-row" },
      el("span", { class: "vc-label" }, el("strong", { text: label }), el("small", { text: hint })), sw));
    return sw;
  };

  row("Motion", "Scroll effects and drift", prefs.motion !== false && !reduced(), (v) => {
    prefs.motion = v; save(prefs);
    document.documentElement.classList.toggle("no-motion", !v);
    onMotion?.(v);
  });
  row("Sound", "Quiet interface tones", sound.on, (v) => { sound.setOn(v); sound.blip(760, 0.06, 0.035); });
  row("Low bandwidth", "Skip full-resolution loads", prefs.lowbw === true, (v) => {
    prefs.lowbw = v; save(prefs);
    document.documentElement.classList.toggle("low-bw", v);
    onBandwidth?.(v);
  });

  const toggle = el("button", {
    class: "vc-toggle", type: "button", "aria-expanded": "false", "aria-controls": "vc-panel",
    "aria-label": "Display settings",
  }, el("span", { class: "vc-icon", "aria-hidden": "true", text: "☰" }), el("span", { text: "Display" }));
  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    sound.blip(open ? 680 : 520, 0.045, 0.028);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !cluster.contains(e.target)) { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
  });

  const cluster = el("div", { class: "vc" }, panel, toggle);
  document.body.append(cluster);

  // Apply stored preferences on load.
  if (prefs.motion === false) document.documentElement.classList.add("no-motion");
  if (prefs.lowbw === true) document.documentElement.classList.add("low-bw");
  return { cluster, prefs };
}

// ---- preloader -------------------------------------------------------------
export function runPreloader() {
  if (reduced()) return Promise.resolve();
  const count = el("span", { class: "pre-count", text: "0" });
  const bar = el("i", { class: "pre-fill" });
  const gate = el("div", { class: "pre", role: "status", "aria-live": "polite" },
    el("p", { class: "pre-label", text: "Newport Pier" }),
    el("div", { class: "pre-track" }, bar),
    el("p", { class: "pre-num" }, count, el("span", { text: "%" })));
  document.body.append(gate);

  return new Promise((resolve) => {
    const t0 = performance.now();
    const MIN = 900;
    (function tick() {
      // Real signal where the browser gives one, with a floor so it never
      // flashes past too fast to read.
      const loaded = document.readyState === "complete" ? 1 : 0.72;
      const p = Math.min(loaded, (performance.now() - t0) / MIN);
      count.textContent = String(Math.round(p * 100));
      bar.style.transform = `scaleX(${p.toFixed(3)})`;
      if (p < 1) return requestAnimationFrame(tick);
      gate.dataset.done = "true";
      setTimeout(() => { gate.remove(); resolve(); }, 620);
    })();
  });
}

export { load as loadPrefs };
