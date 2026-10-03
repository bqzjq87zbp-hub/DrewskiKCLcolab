/* /iw-particles-physics: a field that becomes a portrait.
 *
 * Thousands of points drift as dust behind the covers on the landing page.
 * Hover an issue and every point flows to a pixel of that cover, sampled from
 * the image itself (its colour, and a size from how dark it is), forming the
 * cover as a dot portrait; the pointer scatters them like a hand through
 * sand. Leave and they let go again. Springs on the CPU, drawn as GL points.
 */
import { program } from "./lib.js";
import { stage } from "./stage.js";
import { clamp } from "../util.js";
import { pointer } from "../core/cursor.js";

const VS = `
attribute vec2 aPos; attribute vec3 aCol; attribute float aSize;
uniform vec2 uView; uniform float uDpr;
varying vec3 vCol;
void main(){
  vCol = aCol;
  gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0);
  gl_PointSize = aSize * uDpr;
}`;
const FS = `
uniform float uAlpha;
varying vec3 vCol;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.32, length(c)) * uAlpha;
  gl_FragColor = vec4(vCol * a, a);
}`;

let prog, bPos, bCol, bSize, N = 0;
let pos, vel, tgt, col, tcol, size, tsize, home;
let mode = "dust", alpha = 0, alphaT = 0.9, active = false, t = 0;
const portraits = new Map();

function dust(W, H) {
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6);
    home[i * 2] = W / 2 + Math.cos(a) * r * W * 0.62;
    home[i * 2 + 1] = H / 2 + Math.sin(a) * r * H * 0.55;
  }
}

/** Sample an image into N target points (position, colour, size). */
function sample(img, W, H) {
  const aspect = (img.naturalWidth || 4) / (img.naturalHeight || 7);
  const ph = H * 0.86, pw = ph * aspect;
  const cols = Math.max(8, Math.round(Math.sqrt(N * aspect))), rows = Math.max(8, Math.round(N / cols));
  const c = document.createElement("canvas");
  c.width = cols; c.height = rows;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0, cols, rows);
  const d = x.getImageData(0, 0, cols, rows).data;
  const out = { p: new Float32Array(N * 2), c: new Float32Array(N * 3), s: new Float32Array(N) };
  const ox = (W - pw) / 2, oy = (H - ph) / 2, sx = pw / cols, sy = ph / rows;
  for (let i = 0; i < N; i++) {
    const k = i % (cols * rows);
    const gx = k % cols, gy = Math.floor(k / cols);
    out.p[i * 2] = ox + (gx + 0.5 + (Math.random() - 0.5) * 0.4) * sx;
    out.p[i * 2 + 1] = oy + (gy + 0.5 + (Math.random() - 0.5) * 0.4) * sy;
    const r = d[k * 4] / 255, g = d[k * 4 + 1] / 255, b = d[k * 4 + 2] / 255;
    out.c[i * 3] = r; out.c[i * 3 + 1] = g; out.c[i * 3 + 2] = b;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    out.s[i] = Math.max(1.2, Math.min(sx, sy) * (0.55 + l * 0.75));
  }
  return out;
}

