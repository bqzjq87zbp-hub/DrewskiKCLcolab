/* /iw-shader-surfaces: pool light on the hero.
 *
 * An exhibition by the water opens on light moving across the shallows. The
 * caustic network is the edge set of two drifting Worley (cellular) noise
 * layers: bright where a point is nearly equidistant from its two nearest
 * cell centres. The pointer drops ripples into it. It is drawn as added light
 * over the hero (wordmark included, as if painted on the pool floor), scissored
 * to the part of the hero the gallery sheet has not yet covered.
 */
import { program } from "./lib.js";
import { stage } from "./stage.js";
import { rgb01, damp, clamp } from "../util.js";
import { pointer } from "../core/cursor.js";

const VS = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

const FS = `
uniform vec2 uRes; uniform float uTime; uniform vec3 uTint; uniform float uAmt;
uniform vec2 uPtr; uniform float uRip; uniform float uRipT;
varying vec2 vUv;
vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float edge(vec2 p, float t){
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = h2(i + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
void main(){
  vec2 px = vUv * uRes;
  float sc = 1.0 / max(uRes.x, uRes.y);
  vec2 p = px * sc * 7.0;
  // ripple from the pointer
  vec2 dp = (px - uPtr) * sc * 7.0;
  float d = length(dp);
  float rip = sin(d * 9.0 - uRipT * 7.0) * exp(-d * 1.2) * uRip * 0.22;
  p += (d > 0.0 ? dp / d : vec2(0.0)) * rip;
  // slow warp so the net breathes like moving water
  p += 0.18 * vec2(sin(p.y * 1.3 + uTime * 0.4), cos(p.x * 1.1 - uTime * 0.35));
  float e1 = edge(p, uTime * 0.55);
  float e2 = edge(p * 1.7 + 3.1, -uTime * 0.42);
  float c = pow(clamp(1.0 - e1 * 4.2, 0.0, 1.0), 7.0) * 0.75 + pow(clamp(1.0 - e2 * 4.8, 0.0, 1.0), 8.0) * 0.4;
  // light falls off toward the edges, like a pool lamp under the middle of the frame
  c *= 0.55 + 0.45 * smoothstep(1.1, 0.2, length(vUv - vec2(0.5, 0.45)) * 1.6);
  vec3 col = uTint * vec3(pow(c, 0.95), pow(c, 1.05), pow(c, 1.18)) * uAmt;
  gl_FragColor = vec4(col, 0.0);
}`;

let prog = null, buf = null, box = null, gate = null, tint = [1, 0.93, 0.75], amt = 0.1;
let ripple = 0, ripT = 0, lx = 0, ly = 0;

export const causticsLayer = {
  order: 0,
  setup(gl) {
    prog = program(gl, VS, FS);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  },
  active() { return !!box && (!gate || gate()); },
  draw(gl, st, dt, t) {
    const r = box();
    if (!r || r.height < 2) return;
    if (!st.scissor(r)) return;
    const v = Math.hypot(pointer.x - lx, pointer.y - ly);
    lx = pointer.x; ly = pointer.y;
    if (v > 2) { ripple = clamp(ripple + v * 0.004, 0, 1); ripT = 0; }
    ripple = damp(ripple, 0, 1.6, dt); ripT += dt;
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    prog.use()
      .set("uRes", [st.w, st.h]).set("uTime", t).set("uTint", tint).set("uAmt", amt)
      .set("uPtr", [pointer.x, st.h - pointer.y]).set("uRip", ripple).set("uRipT", ripT);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(prog.attribs.aPos);
    gl.vertexAttribPointer(prog.attribs.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  },
};

/** `rect()` returns the visible hero box each frame; `when()` gates drawing. */
export function caustics(rect, when, opts = {}) {
  if (!stage.ok) return false;
  box = rect; gate = when;
  if (opts.tint) tint = rgb01(opts.tint);
  if (opts.amount != null) amt = opts.amount;
  stage.add(causticsLayer);
  return !causticsLayer.broken;
}
