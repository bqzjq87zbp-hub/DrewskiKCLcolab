/* /iw-webgl-world: walk the hall.
 *
 * A bright gallery, drawn live. The issue's photographs hang down both walls
 * in thin walnut frames with white mats, each under a brass picture light
 * that pools warm light on the plaster; between them, low round plinths carry
 * ceramic vases of peonies, ranunculus and garden roses, every arrangement
 * under the foot of the prints so none ever crosses one. A skylight runs the
 * length of the ceiling, a wool runner the length of a pale oak floor, and
 * the far wall carries Kyle Kiyono's mark and name under a spotlight, flanked
 * by urns of olive branches.
 *
 * Scroll walks the camera down the hall to a reading position in front of
 * that wall and holds it there; the pointer only turns the head a little.
 * Then the wall cracks, bursts into shards that tumble away, and the camera
 * walks through it. Nothing is drawn beyond the end wall, so what shows
 * through the break is the real page, and at the end the hall is gone.
 *
 * Quads lit in the fragment shader (skylight, lamp pools, corner shade, a
 * warm haze), plus one mesh for the end wall's shards. Every texture is
 * painted on a canvas at load. Rendered only while its section is on screen,
 * scissored to that section; under calm motion it is never built.
 */
import { program, texture, fitCanvas, mat4 } from "./lib.js";
import { stage } from "./stage.js";
import { clamp, damp, lerp, smooth, mixHex, hexToRgb, rgb01, prng, loadImage } from "../util.js";
import { pointer } from "../core/cursor.js";

const W = 6, H = 4.4, GAP = 3.8;                       // hall width and height; frame spacing along one wall
const TOP = 2.9, LAMP = 3.1, LOGO = 2.28;              // the frames' top line, the lamps over it, the lettering's centre
const MAT = 0.15, MATB = 0.17, FR = 0.035, SHM = 0.14; // mat (deeper at the foot), moulding, shadow margin
const EYE = 1.62, Z0 = 3.2, READ = 4.4, FOG = 0.024;
/** The walk over scroll progress: down the hall, a pause to read the end
 *  wall, the crack, the burst, and through. */
const T = { logo: 0.72, arrive: 0.77, crack: 0.865, burst: 0.895, through: 0.975 };
const K = { wall: 0, floor: 1, ceil: 2, runner: 3, photo: 4, refl: 5, lamp: 6, sprite: 7, shadow: 8 };
const TAU = Math.PI * 2;
const f = (v) => v.toFixed(4);

// Light, shared by the room and the shards of its end wall.
const LIGHT = `
uniform vec3 uCam; uniform vec3 uHaze; uniform float uFogK; uniform float uEnd;
uniform float uGap; uniform float uZL; uniform float uZR; uniform vec2 uRunL; uniform vec2 uRunR;
const float HW = ${f(W / 2)}, HH = ${f(H)}, LAMP = ${f(LAMP)}, LOGO = ${f(LOGO)};
// Lamps repeat every uGap down each wall, so the nearest one on either side is
// found with a modulo: two evaluations per pixel instead of one per lamp.
float pool(vec3 p, float wx, float z0, vec2 run){
  float dz = mod(p.z - z0 + uGap * 0.5, uGap) - uGap * 0.5;
  float below = LAMP - p.y, fall = max(below, 0.0), spread = 0.42 + fall * 0.34;
  float on = smoothstep(run.x - 1.6, run.x - 0.9, p.z) * (1.0 - smoothstep(run.y + 0.9, run.y + 1.6, p.z));
  return exp(-dz * dz / (spread * spread)) * smoothstep(-0.12, 0.22, below) * exp(-fall * 0.6)
    * exp(-(p.x - wx) * (p.x - wx) * 3.0) * on;
}
vec3 light(vec3 p){
  float pools = pool(p, -HW, uZL, uRunL) + pool(p, HW, uZR, uRunR);
  // skylight: brighter up high and down the middle; the corners fall into soft shade
  float sky = 0.88 + 0.08 * p.y / HH + 0.05 * exp(-p.x * p.x * 0.5);
  float dw = min(HW - abs(p.x), p.z - uEnd);
  float ao = 1.0 - 0.18 * exp(-(dw + p.y) * 5.0) - 0.08 * exp(-(dw + HH - p.y) * 5.0);
  // the spotlight on the end wall's lettering
  vec2 s = vec2(p.x / 2.1, (p.y - LOGO) / 1.4);
  float spot = exp(-dot(s, s)) * (1.0 - smoothstep(0.0, 1.5, p.z - uEnd));
  return vec3(1.0, 0.985, 0.955) * sky * ao + vec3(1.0, 0.86, 0.66) * (pools * 0.32 + spot * 0.2);
}
float fogOf(vec3 p){ return exp(-length(p - uCam) * uFogK); }
vec3 haze(vec3 c, vec3 p){ return mix(uHaze, c, fogOf(p)); }
`;

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

const FS = `${LIGHT}
uniform sampler2D uTex; uniform float uKind;
uniform vec2 uSize; uniform vec2 uFrame; uniform vec2 uPhoto; uniform vec2 uPhotoC;
uniform float uRunEnd; uniform float uSkyEnd;
varying vec2 vUv; varying vec3 vW;
// A framed photograph: a thin walnut moulding, a white mat with a bevelled
// window, the print, and around it all the soft shadow the frame throws on
// the wall under its lamp. Local coordinates in metres, y up.
vec4 framed(vec2 l){
  vec2 lp = l - uPhotoC, uv = lp / (2.0 * uPhoto) + 0.5;
  // sampled before any branch: choosing a mipmap needs every pixel's neighbours
  vec3 ph = texture2D(uTex, vec2(uv.x, 1.0 - uv.y)).rgb;
  vec2 q = abs(l) - uFrame;
  if (max(q.x, q.y) > 0.0) {
    vec2 s = abs(l + vec2(0.0, 0.05)) - uFrame + 0.015;
    return vec4(0.0, 0.0, 0.0, 0.3 * exp(-length(max(s, 0.0)) * 22.0));
  }
  vec2 qi = q + ${f(FR)};
  if (max(qi.x, qi.y) > 0.0) return vec4(vec3(0.2, 0.163, 0.13) * (qi.y > qi.x ? (l.y > 0.0 ? 1.35 : 0.7) : 0.95), 1.0);
  vec2 qp = abs(lp) - uPhoto;
  if (max(qp.x, qp.y) > 0.0) {
    vec3 m = vec3(0.97, 0.962, 0.948) * (1.0 - 0.1 * exp(qi.y * 40.0) * step(0.0, l.y));
    // the window's bevel: its lower edge faces the lamp, its upper edge turns away
    if (max(qp.x, qp.y) < 0.008) m *= qp.y > qp.x ? (lp.y < 0.0 ? 1.03 : 0.8) : 0.92;
    return vec4(m, 1.0);
  }
  return vec4(ph, 1.0);
}
void main(){
  int k = int(uKind + 0.5);
  vec3 col;
  if (k == 0) {
    // side walls: one bay of panelling per frame, painted on a canvas
    col = texture2D(uTex, vec2((vW.z - (vW.x < 0.0 ? uZL : uZR)) / uGap + 0.5, 1.0 - vW.y / HH)).rgb * light(vW);
  } else if (k == 1) {
    // pale oak, with a satin sheen toward the far end
    col = texture2D(uTex, vec2(vW.x / 3.0, vW.z / 6.0)).rgb * light(vW);
    col += vec3(1.0, 0.96, 0.9) * pow(1.0 - abs(normalize(uCam - vW).y), 6.0) * 0.12;
  } else if (k == 2) {
    // plaster, and a skylight of frosted panes down the middle
    float sx = abs(vW.x);
    col = vec3(0.975, 0.958, 0.93) * light(vW);
    if (sx < 0.85 && vW.z > uSkyEnd) {
      float m = abs(mod(vW.z, 1.3) - 0.65);
      col = m > 0.6 || sx > 0.79 || sx < 0.02 ? vec3(0.84, 0.83, 0.81) : vec3(1.04, 1.03, 1.0);
    }
  } else if (k == 3) {
    // the runner; its far end takes the same border, mitred at the corners
    float u = (vW.x + 0.8) / 1.6, e = (vW.z - uRunEnd) / 1.6;
    col = texture2D(uTex, vec2(e < min(u, 1.0 - u) ? e : u, vW.z / 1.6)).rgb * light(vW);
  } else if (k == 4) {
    vec4 fr = framed(vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize);
    if (fr.a < 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, fr.a * fogOf(vW)); return; }
    col = fr.rgb * min(light(vW), vec3(1.1));
  } else if (k == 5) {
    // the same frame mirrored under the floor, fading with depth: a soft reflection
    vec4 fr = framed(vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize);
    float a = fr.a < 1.0 ? 0.0 : 0.16 * exp(vW.y * 1.5) * fogOf(vW);
    gl_FragColor = vec4(fr.rgb * 0.9 * a, a);
    return;
  } else if (k == 6) {
    // a brass picture light: the hood, its stem, the plate on the wall
    vec2 l = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize;
    float hy = -uSize.y * 0.5 + 0.04;
    float hood = length(vec2(max(abs(l.x) - uSize.x * 0.5 + 0.04, 0.0), l.y - hy)) - 0.032;
    float stem = max(abs(l.x) - 0.006, abs(l.y - 0.01) - 0.07);
    if (min(hood, min(stem, length(l - vec2(0.0, 0.078)) - 0.02)) > 0.0) discard;
    float t = (l.y - hy) / 0.032;
    col = vec3(0.74, 0.57, 0.31) * (hood < 0.0 ? 0.5 + 0.8 * smoothstep(-0.8, 0.4, t) - 0.25 * smoothstep(0.55, 1.0, t) : 0.62);
    if (hood < 0.0 && t < -0.7) col = vec3(1.0, 0.94, 0.8);
  } else if (k == 7) {
    // a painted cut-out (premultiplied), turned to face the camera
    vec4 t = texture2D(uTex, vUv);
    if (t.a < 0.02) discard;
    gl_FragColor = vec4(mix(uHaze * t.a, t.rgb * min(light(vW), vec3(1.04)), fogOf(vW)), t.a);
    return;
  } else {
    // a soft contact shadow on the floor; uSize.x is its strength
    vec2 l = (vUv - 0.5) * 2.0;
    float r2 = dot(l, l);
    gl_FragColor = vec4(0.0, 0.0, 0.0, uSize.x * exp(-r2 * 3.0) * (1.0 - smoothstep(0.6, 1.0, r2)) * fogOf(vW));
    return;
  }
  gl_FragColor = vec4(haze(col, vW), 1.0);
}`;

