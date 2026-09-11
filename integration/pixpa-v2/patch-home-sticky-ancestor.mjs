import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Offline Home-only correction. Never contacts Pixpa or rewrites a drifted field.
const [input, output] = process.argv.slice(2);
if (!input || !output || !path.isAbsolute(input) || !path.isAbsolute(output)) {
  throw new Error('Usage: node patch-home-sticky-ancestor.mjs /absolute/current-body.html /absolute/candidate.html');
}
if (fs.existsSync(output)) throw new Error('Output exists; nothing will be overwritten');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const before = fs.readFileSync(input, 'utf8');
const baseline = '3b538d6cbbdf38d037143bac07bf6b80daabd60db42b9b3452b43cc4e2bc76d9';
const expected = '820a22a5b99477027456fb76daa3d4f7f984b31319e39c46f1dfb5269de836bc';
if (digest(before) !== baseline) throw new Error('Baseline drift: inspect and rebase before any save');
const css = `/* Home only: the sticky masthead must reference the document scroller. */
@media (max-width:767px) {
  body:has(#kcl-pacific-landing) .is-section .is-boxes:has(#kcl-pacific-landing) {
    overflow:visible;
  }
}
`;
const owner = /(<style id="kcl-pier-home-entry-20260909">)([\s\S]*?)(<\/style>)/g;
const matches = [...before.matchAll(owner)];
if (matches.length !== 1 || before.includes(css)) throw new Error('Unexpected or already-patched Home style owner');
const after = before.replace(owner, (_match, start, contents, end) => start + contents + css + end);
if (after.replace(css, '') !== before || digest(after) !== expected) throw new Error('Candidate integrity failed');
fs.writeFileSync(output, after, {flag: 'wx'});
console.log(JSON.stringify({bytes: Buffer.byteLength(after), sha256: digest(after), published: false}));
