import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Offline, exact-baseline patch only. This never contacts or saves to Pixpa.
const [input, output] = process.argv.slice(2);
if (!input || !output || !path.isAbsolute(input) || !path.isAbsolute(output)) {
  throw new Error('Usage: node patch-native-menu-sheen.mjs /absolute/current-body.html /absolute/new-candidate.html');
}
if (fs.existsSync(output)) throw new Error('Output exists; nothing will be overwritten');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const before = fs.readFileSync(input, 'utf8');
const baseline = 'c29620c604d825e315522b9edbc08b7189d6ea63ac384d6130b5cb4823417484';
const expected = '3b538d6cbbdf38d037143bac07bf6b80daabd60db42b9b3452b43cc4e2bc76d9';
if (digest(before) !== baseline) throw new Error('Baseline differs: inspect current code and rebase; do not overwrite');
const owner = /(<script id="kcl-b-optical-glass-runtime-20260904">)([\s\S]*?)(<\/script>)/;
const match = before.match(owner);
if (!match || digest(match[2]) !== '7a4c96745aaf4e4b0913c8ad75df6a4b8f73573e6ef9061c144aeab507ae5d2e') {
  throw new Error('Unexpected original optical runtime');
}
const oldBlock = '        var progress = Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));\n        readings.push({layer: layer, x: -120 + progress * 360});';
const newBlock = `        var isFixedNavigation = surface.matches(".kcl-premium-nav-toggle, #kcl-premium-primary-navigation.kcl-premium-nav-dropdown");
        var progress = isFixedNavigation
          ? (((window.scrollY || 0) / viewport + 0.5) % 1 + 1) % 1
          : Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
        /* At either wrap boundary, even the skewed band is entirely outside its clip. */
        var edge = 120 + 21 * rect.height / rect.width;
        var sheenX = isFixedNavigation ? -edge + progress * (110 + 2 * edge) : -120 + progress * 360;
        readings.push({layer: layer, x: sheenX});`;
if (match[2].split(oldBlock).length !== 2) throw new Error('Original block is not unique');
const runtime = match[2].replace(oldBlock, newBlock);
new Function(runtime);
const after = before.replace(owner, () => match[1] + runtime + match[3]);
if (digest(after) !== expected) throw new Error('Candidate differs from accepted bytes');
fs.writeFileSync(output, after, {flag: 'wx'});
console.log(JSON.stringify({bytes: Buffer.byteLength(after), sha256: digest(after), published: false}));
