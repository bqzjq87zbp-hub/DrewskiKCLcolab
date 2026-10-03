/* The page model: issue.json + catalog.json, flattened into what every room
 * reads. Plates are numbered through the whole exhibition and keep their real
 * shape (w, h). Each chapter's first plate is its lead print, which the
 * palette room hangs on its rail; the swatches are the colours measured from
 * the photographs by tools/build_exhibitions.py.
 * Pure, unit-tested (the finder tests run against exactly this). */

/** "Portrait", "Landscape" or "Square" from pixel dimensions, in words: the
 *  site shows no numbers, so no print ratio. */
export function shape(w, h) {
  const r = w / h;
  return r >= 1.08 ? "Landscape" : r > 1 / 1.08 ? "Square" : "Portrait";
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
