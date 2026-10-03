// The exhibition hang: every plate once, in order, inside the grid, never overlapping.
import test from "node:test";
import assert from "node:assert/strict";
import { layout, place, rowSizes, columnsFor } from "../../public/assets/x/exhibit/layout.js";
import { prng } from "../../public/assets/x/util.js";

const SETS = [[4, 3, 6, 2, 1, 2], [3, 3, 4, 3, 1, 2], [1], [9], [2, 2, 2, 2, 2, 2, 2], [5, 1, 5, 1]];

test("every plate appears exactly once, in reading order, one chapter head per story", () => {
  for (const stories of SETS) for (const cols of [4, 6, 8, 10]) for (const seed of ["a", "thickvato", "gitchubbed", "zz"]) {
    const rows = layout(stories.map((n) => ({ plates: n })), { cols, seed });
    const seen = rows.filter((r) => r.type === "plates").flatMap((r) => r.items.map((i) => i.index));
    assert.deepEqual(seen, [...Array(stories.reduce((a, b) => a + b, 0)).keys()], `order at ${cols} cols, ${seed}`);
    assert.equal(rows.filter((r) => r.type === "chapter").length, stories.length);
  }
});

test("rows stay inside the grid, never overlap, and never mix chapters", () => {
  for (const stories of SETS) for (const cols of [4, 6, 8, 10]) for (const seed of ["a", "b", "c", "thickvato"]) {
    const rows = layout(stories.map((n) => ({ plates: n })), { cols, seed });
    let story = -1;
    for (const r of rows) {
      if (r.type === "chapter") { story = r.story; continue; }
      assert.equal(r.story, story, "row belongs to the current chapter");
      const cells = new Array(cols).fill(0);
      for (const it of r.items) {
        assert.ok(it.start >= 0 && it.start + it.span <= cols, `inside grid: ${JSON.stringify(it)} at ${cols}`);
        for (let c = it.start; c < it.start + it.span; c++) cells[c]++;
        assert.ok(["left", "right", "inside"].includes(it.label));
      }
      assert.ok(cells.every((c) => c <= 1), `no overlap at ${cols} cols: ${JSON.stringify(r.items)}`);
    }
  }
});

test("the same seed always gives the same hang", () => {
  const a = layout([{ plates: 6 }, { plates: 4 }], { cols: 8, seed: "x" });
  const b = layout([{ plates: 6 }, { plates: 4 }], { cols: 8, seed: "x" });
  assert.deepEqual(a, b);
});

test("labels go into a free neighbouring column when there is one", () => {
  const items = place([{ p: 0, s: 2 }, { p: 1, s: 2 }], 8);
  assert.equal(items[0].label, "right");
  const tight = place([{ p: 0, s: 2 }, { p: 1, s: 2 }], 4);
  assert.equal(tight[0].label, "inside");
});

test("row sizes sum to the chapter and respect the maximum", () => {
  for (let n = 1; n < 30; n++) for (const max of [2, 4]) {
    const sizes = rowSizes(n, prng(n * 7 + max), max);
    assert.equal(sizes.reduce((a, b) => a + b, 0), n);
    assert.ok(sizes.every((k) => k >= 1 && k <= max));
  }
});

test("columns per viewport and zoom", () => {
  assert.equal(columnsFor(390, 0), 4);
  assert.equal(columnsFor(1440, 0), 8);
  assert.equal(columnsFor(1440, -1), 6);
  assert.equal(columnsFor(1440, 1), 10);
  assert.equal(columnsFor(900, 0), 6);
});
