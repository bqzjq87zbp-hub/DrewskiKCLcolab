#!/usr/bin/env node
// Independent 2026-09-11 linear-walk contract; historical B7m QA stays frozen.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const contract = JSON.parse(await readFile(new URL('docs/straight-walk/CONTRACT.json', root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {contract: contract.id, started: new Date().toISOString(), math: null, browser: process.env.QA_URL ? {status: 'PENDING'} : {status: 'NOT_RUN', reason: 'QA_URL not set'}, physicalDevice: false};
let checks = 0;
const check = (pass, message) => { assert(pass, message); checks++; };
const near = (actual, expected, message, tolerance = 1e-10) => check(Math.abs(actual - expected) <= tolerance, message);
const summary = manifest => manifest.categories.map(c => ({id: c.id, count: c.items.length}));
const identities = manifest => manifest.categories.map(c => ({id: c.id, items: c.items.map(i => i.id)}));

async function sourceMath() {
  const source = {};
  for (const [relative, expected] of Object.entries(contract.sourceSha256)) {
    source[relative] = await readFile(new URL(relative, root), 'utf8');
    check(sha(source[relative]) === expected, 'Source fingerprint changed: ' + relative);
  }
  const layout = await import(new URL('public/aisle/gallery-layout.js', root));
  const engine = source['public/aisle/photographic-aisle.js'];
  const integration = source['public/aisle-integration.js'];
  check(layout.TRAVEL === contract.travelMetres, 'Travel must remain 7 metres');
  check(JSON.stringify(layout.FOCUS_STOPS) === JSON.stringify(contract.focusStops), 'Focus stops changed');
  check(layout.LOOK_ANGLE === contract.requestedLookRadians, 'Requested manual look angle changed');
  check(engine.includes("look='ahead'"), 'Default look must be ahead');
  check(engine.includes("look==='left'?1:look==='right'?-1:0"), 'Only explicit left/right controls may request yaw');
  check(!engine.includes('galleryAutoYaw('), 'Engine must not request an automatic yaw tour');
  check(integration.includes("String(direction==='ahead')"), 'Ahead must be the initially pressed control');
  check(integration.includes('engine.viewport.append(looks)'), 'Manual look controls must be children of the visible viewport');
  check(!integration.includes("menu.querySelector('nav').append(looks)"), 'Manual look controls must not be moved inside the menu');

  const samples = Array.from({length: 201}, (_, i) => i / 200);
  for (const p of [-2, -1, ...samples, 2, 3]) {
    near(layout.galleryDistance(p), 7 * Math.max(0, Math.min(1, p)), 'Distance is not linear/clamped at ' + p);
    near(layout.galleryAutoYaw(p), 0, 'Legacy auto-yaw export must be zero at ' + p);
    for (const look of [-2, -1, -.5, 0, .5, 1, 2]) {
      near(layout.galleryLookYaw(p, look), .39 * Math.max(-1, Math.min(1, look)), 'Manual yaw depends on progress at ' + p);
    }
  }
  for (let i = 1; i < samples.length; i++) {
    const previous = layout.galleryDistance(samples[i - 1]);
    const current = layout.galleryDistance(samples[i]);
    check(current > previous, 'Forward travel contains a pause or reversal');
    near(current - previous, 7 / 200, 'Equal scroll intervals produce unequal travel');
    near(layout.galleryDistance([...samples].reverse()[samples.length - 1 - i]), current, 'Reverse traversal does not return to the same distance');
  }
  const manifest = JSON.parse(source['public/categories.json']);
  check(JSON.stringify(summary(manifest)) === JSON.stringify(contract.categories), '111-photo category inventory changed');
  const ids = manifest.categories.flatMap(c => c.items.map(i => i.id));
  check(ids.length === contract.photographs && new Set(ids).size === contract.photographs, 'Expected 111 distinct photograph identities');
  report.math = {status: 'PASS', checks, sourceSha256: contract.sourceSha256, categories: summary(manifest), progressSamples: samples.length};
  return manifest;
}

