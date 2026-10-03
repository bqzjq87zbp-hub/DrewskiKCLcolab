/* /iw-viewer-controls: the visitor owns theme, motion, effects, sound, grain.
 *
 * Stored per browser in localStorage (a per-viewer convenience, nothing shared)
 * and mirrored onto <html> as data attributes so CSS can react without JS.
 * head.js applies the same rules before first paint.
 */
import { emit, listen } from "../util.js";

const KEY = "x.prefs";
export const OPTIONS = {
  theme: [["light", "Light"], ["dark", "Dark"], ["system", "System"]],
  motion: [["system", "System"], ["full", "Full"], ["calm", "Calm"]],
  effects: [["auto", "Auto"], ["on", "On"], ["off", "Low power"]],
  sound: [["off", "Off"], ["on", "On"]],
  grain: [["on", "On"], ["off", "Off"]],
};
export const DEFAULTS = { theme: "light", motion: "system", effects: "auto", sound: "off", grain: "on" };

let state = { ...DEFAULTS };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
for (const k in state) if (!OPTIONS[k] || !OPTIONS[k].some(([v]) => v === state[k])) state[k] = DEFAULTS[k];

let glOK = null;
export function webglSupported() {
  if (glOK !== null) return glOK;
  try {
    const c = document.createElement("canvas");
    glOK = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { glOK = false; }
  return glOK;
}

const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };

/** Pure resolution of stored choices into what the page should actually do. */
export function resolve(s, env) {
  const theme = s.theme === "system" ? (env.dark ? "dark" : "light") : s.theme;
  const motion = s.motion === "system" ? (env.reduced ? "calm" : "full") : s.motion;
  let effects = s.effects;
  if (effects === "auto") effects = env.webgl && !env.saveData && !env.lowMemory ? "on" : "off";
  if (!env.webgl) effects = "off";
  return { theme, motion, effects, sound: s.sound === "on", grain: s.grain !== "off" };
}

function env() {
  const c = navigator.connection || {};
  return {
    dark: mq("(prefers-color-scheme: dark)"),
    reduced: mq("(prefers-reduced-motion: reduce)"),
    webgl: webglSupported(),
    saveData: !!c.saveData,
    lowMemory: typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2,
  };
}

let current = null;
export function get() { return current || (current = resolve(state, env())); }
export function raw() { return { ...state }; }

export function apply() {
  current = resolve(state, env());
  const d = document.documentElement;
  d.setAttribute("data-theme", current.theme);
  d.setAttribute("data-motion", current.motion);
  d.setAttribute("data-effects", current.effects);
  d.setAttribute("data-grain", current.grain ? "on" : "off");
  return current;
}

export function set(key, value) {
  if (!OPTIONS[key] || !OPTIONS[key].some(([v]) => v === value)) return;
  if (state[key] === value) return;
  state[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  const before = current;
  const after = apply();
  emit("prefs", { key, value, before, after });
}

export const onChange = (fn) => listen("prefs", fn);

// Follow the OS when the visitor left a setting on "system".
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { apply(); emit("prefs", { key: "theme", after: current }); });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { apply(); emit("prefs", { key: "motion", after: current }); });
} catch (e) {}