export const particlesLayer = {
  order: 1,
  setup(gl) {
    prog = program(gl, VS, FS);
    bPos = gl.createBuffer(); bCol = gl.createBuffer(); bSize = gl.createBuffer();
  },
  active() { return active && N > 0; },
  draw(gl, st, dt) {
    t += dt;
    alpha += (alphaT - alpha) * Math.min(1, dt * 3);
    const W = st.w, H = st.h;
    const pr = 110, pr2 = pr * pr;
    const k = mode === "dust" ? 1.6 : 7.5, damp = mode === "dust" ? 0.92 : 0.86;
    for (let i = 0; i < N; i++) {
      const i2 = i * 2, i3 = i * 3;
      let tx, ty;
      if (mode === "dust") {
        tx = home[i2] + Math.sin(t * 0.15 + i * 0.7) * 26;
        ty = home[i2 + 1] + Math.cos(t * 0.12 + i * 1.3) * 22;
      } else { tx = tgt[i2]; ty = tgt[i2 + 1]; }
      let vx = vel[i2], vy = vel[i2 + 1];
      vx += (tx - pos[i2]) * k * dt; vy += (ty - pos[i2 + 1]) * k * dt;
      if (pointer.moved) {
        const dx = pos[i2] - pointer.x, dy = pos[i2 + 1] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < pr2 && d2 > 0.01) { const f = (1 - d2 / pr2) * 900 * dt; const d = Math.sqrt(d2); vx += (dx / d) * f; vy += (dy / d) * f; }
      }
      vx *= damp; vy *= damp;
      vel[i2] = vx; vel[i2 + 1] = vy;
      pos[i2] += vx; pos[i2 + 1] += vy;
      col[i3] += (tcol[i3] - col[i3]) * 0.06; col[i3 + 1] += (tcol[i3 + 1] - col[i3 + 1]) * 0.06; col[i3 + 2] += (tcol[i3 + 2] - col[i3 + 2]) * 0.06;
      size[i] += (tsize[i] - size[i]) * 0.08;
    }
    gl.viewport(0, 0, st.canvas.width, st.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    prog.use().set("uView", [W, H]).set("uDpr", st.dpr).set("uAlpha", alpha);
    const bind = (buf, data, loc, n) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
    };
    bind(bPos, pos, prog.attribs.aPos, 2);
    bind(bCol, col, prog.attribs.aCol, 3);
    bind(bSize, size, prog.attribs.aSize, 1);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(prog.attribs.aCol);
    gl.disableVertexAttribArray(prog.attribs.aSize);
  },
};

export function particles(opts = {}) {
  if (!stage.ok) return null;
  N = opts.count || (innerWidth < 760 ? 2600 : 6200);
  pos = new Float32Array(N * 2); vel = new Float32Array(N * 2); tgt = new Float32Array(N * 2); home = new Float32Array(N * 2);
  col = new Float32Array(N * 3); tcol = new Float32Array(N * 3); size = new Float32Array(N); tsize = new Float32Array(N);
  dust(stage.w, stage.h);
  const dustCol = opts.dust || [0.55, 0.52, 0.48];
  for (let i = 0; i < N; i++) {
    pos[i * 2] = home[i * 2]; pos[i * 2 + 1] = home[i * 2 + 1];
    col[i * 3] = tcol[i * 3] = dustCol[0]; col[i * 3 + 1] = tcol[i * 3 + 1] = dustCol[1]; col[i * 3 + 2] = tcol[i * 3 + 2] = dustCol[2];
    size[i] = tsize[i] = 1 + Math.random() * 1.6;
  }
  stage.add(particlesLayer);
  addEventListener("resize", () => { dust(stage.w, stage.h); portraits.clear(); });
  const toDust = () => {
    mode = "dust"; alphaT = 0.9;
    for (let i = 0; i < N; i++) {
      tcol[i * 3] = dustCol[0]; tcol[i * 3 + 1] = dustCol[1]; tcol[i * 3 + 2] = dustCol[2];
      tsize[i] = 1 + (i % 7) * 0.22;
    }
  };
  return {
    start() { active = true; alpha = 0; },
    stop() { active = false; },
    /** Form the portrait of an <img>; null lets the field go back to dust. */
    form(img) {
      if (!img) return toDust();
      let s = portraits.get(img.src);
      if (!s) { s = sample(img, stage.w, stage.h); portraits.set(img.src, s); }
      mode = "portrait"; alphaT = 0.62;
      tgt.set(s.p); tcol.set(s.c); tsize.set(s.s);
      // shuffle each point a little toward its target so they arrive in a wave
      for (let i = 0; i < N; i++) { vel[i * 2] += (Math.random() - 0.5) * 6; vel[i * 2 + 1] += (Math.random() - 0.5) * 6; }
    },
    get broken() { return !!particlesLayer.broken; },
  };
}
