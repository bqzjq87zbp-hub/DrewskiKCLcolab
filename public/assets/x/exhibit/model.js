/* The page model: issue.json + catalog.json, flattened into what every room
 * reads. Plates are numbered through the whole exhibition and keep their real
 * shape (w, h). Each chapter's first plate is its lead print, which the
 * palette room hangs on its rail; the swatches are the colours measured from
 * the photographs by tools/build_exhibitions.py.
 * Pure, unit-tested (the finder tests run against exactly this). */

const RATIOS = [[1, 1], [5, 4], [4, 3], [7, 5], [3, 2], [16, 9], [2, 1]];

/** "Portrait, 2:3" from pixel dimensions: the nearest common print ratio. */
export function shape(w, h) {
  const r = w / h, wide = r >= 1, k = wide ? r : 1 / r;
  if (k < 1.08) return "Square";
  const [a, b] = RATIOS.reduce((best, q) => (Math.abs(q[0] / q[1] - k) < Math.abs(best[0] / best[1] - k) ? q : best));
  return wide ? `Landscape, ${a}:${b}` : `Portrait, ${b}:${a}`;
}

export function model(issue, catalog, root, slug) {
  const res = (u) => (/^https?:|^\//.test(u) ? u : root + u);
  const plates = [], stories = [];
  issue.stories.forEach((s, si) => {
    const st = { i: si, title: s.title, deck: s.deck, mood: s.mood, plates: [] };
    s.plates.forEach((p) => {
      const i = plates.length;
      const w = p.w || 4, h = p.h || 7;
      plates.push({
        i, n: i + 1, src: res(p.img), file: p.img.split("/").pop(), kicker: p.kicker || "", caption: p.caption || "",
        story: si, storyTitle: s.title, w, h, ar: w / h, shape: shape(w, h), palette: p.palette || [],
        alt: `${p.kicker || "Plate " + (i + 1)}. ${p.caption || ""}`.trim(),
      });
      st.plates.push(i);
    });
    stories.push(st);
  });
  const prints = stories.map((s) => ({
    id: s.i, story: s.i, plate: s.plates[0], name: s.title, note: s.deck, swatch: plates[s.plates[0]].palette,
  }));
  const palette = (issue.palette || []).map((c, k) => ({ ...c, id: k }));
  const others = ((catalog && catalog.issues) || []).filter((i) => i.slug !== slug);
  return { plates, stories, prints, palette, others };
}