/* The end wall's shards. Every vertex knows where it sits in the whole wall,
 * so while nothing moves it lands exactly there and the wall is seamless.
 * Seams open outward from the impact point, then each piece flies on its own
 * clock: away from the camera and out, lifted, then pulled down, tumbling
 * about its own axis, fading. A pure function of progress, so scrolling back
 * puts the wall together again. */
const SVS = `
attribute vec2 aCorner; attribute vec2 aCenter; attribute vec3 aEdge; attribute vec4 aSeed;
uniform mat4 uVP; uniform float uEnd; uniform float uCrack; uniform float uBurst; uniform vec2 uImpact;
varying vec2 vUv; varying vec3 vW; varying vec3 vO; varying vec3 vEdge;
varying float vK; varying float vA; varying float vShade;
mat3 rot(vec3 a, float g){
  float s = sin(g), c = cos(g), o = 1.0 - c;
  return mat3(o*a.x*a.x + c, o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s,
              o*a.x*a.y - a.z*s, o*a.y*a.y + c, o*a.y*a.z + a.x*s,
              o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c);
}
void main(){
  vec3 o = vec3(aCorner, uEnd);
  vUv = vec2(aCorner.x / ${f(W)} + 0.5, 1.0 - aCorner.y / ${f(H)});
  vec2 rel = aCenter - uImpact;
  float d = length(rel);
  // the crack runs out from the impact, reaching pieces at their own moment
  float k = clamp(uCrack * 2.2 - d * 0.75 - aSeed.x * 0.4, 0.0, 1.0);
  float t = clamp(uBurst * 1.45 - d * 0.07 - aSeed.z * 0.08, 0.0, 1.0);
  vec3 w = o, n = vec3(0.0, 0.0, 1.0);
  if (k > 0.0 || t > 0.0) {
    mat3 R = rot(normalize(vec3(aSeed.x - 0.5, aSeed.y - 0.5, 0.3)), k * (aSeed.y - 0.5) * 0.2 + t * (2.0 + aSeed.y * 6.0));
    vec3 vel = vec3(rel / max(d, 0.001) * (0.6 + aSeed.x * 1.6 + d * 0.5), -(3.5 + aSeed.y * 5.5)) + vec3(0.0, 0.6 + aSeed.z, 0.0);
    // seams of about the same width on every piece, whatever its size: dark
    // hairlines at first, opening onto the light only as the wall is about to
    // go; the middle gives a little first, as if pushed
    float shrink = 1.0 - min(smoothstep(0.5, 1.0, k) * 0.007 / max(aSeed.w, 0.004), 0.4);
    float dent = k * (0.015 + 0.08 * exp(-d * 1.5));
    w = vec3(aCenter, uEnd - dent) + R * vec3((aCorner - aCenter) * shrink, 0.0) + vel * t + vec3(0.0, -2.6 * t * t, 0.0);
    n = R * n;
  }
  vW = w; vO = o; vEdge = aEdge; vK = k;
  vA = 1.0 - smoothstep(0.45, 0.95, t);
  // lit from above and in front: a piece that tilts or turns (either face) catches more or less of it
  vShade = 0.72 + 0.28 * abs(dot(n, vec3(0.0, 0.447, 0.894))) / 0.894;
  gl_Position = uVP * vec4(w, 1.0);
}`;

const SFS = `${LIGHT}
uniform sampler2D uTex;
varying vec2 vUv; varying vec3 vW; varying vec3 vO; varying vec3 vEdge;
varying float vK; varying float vA; varying float vShade;
void main(){
  // the face of the wall, or the plaster inside a piece turned over
  vec3 c = gl_FrontFacing ? texture2D(uTex, vUv).rgb : vec3(0.84, 0.8, 0.74);
  // a piece's broken outline darkens as its seams open, so they read as cracks, not lines
  float e = min(vEdge.x, min(vEdge.y, vEdge.z));
  c *= 1.0 - min(vK * 2.0, 1.0) * 0.6 * (1.0 - smoothstep(0.0, 0.009, e));
  gl_FragColor = vec4(haze(c * light(vO) * vShade, vW) * vA, vA);
}`;
const SHARD_ATTRS = [["aCorner", 2, 0], ["aCenter", 2, 8], ["aEdge", 3, 16], ["aSeed", 4, 28]];

let G = null, prog, sprog, quadBuf, shardBuf;
let L = null;                            // the built hall: layout, matrices, textures
let progress = 0, pv = -1, visible = false, rectFn = null;
const cam = { yaw: 0, pitch: 0 };
const P = new Float32Array(16), V = new Float32Array(16), VP = new Float32Array(16), M = new Float32Array(16);
const eye = [0, EYE, Z0], tgt = [0, EYE, 0], UP = [0, 1, 0];

/** M = T * Ry * Rx * S, written into `o`: a unit quad placed in the room. */
function place(o, x, y, z, rx, ry, sx, sy) {
  const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx);
  o[0] = cy * sx; o[1] = 0; o[2] = -sy_ * sx; o[3] = 0;
  o[4] = sy_ * sx_ * sy; o[5] = cx * sy; o[6] = cy * sx_ * sy; o[7] = 0;
  o[8] = sy_ * cx; o[9] = -sx_; o[10] = cy * cx; o[11] = 0;
  o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
  return o;
}
const placed = (...a) => place(new Float32Array(16), ...a);
/** The soft contact shadow under a piece of decor, from its foot [w, d, strength]. */
const shadowOf = (s) => { s.shM = placed(s.x, 0.003, s.z, -Math.PI / 2, 0, s.foot[0], s.foot[1]); s.shade = [s.foot[2], 0]; };

/** Where the camera stands at progress p: down the hall to `read` metres from
 *  the end wall, a slight lean in while it reads, then on through the wall. */
function camZ(p, end, read) {
  const zr = end + read;
  if (p < T.arrive) return lerp(Z0, zr, smooth(p / T.arrive));
  if (p < T.burst) return zr - 0.2 * smooth((p - T.arrive) / (T.burst - T.arrive));
  return lerp(zr - 0.2, end - 2.4, smooth(clamp((p - T.burst) / (T.through - T.burst))));
}

