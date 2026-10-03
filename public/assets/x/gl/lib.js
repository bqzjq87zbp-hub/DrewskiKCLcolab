/* Minimal WebGL helpers. Raw GL on purpose: every effect here is a textured
 * quad or grid with a custom shader, and three.js would add ~600KB to draw
 * rectangles. The Atelier, which needs real PBR, still uses three.js. */

export function getContext(canvas, opts) {
  const o = Object.assign({ alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: false }, opts);
  let gl = canvas.getContext("webgl2", o);
  const isGL2 = !!gl;
  if (!gl) gl = canvas.getContext("webgl", o) || canvas.getContext("experimental-webgl", o);
  if (!gl) return null;
  gl.isGL2 = isGL2;
  return gl;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("shader: " + log + "\n" + src.split("\n").map((l, i) => i + 1 + ": " + l).join("\n").slice(0, 1400));
  }
  return s;
}

const HEADER = "precision highp float;\n";

export function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, HEADER + vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, HEADER + fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
  const uniforms = {}, attribs = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uniforms[info.name.replace(/\[0\]$/, "")] = { loc: gl.getUniformLocation(p, info.name), type: info.type };
  }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); attribs[a.name] = gl.getAttribLocation(p, a.name); }
  // Each sampler owns one texture unit for the life of the program. Handing
  // out a fresh unit per set() ran past the GPU's limit when a layer drew many
  // textured quads in one frame (the hall draws over forty).
  let units = 0;
  for (const k in uniforms) if (uniforms[k].type === gl.SAMPLER_2D) uniforms[k].unit = units++;
  const api = {
    p, uniforms, attribs,
    use() { gl.useProgram(p); return api; },
    set(name, v) {
      const u = uniforms[name];
      if (!u) return api;
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2f(u.loc, v[0], v[1]); break;
        case gl.FLOAT_VEC3: gl.uniform3f(u.loc, v[0], v[1], v[2]); break;
        case gl.FLOAT_VEC4: gl.uniform4f(u.loc, v[0], v[1], v[2], v[3]); break;
        case gl.INT: case gl.BOOL: gl.uniform1i(u.loc, v | 0); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        case gl.SAMPLER_2D:
          gl.activeTexture(gl.TEXTURE0 + u.unit);
          gl.bindTexture(gl.TEXTURE_2D, v);
          gl.uniform1i(u.loc, u.unit);
          break;
      }
      return api;
    },
  };
  return api;
}

/** A grid of (sx x sy) cells over 0..1 UV, y down, as indexed triangles. */
export function grid(gl, sx, sy) {
  const verts = [], idx = [];
  for (let y = 0; y <= sy; y++) for (let x = 0; x <= sx; x++) verts.push(x / sx, y / sy);
  for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    const a = y * (sx + 1) + x, b = a + 1, c = a + sx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  const big = verts.length / 2 > 65535;
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW);
  return { vb, ib, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}

export function drawGrid(gl, prog, g, attr = "aUv") {
  const loc = prog.attribs[attr];
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vb);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.ib);
  gl.drawElements(gl.TRIANGLES, g.count, g.type, 0);
}

/** Upload an image, canvas or video. Mipmaps when the context allows it.
 *  `premul` uploads premultiplied, so cut-outs never fringe dark as they
 *  shrink into their mipmaps; `aniso` keeps floors and walls sharp at a
 *  grazing angle. */
export function texture(gl, src, opts = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!opts.premul);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (src) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const w = src.videoWidth || src.naturalWidth || src.width, hgt = src.videoHeight || src.naturalHeight || src.height;
    const pot = (n) => (n & (n - 1)) === 0;
    if (opts.mip !== false && (gl.isGL2 || (pot(w) && pot(hgt)))) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const an = opts.aniso && gl.getExtension("EXT_texture_filter_anisotropic");
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  return t;
}

/** Draw a source into a canvas at a given size (cover-fit), so textures match
 *  display resolution: sharper than GPU minification and far lighter. */
export function fitCanvas(src, w, hgt) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(hgt));
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height;
  const s = Math.max(c.width / sw, c.height / sh);
  const dw = sw * s, dh = sh * s;
  x.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c;
}

/* ─── mat4, column-major, just what the hall needs. Each writes into `o`
 * (a new array when it is left out), so a render loop can reuse its own. */
export const mat4 = {
  perspective(fovy, aspect, near, far, o = new Float32Array(16)) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  },
  lookAt(e, c, up, o = new Float32Array(16)) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
    return o;
  },
  multiply(a, b, o = new Float32Array(16)) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  },
};
