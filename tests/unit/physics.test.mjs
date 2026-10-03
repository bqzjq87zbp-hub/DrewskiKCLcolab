// The swatch tray: things fall, stack without overlapping, and can be thrown.
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../../public/assets/x/exhibit/physics.js";

test("dropped swatches settle on the floor without overlapping", () => {
  const W = world({ w: 420, h: 500 });
  for (let i = 0; i < 6; i++) W.add({ x: 60 + i * 55, y: -80 - i * 90, r: 38 + (i % 3) * 5, vx: i % 2 ? 60 : -40 });
  let t = 0;
  for (; t < 6 && !W.settled(); t += 1 / 60) W.step(1 / 60);
  assert.ok(W.settled(), "settles within 6s, took " + t.toFixed(2));
  const b = W.bodies;
  for (let i = 0; i < b.length; i++) {
    assert.ok(b[i].x >= b[i].r - 0.5 && b[i].x <= 420 - b[i].r + 0.5 && b[i].y <= 500 - b[i].r + 0.5, "inside the tray");
    for (let j = i + 1; j < b.length; j++) {
      const overlap = b[i].r + b[j].r - Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
      assert.ok(overlap < 1, `bodies ${i},${j} overlap by ${overlap.toFixed(2)}px`);
    }
  }
});

test("a held body follows the pointer and flies when released", () => {
  const W = world({ w: 400, h: 400 });
  const b = W.add({ x: 200, y: 360, r: 30 });
  W.hold(b, 200, 360);
  for (let k = 0; k < 10; k++) { W.move(b, 200 + k * 12, 360 - k * 20); W.step(1 / 60); }
  assert.ok(Math.abs(b.x - 308) < 30 && b.y < 220, `followed: ${b.x.toFixed(0)},${b.y.toFixed(0)}`);
  W.release(b);
  assert.ok(b.vx > 100 && b.vy < -100, "carries the throw");
  const y0 = b.y;
  for (let k = 0; k < 6; k++) W.step(1 / 60);
  assert.ok(b.y < y0, "keeps rising for a moment after release");
});

test("pick finds the topmost body under a point", () => {
  const W = world({ w: 300, h: 300 });
  W.add({ x: 100, y: 100, r: 40 });
  const top = W.add({ x: 120, y: 100, r: 40 });
  assert.equal(W.pick(115, 100), top);
  assert.equal(W.pick(10, 10), null);
});