function quad(m, kind, tex) {
  prog.set("uM", m).set("uKind", kind);
  if (tex) prog.set("uTex", tex);
  G.drawArrays(G.TRIANGLE_STRIP, 0, 4);
}
function framed(q, m, kind) {
  prog.set("uSize", q.size).set("uFrame", q.frame).set("uPhoto", q.photo).set("uPhotoC", q.photoC);
  quad(m, kind, L.texs[q.i]);
}
function bindQuad(gl) {
  prog.use();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(prog.attribs.aPos);
  gl.vertexAttribPointer(prog.attribs.aPos, 2, gl.FLOAT, false, 0, 0);
}
function drawShards(gl, tex) {
  sprog.use().set("uVP", VP).set("uCam", eye).set("uTex", tex)
    .set("uCrack", smooth(clamp((pv - T.crack) / (T.burst - T.crack))))
    .set("uBurst", clamp((pv - T.burst) / (T.through - T.burst)));
  gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf);
  for (let i = 0; i < 4; i++) {
    const a = SHARD_ATTRS[i], loc = sprog.attribs[a[0]];
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, a[1], gl.FLOAT, false, 44, a[2]);
  }
  gl.drawArrays(gl.TRIANGLES, 0, L.shards);
  for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(sprog.attribs[SHARD_ATTRS[i][0]]);
}

export const hallLayer = {
  order: 5,
  setup(gl) {
    G = gl;
    prog = program(gl, VS, FS);
    sprog = program(gl, SVS, SFS);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    shardBuf = gl.createBuffer();
  },
  // at rest once the camera is through the end wall: nothing of the hall is left to draw
  active() { return visible && !!L && L.texs.length > 0 && !(progress > 0.995 && pv > 0.995); },
  draw(gl, st, dt) {
    const r = rectFn();
    if (!st.scissor(r)) return;
    pv = pv < 0 || Math.abs(progress - pv) > 0.25 ? progress : damp(pv, progress, 7, dt);
    const aspect = r.width / r.height;
    // a portrait screen keeps a fair width of view, and reads the end wall from where its lettering fits
    const fovy = Math.max(0.9, 2 * Math.atan(Math.tan(0.42) / aspect));
    const read = Math.max(READ, 1.75 / (Math.tan(fovy / 2) * aspect));
    const z = camZ(pv, L.end, read);
    const at = smooth(clamp((pv - 0.5) / (T.arrive - 0.5)));   // 0 walking, 1 reading the end wall
    // no sway and no weave from the scroll: the head turns a little toward the pointer, the photographs never tilt
    const look = 1 - 0.6 * at;
    cam.yaw = damp(cam.yaw, -pointer.nx * 0.12 * look, 3, dt);
    cam.pitch = damp(cam.pitch, -pointer.ny * 0.04 * look, 3, dt);
    const x = Math.sin(pv * 5) * 0.05 * (1 - at);
    eye[0] = x; eye[2] = z;
    tgt[0] = x - Math.sin(cam.yaw) * 4;
    tgt[1] = EYE + ((LOGO - EYE) * at * 4) / read + cam.pitch * 4;
    tgt[2] = z - Math.cos(cam.yaw) * 4;
    mat4.multiply(mat4.perspective(fovy, aspect, 0.05, 120, P), mat4.lookAt(eye, tgt, UP, V), VP);

    // The section may be partly off screen: map the viewport to its rect.
    const d = st.dpr, tx = L.tex, near = z + 0.4;    // anything wholly behind the eye is skipped
    gl.viewport(Math.round(r.left * d), Math.round((st.h - r.bottom) * d), Math.round(r.width * d), Math.round(r.height * d));
    bindQuad(gl);
    prog.set("uVP", VP).set("uCam", eye);

    // On the floor, laid in order with no depth: oak, runner, reflections, contact shadows.
    gl.disable(gl.DEPTH_TEST);
    if (tx.floor) quad(L.floorM, K.floor, tx.floor);
    if (tx.runner) quad(L.runM, K.runner, tx.runner);
    for (const q of L.plates) if (L.texs[q.i] && q.zf < near) framed(q, q.reflM, K.refl);
    for (const s of L.decor) if (tx[s.key] && s.z - 0.5 < near) { prog.set("uSize", s.shade); quad(s.shM, K.shadow); }
    // The room, with depth: walls, ceiling, the frames and their lamps.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    if (tx.wall) { quad(L.wallLM, K.wall, tx.wall); quad(L.wallRM, K.wall, tx.wall); }
    quad(L.ceilM, K.ceil);
    for (const q of L.plates) if (L.texs[q.i] && q.zf < near) {
      framed(q, q.M, K.photo);
      prog.set("uSize", q.lampSize);
      quad(q.lampM, K.lamp);
    }
    // The end wall: whole until it gives. Then decor, far to near, so soft edges blend over what is behind.
    gl.depthMask(false);
    if (tx.end) { drawShards(gl, tx.end); bindQuad(gl); }
    for (const s of L.decor) {
      const t = tx[s.key];
      if (!t || s.z - 0.5 > near) continue;
      quad(place(M, s.x, s.h / 2, s.z, 0, Math.atan2(eye[0] - s.x, eye[2] - s.z), s.w, s.h), K.sprite, t);
    }
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
  },
};

/**
 * Build the hall for a list of plate <img> sources.
 * Returns a controller, or null when WebGL is not available.
 */
