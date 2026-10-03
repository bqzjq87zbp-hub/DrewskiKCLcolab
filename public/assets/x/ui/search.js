/* Plate search for the menu: every word must match somewhere in a plate's
 * place, caption, chapter or garment; matches in the place name rank higher.
 * Pure, unit-tested. */

export function searchPlates(plates, q) {
  const terms = q.toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const out = [];
  for (const p of plates) {
    const hay = `${p.kicker} ${p.caption} ${p.storyTitle} ${p.garment ? p.garment.colour + " " + p.garment.cut : ""}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += p.kicker.toLowerCase().includes(t) ? 3 : 1;
      else { score = -1; break; }
    }
    if (score > 0) out.push({ p, score });
  }
  return out.sort((a, b) => b.score - a.score || a.p.i - b.p.i).map((r) => r.p);
}
