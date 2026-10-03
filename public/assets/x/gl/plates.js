/* /iw-shader-surfaces + /iw-entrance-reveals: photographs as paper.
 *
 * Each image is a DOM <img> first. While something is happening to it, a
 * WebGL plane is drawn exactly over it (same rect, read after the scroll
 * engine moved the page this frame) and the DOM image waits underneath:
 *
 *   fold   entrance. A crease sweeps diagonally from the bottom-left corner;
 *          paper behind it is still lifted off the page and bends down onto
 *          it, shaded by its angle to the light. When the crease has crossed,
 *          the plane is flat, identical to the <img>, and hands back to it.
 *   flip   entrance for covers: the sheet turns over on an oblique axis and
 *          bows as it lands, its reverse showing plain paper.
 *   loupe  hover. Inside a lens under the pointer the photograph is shown
 *          magnified as halftone print dots; outside it ripples faintly.
 *          The plane covers the image exactly, so the DOM never has to hide.
 *
 * Textures are drawn at display size (sharper than GPU minification, a
 * fraction of the memory) and freed when the effect ends.
 */
import { program, grid, drawGrid, texture, fitCanvas } from "./lib.js";
import { stage } from "./stage.js";
import { rgb01, clamp, listen, damp } from "../util.js";
import { pointer } from "../core/cursor.js";

const gsap = window.gsap;

const VS = `
attribute vec2 aUv;
uniform vec4 uRect; uniform vec2 uView; uniform float uD;
uniform float uMode; uniform float uFold; uniform float uLift; uniform float uBendW;
uniform float uFlip;
varying vec2 vUv; varying float vLight; varying float vFacing;
mat3 rot(vec3 a, float g){
  a = normalize(a); float s = sin(g), c = cos(g), o = 1.0 - c;
  return mat3(o*a.x*a.x + c, o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s,
              o*a.x*a.y - a.z*s, o*a.y*a.y + c, o*a.y*a.z + a.x*s,
              o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c);
}
void main(){
  vUv = aUv;
  vec2 p = vec2(aUv.x * uRect.z, (1.0 - aUv.y) * uRect.w);
  vec3 pos = vec3(p, 0.0);
  vec3 n = vec3(0.0, 0.0, 1.0);
  if (uMode < 0.5) {
    vec2 d = vec2(0.70710678);
    float S = dot(uRect.zw, d);
    float F = uFold * (S + 2.0);
    float x = dot(p, d) - F;
    if (x > 0.0) {
      float th = uLift * (1.0 - 0.45 * uFold);
      float w = uBendW;
      float R = w / th;
      float ph = x < w ? x / R : th;
      float along = x < w ? R * sin(ph) : R * sin(th) + (x - w) * cos(th);
      float z = x < w ? R * (1.0 - cos(ph)) : R * (1.0 - cos(th)) + (x - w) * sin(th);
      pos.xy = p - d * x + d * along;
      pos.z = z;
      n = vec3(-d * sin(ph), cos(ph));
    }
  } else if (uMode > 1.5) {
    vec3 c = vec3(uRect.zw * 0.5, 0.0);
    float fp = smoothstep(aUv.x * 0.35, 0.72 + aUv.x * 0.28, uFlip);
    mat3 R = rot(vec3(0.55, 1.0, 0.2), (1.0 - fp) * 3.14159);
    vec3 q = R * (pos - c);
    q.z += (1.0 - fp) * sin(aUv.y * 3.14159) * uRect.w * 0.22 + (1.0 - fp) * uRect.w * 0.35;
    pos = q + c;
    n = R * n;
  }
  vec3 L = normalize(vec3(-0.35, 0.55, 1.0));
  vLight = clamp(dot(n, L) / 0.8604, 0.0, 1.15);
  vFacing = n.z;
  vec2 s = vec2(uRect.x + pos.x, uRect.y + (uRect.w - pos.y));
  vec2 c2 = s - uView * 0.5;
  float k = uD / max(uD - pos.z, 60.0);
  c2 *= k;
  gl_Position = vec4(c2.x / (uView.x * 0.5), -c2.y / (uView.y * 0.5), 0.0, 1.0);
}`;

const FS = `
uniform sampler2D uTex; uniform vec2 uSize; uniform float uAlpha;
uniform float uHover; uniform vec2 uPointer; uniform float uTime; uniform float uLens;
uniform vec3 uPaper; uniform vec3 uBack;
varying vec2 vUv; varying float vLight; varying float vFacing;
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main(){
  if (vFacing < 0.0) { gl_FragColor = vec4(uBack * (0.72 + 0.28 * abs(vFacing)) * uAlpha, uAlpha); return; }
  vec2 uv = vUv;
  vec3 col;
  if (uHover > 0.001) {
    vec2 dp = (uv - uPointer) * uSize;
    float d = length(dp);
    float R = uLens * uHover;
    // faint ripple outside the lens
    vec2 dir = d > 0.0 ? dp / d : vec2(0.0);
    float rip = sin(d * 0.075 - uTime * 5.5) * exp(-d / 170.0) * 2.4 * uHover;
    vec2 uvR = uv + dir * rip / uSize;
    vec3 base = texture2D(uTex, uvR).rgb;
    // inside the lens: magnified, printed as halftone dots
    vec2 uvM = uPointer + (uv - uPointer) * 0.78;
    vec3 src = texture2D(uTex, uvM).rgb;
    float a = 0.26;
    mat2 rm = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 hv = rm * (uv * uSize) / 5.0;
    vec2 cell = fract(hv) - 0.5;
    float r = mix(0.2, 0.66, 1.0 - lum(src));
    float dotm = smoothstep(r, r - 0.08, length(cell));
    vec3 print = mix(uPaper, src * 1.04, dotm);
    float inside = 1.0 - smoothstep(R - 1.5, R, d);
    float ring = (smoothstep(R - 3.0, R - 1.5, d) - smoothstep(R - 0.5, R + 0.8, d)) * 0.35;
    col = mix(base, print, inside) * (1.0 - ring);
  } else col = texture2D(uTex, uv).rgb;
  col *= vLight;
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}`;