export function hall(opts) {
  if (!stage.ok) return null;
  const gl = stage.gl;
  stage.add(hallLayer);
  if (hallLayer.broken) return null;
  const tone = opts.tone || "#f2ece4", wall = mixHex(tone, "#fffdf9", 0.5);
  rectFn = opts.rect;
  // Every frame hangs from one top line at its own proportions: portraits at
  // full height, wide ones capped in width so a plinth still fits between.
  const plates = opts.srcs.map((src, i) => {
    const a = (opts.aspects && opts.aspects[i]) || 0.5714;
    const ph = Math.min(1.4, 2 / a), pw = ph * a, fw = pw + 2 * (MAT + FR), fh = ph + MAT + MATB + 2 * FR;
    const side = i % 2 ? 1 : -1, z = -1.5 - Math.floor(i / 2) * GAP - (i % 2 ? GAP / 2 : 0);
    const x = side * (W / 2 - 0.012), yc = TOP - fh / 2, ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const qw = fw + 2 * SHM, qh = fh + 2 * SHM, hw = clamp(fw * 0.55, 0.45, 1);
    return {
      i, src, a, side, z, zf: z - fw / 2 - SHM,
      size: [qw, qh], frame: [fw / 2, fh / 2], photo: [pw / 2, ph / 2], photoC: [0, (MATB - MAT) / 2], lampSize: [hw, 0.2],
      M: placed(x, yc, z, 0, ry, qw, qh), reflM: placed(x, -yc, z, 0, ry, qw, -qh),
      lampM: placed(side * (W / 2 - 0.17), LAMP + 0.06, z, 0, ry, hw, 0.2),
    };
  });
  const left = plates.filter((q) => q.side < 0), right = plates.filter((q) => q.side > 0);
  const end = Math.min(...plates.map((q) => q.z)) - 3;
  const run = (row) => (row.length ? [row[row.length - 1].z, row[0].z] : [9, 9]);
  // a plinth of flowers ahead of each wall's first frame and between every
  // pair after it, and a pair of urns of olive branches flanking the end wall
  const decor = [], rnd = prng("hall");
  for (const row of [left, right]) row.forEach((q, k) => decor.push({
    key: "plinth" + ((k + (q.side > 0 ? 1 : 0)) % 3), x: q.side * (W / 2 - 0.42),
    z: k ? (q.z + row[k - 1].z) / 2 : q.z + GAP / 2, w: rnd() < 0.5 ? -1.2 : 1.2, h: 2.4, foot: [0.62, 0.62, 0.42],
  }));
  for (const s of [-1, 1]) decor.push({ key: "urn", x: s * 2.15, z: end + 0.8, w: 3.2 * s, h: 3.2, foot: [0.8, 0.8, 0.45] });
  for (const s of decor) shadowOf(s);
  decor.sort((a, b) => a.z - b.z);
  // the foot of the lowest frame. From the eye, anything nearer than a frame
  // and lower than its foot is drawn below it, so an arrangement that stays
  // under this line never crosses a print, at any distance down the hall
  const sill = TOP - 2 * Math.max(...plates.map((q) => q.frame[1]));

  const mid = (6 + end) / 2, len = 6 - end, runEnd = end + 1.7;
  L = {
    end, plates, decor, texs: [], tex: {},
    floorM: placed(0, 0, mid, -Math.PI / 2, 0, W, len),
    ceilM: placed(0, H, mid, Math.PI / 2, 0, W, len),
    wallLM: placed(-W / 2, H / 2, mid, 0, Math.PI / 2, len, H),
    wallRM: placed(W / 2, H / 2, mid, 0, -Math.PI / 2, len, H),
    runM: placed(0, 0.004, (5 + runEnd) / 2, -Math.PI / 2, 0, 1.6, 5 - runEnd),
  };
  const mesh = shardMesh(0, LOGO, prng("wall"));
  gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  L.shards = mesh.length / 11;
  const haze = rgb01(mixHex(tone, "#ffffff", 0.25));
  for (const pr of [prog, sprog]) {
    pr.use().set("uHaze", haze).set("uFogK", FOG).set("uEnd", end).set("uGap", GAP)
      .set("uZL", -1.5).set("uZR", -1.5 - GAP / 2).set("uRunL", run(left)).set("uRunR", run(right));
  }
  prog.use().set("uRunEnd", runEnd).set("uSkyEnd", end + 0.8);
  sprog.use().set("uImpact", [0, LOGO]);

  let loading = false;
  return {
    T,
    load() {
      if (loading) return;
      loading = true;
      const narrow = innerWidth < 760, k = narrow ? 0.5 : 1, endW = narrow ? 1024 : stage.dpr > 1.5 ? 2560 : 2048;
      const up = (c, o) => texture(gl, c, o);
      // one surface per task, so no single frame stalls on the painting
      const jobs = [
        () => { L.tex.wall = up(paintWall(1024 * k, 2048 * k, wall), { repeat: true, aniso: true }); },
        () => { L.tex.floor = up(paintFloor(1024 * k, 2048 * k, prng("oak")), { repeat: true, aniso: true }); },
        () => { L.tex.runner = up(paintRunner(512 * k, 512 * k, opts.accent || "#b5502f"), { repeat: true, aniso: true }); },
        () => { if (!L.tex.end) L.tex.end = up(paintEnd(null, endW, wall)); },
        ...[0, 1, 2].map((v) => () => {
          const c = paintPlinth(v, 512 * k / 1.2), f = Math.min(1, (sill - 0.05) / peak(c, 2.4));
          for (const s of decor) if (s.key === "plinth" + v) { s.w *= f; s.h *= f; s.foot[0] *= f; s.foot[1] *= f; shadowOf(s); }
          L.tex["plinth" + v] = up(c, { premul: true });
        }),
        () => { L.tex.urn = up(paintUrn(1024 * k / 3.2), { premul: true }); },
      ];
      const next = () => { const j = jobs.shift(); if (j) { j(); setTimeout(next, 30); } };
      next();
      // the lettering waits for the logo and the display face
      Promise.all([loadImage(opts.logo), document.fonts.load("300 100px Fraunces").then(() => document.fonts.ready)])
        .then(([img]) => { const old = L.tex.end; L.tex.end = up(paintEnd(img, endW, wall)); if (old) gl.deleteTexture(old); })
        .catch(() => {});
      const long = narrow ? 320 : 560;
      for (const q of plates) {
        const im = new Image();
        im.onload = () => { L.texs[q.i] = up(fitCanvas(im, q.a >= 1 ? long : long * q.a, q.a >= 1 ? long / q.a : long), { mip: gl.isGL2, aniso: true }); };
        im.src = q.src;
      }
    },
    set progress(v) { progress = v; },
    set visible(v) { visible = v; },
    phaseAt: (p) => (p < T.logo ? "walk" : p < T.crack ? "logo" : p < T.through ? "break" : "through"),
    /** The plate the camera is walking up to at progress p, or -1. */
    plateAt(p) {
      if (p >= T.logo) return -1;
      const z = camZ(p, end, READ);
      let best = -1, bd = 1e9;
      for (const q of plates) { const dz = z - q.z; if (dz > -0.5 && dz < bd) { bd = dz; best = q.i; } }
      return bd < GAP * 1.6 ? best : -1;
    },
  };
}

/** The end wall as a mesh of shards: rays from the impact point to the wall's
 *  edge (four of them through its corners, so the pieces tile the wall
 *  exactly), cut by rings. A shard is a cell or a few neighbouring cells as
 *  triangles that move as one, so only its outline cracks. A vertex carries
 *  its corner, its shard's centre, its distance to each edge of its triangle
 *  (edges inside the shard pushed far away, so they never darken), three
 *  random numbers and the shard's size. */
function shardMesh(ix, iy, r) {
  const x0 = -W / 2, x1 = W / 2, out = [];
  const reach = (a) => {
    const dx = Math.cos(a), dy = Math.sin(a);
    return Math.min(dx > 1e-6 ? (x1 - ix) / dx : dx < -1e-6 ? (x0 - ix) / dx : 1e9, dy > 1e-6 ? (H - iy) / dy : dy < -1e-6 ? -iy / dy : 1e9);
  };
  const corners = [[x1, H], [x0, H], [x0, 0], [x1, 0]].map(([x, y]) => (Math.atan2(y - iy, x - ix) + TAU) % TAU).sort((a, b) => a - b);
  const rays = [];
  corners.forEach((a, k) => {
    const b = k < 3 ? corners[k + 1] : corners[0] + TAU, n = Math.max(1, Math.round(((b - a) / TAU) * 20));
    for (let j = 0; j < n; j++) rays.push(a + ((b - a) * j) / n);
  });
  // rings and rays both wander, so the cracks run jagged instead of drawing a web
  const n = rays.length, RINGS = [0.13, 0.28, 0.45, 0.64, 0.83, 1];
  const pts = RINGS.map((fr, k) => rays.map((a, j) => {
    if (k === RINGS.length - 1) return [ix + Math.cos(a) * reach(a), iy + Math.sin(a) * reach(a)];
    const aa = a + (r() - 0.5) * ((j < n - 1 ? rays[j + 1] : rays[0] + TAU) - a) * 0.7, dd = reach(aa) * (fr + (r() - 0.5) * 0.09);
    return [ix + Math.cos(aa) * dd, iy + Math.sin(aa) * dd];
  }));
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const piece = (tris) => {
    // an edge two of the piece's triangles share is inside it
    const inner = tris.map((t) => [0, 1, 2].map((i) => tris.some((u) => u !== t && u.includes(t[(i + 1) % 3]) && u.includes(t[(i + 2) % 3]))));
    let area = 0, per = 0, cx = 0, cy = 0;
    tris.forEach((t, k) => {
      const A = Math.abs(cross(...t)) / 2;
      area += A; cx += (A * (t[0][0] + t[1][0] + t[2][0])) / 3; cy += (A * (t[0][1] + t[1][1] + t[2][1])) / 3;
      for (let i = 0; i < 3; i++) if (!inner[k][i]) per += len(t[(i + 1) % 3], t[(i + 2) % 3]);
    });
    const s0 = r(), s1 = r(), s2 = r();
    tris.forEach((t, k) => {
      let v = t, f = inner[k];
      if (cross(...v) < 0) { v = [t[0], t[2], t[1]]; f = [f[0], f[2], f[1]]; }   // counter-clockwise: the face the camera sees
      const A2 = cross(...v);
      v.forEach((p, i) => out.push(p[0], p[1], cx / area, cy / area,
        ...[0, 1, 2].map((j) => (f[j] ? 9 : 0) + (i === j ? A2 / len(v[(j + 1) % 3], v[(j + 2) % 3]) : 0)), s0, s1, s2, (2 * area) / per));
    });
  };
  // cells: the fan round the impact in pairs, then each ring's quads, some
  // run together with the next so the pieces come in uneven sizes
  const C = [ix, iy];
  for (let j = 0; j < n; j += 2) piece(j + 1 < n ? [[C, pts[0][j], pts[0][j + 1]], [C, pts[0][j + 1], pts[0][(j + 2) % n]]] : [[C, pts[0][j], pts[0][0]]]);
  for (let k = 0; k < RINGS.length - 1; k++) {
    let group = [];
    for (let j = 0; j < n; j++) {
      const a = pts[k][j], b = pts[k][(j + 1) % n], c = pts[k + 1][(j + 1) % n], d = pts[k + 1][j];
      group.push(...(r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]));
      if (j === n - 1 || group.length >= 4 || r() < 0.55) { piece(group); group = []; }
    }
  }
  return new Float32Array(out);
}

