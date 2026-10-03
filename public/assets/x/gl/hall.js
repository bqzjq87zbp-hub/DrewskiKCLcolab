/* /iw-webgl-world: walk the hall.
 *
 * A real-time gallery corridor. The issue's photographs hang on both walls
 * under pools of light; scroll flies the camera down the hall (a scroll-driven
 * 3D camera), the pointer turns the head a little, and the far wall holds the
 * cover. Floor reflections are the same plates mirrored under a fading glaze.
 *
 * Geometry is nothing but quads, lit in the fragment shader: light pools from
 * each frame's position, distance fog, a warm/cool tint from the issue.
 * Rendered only while its section is on screen, scissored to that section.
 */
import { program, texture, fitCanvas, mat4 } from "./lib.js";
import { stage } from "./stage.js";
import { rgb01, clamp, damp, lerp, smooth, mixHex } from "../util.js";
import { pointer } from "../core/cursor.js";

const VS = `
attribute vec2 aPos;
uniform mat4 uVP; uniform mat4 uM;
varying vec2 vUv; varying vec3 vW;
void main(){
  vUv = vec2(aPos.x + 0.5, 0.5 - aPos.y);
  vec4 w = uM * vec4(aPos, 0.0, 1.0);
  vW = w.xyz;
  gl_Position = uVP * w;
}`;

const FS = `
uniform sampler2D uTex; uniform float uKind; uniform vec3 uCol; uniform vec3 uFog; uniform vec3 uCam;
uniform float uGap; uniform float uZL; uniform float uZR; uniform float uZmin; uniform float uZmax; uniform float uEnd;
uniform float uAlpha;
varying vec2 vUv; varying vec3 vW;
// Frames repeat every uGap on each wall, so the nearest spot on either side is
// found with a modulo: two light evaluations per pixel instead of one per frame.
float spot(vec3 p, float lx, float z0){
  float dz = mod(p.z - z0 + uGap * 0.5, uGap) - uGap * 0.5;
  vec2 d = vec2(p.x - lx, dz);
  return exp(-dot(d, d) * 0.55) * exp(-pow(max(0.0, 3.2 - p.y), 2.0) * 0.06);
}
float pools(vec3 p){
  float inside = smoothstep(uZmin - 1.2, uZmin, p.z) * (1.0 - smoothstep(uZmax, uZmax + 1.2, p.z));
  float s = (spot(p, -2.34, uZL) + spot(p, 2.34, uZR)) * inside;
  vec2 e = vec2(p.x * 0.6, p.z - (uEnd + 1.6));
  s += exp(-dot(e, e) * 0.35) * 1.1;
  return s;
}
void main(){
  vec3 col;
  float dist = length(vW - uCam);
  float fog = exp(-dist * 0.06);
  if (uKind < 0.5) {
    float l = 0.26 + pools(vW) * 1.25;
    float grain = fract(sin(dot(floor(vW.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.03;
    col = uCol * l + grain * uCol;
  } else if (uKind < 1.5) {
    col = texture2D(uTex, vUv).rgb * (0.78 + pools(vW) * 0.45);
  } else if (uKind < 2.5) {
    vec3 t = texture2D(uTex, vUv).rgb;
    float fade = smoothstep(0.0, 1.0, vUv.y) * 0.16;
    gl_FragColor = vec4(t * fade * (0.5 + pools(vW) * 0.5) * fog * uAlpha, 0.0);
    return;
  } else {
    col = uCol * (0.45 + pools(vW) * 0.9);
  }
  col = mix(uFog, col, fog);
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}`;

const W = 6, H = 4, GAP = 3.1, PH = 1.95;
let prog, buf, cfg = null, texs = [], coverTex = null, cover = { w: 1.55, h: 2.72 }, plates = [], cam = { z: 2, yaw: 0, pitch: 0, x: 0 };
let progress = 0, visible = false, rectFn = null, alpha = 1;

function modelRXY(x, y, z, rx, ry, sx, sy) {
  const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx);
  // M = T * Ry * Rx * S
  return new Float32Array([
    cy * sx, 0, -sy_ * sx, 0,
    sy_ * sx_ * sy, cx * sy, cy * sx_ * sy, 0,
    sy_ * cx, -sx_, cy * cx, 0,
    x, y, z, 1,
  ]);
}

