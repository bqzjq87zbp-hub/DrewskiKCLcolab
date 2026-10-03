/* The scattered exhibition grid, as a pure function (unit-tested).
 *
 * The Hearst galleries hang photographs on an 8-column page with lots of air:
 * rows of one to four frames at one or two column widths, nudged off the
 * baseline, each tagged [n] beside its top corner. This reproduces that hang
 * from data:
 *
 *   - stories become chapters; a chapter head gets its own row and a row
 *     never mixes two chapters, so page-wide mood swaps land on row edges
 *   - row shapes are drawn from a small set of hand-balanced patterns,
 *     picked by a PRNG seeded per issue, so the hang is varied but stable
 *   - positions are fractional and resolved per column count, so the same
 *     hang works at every zoom level and on a phone
 *   - frames in a row keep a free column between them where they can, and
 *     the [n] label goes into that free column
 */
import { prng } from "../util.js";

// p: fractional position of the frame's start across the free width,
// s: span in columns, o: drop below the row top, in small-frame heights.
const WIDE = {
  1: [[{ p: 0.46, s: 2 }], [{ p: 0.16, s: 2 }], [{ p: 0.82, s: 2 }]],
  2: [
    [{ p: 0.14, s: 1 }, { p: 0.72, s: 2 }],
    [{ p: 0, s: 2 }, { p: 0.62, s: 1, o: 0.32 }],
    [{ p: 0.3, s: 1 }, { p: 1, s: 2 }],
    [{ p: 0.1, s: 2 }, { p: 0.78, s: 1, o: 0.5 }],
    [{ p: 0.22, s: 2 }, { p: 0.9, s: 2, o: 0.18 }],
  ],
  3: [
    [{ p: 0, s: 2 }, { p: 0.5, s: 1, o: 0.2 }, { p: 1, s: 2 }],
    [{ p: 0.15, s: 1 }, { p: 0.45, s: 2 }, { p: 0.98, s: 1, o: 0.4 }],
    [{ p: 0, s: 1, o: 0.5 }, { p: 0.32, s: 2 }, { p: 0.86, s: 2 }],
    [{ p: 0.05, s: 2 }, { p: 0.55, s: 1 }, { p: 0.9, s: 1, o: 0.55 }],
  ],
  4: [
    [{ p: 0, s: 2 }, { p: 0.4, s: 1 }, { p: 0.62, s: 2 }, { p: 1, s: 1, o: 0.35 }],
    [{ p: 0, s: 1 }, { p: 0.28, s: 2 }, { p: 0.7, s: 1, o: 0.3 }, { p: 1, s: 1 }],
  ],
};
const NARROW = {
  1: [[{ p: 0.5, s: 3 }], [{ p: 0, s: 3 }], [{ p: 1, s: 3 }]],
  2: [[{ p: 0, s: 2 }, { p: 1, s: 2, o: 0.45 }], [{ p: 0, s: 2, o: 0.3 }, { p: 1, s: 2 }]],
};

/** Row sizes to split `n` frames into, favouring 2s and 3s with the odd 1 or 4. */
export function rowSizes(n, rnd, max) {
  const out = [];
  let left = n;
  while (left > 0) {
    let k;
    if (max <= 2) k = left >= 2 && rnd() < 0.62 ? 2 : 1;
    else {
      const r = rnd();
      k = r < 0.08 ? 1 : r < 0.42 ? 2 : r < 0.84 ? 3 : 4;
    }
    k = Math.min(k, left, max);
    // never strand a single frame at the end of a chapter after a 4
    if (left - k === 1 && k >= 3) k--;
    out.push(k);
    left -= k;
  }
  return out;
}

function resolve(items, cols, gap) {
  for (let i = 1; i < items.length; i++) {
    const min = items[i - 1].start + items[i - 1].span + gap;
    if (items[i].start < min) items[i].start = min;
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const limit = i === items.length - 1 ? cols : items[i + 1].start - gap;
    if (items[i].start + items[i].span > limit) items[i].start = limit - items[i].span;
  }
  return items.every((it) => it.start >= 0);
}

/** Resolve one pattern to integer columns: no overlaps, inside the grid, and
 *  a free column between frames whenever the row has room for one. */
export function place(pattern, cols) {
  const fresh = () => pattern.map((q) => {
    const span = Math.min(q.s, cols);
    return { span, start: Math.round(q.p * (cols - span)), drop: q.o || 0 };
  });
  let items = fresh();
  if (!resolve(items, cols, 1)) { items = fresh(); resolve(items, cols, 0); }
  items.forEach((it) => { it.start = Math.max(0, Math.min(cols - it.span, it.start)); });
  // label side: into a free column beside the frame, else inside the frame
  const occupied = new Array(cols).fill(false);
  items.forEach((it) => { for (let c = it.start; c < it.start + it.span; c++) occupied[c] = true; });
  items.forEach((it) => {
    const r = it.start + it.span, l = it.start - 1;
    it.label = r < cols && !occupied[r] ? "right" : l >= 0 && !occupied[l] ? "left" : "inside";
  });
  return items;
}

/**
 * @param stories [{ plates: n }]
 * @param opts    { cols, seed }
 * @returns rows: [{ type: "chapter", story, side } | { type: "plates", story, items: [{ index, start, span, drop, label }] }]
 */
export function layout(stories, opts) {
  const cols = opts.cols || 8;
  const narrow = cols <= 5;
  const bank = narrow ? NARROW : WIDE;
  const max = narrow ? 2 : 4;
  const rnd = prng(opts.seed || "exhibit");
  const rows = [];
  let index = 0, lastPattern = -1;
  stories.forEach((st, si) => {
    rows.push({ type: "chapter", story: si, side: si % 2 ? "right" : "left" });
    for (const k of rowSizes(st.plates, rnd, max)) {
      const options = bank[k];
      let pick = Math.floor(rnd() * options.length);
      if (options.length > 1 && pick === lastPattern) pick = (pick + 1) % options.length;
      lastPattern = pick;
      const items = place(options[pick], cols).map((it) => ({ ...it, index: index++ }));
      rows.push({ type: "plates", story: si, items });
    }
  });
  return rows;
}

/** Column count for a viewport width and zoom step (-1 in, 0, +1 out). */
export function columnsFor(width, zoom = 0) {
  if (width < 760) return 4;
  const base = width < 1100 ? 6 : 8;
  const steps = width < 1100 ? [4, 6, 8] : [6, 8, 10];
  return steps[Math.max(0, Math.min(2, zoom + 1))] || base;
}