/* ─── paint ───────────────────────────────────────────────────────────────
 * Every surface is painted once, at load: plaster and its mouldings, oak,
 * wool, the end wall's lettering, the flowers. Soft gradients and layered
 * strokes, so nothing reads as a flat fill even up close. Painters that set
 * up a transform work in metres, y up from the floor. */
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; };
/** How high a cut-out h metres tall reaches, in metres: its first row with any paint in it. */
function peak(c, h) {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let i = 3;
  while (i < d.length && d[i] < 8) i += 4;
  return h * (1 - Math.floor(i / 4 / c.width) / c.height);
}
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const sh = (a) => `rgba(70,52,36,${a})`;       // the warm shadow every moulding throws

/** Skirting, chair rail and cornice: the mouldings every wall shares. The
 *  light comes from above, so their tops catch it and undersides throw shadow. */
function mouldings(g, x0, x1, wall) {
  const trim = mixHex(wall, "#ffffff", 0.45), w = x1 - x0;
  const band = (y0, y1, s) => { g.fillStyle = s; g.fillRect(x0, y0, w, y1 - y0); };
  const fade = (y0, y1, a0, a1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, sh(a0)); gr.addColorStop(1, sh(a1)); band(y0, y1, gr); };
  // skirting: a painted board with a small ogee along its top, a dark line at the floor
  band(0, 0.17, trim);
  fade(0, 0.025, 0.3, 0);
  fade(0.12, 0.15, 0, 0.12);
  band(0.15, 0.168, mixHex(trim, "#ffffff", 0.6));
  fade(0.168, 0.2, 0.1, 0);
  // the chair rail, throwing a little shadow down the wall
  fade(0.74, 0.8, 0, 0.13);
  band(0.8, 0.862, trim);
  fade(0.8, 0.815, 0.12, 0);
  band(0.85, 0.862, "#ffffff");
  // the cornice: its shadow, the bed moulding, dentils, a fillet, the cove, the top
  const c0 = H - 0.36, n = Math.round(w / 0.085), p = w / n;
  fade(c0 - 0.08, c0, 0, 0.15);
  band(c0, H, trim);
  fade(c0, c0 + 0.03, 0.14, 0.04);
  band(c0 + 0.03, c0 + 0.1, sh(0.16));
  for (let i = 0; i < n; i++) {
    g.fillStyle = mixHex(trim, "#ffffff", 0.3); g.fillRect(x0 + (i + 0.2) * p, c0 + 0.04, p * 0.6, 0.06);
    g.fillStyle = sh(0.12); g.fillRect(x0 + (i + 0.2) * p, c0 + 0.04, p * 0.6, 0.008);
  }
  band(c0 + 0.1, c0 + 0.115, "#ffffff");
  const cove = g.createLinearGradient(0, c0 + 0.115, 0, H - 0.07);
  cove.addColorStop(0, mixHex(trim, "#8a7a68", 0.2));
  cove.addColorStop(1, mixHex(trim, "#ffffff", 0.4));
  band(c0 + 0.115, H - 0.07, cove);
  band(H - 0.078, H - 0.07, sh(0.16));
}

/** A raised panel moulding: the shadow it throws, the bead, lit top edges. */
function panel(g, x0, y0, x1, y1, wall) {
  const line = (y, s) => { g.strokeStyle = s; g.beginPath(); g.moveTo(x0 - 0.012, y); g.lineTo(x1 + 0.012, y); g.stroke(); };
  g.lineWidth = 0.032;
  g.strokeStyle = sh(0.1); g.strokeRect(x0, y0 - 0.014, x1 - x0, y1 - y0);
  g.strokeStyle = mixHex(wall, "#ffffff", 0.4); g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.lineWidth = 0.006;
  for (const y of [y0, y1]) { line(y + 0.012, "rgba(255,255,255,.8)"); line(y - 0.013, sh(0.16)); }
}

/** One bay of a side wall, a frame's width, tiling along the hall: wainscot
 *  panels under the frame (the middle) and under each plinth (the edges). */
function paintWall(cw, ch, wall) {
  const c = canvas(cw, ch), g = c.getContext("2d");
  g.fillStyle = wall; g.fillRect(0, 0, cw, ch);
  g.setTransform(cw / GAP, 0, 0, -ch / H, 0, ch);
  mouldings(g, 0, GAP, wall);
  for (const x of [0, GAP / 2, GAP]) panel(g, x - 0.8, 0.27, x + 0.8, 0.7, wall);
  return c;
}

/** Pale oak boards running down the hall, 3 by 6 metres, tiling both ways. */
function paintFloor(cw, ch, r) {
  const c = canvas(cw, ch), g = c.getContext("2d"), N = 16, bw = cw / N, px = cw / 1024;
  const tones = ["#dcc7a4", "#d5be9a", "#e1ceae", "#d9c29e", "#dfc9a6", "#d2ba95"];
  for (let i = 0; i < N; i++) {
    // exactly one period of joints per column, wrapped, so the tile has no seam
    let y = -r() * ch * 0.5;
    const stop = y + ch;
    while (y < stop - 1) {
      const len = Math.min(ch * (0.2 + r() * 0.3), stop - y), tone = tones[(r() * tones.length) | 0], seed = (r() * 1e9) | 0;
      board(g, i * bw, y, bw, len, tone, prng(seed), px);
      if (y < 0) board(g, i * bw, y + ch, bw, len, tone, prng(seed), px);
      y += len;
    }
  }
  return c;
}

function board(g, x, y, w, len, tone, r, px) {
  g.save();
  g.beginPath(); g.rect(x, y, w, len); g.clip();
  g.fillStyle = tone; g.fillRect(x, y, w, len);
  const gr = g.createLinearGradient(0, y, 0, y + len);
  gr.addColorStop(0, `rgba(255,248,232,${(r() * 0.14).toFixed(3)})`);
  gr.addColorStop(0.5, `rgba(120,86,50,${(r() * 0.08).toFixed(3)})`);
  gr.addColorStop(1, `rgba(255,248,232,${(r() * 0.12).toFixed(3)})`);
  g.fillStyle = gr; g.fillRect(x, y, w, len);
  // the figure: fine wavering streaks along the board
  for (let k = 0; k < 12; k++) {
    const gx = x + r() * w, amp = (1 + r() * 3) * px, ph = r() * 6;
    g.strokeStyle = r() < 0.7 ? `rgba(122,86,48,${(0.05 + r() * 0.08).toFixed(3)})` : `rgba(255,246,228,${(0.06 + r() * 0.08).toFixed(3)})`;
    g.lineWidth = (0.6 + r() * 1.4) * px;
    g.beginPath(); g.moveTo(gx, y);
    for (let s = 1; s <= 7; s++) g.lineTo(gx + Math.sin(ph + s * 1.1) * amp, y + (len * s) / 7);
    g.stroke();
  }
  // the joints: a hairline down one long edge and across the end, the other edge lit
  g.fillStyle = "rgba(84,58,32,.4)"; g.fillRect(x, y, 1.3 * px, len); g.fillRect(x, y, w, 1.3 * px);
  g.fillStyle = "rgba(255,248,236,.2)"; g.fillRect(x + w - px, y, px, len);
  g.restore();
}

/** A wool runner 1.6 metres across: an oatmeal field inside a border in the
 *  issue's accent, quietened toward taupe. */
function paintRunner(cw, ch, accent) {
  const c = canvas(cw, ch), g = c.getContext("2d"), m = cw / 1.6, border = mixHex(accent, "#6f6152", 0.6);
  g.fillStyle = "#d6ccbb"; g.fillRect(0, 0, cw, ch);
  for (const side of [0, 1]) {
    const at = (d, wd, col) => { g.fillStyle = col; g.fillRect(side ? cw - (d + wd) * m : d * m, 0, wd * m, ch); };
    at(0, 0.014, "#5c4f43");
    at(0.014, 0.07, border);
    at(0.12, 0.014, border);
  }
  // the weave: faint rows across
  for (let y = 0; y < ch; y += 2) { g.fillStyle = y % 4 ? "rgba(255,250,240,.06)" : "rgba(90,70,50,.06)"; g.fillRect(0, y, cw, 1); }
  return c;
}