let prog = null, mesh = null, paper = [0.96, 0.94, 0.9], back = [0.93, 0.91, 0.87];
const items = new Map();
let registered = false;

function makeTex(it, rect) {
  const gl = stage.gl;
  const d = stage.dpr, cap = 1400;
  let w = rect.width * d, hh = rect.height * d;
  const s = Math.min(1, cap / Math.max(w, hh));
  w *= s; hh *= s;
  if (it.tex && Math.abs(it.tw - w) < 24 && Math.abs(it.th - hh) < 24) return;
  if (it.tex) gl.deleteTexture(it.tex);
  it.tex = texture(gl, fitCanvas(it.img, w, hh), { mip: gl.isGL2 });
  it.tw = w; it.th = hh;
}

function drop(it) {
  if (it.tex) stage.gl && stage.gl.deleteTexture(it.tex);
  items.delete(it.img);
}

export const platesLayer = {
  order: 10,
  setup(gl) {
    prog = program(gl, VS, FS);
    mesh = grid(gl, 28, 40);
  },
  active() { return items.size > 0; },
  draw(gl, st, dt, t) {
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    prog.use();
    prog.set("uView", [st.w, st.h]).set("uD", Math.max(1400, st.h * 1.6)).set("uTime", t)
      .set("uPaper", paper).set("uBack", back);
    for (const it of items.values()) {
      const r = (it.box || it.img).getBoundingClientRect();
      if (!r.width || r.bottom < -r.height || r.top > st.h + r.height) continue;
      if (it.hoverOn || it.hover > 0.001) {
        const u = clamp((pointer.x - r.left) / r.width), v = clamp((pointer.y - r.top) / r.height);
        it.px = damp(it.px, u, 16, dt); it.py = damp(it.py, v, 16, dt);
      }
      it.hover = damp(it.hover, it.hoverOn ? 1 : 0, it.hoverOn ? 7 : 9, dt);
      if (!it.hoverOn && it.hover < 0.002 && !it.anim) { drop(it); continue; }
      makeTex(it, r);
      prog.set("uRect", [r.left, r.top, r.width, r.height])
        .set("uMode", it.mode === "flip" ? 2 : it.mode === "fold" ? 0 : 1)
        .set("uFold", it.p).set("uFlip", it.p)
        .set("uLift", 1.22).set("uBendW", Math.max(r.width, r.height) * 0.3)
        .set("uSize", [r.width, r.height]).set("uAlpha", it.alpha)
        .set("uHover", it.hover).set("uPointer", [it.px, it.py]).set("uLens", clamp(Math.min(r.width, r.height) * 0.36, 44, 130))
        .set("uTex", it.tex);
      drawGrid(gl, prog, mesh);
    }
  },
};

function ensure() {
  if (!stage.ok) return false;
  if (!registered) {
    stage.add(platesLayer);
    registered = true;
    listen("gl:lost", () => { for (const it of items.values()) it.img.classList.remove("is-gl"); items.clear(); });
  }
  return !platesLayer.broken;
}

export function setPaper(paperHex, backHex) { paper = rgb01(paperHex); back = rgb01(backHex || paperHex); }

function item(img, box) {
  let it = items.get(img);
  if (!it) { it = { img, box, mode: "hover", p: 1, alpha: 1, hover: 0, hoverOn: false, px: 0.5, py: 0.5, anim: false }; items.set(img, it); }
  if (box) it.box = box;
  return it;
}

/**
 * Entrance. The <img> stays hidden (class is-gl) until the plane has landed.
 * Resolves false when WebGL is unavailable, so the caller can run the CSS
 * version instead.
 */
export function enter(img, opts = {}) {
  if (!ensure() || !img.naturalWidth) return Promise.resolve(false);
  const it = item(img, opts.box);
  it.mode = opts.mode || "fold";
  it.p = 0; it.alpha = 0; it.anim = true;
  img.classList.add("is-gl");
  return new Promise((res) => {
    const tl = gsap.timeline({
      delay: opts.delay || 0,
      onComplete: () => {
        it.anim = false; it.mode = "hover"; it.p = 1; it.alpha = 1;
        img.classList.remove("is-gl");
        if (!it.hoverOn) requestAnimationFrame(() => { if (!it.hoverOn && !it.anim) drop(it); });
        res(true);
      },
    });
    tl.to(it, { alpha: 1, duration: 0.28, ease: "power1.out" }, 0);
    tl.to(it, { p: 1, duration: opts.duration || (it.mode === "flip" ? 1.5 : 1.55), ease: opts.ease || (it.mode === "flip" ? "power3.out" : "sine.out") }, 0);
  });
}

/** Hover lens on/off for an image (the box is what the pointer is measured in). */
export function hover(img, on, box) {
  if (!ensure() || !img.naturalWidth) return;
  const it = item(img, box);
  it.hoverOn = on;
  if (on && it.hover < 0.01) {
    const r = (box || img).getBoundingClientRect();
    it.px = clamp((pointer.x - r.left) / r.width); it.py = clamp((pointer.y - r.top) / r.height);
  }
}

export const glReady = () => ensure();
