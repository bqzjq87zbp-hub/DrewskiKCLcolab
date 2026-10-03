// Search, preference resolution and the small shared helpers.
import test from "node:test";
import assert from "node:assert/strict";
import { searchPlates } from "../../public/assets/x/ui/search.js";
import { resolve, DEFAULTS } from "../../public/assets/x/core/prefs.js";
import { hexToRgb, luma, mixHex, prng, esc, clamp, damp } from "../../public/assets/x/util.js";

const P = [
  { i: 0, kicker: "East Side", caption: "Midnight blue set. Empty lot, dust in the light.", storyTitle: "Golden Hour", garment: null },
  { i: 1, kicker: "Room 11", caption: "Midnight blue one-piece. Floral bedspread.", storyTitle: "After Dark", garment: null },
  { i: 2, kicker: "Midnight Run", caption: "Night drive.", storyTitle: "After Dark", garment: null },
];

test("search: every word must match, place names rank first", () => {
  assert.deepEqual(searchPlates(P, "midnight").map((p) => p.i), [2, 0, 1]);
  assert.deepEqual(searchPlates(P, "midnight floral").map((p) => p.i), [1]);
  assert.deepEqual(searchPlates(P, "  "), []);
  assert.deepEqual(searchPlates(P, "zebra"), []);
});

test("prefs resolve system choices and never turn effects on without WebGL", () => {
  const env = { dark: true, reduced: true, webgl: true, saveData: false, lowMemory: false };
  assert.deepEqual(resolve(DEFAULTS, env), { theme: "light", motion: "calm", effects: "on", sound: false, grain: true });
  assert.equal(resolve({ ...DEFAULTS, theme: "system" }, env).theme, "dark");
  assert.equal(resolve({ ...DEFAULTS, effects: "on" }, { ...env, webgl: false }).effects, "off");
  assert.equal(resolve(DEFAULTS, { ...env, saveData: true }).effects, "off");
  assert.equal(resolve({ ...DEFAULTS, motion: "full" }, env).motion, "full");
});

test("colour helpers", () => {
  assert.deepEqual(hexToRgb("#ff8000"), [255, 128, 0]);
  assert.deepEqual(hexToRgb("#fff"), [255, 255, 255]);
  assert.ok(luma("#ffffff") > 0.99 && luma("#000000") === 0);
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
});

test("prng is deterministic per seed", () => {
  const a = prng("x"), b = prng("x"), c = prng("y");
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});

test("escaping and maths", () => {
  assert.equal(esc(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  assert.equal(clamp(5, 0, 1), 1);
  assert.ok(Math.abs(damp(0, 10, 1000, 1) - 10) < 1e-6);
});