/** The end wall: the same mouldings, a doubled frame, and inside it Kyle
 *  Kiyono's mark recoloured to ink over his name in the display face. The
 *  letters stand a little off the plaster, so they throw a soft shadow. */
function paintEnd(img, cw, wall) {
  const s = cw / W, ch = Math.round(H * s), c = canvas(cw, ch), g = c.getContext("2d");
  g.fillStyle = wall; g.fillRect(0, 0, cw, ch);
  g.setTransform(s, 0, 0, -s, cw / 2, ch);
  mouldings(g, -W / 2, W / 2, wall);
  for (const x of [-2, 0, 2]) panel(g, x - 0.78, 0.27, x + 0.78, 0.7, wall);
  panel(g, -2.25, 1.0, 2.25, 3.62, wall);
  panel(g, -2.12, 1.12, 2.12, 3.5, wall);
  if (!img) return c;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const X = (x) => (x + W / 2) * s, Y = (y) => (H - y) * s, ink = "#211b16";
  g.shadowColor = "rgba(48,34,20,.3)"; g.shadowBlur = 0.022 * s; g.shadowOffsetY = 0.016 * s;
  const lh = 0.98, lw = (lh * img.naturalWidth) / img.naturalHeight;
  const m = canvas(lw * s, lh * s), mg = m.getContext("2d");
  mg.drawImage(img, 0, 0, m.width, m.height);
  mg.globalCompositeOperation = "source-in";
  mg.fillStyle = ink; mg.fillRect(0, 0, m.width, m.height);
  g.drawImage(m, X(-lw / 2), Y(3.2));
  const name = "Kyle Kiyono", face = (px) => `300 ${px}px Fraunces, Georgia, serif`;
  g.font = face(100);
  g.font = face(((100 * 2.7 * s) / g.measureText(name).width).toFixed(1));
  g.textAlign = "center"; g.fillStyle = ink;
  g.fillText(name, X(0), Y(1.5));
  return c;
}

/* The decor: round plinths (round, so a cut-out turned to the camera stays
 * true from any side), thrown vases and arrangements, and the urns. */
// deep, shade, base, light
const PAL = {
  blush: ["#c4878a", "#dfa7a5", "#f2cbc5", "#fdeee9"],
  ivory: ["#c9b391", "#e5d5bb", "#f5ede0", "#fffbf3"],
  coral: ["#b4503f", "#d9735a", "#f09a7e", "#ffd5c2"],
  peach: ["#c98a66", "#e5aa86", "#f5c9aa", "#fde8d6"],
};
const LEAF = ["#4a6043", "#9db48f"], EUC = ["#8fa59d", "#c2d0ca"], OLIVE = ["#66744f", "#8c9873"], OLIVE_U = ["#a3ad94", "#c6ccb8"];
// low plinths, so the flowers sit under the prints rather than across them
const PLINTHS = [
  { // a porcelain ginger jar: blush peonies, ivory roses, coral ranunculus, eucalyptus
    top: 0.46, stone: "#ece6dc",
    vase: { h: 0.42, R: 0.15, col: "#efebe5", gloss: 1, r: [[0, 0.5], [0.06, 0.56], [0.3, 1], [0.55, 0.97], [0.78, 0.62], [0.88, 0.45], [0.96, 0.47], [1, 0.52]] },
    dome: [0.32, 0.19, 0.2], trail: 1, greens: [["leaf", 8], ["euc", 4]],
    blooms: [["peony", "blush", 4, 0.085, 0.1], ["rose", "ivory", 3, 0.06, 0.07], ["ranunculus", "coral", 2, 0.045, 0.055], ["bud", "blush", 2, 0.026, 0.032]],
  },
  { // a celadon bottle: peach roses and coral ranunculus on long stems, airy greens
    top: 0.42, stone: "#efece6",
    vase: { h: 0.52, R: 0.115, col: "#a9bdae", gloss: 0.9, r: [[0, 0.55], [0.05, 0.6], [0.28, 1], [0.5, 0.84], [0.7, 0.4], [0.9, 0.34], [1, 0.46]] },
    dome: [0.26, 0.24, 0.26], trail: 0, greens: [["leaf", 7], ["euc", 3]],
    blooms: [["rose", "peach", 3, 0.06, 0.068], ["ranunculus", "coral", 3, 0.045, 0.052], ["peony", "blush", 1, 0.08, 0.085], ["bud", "peach", 2, 0.025, 0.03]],
  },
  { // a stoneware footed bowl: a low dome of ivory and blush peonies, ranunculus and roses
    top: 0.5, stone: "#e6ddcf",
    vase: { h: 0.24, R: 0.21, col: "#d4c2a8", gloss: 0.3, r: [[0, 0.38], [0.12, 0.4], [0.22, 0.3], [0.32, 0.32], [0.5, 0.72], [0.8, 0.96], [1, 1]] },
    dome: [0.38, 0.13, 0.1], trail: 2, greens: [["leaf", 9], ["euc", 3]],
    blooms: [["peony", "ivory", 2, 0.095, 0.11], ["peony", "blush", 2, 0.09, 0.1], ["ranunculus", "blush", 2, 0.048, 0.055], ["ranunculus", "coral", 1, 0.048, 0.052], ["rose", "ivory", 2, 0.062, 0.07]],
  },
];
const E = 0.16;        // a round edge seen from a little above: its ellipse's height over its width

/** Shading across a lit cylinder: dark edges, a soft highlight left of centre. */
function cyl(g, r, col, gloss) {
  const gr = g.createLinearGradient(-r, 0, r, 0), dk = "#4a3a2c";
  gr.addColorStop(0, mixHex(col, dk, 0.32));
  gr.addColorStop(0.2, mixHex(col, dk, 0.06));
  gr.addColorStop(0.36, mixHex(col, "#ffffff", 0.2 + 0.2 * gloss));
  gr.addColorStop(0.62, col);
  gr.addColorStop(1, mixHex(col, dk, 0.4));
  return gr;
}

/** One drum of a round pedestal, from y0 up to y1, its front edges curved. */
function drum(g, y0, y1, r, col) {
  g.fillStyle = cyl(g, r, col, 0.4);
  g.beginPath();
  g.moveTo(-r, y1);
  g.lineTo(-r, y0);
  g.ellipse(0, y0, r, r * E, 0, Math.PI, TAU);
  g.lineTo(r, y1);
  g.ellipse(0, y1, r, r * E, 0, 0, Math.PI, true);
  g.fill();
}

