/* /iw-shader-surfaces + /iw-transitions-preloader: the paper curl.
 *
 * The move the Hearst exhibit is known for: a sheet of paper physically
 * peeling over a cylinder. Analytic, in the fragment shader, per pixel:
 *
 *   the sheet lies flat over a rect; a fold line at distance L from corner O
 *   travels along `dir`. Paper behind the fold wraps a cylinder of radius R
 *   and lies back over itself, showing its reverse. For every pixel we find
 *   which layer of paper is on top (flipped layer, upper cylinder, lower
 *   cylinder, flat sheet, or nothing) and shade it by its angle to the light.
 *   Where the paper has lifted away, the curl casts a soft shadow on what is
 *   underneath.
 *
 * Peeling a sheet away (p 0 -> 1) reveals the page. Running it backwards from
 * the opposite corner lays a sheet down, so leaving a page and arriving on the
 * next read as one continuous turn in the same direction.
 */
import { program, texture, fitCanvas } from "./lib.js";
import { stage } from "./stage.js";
import { rgb01, clamp } from "../util.js";

const gsap = window.gsap;

const VS = `
attribute vec2 aPos;
uniform vec4 uRect; uniform vec2 uView; uniform float uPad;
varying vec2 vPx;
void main(){
  vec2 px = mix(vec2(-uPad), uRect.zw + uPad, aPos);
  vPx = px;
  vec2 s = uRect.xy + px;
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
}`;

const FS = `
#define PI 3.14159265
uniform vec4 uRect; uniform vec2 uO; uniform vec2 uDir;
uniform float uL; uniform float uR; uniform float uUseTex; uniform float uShow; uniform float uShadow;
uniform sampler2D uTex; uniform vec3 uFront; uniform vec3 uBack;
varying vec2 vPx;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
bool inRect(vec2 p){ return p.x >= 0.0 && p.y >= 0.0 && p.x <= uRect.z && p.y <= uRect.w; }
vec3 front(vec2 p){ return uUseTex > 0.5 ? texture2D(uTex, p / uRect.zw).rgb : uFront; }
vec3 back(vec2 p){ vec3 c = uBack; if (uUseTex > 0.5) c = mix(uBack, texture2D(uTex, p / uRect.zw).rgb, uShow); return c; }
void main(){
  vec2 P = vPx;
  float g = (hash(floor(P)) - 0.5) * 0.025;
  float t = dot(P - uO, uDir);
  float L = uL, R = uR;
  if (inRect(P) && t >= L) {
    float u = t - L + PI * R;
    vec2 Po = P + (L - u - t) * uDir;
    if (u <= L && inRect(Po)) {
      // flipped layer lying back over the sheet, reverse side up
      float edge = smoothstep(0.0, R * 1.2, L - u);
      gl_FragColor = vec4(back(Po) * (0.9 + 0.08 * edge) + g, 1.0);
      return;
    }
    // flat sheet, darkened where the curl crowds it
    float occ = exp(-(t - L) / (R * 1.4)) * 0.22;
    gl_FragColor = vec4(front(P) * (1.0 - occ) + g, 1.0);
    return;
  }
  if (t >= L - R && t < L + 0.001) {
    float s = clamp((L - t) / R, 0.0, 1.0);
    float a1 = asin(s), a2 = PI - a1;
    float u2 = R * a2;
    vec2 P2 = P + (L - u2 - t) * uDir;
    if (u2 <= L && inRect(P2)) {
      float lit = 0.62 + 0.38 * (-cos(a2));
      float spec = pow(max(0.0, sin(a2 * 1.0 + 0.5)), 24.0) * 0.12;
      gl_FragColor = vec4(back(P2) * lit + spec + g, 1.0);
      return;
    }
    float u1 = R * a1;
    vec2 P1 = P + (L - u1 - t) * uDir;
    if (u1 <= L && inRect(P1)) {
      float lit = 0.5 + 0.5 * cos(a1);
      float spec = pow(max(0.0, cos(a1 - 0.55)), 30.0) * 0.18;
      gl_FragColor = vec4(front(P1) * lit + spec + g, 1.0);
      return;
    }
  }
  // paper has lifted away here: shadow of the curl on what is beneath
  float d = (L - R) - t;
  float sh = uShadow * exp(-max(d, 0.0) / (R * 0.8)) * clamp(L / (R * 2.0), 0.0, 1.0);
  if (!inRect(P)) sh *= 0.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, sh);
}`;