async function browserChecks(manifest) {
  const base = new URL(process.env.QA_URL);
  check(['http:', 'https:'].includes(base.protocol), 'QA_URL must be an HTTP(S) direct gallery URL');
  base.search = ''; base.hash = '';
  if (!base.pathname.endsWith('/')) throw Error('QA_URL must end in / and point directly to this unrewritten source preview, not a wrapper or index.html');
  const fingerprint = async () => {
    const result = {};
    for (const [relative, expected] of Object.entries(contract.sourceSha256)) {
      const response = await fetch(new URL(relative.replace(/^public\//, ''), base), {cache: 'no-store', signal: AbortSignal.timeout(10000)});
      check(response.ok, 'Served source unavailable: ' + relative + ' (' + response.status + ')');
      const bytes = Buffer.from(await response.arrayBuffer());
      result[relative] = sha(bytes);
      check(result[relative] === expected, 'Served bytes differ from this contract: ' + relative);
      if (relative.endsWith('categories.json')) {
        check(JSON.stringify(identities(JSON.parse(bytes))) === JSON.stringify(identities(manifest)), 'Served photograph identities differ');
      }
    }
    return result;
  };
  const before = await fingerprint();
  let chromium;
  try { ({chromium} = await import('playwright')); }
  catch (error) { throw new Error('Optional browser mode needs separately installed Playwright resolvable from this checkout. No packages were changed.', {cause: error}); }
  const browser = await chromium.launch({headless: true, ...(process.env.QA_CHANNEL ? {channel: process.env.QA_CHANNEL} : {})});
  report.browser = {status: 'RUNNING', url: base.href, engine: 'Chromium', physicalDevice: false, sourceSha256: before, cases: []};
  try {
    for (const profile of contract.browserProfiles) {
      const {width, height, touch} = profile;
      const row = {width, height, touch, checks: 0, samples: [], status: 'RUNNING'};
      report.browser.cases.push(row);
      const initialChecks = checks;
      const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch, reducedMotion: 'no-preference'});
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const read = () => page.evaluate(() => {
          const s = window.PhotographicAisle.getState();
          return {p: s.progress, z: s.cameraZ, y: scrollY, look: s.lookDirection, reduced: s.reducedMotion, ready: s.physical.ready, camera: s.physical.environment.camera,
            overflow: document.documentElement.scrollWidth - innerWidth,
            quads: s.slots.map(r => ({id: r.id, passed: r.passed, quad: r.projectedQuad}))};
        });
        const sample = async (label, ahead = true) => {
          await delay(220);
          const s = await read();
          check(s.ready && !s.reduced, 'Healthy ordinary walk required: ' + label);
          near(s.z, 7 * s.p, 'Rendered distance must equal 7 * progress: ' + label, 1e-8);
          check(s.camera.sourceEnvelope.inside, 'Photographic source envelope escaped: ' + label);
          check(s.overflow === 0, 'Horizontal overflow: ' + label);
          if (ahead) check(s.look === 'ahead' && s.camera.lookYaw === 0, 'Unrequested heading change: ' + label);
          row.samples.push({label, progress: s.p, distance: s.z, scrollY: s.y, look: s.look, yaw: s.camera.lookYaw});
          return s;
        };
        // Programmatic seeks sample the mapping; native movement below is tested separately.
        const seek = async p => {
          await page.evaluate(p => {
            const a = window.PhotographicAisle;
            scrollTo({top: a.journey.getBoundingClientRect().top + scrollY + a.getScrollRange() * p, behavior: 'instant'});
          }, p);
          await page.waitForFunction(p => Math.abs(window.PhotographicAisle.getState().progress - p) < .001, p);
        };
        await page.goto(base.href, {waitUntil: 'domcontentloaded'});
        await page.waitForFunction(() => window.PhotographicAisle?.getState().physical?.ready && window.PhotographicAisle.getState().physical.environment?.camera, null, {timeout: 45000});
        const entry = await sample('entry');
        const cdp = touch ? await context.newCDPSession(page) : null;
        const nativeMove = async forward => {
          if (cdp) {
            await cdp.send('Input.synthesizeScrollGesture', {x: width * .5, y: height * (forward ? .58 : .45),
              yDistance: forward ? -Math.min(600, height * .65) : Math.min(350, height * .4), speed: 450, preventFling: true, gestureSourceType: 'touch'});
          } else {
            await page.mouse.move(width * .5, height * .58);
            await page.mouse.wheel(0, forward ? 600 : -350);
          }
          await delay(350);
        };
        row.input = touch ? 'Chromium compositor synthetic touch swipe; not a physical device' : 'Browser wheel';
        await nativeMove(true);
        const forward = await sample('native-forward');
        check(forward.z > entry.z + .2, 'Native forward input did not advance');
        await nativeMove(false);
        const reverse = await sample('native-reverse');
        check(reverse.z < forward.z - .05, 'Native reverse input did not retreat');
        let middle;
        for (const p of [0, .25, .5, .75, 1, .5]) {
          await seek(p);
          const s = await sample('seek-' + p);
          if (p === .5 && !middle) middle = s;
          else if (p === .5) {
            assert.deepEqual(s.camera, middle.camera, 'Same progress must restore the exact camera');
            assert.deepEqual(s.quads, middle.quads, 'Same progress must restore exact projected artwork quads');
            checks += 2;
          }
        }
        const sideSupported = (await read()).camera.sideLookSupported;
        if (touch) check(sideSupported, '390px phone must support explicit side look');
        if (sideSupported) {
          const controls = page.locator('.aisle-viewport > .aisle-look-controls');
          check(await controls.isVisible(), 'Manual controls must be visible outside the closed menu');
          const boxes = await controls.locator('button').evaluateAll(buttons => buttons.map(b => {
            const r = b.getBoundingClientRect();
            return {width: r.width, height: r.height, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight};
          }));
          check(boxes.length === 3 && boxes.every(b => b.width >= 44 && b.height >= 44 && b.inside), 'Look controls must be usable viewport targets');
          for (const [direction, sign] of [['left', 1], ['right', -1]]) {
            await seek(.4);
            const beforeLook = await read();
            await controls.getByRole('button', {name: 'Look ' + direction, exact: true}).click();
            const aimed = await sample('look-' + direction, false);
            check(aimed.look === direction && aimed.camera.lookYaw * sign > 0, 'Explicit look has wrong direction');
            check(aimed.y === beforeLook.y && aimed.z === beforeLook.z, 'Looking changed forward position');
            await nativeMove(true);
            const walking = await sample('walk-looking-' + direction, false);
            check(walking.z > aimed.z && walking.look === direction, 'Manual look prevented forward movement');
            near(walking.camera.lookYaw, aimed.camera.lookYaw, 'Manual heading changed during scrolling');
          }
          await controls.getByRole('button', {name: 'Look ahead', exact: true}).click();
          await sample('ahead-restored');
          row.manualLook = 'PASS';
        } else row.manualLook = 'NOT_APPLICABLE: source guard does not offer side look at this viewport';

        await seek(.5);
        const beforeCollection = await sample('before-collection');
        await page.locator('#menu-toggle').click();
        await page.locator('#menu-panel a[href="#collection/coastal"]').click();
        await page.locator('.collection-grid .collection-photo').first().waitFor();
        check(await page.locator('.collection-grid .collection-photo').count() === contract.categories.find(c => c.id === 'coastal').count, 'Coastal collection count differs');
        await page.locator('.collection-back').click();
        await page.waitForFunction(() => document.body.dataset.view === 'aisle');
        const returned = await sample('collection-return');
        near(returned.p, beforeCollection.p, 'Collection return changed progress', 1e-5);
        check(returned.look === beforeCollection.look && returned.y === beforeCollection.y, 'Collection return changed heading or exact scroll position');
        assert.deepEqual(returned.camera, beforeCollection.camera, 'Collection return changed the exact camera');
        assert.deepEqual(returned.quads, beforeCollection.quads, 'Collection return changed exact artwork projection');
        checks += 2;
        check(errors.length === 0, 'Browser JavaScript errors: ' + errors.join('; '));
        row.status = 'PASS';
      } catch (error) {
        row.status = 'FAIL'; row.error = String(error); throw error;
      } finally {
        row.checks = checks - initialChecks;
        await context.close();
      }
    }
    assert.deepEqual(await fingerprint(), before, 'Served source changed during browser run');
    check(true, 'Served source stable');
    report.browser.status = 'PASS';
  } finally { await browser.close(); }
}

try {
  const manifest = await sourceMath();
  if (process.env.QA_URL) await browserChecks(manifest);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error);
  if (process.env.QA_URL && report.browser.status !== 'PASS') report.browser.status = 'FAIL';
  process.exitCode = 1;
} finally {
  report.checks = checks;
  report.finished = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}