function pedestal(g, top, r, col, rnd) {
  for (const [y0, y1, k] of [[0, 0.06, 1.22], [0.06, 0.085, 1.1], [0.085, top - 0.07, 1], [top - 0.07, top - 0.05, 1.07], [top - 0.05, top, 1.2]]) drum(g, y0, y1, r * k, col);
  // veins in the stone, held to the shaft
  g.save();
  g.beginPath(); g.rect(-r, 0.09, 2 * r, top - 0.17); g.clip();
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(128,114,100,${(0.06 + rnd() * 0.08).toFixed(3)})`; g.lineWidth = 0.002 + rnd() * 0.004;
    let x = (rnd() - 0.5) * 2 * r, y = 0.09;
    g.beginPath(); g.moveTo(x, y);
    while (y < top) { x += (rnd() - 0.5) * 0.09; y += 0.06 + rnd() * 0.1; g.lineTo(x, y); }
    g.stroke();
  }
  g.restore();
  // the top face, lit from above
  const R = r * 1.2, gr = g.createRadialGradient(-R * 0.2, top, 0, 0, top, R);
  gr.addColorStop(0, mixHex(col, "#ffffff", 0.55)); gr.addColorStop(1, mixHex(col, "#ffffff", 0.15));
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, top, R, R * E, 0, 0, TAU); g.fill();
}

/** Radius along a vase's height, from knots [t, r] eased into one another. */
function profile(knots, t) {
  let i = 1;
  while (i < knots.length - 1 && knots[i][0] < t) i++;
  const [t0, r0] = knots[i - 1], [t1, r1] = knots[i];
  return lerp(r0, r1, smooth(clamp((t - t0) / (t1 - t0))));
}

/** A thrown vase standing at y0: its body, shade at the foot, the long soft
 *  highlight of the glaze (fluted stone for the urns), a dark mouth.
 *  Returns the mouth's height and radius. */
function vase(g, y0, V, fluted) {
  const pts = [];
  for (let k = 0; k <= 48; k++) pts.push([profile(V.r, k / 48) * V.R, y0 + (k / 48) * V.h]);
  const [rt, yt] = pts[48];
  g.beginPath();
  g.moveTo(-pts[0][0], y0);
  g.ellipse(0, y0, pts[0][0], pts[0][0] * E, 0, Math.PI, TAU);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.ellipse(0, yt, rt, rt * E, 0, 0, Math.PI);
  for (let k = 48; k >= 0; k--) g.lineTo(-pts[k][0], pts[k][1]);
  g.closePath();
  g.fillStyle = cyl(g, V.R, V.col, V.gloss);
  g.fill();
  g.save();
  g.clip();
  const ft = g.createLinearGradient(0, y0, 0, y0 + V.h * 0.45);
  ft.addColorStop(0, sh(0.32)); ft.addColorStop(1, sh(0));
  g.fillStyle = ft; g.fillRect(-V.R, y0 - 0.05, 2 * V.R, V.h * 0.5);
  if (fluted) for (let k = -6; k <= 6; k++) {
    const a = (k / 7) * (Math.PI / 2), x = Math.sin(a) * V.R * 0.85, wd = Math.cos(a) * V.R * 0.09;
    const gr = g.createLinearGradient(x - wd, 0, x + wd, 0);
    gr.addColorStop(0, sh(0.18)); gr.addColorStop(0.5, "rgba(255,255,255,.2)"); gr.addColorStop(1, sh(0.04));
    g.fillStyle = gr; g.fillRect(x - wd, y0 + V.h * 0.26, wd * 2, V.h * 0.24);
  }
  g.translate(-V.R * 0.34, y0 + V.h * 0.52);
  g.scale(1, (V.h * 0.36) / (V.R * 0.09));
  const hl = g.createRadialGradient(0, 0, 0, 0, 0, V.R * 0.09);
  hl.addColorStop(0, `rgba(255,255,255,${0.55 * V.gloss})`); hl.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hl; g.beginPath(); g.arc(0, 0, V.R * 0.09, 0, TAU); g.fill();
  g.restore();
  g.fillStyle = V.mouth || mixHex(V.col, "#2a2018", 0.75);
  g.beginPath(); g.ellipse(0, yt, rt * 0.86, rt * E * 0.86, 0, 0, TAU); g.fill();
  g.strokeStyle = mixHex(V.col, "#ffffff", 0.4); g.lineWidth = 0.004;
  g.beginPath(); g.ellipse(0, yt, rt, rt * E, 0, 0, TAU); g.stroke();
  return [yt, rt];
}

/** A rounded petal from the flower's heart outward, deeper in colour at its base. */
function petal(g, a, len, wid, pal) {
  g.save();
  g.rotate(a);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, len);
  gr.addColorStop(0, pal[0]); gr.addColorStop(0.4, pal[1]); gr.addColorStop(0.82, pal[2]); gr.addColorStop(1, pal[3]);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.2, wid, len * 0.78, wid * 1.2, len, wid * 0.3);
  g.quadraticCurveTo(len * 1.07, 0, len, -wid * 0.3);
  g.bezierCurveTo(len * 0.78, -wid * 1.2, len * 0.2, -wid, 0, 0);
  g.fill();
  g.restore();
}
// petals that point up sit behind the heart, those that point down in front of it
const backToFront = (list) => list.sort((p, q) => Math.sin(q[0]) - Math.sin(p[0]));
function glow(g, x, y, rad, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
}

const FLOWER = {
  peony(g, R, pal, r) {
    const guard = [], ruff = [];
    for (let i = 0; i < 10; i++) guard.push([(i / 10) * TAU + r() * 0.5, R * (0.86 + r() * 0.14), R * (0.5 + r() * 0.16)]);
    for (let i = 0; i < 22; i++) ruff.push([r() * TAU, R * (0.28 + r() * 0.42), R * (0.24 + r() * 0.12)]);
    for (const [a, l, w] of backToFront(guard)) petal(g, a, l, w, pal);
    glow(g, 0, 0, R * 0.62, pal[0], 0.55);
    for (const [a, l, w] of backToFront(ruff)) petal(g, a, l, w, pal);
    glow(g, -R * 0.2, R * 0.25, R * 0.5, pal[3], 0.5);     // light on the crown of the ruffles
  },
  ranunculus(g, R, pal, r) {
    // tight layers of cupped petals, each smaller and turned a little more toward us
    for (let j = 0; j < 7; j++) {
      const rr = R * (1 - j * 0.13), oy = -j * R * 0.035, ph = r() * TAU;
      const gr = g.createRadialGradient(0, oy, 0, 0, oy, rr);
      gr.addColorStop(0, pal[j > 4 ? 0 : 1]); gr.addColorStop(0.72, pal[2]); gr.addColorStop(1, pal[3]);
      g.fillStyle = gr;
      g.beginPath();
      for (let k = 0; k <= 48; k++) { const t = (k / 48) * TAU, q = rr * (1 + 0.05 * Math.cos(12 * t + ph)); g.lineTo(Math.cos(t) * q, oy + Math.sin(t) * q * 0.92); }
      g.fill();
      g.strokeStyle = rgba(pal[0], 0.3); g.lineWidth = R * 0.025; g.stroke();
    }
    g.fillStyle = "#93a061"; g.beginPath(); g.arc(0, -R * 0.24, R * 0.09, 0, TAU); g.fill();
  },
  rose(g, R, pal, r) {
    const outer = [];
    for (let i = 0; i < 6; i++) outer.push([(i / 6) * TAU + r() * 0.6, R * (0.9 + r() * 0.1), R * (0.62 + r() * 0.12)]);
    for (const [a, l, w] of backToFront(outer)) petal(g, a, l, w, pal);
    // the cup, and the folded petals of its heart catching light and falling into shade
    const gr = g.createRadialGradient(0, R * 0.12, 0, 0, 0, R * 0.68);
    gr.addColorStop(0, pal[2]); gr.addColorStop(0.8, pal[1]); gr.addColorStop(1, pal[2]);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.66, 0, TAU); g.fill();
    g.lineCap = "round";
    for (let k = 0; k < 9; k++) {
      const rad = R * (0.58 - k * 0.055), a0 = r() * TAU, sw = 1.4 + r() * 1.6, ox = (r() - 0.5) * R * 0.1, oy = (r() - 0.5) * R * 0.1;
      g.lineWidth = R * 0.07; g.strokeStyle = rgba(pal[3], 0.85);
      g.beginPath(); g.arc(ox, oy, rad, a0, a0 + sw); g.stroke();
      g.lineWidth = R * 0.03; g.strokeStyle = rgba(pal[0], 0.35);
      g.beginPath(); g.arc(ox, oy, rad - R * 0.045, a0 + 0.2, a0 + sw - 0.1); g.stroke();
    }
  },
  bud(g, R, pal) {
    leaf(g, 0, -R * 0.4, -Math.PI / 2 - 0.6, R * 1.1, R * 0.28, LEAF[0], LEAF[1]);
    leaf(g, 0, -R * 0.4, -Math.PI / 2 + 0.6, R * 1.1, R * 0.28, LEAF[0], LEAF[1]);
    const gr = g.createRadialGradient(-R * 0.3, R * 0.3, 0, 0, 0, R * 1.1);
    gr.addColorStop(0, pal[3]); gr.addColorStop(0.6, pal[2]); gr.addColorStop(1, pal[1]);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, R * 0.75, R, 0, 0, TAU); g.fill();
  },
};

function leaf(g, x, y, a, len, wid, c0, c1) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  const gr = g.createLinearGradient(0, -wid, 0, wid);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.42, wid * 1.25, len, 0);
  g.quadraticCurveTo(len * 0.42, -wid * 1.25, 0, 0);
  g.fill();
  g.strokeStyle = "rgba(236,242,214,.22)"; g.lineWidth = wid * 0.14;
  g.beginPath(); g.moveTo(len * 0.06, 0); g.lineTo(len * 0.86, 0); g.stroke();
  g.restore();
}

/** A quadratic stem from (x, y): heading a, bending by `bend` toward its tip.
 *  Calls back at each t along it with the point and the stem's direction. */
function stem(g, x, y, a, len, bend, width, col, each) {
  const mx = x + Math.cos(a + bend * 0.4) * len * 0.5, my = y + Math.sin(a + bend * 0.4) * len * 0.5;
  const ex = x + Math.cos(a + bend) * len, ey = y + Math.sin(a + bend) * len;
  g.strokeStyle = col; g.lineWidth = width;
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
  return (t) => {
    const u = 1 - t;
    return [u * u * x + 2 * u * t * mx + t * t * ex, u * u * y + 2 * u * t * my + t * t * ey, Math.atan2(u * (my - y) + t * (ey - my), u * (mx - x) + t * (ex - mx))];
  };
}

/** Greenery for the vases: a stem with leaves alternating down it, smaller
 *  toward the tip, or eucalyptus rounds in pairs. */
function sprig(g, x, y, a, len, r, kind, bend = (r() - 0.5) * 0.9) {
  const at = stem(g, x, y, a, len, bend, 0.005, "#5a6a44"), n = kind === "euc" ? 6 : 7;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.4), s = 1 - t * 0.45, [px, py, ta] = at(t);
    if (kind === "euc") {
      for (const sd of [1, -1]) {
        const ox = px + Math.cos(ta + sd * 1.3) * 0.022 * s, oy = py + Math.sin(ta + sd * 1.3) * 0.022 * s;
        const gr = g.createRadialGradient(ox - 0.006, oy + 0.006, 0, ox, oy, 0.026 * s);
        gr.addColorStop(0, EUC[1]); gr.addColorStop(1, EUC[0]);
        g.fillStyle = gr; g.beginPath(); g.arc(ox, oy, 0.024 * s, 0, TAU); g.fill();
      }
    } else leaf(g, px, py, ta + (i % 2 ? 1 : -1) * (0.55 + r() * 0.3), 0.09 * s, 0.028 * s, LEAF[0], LEAF[1]);
  }
  if (kind === "leaf") { const [ex, ey, ta] = at(1); leaf(g, ex, ey, ta, 0.07, 0.022, LEAF[0], LEAF[1]); }
}

/** An olive branch: a long arching stem, the odd side shoot, slender leaves
 *  set at uneven angles (some turned to show their silver undersides, a few
 *  toward us and so foreshortened), and now and then a fruit. */
function olive(g, x, y, a, len, bend, r, shoot) {
  const at = stem(g, x, y, a, len, bend, shoot ? 0.004 : 0.007, "#5d5242");
  for (let t = 0.1 + r() * 0.06; t < 0.98; t += 0.035 + r() * 0.04) {
    const [px, py, ta] = at(t), s = 1 - t * 0.35, side = r() < 0.5 ? 1 : -1, c = r() < 0.35 ? OLIVE_U : OLIVE;
    leaf(g, px, py, ta + side * (0.25 + r() * 0.6), (0.1 + r() * 0.07) * s * (r() < 0.2 ? 0.55 : 1), (0.015 + r() * 0.006) * s, c[0], c[1]);
    if (r() < 0.05) { g.fillStyle = r() < 0.5 ? "#3f3a2d" : "#6b6a40"; g.beginPath(); g.ellipse(px, py - 0.014, 0.01, 0.013, ta, 0, TAU); g.fill(); }
    if (!shoot && r() < 0.07) olive(g, px, py, ta + side * (0.5 + r() * 0.4), len * (0.25 + r() * 0.2), bend * 0.6, r, true);
  }
}

/** The arrangement in a vase's mouth: greenery fanned out behind, blooms over
 *  a dome (the largest low and in front), stems spilling over the lip. */
function bouquet(g, my, mr, B, r) {
  const [dw, dh, lift] = B.dome, cy = my + lift;
  for (const [kind, n] of B.greens) for (let i = 0; i < n; i++) {
    sprig(g, (r() - 0.5) * mr, my, Math.PI * (0.08 + (0.84 * (i + r())) / n), (dw + 0.1) * (0.85 + r() * 0.5), r, kind);
  }
  const list = [];
  for (const [kind, pal, n, r0, r1] of B.blooms) for (let i = 0; i < n; i++) list.push({ kind, pal: PAL[pal], R: lerp(r0, r1, r()) });
  list.sort((a, b) => b.R - a.R);
  list.forEach((b, i) => {
    const a = i * 2.39996 + r() * 0.5, k = Math.sqrt((i + 0.5) / list.length);
    b.x = Math.cos(a) * dw * k; b.y = cy + Math.sin(a) * dh * k;
  });
  list.sort((a, b) => b.y - a.y);
  for (const b of list) {
    g.strokeStyle = "#5a6a44"; g.lineWidth = 0.005;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x * 0.2, my); g.stroke();
    g.save(); g.translate(b.x, b.y); g.scale(1, 0.9);
    FLOWER[b.kind](g, b.R, b.pal, r);
    g.restore();
  }
  for (let i = 0; i < B.trail; i++) sprig(g, mr * (i ? -0.5 : 0.5), my, i ? -Math.PI + 0.45 : -0.45, dw + 0.16, r, "leaf", i ? 0.5 : -0.5);
}

/** Flowers go on their own layer, shaded from above and darker toward the
 *  mouth, then laid over the vase with the soft shadow they throw on it. */
function flowers(c, S, w, h, my, paint) {
  const fl = canvas(c.width, c.height), fg = fl.getContext("2d");
  fg.setTransform(S, 0, 0, -S, (w / 2) * S, h * S);
  paint(fg);
  fg.setTransform(1, 0, 0, 1, 0, 0);
  fg.globalCompositeOperation = "source-atop";
  const yb = (h - my) * S, gr = fg.createLinearGradient(0, 0, 0, yb);
  gr.addColorStop(0, "rgba(255,250,240,.12)"); gr.addColorStop(0.6, "rgba(255,250,240,0)"); gr.addColorStop(1, "rgba(46,32,22,.3)");
  fg.fillStyle = gr; fg.fillRect(0, 0, fl.width, yb);
  const g = c.getContext("2d");
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.shadowColor = "rgba(40,28,18,.28)"; g.shadowBlur = 0.03 * S; g.shadowOffsetY = 0.02 * S;
  g.drawImage(fl, 0, 0);
  g.restore();
}

/** A plinth of flowers, 1.2 by 2.4 metres of canvas at S pixels a metre. */
function paintPlinth(v, S) {
  const B = PLINTHS[v], w = 1.2, h = 2.4, r = prng("plinth" + v), c = canvas(w * S, h * S), g = c.getContext("2d");
  g.setTransform(S, 0, 0, -S, (w / 2) * S, h * S);
  pedestal(g, B.top, 0.24, B.stone, r);
  g.save(); g.translate(0, B.top); g.scale(1, E * 1.4);
  glow(g, 0, 0, B.vase.R * 0.95, "#3a2a1c", 0.35);        // where the vase stands
  g.restore();
  const [my, mr] = vase(g, B.top, B.vase);
  flowers(c, S, w, h, my, (fg) => bouquet(fg, my, mr, B, r));
  return c;
}

/** A fluted limestone urn on a low round plinth, planted with moss and olive
 *  branches: 3.2 metres square of canvas, the branches leaning one way (the
 *  pair either side of the end wall is mirrored, so both lean outward). */
function paintUrn(S) {
  const w = 3.2, h = 3.2, r = prng("urn"), c = canvas(w * S, h * S), g = c.getContext("2d"), stone = "#ddd3c1";
  g.setTransform(S, 0, 0, -S, (w / 2) * S, h * S);
  pedestal(g, 0.36, 0.3, mixHex(stone, "#ffffff", 0.25), r);
  const [my, mr] = vase(g, 0.36, { h: 1.1, R: 0.33, col: stone, gloss: 0.2, mouth: "#4f5a3a", r: [[0, 0.5], [0.07, 0.52], [0.12, 0.3], [0.2, 0.3], [0.3, 0.62], [0.52, 0.97], [0.66, 1], [0.78, 0.84], [0.88, 0.8], [0.95, 0.95], [1, 1.04]] }, true);
  flowers(c, S, w, h, my, (fg) => {
    // all leaning out, none across the lettering between the pair
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.17 + (0.33 * (i + r())) / 9);
      olive(fg, (r() - 0.5) * mr, my, a, 1.0 + r() * 0.6, -Math.sign(Math.cos(a)) * (0.3 + r() * 0.5), r);
    }
  });
  return c;
}