let prog = null, quad = null;
const runs = new Set();

const CORNERS = { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] };

export const curlLayer = {
  order: 50,
  setup(gl) {
    prog = program(gl, VS, FS);
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  },
  active() { return runs.size > 0; },
  draw(gl, st) {
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    prog.use();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(prog.attribs.aPos);
    gl.vertexAttribPointer(prog.attribs.aPos, 2, gl.FLOAT, false, 0, 0);
    for (const r of runs) {
      const rect = r.rectFn ? r.rectFn() : { left: 0, top: 0, width: st.w, height: st.h };
      const W = rect.width, H = rect.height;
      const O = [CORNERS[r.origin][0] * W, CORNERS[r.origin][1] * H];
      // travel direction: into the rect from the origin corner, mostly horizontal like a page
      const dx = O[0] > 0 ? -1 : 1, dy = O[1] > 0 ? -1 : 1;
      let dir = [dx * r.slant[0], dy * r.slant[1]];
      const l = Math.hypot(dir[0], dir[1]); dir = [dir[0] / l, dir[1] / l];
      let S = 0;
      for (const c of [[0, 0], [W, 0], [0, H], [W, H]]) S = Math.max(S, (c[0] - O[0]) * dir[0] + (c[1] - O[1]) * dir[1]);
      const R = r.radius || clamp(Math.min(W, H) * 0.09, 18, 110);
      const L = r.p * (S + R * 1.15 + 4);
      prog.set("uRect", [rect.left, rect.top, W, H]).set("uView", [st.w, st.h]).set("uPad", r.pad || 0)
        .set("uO", O).set("uDir", dir).set("uL", L).set("uR", R)
        .set("uUseTex", r.tex ? 1 : 0).set("uShow", r.show || 0).set("uShadow", r.shadow != null ? r.shadow : 0.34)
        .set("uFront", r.front).set("uBack", r.back);
      if (r.tex) prog.set("uTex", r.tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  },
};

let registered = false;
function ensure() {
  if (!stage.ok) return false;
  if (!registered) { stage.add(curlLayer); registered = true; }
  return !curlLayer.broken;
}

/**
 * Run a curl. Resolves when done. With `hold`, the final frame stays drawn
 * (a cover waiting for navigation) until release() is called.
 *
 *   origin  corner the peel starts from: "tl" | "tr" | "bl" | "br"
 *   from/to progress, 0 = sheet flat, 1 = sheet gone
 *   rect    function returning a DOMRect-like box (default: viewport)
 *   front   hex colour, or an image/canvas to texture the sheet with
 */
export function curl(opts) {
  if (!ensure()) return null;
  const gl = stage.gl;
  const r = {
    origin: opts.origin || "br", p: opts.from != null ? opts.from : 0,
    slant: opts.slant || [1, 0.42], radius: opts.radius, pad: opts.pad || 0,
    front: rgb01(typeof opts.front === "string" ? opts.front : "#ffffff"),
    back: rgb01(opts.back || "#f1ede4"), show: opts.show || 0, shadow: opts.shadow,
    rectFn: opts.rect || null, tex: null,
  };
  if (opts.front && typeof opts.front !== "string") {
    const rect = r.rectFn ? r.rectFn() : { width: stage.w, height: stage.h };
    const src = fitCanvas(opts.front, rect.width * stage.dpr, rect.height * stage.dpr);
    r.tex = texture(gl, src, { mip: false });
  }
  runs.add(r);
  if (opts.top) stage.top(true);
  let release;
  const done = new Promise((res) => {
    gsap.to(r, {
      p: opts.to != null ? opts.to : 1, duration: opts.duration || 1.2, ease: opts.ease || "power2.inOut",
      onComplete: () => {
        release = () => { runs.delete(r); if (r.tex) gl.deleteTexture(r.tex); if (opts.top) stage.top(false); };
        if (!opts.hold) release();
        res({ release: () => release && release() });
      },
    });
  });
  return done;
}
