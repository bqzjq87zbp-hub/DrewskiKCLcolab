/* /iw-particles-physics: a tiny 2D world for things you can toss.
 *
 * Circles only: every body is a swatch. Semi-implicit Euler in sub-steps,
 * walls on three sides (the top is open so things can drop in), pairwise
 * collisions resolved by positional correction plus an impulse with
 * restitution and tangential friction. A grabbed body follows the pointer by
 * velocity, so letting go throws it. Pure: no DOM, unit-tested.
 */

export function world(opts = {}) {
  const W = { w: opts.w || 400, h: opts.h || 400, g: opts.g != null ? opts.g : 2600, e: opts.e != null ? opts.e : 0.32, mu: 0.18, bodies: [] };

  W.add = (b) => {
    const body = { x: 0, y: 0, vx: 0, vy: 0, r: 30, m: 1, spin: 0, a: 0, held: false, hx: 0, hy: 0, sleep: 0, ...b };
    body.m = body.m || body.r * body.r;
    W.bodies.push(body);
    return body;
  };
  W.resize = (w, h) => { W.w = w; W.h = h; };

  W.pick = (x, y) => {
    for (let i = W.bodies.length - 1; i >= 0; i--) {
      const b = W.bodies[i];
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r) return b;
    }
    return null;
  };
  W.hold = (b, x, y) => { b.held = true; b.hx = x; b.hy = y; b.sleep = 0; };
  W.move = (b, x, y) => { b.hx = x; b.hy = y; };
  W.release = (b) => { b.held = false; };

  function walls(b) {
    const e = W.e;
    if (b.y + b.r > W.h) { b.y = W.h - b.r; if (b.vy > 0) b.vy = -b.vy * e; b.vx *= 1 - W.mu * 0.5; b.spin = b.vx / b.r; }
    if (b.x - b.r < 0) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * e; }
    if (b.x + b.r > W.w) { b.x = W.w - b.r; if (b.vx > 0) b.vx = -b.vx * e; }
    if (b.y - b.r < -W.h * 2) { b.y = -W.h * 2 + b.r; if (b.vy < 0) b.vy = 0; }
  }

  function collide(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 === 0) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    const pen = rr - d;
    const ia = a.held ? 0 : 1 / a.m, ib = b.held ? 0 : 1 / b.m;
    const it = ia + ib;
    if (!it) return;
    a.x -= nx * pen * (ia / it); a.y -= ny * pen * (ia / it);
    b.x += nx * pen * (ib / it); b.y += ny * pen * (ib / it);
    const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn > 0) return;
    const j = (-(1 + W.e) * vn) / it;
    a.vx -= j * nx * ia; a.vy -= j * ny * ia;
    b.vx += j * nx * ib; b.vy += j * ny * ib;
    // friction along the contact
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty;
    const jt = Math.max(-j * W.mu, Math.min(j * W.mu, -vt / it));
    a.vx -= jt * tx * ia; a.vy -= jt * ty * ia;
    b.vx += jt * tx * ib; b.vy += jt * ty * ib;
    if (vn < -40) a.sleep = b.sleep = 0;
  }

  W.step = (dt, sub = 4) => {
    dt = Math.min(dt, 1 / 30);
    const h = dt / sub;
    const bs = W.bodies;
    for (let s = 0; s < sub; s++) {
      for (const b of bs) {
        if (b.held) {
          b.vx = (b.hx - b.x) / Math.max(h * 3, 1e-4);
          b.vy = (b.hy - b.y) / Math.max(h * 3, 1e-4);
          const cap = 4000;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
        } else b.vy += W.g * h;
        b.x += b.vx * h; b.y += b.vy * h;
        b.a += b.spin * h;
      }
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) collide(bs[i], bs[j]);
      for (const b of bs) walls(b);
    }
    for (const b of bs) {
      b.vx *= 0.999; b.spin *= 0.99;
      const still = Math.abs(b.vx) < 12 && Math.abs(b.vy) < 12 && !b.held;
      b.sleep = still ? b.sleep + dt : 0;
    }
  };

  W.settled = () => W.bodies.every((b) => b.sleep > 0.5);
  return W;
}
