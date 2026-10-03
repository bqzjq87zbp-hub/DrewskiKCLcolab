/* Shared helpers for the exhibit system.
 *
 * Everything under assets/x/ is a plain ES module loaded straight by the
 * browser: no bundler, no build step, same as the rest of the site. Modules
 * that are pure (no DOM at import time) are unit-tested with `node --test`.
 */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const map = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v)));
/** Frame-rate independent exponential smoothing toward a target. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const pad = (n, w = 2) => String(n).padStart(w, "0");
export const smooth = (t) => t * t * (3 - 2 * t);

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deterministic PRNG so layouts are stable per issue. */
export function prng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hashStr(String(seed));
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb01 = (hex) => hexToRgb(hex).map((c) => c / 255);
/** Relative luminance (WCAG) of a hex colour, 0..1. */
export function luma(hex) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((c, i) => Math.round(lerp(c, B[i], t)).toString(16).padStart(2, "0")).join("");
}

/* ─── DOM (only touched when called, never at import) ─────────────────── */
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
export function h(tag, attrs, html) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] == null || attrs[k] === false) continue;
    if (k === "class") el.className = attrs[k];
    else if (k === "style") el.style.cssText = attrs[k];
    else el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
  }
  if (html != null) el.innerHTML = html;
  return el;
}

/** App root (the folder that holds index.html and assets/), from this file's own URL. */
export const APP = new URL("../../", import.meta.url);
export const appUrl = (p) => new URL(p, APP).pathname;

/** The folder the current page lives in, trailing slash guaranteed. cleanUrls
 *  serves /slug/ as /slug with no slash, which breaks bare relative URLs. */
export function hereDir() {
  return location.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "") + "/";
}

export const BB = (lvl, msg, extra) => { try { window.BB && window.BB[lvl](msg, extra); } catch (e) {} };

export async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

/** Resolves when the image has decoded (or failed); never rejects. */
export function ready(img) {
  if (img.complete && img.naturalWidth) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return new Promise((res) => {
    const done = () => { img.removeEventListener("load", done); img.removeEventListener("error", done); res(); };
    img.addEventListener("load", done); img.addEventListener("error", done);
  });
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image " + src));
    i.src = src;
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const raf = () => new Promise((r) => requestAnimationFrame(r));

export const media = {
  fine: () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  coarse: () => matchMedia("(pointer: coarse)").matches,
  reduced: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  dark: () => matchMedia("(prefers-color-scheme: dark)").matches,
  narrow: () => innerWidth < 760,
};

/** Tiny event bus shared by modules on one page. */
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const listen = (type, fn) => {
  const f = (e) => fn(e.detail);
  bus.addEventListener(type, f);
  return () => bus.removeEventListener(type, f);
};
