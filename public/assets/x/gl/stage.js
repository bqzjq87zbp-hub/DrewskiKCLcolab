/* The GL stage: one fixed full-viewport canvas and one context for the whole
 * page. Effects register as layers; the stage only renders while at least one
 * layer is active, clears once when they all go quiet, and then costs nothing.
 *
 * It rides the GSAP ticker after the scroll engine, so any layer that reads a
 * DOM rect reads it after Lenis has moved the page in the same frame: planes
 * never lag or swim behind the elements they sit on.
 *
 * iOS and memory: one context, DPR capped, textures sized to what is shown.
 * If the context is lost, every layer is told to fall back to the DOM.
 */
import { getContext } from "./lib.js";
import * as prefs from "../core/prefs.js";
import { BB, emit } from "../util.js";

const gsap = window.gsap;

export const stage = {
  canvas: null, gl: null, ok: false,
  w: 0, h: 0, dpr: 1, time: 0,
  layers: [],
  dirty: false,
  baseZ: 30,
  init(opts = {}) {
    if (this.canvas) return this;
    this.baseZ = opts.z != null ? opts.z : 30;
    if (prefs.get().effects !== "on") return this;
    const c = document.createElement("canvas");
    c.className = "gl-stage";
    c.setAttribute("aria-hidden", "true");
    c.style.zIndex = this.baseZ;
    document.body.appendChild(c);
    const gl = getContext(c);
    if (!gl) { c.remove(); return this; }
    this.canvas = c; this.gl = gl; this.ok = true;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize();
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => this.resize(), 80); });
    c.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.ok = false;
      BB("warn", "webgl context lost");
      emit("gl:lost");
      document.documentElement.setAttribute("data-effects", "off");
    });
    prefs.onChange(({ key }) => {
      if (key === "effects" && prefs.get().effects !== "on" && this.ok) {
        this.ok = false; this.clear(); emit("gl:lost");
      }
    });
    gsap.ticker.add((t, dtms) => this.frame(t, Math.min(0.05, (dtms || 16) / 1000)));
    return this;
  },
  resize() {
    if (!this.canvas) return;
    const narrow = innerWidth < 760;
    this.dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2);
    this.w = this.canvas.clientWidth || innerWidth;
    this.h = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    for (const l of this.layers) l.resize && l.resize(this);
    this.dirty = true;
  },
  add(layer) {
    this.layers.push(layer);
    this.layers.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (this.ok && layer.setup) {
      try { layer.setup(this.gl, this); }
      catch (e) { BB("fail", "gl layer setup: " + e.message, { stack: e.stack }); layer.broken = true; }
    }
    return layer;
  },
  /** Raise the canvas above everything (page transitions), or put it back. */
  top(on) { if (this.canvas) this.canvas.style.zIndex = on ? 2147483000 : this.baseZ; },
  clear() {
    if (!this.gl) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  },
  frame(t, dt) {
    if (!this.ok) return;
    this.time = t;
    const active = this.layers.filter((l) => !l.broken && l.active(this));
    if (!active.length) {
      // at rest the canvas leaves the compositor entirely
      if (this.dirty) { this.clear(); this.dirty = false; this.canvas.style.visibility = "hidden"; }
      return;
    }
    if (this.canvas.style.visibility === "hidden") this.canvas.style.visibility = "";
    const gl = this.gl;
    this.clear();
    for (const l of active) {
      try { l.draw(gl, this, dt, t); }
      catch (e) { l.broken = true; BB("fail", "gl layer draw: " + e.message, { stack: e.stack }); emit("gl:layer-broken", l); }
    }
    gl.disable(gl.SCISSOR_TEST);
    this.dirty = true;
  },
  /** CSS px rect -> GL scissor in device px (origin bottom-left). */
  scissor(r) {
    const gl = this.gl, d = this.dpr;
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top);
    const x1 = Math.min(this.w, r.left + r.width), y1 = Math.min(this.h, r.top + r.height);
    if (x1 <= x0 || y1 <= y0) return false;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.floor(x0 * d), Math.floor((this.h - y1) * d), Math.ceil((x1 - x0) * d), Math.ceil((y1 - y0) * d));
    return true;
  },
};