export const hallLayer = {
  order: 5,
  setup(gl) {
    prog = program(gl, VS, FS);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  },
  active() { return visible && !!cfg && texs.length > 0; },
  draw(gl, st, dt) {
    const r = rectFn();
    if (!st.scissor(r)) return;
    const end = -(plates.length / 2 + 1) * GAP - 2;
    const p = smooth(clamp(progress));
    cam.z = damp(cam.z, lerp(3.2, end + 4.2, p), 6, dt);
    const look = pointer.moved ? pointer.nx : 0;
    cam.yaw = damp(cam.yaw, -look * 0.22 + Math.sin(p * 9) * 0.05, 3, dt);
    cam.pitch = damp(cam.pitch, (pointer.moved ? -pointer.ny : 0) * 0.07, 3, dt);
    cam.x = damp(cam.x, Math.sin(p * 6.2) * 0.35, 2, dt);
    const eye = [cam.x, 1.62, cam.z];
    const tgt = [cam.x + Math.sin(cam.yaw) * -4, 1.62 + cam.pitch * 4, cam.z - Math.cos(cam.yaw) * 4];
    const proj = mat4.perspective(0.9, r.width / r.height, 0.05, 80);
    const VP = mat4.multiply(proj, mat4.lookAt(eye, tgt, [0, 1, 0]));

    // The section may be partly off screen: map the viewport to its rect.
    const d = st.dpr;
    gl.viewport(Math.round(r.left * d), Math.round((st.h - r.bottom) * d), Math.round(r.width * d), Math.round(r.height * d));
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    const zs = plates.map((q) => q.z);
    prog.use().set("uVP", VP).set("uFog", cfg.fog).set("uCam", eye).set("uAlpha", alpha)
      .set("uGap", GAP).set("uZL", plates[0] ? plates[0].z : 0).set("uZR", plates[1] ? plates[1].z : 0)
      .set("uZmin", Math.min(...zs)).set("uZmax", Math.max(...zs)).set("uEnd", end);

    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(prog.attribs.aPos);
    gl.vertexAttribPointer(prog.attribs.aPos, 2, gl.FLOAT, false, 0, 0);
    const quad = (M, kind, col, tex) => {
      prog.set("uM", M).set("uKind", kind);
      if (col) prog.set("uCol", col);
      if (tex) prog.set("uTex", tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const len = -end + 8, mid = end / 2 + 1;
    quad(modelRXY(0, 0, mid, -Math.PI / 2, 0, W, len), 0, cfg.floor);
    quad(modelRXY(0, H, mid, Math.PI / 2, 0, W, len), 0, cfg.ceil);
    quad(modelRXY(-W / 2, H / 2, mid, 0, Math.PI / 2, len, H), 0, cfg.wall);
    quad(modelRXY(W / 2, H / 2, mid, 0, -Math.PI / 2, len, H), 0, cfg.wall);
    quad(modelRXY(0, H / 2, end, 0, 0, W, H), 0, cfg.wall);
    quad(modelRXY(0, H / 2, 6, 0, Math.PI, W, H), 0, cfg.wall);
    // plates, mounts and reflections
    for (const q of plates) {
      if (!texs[q.i]) continue;
      const ry = q.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const wx = q.x < 0 ? -W / 2 + 0.03 : W / 2 - 0.03;
      quad(modelRXY(wx + (q.x < 0 ? -0.012 : 0.012), 1.75, q.z, 0, ry, q.pw + 0.16, q.ph + 0.16), 3, cfg.mount);
      quad(modelRXY(wx, 1.75, q.z, 0, ry, q.pw, q.ph), 1, null, texs[q.i]);
    }
    if (coverTex) {
      quad(modelRXY(0, 1.9, end + 0.03, 0, 0, cover.w + 0.18, cover.h + 0.18), 3, cfg.mount);
      quad(modelRXY(0, 1.9, end + 0.05, 0, 0, cover.w, cover.h), 1, null, coverTex);
    }
    // Reflections sit below the floor, so they would fail the depth test.
    // Drawn last, additively, with depth off: they land on the floor area.
    gl.disable(gl.DEPTH_TEST);
    for (const q of plates) {
      if (!texs[q.i]) continue;
      const ry = q.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const wx = q.x < 0 ? -W / 2 + 0.03 : W / 2 - 0.03;
      quad(modelRXY(wx, -1.75, q.z, 0, ry, q.pw, -q.ph), 2, null, texs[q.i]);
    }
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
  },
};

/**
 * Build the hall for a list of plate <img> sources and a cover.
 * Returns a controller, or null when WebGL is not available.
 */
export function hall(opts) {
  if (!stage.ok) return null;
  const gl = stage.gl;
  const base = opts.wall || "#1b1714";
  cfg = {
    wall: rgb01(base), floor: rgb01(mixHex(base, "#000000", 0.35)), ceil: rgb01(mixHex(base, "#000000", 0.55)),
    mount: rgb01(mixHex(base, "#ffffff", 0.08)), fog: rgb01(mixHex(base, "#000000", 0.6)),
  };
  rectFn = opts.rect;
  // Every frame hangs at its own proportions: portraits at full height, wide
  // ones capped in width so neighbours on the same wall never touch.
  const sizeFor = (a, h, maxW) => { const ph = Math.min(h, maxW / a); return { aspect: a, ph, pw: ph * a }; };
  plates = opts.srcs.map((src, i) => ({
    i, src, x: i % 2 ? 1 : -1, z: -Math.floor(i / 2) * GAP - (i % 2 ? GAP / 2 : 0) - 1.5,
    ...sizeFor((opts.aspects && opts.aspects[i]) || 0.5714, PH, 2.6),
  }));
  const cs = sizeFor(opts.coverAspect || 0.57, 2.72, 2.6);
  cover = { w: cs.pw, h: cs.ph };
  stage.add(hallLayer);
  let loading = false;
  return {
    load() {
      if (loading) return;
      loading = true;
      const narrow = innerWidth < 760;
      const long = narrow ? 300 : 460;
      const one = (src, a) => new Promise((res) => {
        const tw = a >= 1 ? long : Math.round(long * a), th = a >= 1 ? Math.round(long / a) : long;
        const im = new Image();
        im.onload = () => res(texture(gl, fitCanvas(im, tw, th), { mip: gl.isGL2 }));
        im.onerror = () => res(null);
        im.src = src;
      });
      opts.srcs.forEach((s, i) => one(s, plates[i].aspect).then((t) => { texs[i] = t; }));
      if (opts.cover) one(opts.cover, cover.w / cover.h).then((t) => { coverTex = t; });
    },
    set progress(v) { progress = v; },
    set visible(v) { visible = v; },
    set alpha(v) { alpha = v; },
    plateAt(p) {
      const end = -(plates.length / 2 + 1) * GAP - 2;
      const z = lerp(3.2, end + 4.2, smooth(clamp(p)));
      let best = null, bd = 1e9;
      for (const q of plates) { const dz = z - q.z; if (dz > -0.5 && dz < bd) { bd = dz; best = q; } }
      return best && bd < GAP * 1.6 ? best.i : -1;
    },
    get broken() { return !!hallLayer.broken; },
  };
}
