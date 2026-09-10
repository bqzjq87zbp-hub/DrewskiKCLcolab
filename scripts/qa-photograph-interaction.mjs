/**
 * Reproduce the guided gallery's interaction checks with exclusive GPU access.
 * QA_URL=http://localhost:4278 QA_OUTPUT=/tmp/photograph-interaction
 *   node scripts/qa-photograph-interaction.mjs
 * Install Playwright separately or set PLAYWRIGHT_MODULE to its import path.
 * QA_ONLY=still or cleanup runs only the corresponding focused checks.
 * --prepare checks the execution gate without launching a browser.
 * Emulated input is functional evidence, not physical-phone performance.
 * The independent coverage helper owns ten-photo visibility; this helper does not.
 * Verification history: initial full run 304/306; two Still expectations wrongly
 * used raw slots without category/headshot curation. The corrected Still-only
 * retry passed 28/28. The original negative report remains preserved separately.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Deliberate execution gate: --prepare must not acquire the GPU.
if (process.argv.includes('--prepare')) {
  console.log('Prepared only. Run the script without --prepare only with exclusive GPU access.');
  process.exit(0);
}
const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium} = await import(moduleName?(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName):'playwright');
const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output = path.resolve(process.env.QA_OUTPUT || path.join(os.tmpdir(), 'photograph-interaction-' + new Date().toISOString().replaceAll(':', '-')));
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(output, {recursive: false});
const base = process.env.QA_URL || 'http://localhost:4278/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceAssets=JSON.parse(await fs.readFile(path.join(work,'docs/asset-manifest.json'),'utf8')).assets;
const frames=JSON.parse(await fs.readFile(path.join(work,'public/video/frames.json'),'utf8')).frames;
const textures=JSON.parse(await fs.readFile(path.join(work,'public/aisle/assets/texture-manifest.json'),'utf8'));
const sourceManifest={sourceBefore:[...sourceAssets.map(p=>({path:p.path,sha256:p.sha256})),...frames.map(p=>({path:'public/video/'+p.file,sha256:p.sha256})),...textures.map(p=>({path:'public/aisle/assets/'+p.file,sha256:p.sha256}))].sort((a,b)=>a.path.localeCompare(b.path))};
const contractRelative='docs/easel-review/photo-guided/SCROLL-PATH-CONTRACT.json';
const contractPath = path.join(work,contractRelative);
const contractBytes = await fs.readFile(contractPath);
const independentContract = JSON.parse(contractBytes);
if(independentContract.version!=='B7m-moving-reads-v1')throw Error('Review the new contract version before adapting the audit.');
const reading=independentContract.readIntervals.find(r=>r.row===2&&r.side==='left');
const contract={...independentContract,
  distanceKeys:independentContract.keys.map(k=>[k.progress,k.distance]),
  yawKeys:independentContract.keys.map(k=>[k.progress,k.phoneYaw]),
  distanceInterpolation:'smoothstep',yawInterpolation:'smoothstep',
  phonePitch:independentContract.phonePitchRadians,
  gallerySourceSHA256:independentContract.hashes['gallery-layout.js'],
  placements:independentContract.physicalPrints.map(p=>({id:p.id,worldPosition:p.position,worldRotation:[0,p.yaw,0],worldFrontCorners:p.worldFrontCorners})),
  roundTripProgress:(reading.startProgress+reading.endProgress)/2,
};
function validateKeys(keys, name) {
  if (!Array.isArray(keys) || keys.length < 2 || keys[0][0] !== 0 || keys.at(-1)[0] !== 1 || keys.some((v, i) => !Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || (i && v[0] <= keys[i - 1][0]))) throw Error('Invalid ' + name);
}
validateKeys(contract.distanceKeys, 'distanceKeys'); validateKeys(contract.yawKeys, 'yawKeys');
if (!(contract.travel > 0) || contract.distanceKeys[0][1] !== 0 || contract.distanceKeys.at(-1)[1] !== contract.travel || contract.distanceKeys.some((v,i)=>i&&v[1]<contract.distanceKeys[i-1][1])) throw Error('Distance contract must be monotone from zero to travel.');
if (!['linear','smoothstep'].includes(contract.distanceInterpolation) || !['linear','smoothstep'].includes(contract.yawInterpolation)) throw Error('Explicit distance/yaw interpolation required.');
if (!Array.isArray(contract.expectedIds) || new Set(contract.expectedIds).size !== 10 || contract.expectedIds.length !== 10 || !Number.isFinite(contract.phonePitch) || !Array.isArray(contract.focusStops) || !/^[a-f0-9]{64}$/.test(contract.gallerySourceSHA256) || !Array.isArray(contract.placements) || contract.placements.length!==10) throw Error('Incomplete candidate contract.');
function interpolate(progress, keys, interpolation) {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0; while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [ap, ay] = keys[i], [bp, by] = keys[i + 1], t = Math.max(0, Math.min(1, (p - ap) / (bp - ap)));
  return ay + (by - ay) * (interpolation === 'smoothstep' ? t * t * (3 - 2 * t) : t);
}
const expectedDistance = p => interpolate(p, contract.distanceKeys, contract.distanceInterpolation);
const expectedAutoYaw = p => interpolate(p, contract.yawKeys, contract.yawInterpolation);
const runtime = ['/main-v2.js', '/collections.js', '/collections.css', '/canvas-wrap.js', '/aisle-integration.js', '/aisle/aisle.css', '/aisle/photographic-aisle.js', '/aisle/physical-display.js', '/aisle/physical-easel.js', '/aisle/photographic-environment.js', '/aisle/gallery-layout.js', '/aisle/video-frame-seam.js', '/aisle/water-surface.js', '/aisle/easel-masks.js', '/aisle/assets/easel-geometry.js', '/vendor/three.module.js', '/vendor/three.core.min.js'];
const slots = JSON.parse(await fs.readFile(path.join(work,'public/slots.json'),'utf8'));
const categories=JSON.parse(await fs.readFile(path.join(work,'public/categories.json'),'utf8')).categories;
// Canonical application curation: raw geometry slots have no category field;
// the fourth frame introduces the first professional-client headshot.
const categoryIds=['families','families','families','headshots','branding','branding','coastal','branding','branding','coastal'];
const expectedFallback=slots.map((s,i)=>({href:'#collection/'+categoryIds[i],src:i===3?categories.find(c=>c.id==='headshots').items[0].src:s.src}));
if (JSON.stringify(slots.map(s=>s.id).sort()) !== JSON.stringify([...contract.expectedIds].sort())) throw Error('Frozen contract does not match the exact ten source slot IDs.');
async function fingerprint() {
  const originals = await Promise.all(sourceManifest.sourceBefore.map(async ({path: p}) => ({path: p, sha256: sha(await fs.readFile(path.join(work, p)))})));
  const modules = await Promise.all(runtime.map(async url => { const r = await fetch(new URL(url, base),{cache:'no-store'}); return {url, status: r.status, sha256: sha(Buffer.from(await r.arrayBuffer())), localSHA256:sha(await fs.readFile(path.join(work,'public',url.slice(1))))}; }));
  return {originals, modules};
}
const report = {created: new Date().toISOString(), base, scope: 'Bounded native input, monotone scroll-guided distance/yaw, idle motion, Still, return-state, overlays and actual resize preservation', checks: [], cases: [], errors: [], warnings: [], httpErrors: [], requestFailures:[], fixtureRequests:[], limitations: ['Installed Chrome with emulated touch/viewport; not direct Codex panel control or a physical phone.', 'No real-device timing or performance claim.', 'This is not ten-photo coverage or continuous-motion visual acceptance; link the separate all-ten inspection-interval and normal appearance evidence.', 'Water screenshot differences establish rendered change, not physical fluid/contact correctness.']};
report.harness={file:'scripts/qa-photograph-interaction.mjs',sha256:sha(await fs.readFile(fileURLToPath(import.meta.url)))};
const only=process.env.QA_ONLY||null;if(only&&!['still','cleanup'].includes(only))throw Error('QA_ONLY supports the documented still or cleanup checks.');
report.only=only;
report.contract = {file: contractRelative, sha256: sha(contractBytes), ...contract};
const check = (name, pass, evidence = {}) => report.checks.push({name, pass: Boolean(pass), ...evidence});
const save = () => fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
report.before = await fingerprint();
check('all required runtime modules load', report.before.modules.every(m => m.status === 200));
check('served runtime matches current local files', report.before.modules.every(m=>m.sha256===m.localSHA256));
check('gallery layout matches independently frozen contract', report.before.modules.find(m=>m.url==='/aisle/gallery-layout.js')?.sha256===contract.gallerySourceSHA256);
check('original source identity matches accepted manifest', JSON.stringify(report.before.originals)===JSON.stringify(sourceManifest.sourceBefore));
if(report.checks.some(c=>!c.pass)){report.status='PREFLIGHT FAIL';await save();throw Error('Preflight failed; browser not launched.');}
const browser = await chromium.launch({channel: process.env.QA_BROWSER_CHANNEL||'chrome', headless: true});

async function ready(page) {
  await page.waitForFunction(() => window.PhotographicAisle?.getState().physical?.ready && window.PhotographicAisle.getState().physical.environment?.camera, null, {timeout: 45000});
  await page.evaluate(() => document.fonts.ready);
  await settleScroll(page);
}
async function twoFrames(page) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function settleScroll(page) {
  await page.evaluate(() => { window.__inputAuditStable = {y: scrollY, at: performance.now()}; });
  await page.waitForFunction(() => { const q = window.__inputAuditStable; if (q.y !== scrollY) { q.y = scrollY; q.at = performance.now(); } return performance.now() - q.at > 250; }, null, {timeout: 10000});
  await twoFrames(page);
}
async function atProgress(page, p) {
  await page.evaluate(p => { const a = window.PhotographicAisle; scrollTo({top: Math.round(a.journey.getBoundingClientRect().top + scrollY + p * a.getScrollRange()), behavior: 'instant'}); }, p);
  await page.waitForFunction(p => Math.abs(window.PhotographicAisle.getState().progress - p) < .001, p, {timeout: 10000});
  await settleScroll(page);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const a = window.PhotographicAisle, s = a.getState();
    const rect = e => { const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height}; };
    const visible = e => { if (!e || e.closest('[hidden]') || !e.getClientRects().length) return false; for (let n = e; n instanceof Element; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < .05) return false; } return true; };
    const items = selector => [...document.querySelectorAll(selector)].filter(visible).map(e => ({id: e.id || e.className, text: e.textContent.trim(), rect: rect(e)}));
    const labels = items('.aisle-category-sign'), controls = items('#menu-toggle,#menu-panel,.aisle-progress,.aisle-invitation,.aisle-start-walk');
    const overlap = (a, b) => a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5;
    const collisions = labels.flatMap(a => controls.filter(b => overlap(a.rect, b.rect)).map(b => ({label: a.text, control: b.id})));
    const controlCollisions = controls.flatMap((a, i) => controls.slice(i + 1).filter(b => overlap(a.rect, b.rect)).map(b => [a.id, b.id]));
    const panel = document.querySelector('#menu-panel');
    return {state: s, scene: rect(a.viewport), inner: [innerWidth, innerHeight], documentWidth: document.documentElement.scrollWidth, view: document.body.dataset.view, labels, controls, collisions, controlCollisions, menu: {hidden: panel.hidden, rect: rect(panel), clientHeight: panel.clientHeight, scrollHeight: panel.scrollHeight, scrollTop: panel.scrollTop}, startVisible: visible(document.querySelector('.aisle-start-walk')), fallbackVisible: visible(document.querySelector('.aisle-fallback')), fallbackLinks:[...document.querySelectorAll('.aisle-fallback a')].map(e=>({href:e.getAttribute('href'),src:e.querySelector('img')?.getAttribute('src')})), focusedSlot: document.activeElement?.closest('.aisle-slot')?.dataset.slotId || null};
  });
}
function pose(s) {
  return {scrollY: s.state.scrollY, progress: s.state.progress, cameraZ: s.state.cameraZ, viewport: s.state.viewport, distance: s.state.physical.cameraDistance, camera: s.state.physical.environment.camera, quads: s.state.slots.map(q => ({id: q.id, quad: q.projectedQuad}))};
}
const exactPose = (a, b) => JSON.stringify(pose(a)) === JSON.stringify(pose(b));
function layoutChecks(id, s) {
  check(id + ': no horizontal overflow', s.documentWidth <= s.inner[0] + 1, {documentWidth: s.documentWidth, width: s.inner[0]});
  check(id + ': labels clear of Menu and HUD', !s.collisions.length && !s.controlCollisions.length, {labelCollisions: s.collisions, controlCollisions: s.controlCollisions});
  if (!s.state.reducedMotion && s.view !== 'collection') {
    check(id + ': stage remains inside viewport', s.scene.top >= -.5 && s.scene.bottom <= s.inner[1] + .5 && s.scene.left >= -.5 && s.scene.right <= s.inner[0] + .5, {scene: s.scene});
    const distance=expectedDistance(s.state.progress);
    check(id + ': distance follows frozen guided map', Math.abs(s.state.physical.cameraDistance-distance)<1e-8&&(s.state.video.committedFrame!==null?s.state.cameraZ===null:Math.abs(s.state.cameraZ-distance)<1e-8)&&Math.abs(s.state.physical.environment.camera.distance-distance)<1e-8, {progress:s.state.progress,expected:distance,physical:s.state.physical.cameraDistance,engine:s.state.cameraZ,camera:s.state.physical.environment.camera.distance});
    check(id + ': source remains guarded', s.state.physical.environment.camera.sourceEnvelope?.inside === true);
    if (s.state.lookDirection === 'auto') {
      const camera = s.state.physical.environment.camera, expected = camera.sideLookSupported ? expectedAutoYaw(s.state.progress) : 0;
      check(id + ': Auto yaw matches independent guided contract', Math.abs(camera.lookYaw - expected) < 1e-8, {actual: camera.lookYaw, expected});
    }
  }
}
async function capture(page, c, name) {
  const s = await snapshot(page), file = `${c.id}-${name}.png`;
  const bytes = await page.screenshot({path: path.join(output, file)});
  c.snapshots.push({name, file, sha256: sha(bytes), ...s});
  layoutChecks(c.id + '/' + name, s);
  return s;
}
async function menu(page, open) {
  if ((await page.locator('#menu-panel').isVisible()) !== open) await page.locator('#menu-toggle').click();
  await twoFrames(page);
}
async function nativeMove(context, page, config, forward) {
  if (!config.touch) {
    const s = await snapshot(page); await page.mouse.move(config.width / 2, s.scene.y + s.scene.height * .65);
    await page.mouse.wheel(0, forward ? 360 : -260);
  } else {
    const cdp = await context.newCDPSession(page), x = Math.round(config.width * .5), from = config.height * (forward ? .74 : .36), to = config.height * (forward ? .37 : .70);
    try {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: from, id: 1}]});
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: from + (to - from) * i / 12, id: 1}]}); await page.waitForTimeout(24); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    } finally { await cdp.detach(); }
  }
  await settleScroll(page);
}
async function idleAudit(page, c, label, reduced) {
  const a = await snapshot(page), beforeFile = `${c.id}-${label}-a.png`, afterFile = `${c.id}-${label}-b.png`;
  const before = await page.screenshot({path: path.join(output, beforeFile)});
  await page.waitForTimeout(reduced?2000:700);
  const b = await snapshot(page), after = await page.screenshot({path: path.join(output, afterFile)});
  const ma = a.state.physical.environment.waterMotion, mb = b.state.physical.environment.waterMotion;
  check(c.id + '/' + label + ': exact camera and quads at idle', exactPose(a, b), {before: pose(a), after: pose(b)});
  if (reduced) {
    check(c.id + '/' + label + ': ambient motion stops', !ma.enabled && !mb.enabled && ma.phase === 0 && mb.phase === 0 && a.state.physical.waterPhase === 0 && b.state.physical.waterPhase === 0, {before: ma, after: mb});
    check(c.id + '/' + label + ': idle reduced captures identical', before.equals(after));
  } else {
    check(c.id + '/' + label + ': ambient water continues', ma.enabled && mb.enabled && mb.phase !== ma.phase && b.state.physical.waterPhase !== a.state.physical.waterPhase, {before: ma, after: mb});
    check(c.id + '/' + label + ': normal idle captures differ', !before.equals(after));
  }
  c.idle.push({label, reduced,waitMs:reduced?2000:700, beforeFile, afterFile, beforeHash: sha(before), afterHash: sha(after), before: a, after: b});
}
async function menuAndSteps(page, c, config) {
  await atProgress(page, .30); const before = await snapshot(page); await menu(page, true);
  const open = await capture(page, c, 'menu');
  check(c.id + ': open menu bounded by scene', open.menu.rect.top >= open.scene.top - .5 && open.menu.rect.bottom <= open.scene.bottom + .5, {menu: open.menu.rect, scene: open.scene});
  if (!config.touch && open.menu.scrollHeight > open.menu.clientHeight + 1) {
    const r = open.menu.rect; await page.mouse.move(r.x + r.width / 2, r.y + Math.min(60, r.height / 2)); await page.mouse.wheel(0, 900); await settleScroll(page);
  } else await page.locator('.aisle-step-controls button').last().scrollIntoViewIfNeeded();
  const internal = await snapshot(page), last = await page.locator('.aisle-step-controls button').last().evaluate(e => { const a = e.getBoundingClientRect(), b = e.closest('nav').getBoundingClientRect(); return {top: a.top, bottom: a.bottom, panelTop: b.top, panelBottom: b.bottom}; });
  check(c.id + ': menu access preserves journey position', internal.state.scrollY === before.state.scrollY);
  check(c.id + ': final menu control reachable', last.top >= last.panelTop - .5 && last.bottom <= last.panelBottom + .5, {last});
  const stops = await page.evaluate(async () => [...(await import('/aisle/gallery-layout.js')).FOCUS_STOPS]);
  check(c.id+': navigation stops match frozen contract',JSON.stringify(stops)===JSON.stringify(contract.focusStops),{actual:stops,expected:contract.focusStops});
  const targetNext = stops.find(p => p > before.state.progress + .015);
  await page.getByRole('button', {name: 'Walk forward to the next pair of canvases', exact: true}).click();
  await page.waitForFunction(p => Math.abs(window.PhotographicAisle.getState().progress - p) < .001, targetNext); await settleScroll(page);
  const next = await snapshot(page), targetPrevious = [...stops].reverse().find(p => p < next.state.progress - .015);
  check(c.id + ': Next pair reaches authored stop', Math.abs(next.state.progress - targetNext) < .001, {targetNext, actual: next.state.progress});
  await page.getByRole('button', {name: 'Walk back to the previous pair of canvases', exact: true}).click();
  await page.waitForFunction(p => Math.abs(window.PhotographicAisle.getState().progress - p) < .001, targetPrevious); await settleScroll(page);
  const previous = await snapshot(page); check(c.id + ': Previous pair reaches authored stop', Math.abs(previous.state.progress - targetPrevious) < .001, {targetPrevious, actual: previous.state.progress});
  await menu(page, false); c.navigation = {before, open, internal, next, previous};
}
async function photoRoundTrip(page, c, config) {
  await atProgress(page, contract.roundTripProgress ?? .27); const before = await snapshot(page);
  const candidates = before.state.slots.filter(s => s.interactive && !s.passed && s.projectedQuad.every(q => q.x >= 1 && q.x <= before.scene.width - 1 && q.y >= 1 && q.y <= before.scene.height - 1));
  candidates.sort((a, b) => Math.max(...b.projectedQuad.map((q, i) => Math.hypot(q.x - b.projectedQuad[(i + 1) % 4].x, q.y - b.projectedQuad[(i + 1) % 4].y))) - Math.max(...a.projectedQuad.map((q, i) => Math.hypot(q.x - a.projectedQuad[(i + 1) % 4].x, q.y - a.projectedQuad[(i + 1) % 4].y))));
  const target = candidates[0]; if (!target) throw Error('No complete interactive canvas at selected normal Auto pose.');
  const x = before.scene.x + target.projectedQuad.reduce((v, q) => v + q.x, 0) / 4, y = before.scene.y + target.projectedQuad.reduce((v, q) => v + q.y, 0) / 4;
  const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.closest('.aisle-slot')?.dataset.slotId, {x, y});
  check(c.id + ': featured photo hit target matches canvas', hit === target.id, {target: target.id, hit});
  if (config.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await page.waitForFunction(() => document.body.dataset.view === 'collection');
  const photo = page.locator('#collection-view .collection-grid .collection-photo').first();
  await photo.scrollIntoViewIfNeeded(); const collectionY = await page.evaluate(() => scrollY); await photo.click();
  await page.waitForFunction(() => document.querySelector('#viewer').open && document.querySelector('#full-photo').getAttribute('aria-busy') === 'false');
  await page.screenshot({path: path.join(output, c.id + '-photo-dialog.png')});
  await page.locator('#close').click(); await settleScroll(page);
  check(c.id + ': photo dialog returns to collection position', Math.abs(await page.evaluate(() => scrollY) - collectionY) <= 1);
  await page.locator('.collection-back').click(); await page.waitForFunction(() => document.body.dataset.view === 'aisle');
  await page.waitForFunction(y => Math.abs(scrollY - y) <= 1 && window.PhotographicAisle.getState().viewport.width > 0, before.state.scrollY); await settleScroll(page);
  const after = await capture(page, c, 'collection-return');
  check(c.id + ': collection return restores exact camera and quads', exactPose(before, after), {before: pose(before), after: pose(after)});
  check(c.id + ': collection return restores canvas focus', after.focusedSlot === target.id, {expected: target.id, actual: after.focusedSlot});
  c.photoRoundTrip = {target: target.id, before, after};
}
async function stillAudit(page, c) {
  await atProgress(page, 0); await menu(page, true); await page.locator('#travel-mode').selectOption('still'); await menu(page, false);
  await page.waitForFunction(() => window.PhotographicAisle.getState().reducedMotion); await settleScroll(page);
  const explicit = await capture(page, c, 'explicit-still');
  check(c.id + ': explicit Still exposes all correct source links', explicit.fallbackVisible && JSON.stringify(explicit.fallbackLinks)===JSON.stringify(expectedFallback) && explicit.startVisible && explicit.state.progress === 0, {fallbackLinks: explicit.fallbackLinks,expectedFallback, progress: explicit.state.progress});
  await page.reload(); await ready(page); const saved = await snapshot(page);
  check(c.id + ': saved Still preference restores', saved.state.motionPreference === 'still' && saved.state.reducedMotion && saved.fallbackVisible && JSON.stringify(saved.fallbackLinks)===JSON.stringify(expectedFallback));
  await page.locator('.aisle-start-walk').click(); await page.waitForFunction(() => window.PhotographicAisle.getState().motionPreference === 'guided' && !window.PhotographicAisle.getState().reducedMotion); await settleScroll(page);
  const restarted = await snapshot(page); check(c.id + ': Start walk leaves Still fallback', !restarted.fallbackVisible && !restarted.startVisible && restarted.state.motionPreference === 'guided');
  c.still = {explicit, saved, restarted};
}

async function manualLookAudit(page,c){
  await atProgress(page,contract.roundTripProgress);const before=await snapshot(page);
  for(const [name,direction,sign] of [['Look left','left',1],['Look right','right',-1]]){
    await menu(page,true);await page.getByRole('button',{name,exact:true}).click();await menu(page,false);await settleScroll(page);
    const after=await snapshot(page);
    check(c.id+': '+name+' changes yaw without moving forward',after.state.lookDirection===direction&&after.state.physical.environment.camera.lookYaw*sign>0&&after.state.scrollY===before.state.scrollY&&after.state.physical.cameraDistance===before.state.physical.cameraDistance,{direction:after.state.lookDirection,yaw:after.state.physical.environment.camera.lookYaw,scrollY:after.state.scrollY,distance:after.state.physical.cameraDistance});
    check(c.id+': '+name+' remains within source envelope',after.state.physical.environment.camera.sourceEnvelope.inside===true);
  }
  await menu(page,true);await page.getByRole('button',{name:'Auto',exact:true}).click();await menu(page,false);await settleScroll(page);
  const after=await capture(page,c,'manual-look-return-auto');
  check(c.id+': Auto return restores exact progress pose',exactPose(before,after));
}

async function optionalVideoAudit(page,c){
  await atProgress(page,.5);const before=await capture(page,c,'video-half-before');
  check(c.id+': video toggle begins at exact half progress',before.state.progress===.5,{progress:before.state.progress,scrollRange:before.state.scrollRange});
  await menu(page,true);await page.locator('.aisle-video-toggle').click();
  await page.waitForFunction(()=>window.PhotographicAisle.getState().video.committedFrame!==null,null,{timeout:30000});
  await menu(page,false);await settleScroll(page);const enabled=await capture(page,c,'video-half-enabled');
  check(c.id+': opt-in video preserves half-progress physical distance',enabled.state.progress===.5&&enabled.state.physical.cameraDistance===before.state.physical.cameraDistance&&enabled.state.scrollY===before.state.scrollY,{before:before.state.physical.cameraDistance,after:enabled.state.physical.cameraDistance,progress:enabled.state.progress,frame:enabled.state.video.committedFrame});
  check(c.id+': opt-in video remains labeled experimental',await page.locator('.aisle-video-status').textContent()==='Experimental video preview · alignment still in review.');
  await menu(page,true);await page.locator('.aisle-video-toggle').click();await page.waitForFunction(()=>window.PhotographicAisle.getState().video.committedFrame===null);await menu(page,false);await settleScroll(page);
  const after=await capture(page,c,'video-half-return');
  check(c.id+': video off restores exact photographic camera and quads',exactPose(before,after),{before:pose(before),after:pose(after)});
  c.optionalVideo={before,enabled,after};
}

async function enterFeaturedCollection(page){
  const target=await page.evaluate(()=>{
    const a=window.PhotographicAisle,s=a.getState(),r=a.viewport.getBoundingClientRect();
    const photos=s.slots.filter(p=>p.interactive&&!p.passed&&p.projectedQuad.every(q=>q.x>1&&q.x<s.viewport.width-1&&q.y>1&&q.y<s.viewport.height-1));
    photos.sort((a,b)=>(Math.max(...b.projectedQuad.map(q=>q.x))-Math.min(...b.projectedQuad.map(q=>q.x)))-(Math.max(...a.projectedQuad.map(q=>q.x))-Math.min(...a.projectedQuad.map(q=>q.x))));
    const p=photos[0];if(!p)return null;
    const x=r.x+p.projectedQuad.reduce((v,q)=>v+q.x,0)/4,y=r.y+p.projectedQuad.reduce((v,q)=>v+q.y,0)/4;
    return{id:p.id,x,y,hit:document.elementFromPoint(x,y)?.closest('.aisle-slot')?.dataset.slotId};
  });
  if(!target){await menu(page,true);await page.locator('#menu-panel a[href="#collection/branding"]').click();await page.waitForFunction(()=>document.body.dataset.view==='collection');return{id:null,trigger:'menu-toggle'};}
  if(target.hit!==target.id)throw Error('Featured photograph hit target mismatch');
  await page.mouse.click(target.x,target.y);await page.waitForFunction(()=>document.body.dataset.view==='collection');return target;
}
async function settledReturnTrace(page){
  await page.waitForFunction(()=>document.body.dataset.view==='aisle'&&window.PhotographicAisle.getState().viewport.width>0);
  const trace=[];
  for(let i=0;i<20;i++){await page.waitForTimeout(100);trace.push(await page.evaluate(()=>({at:performance.now(),scrollY,progress:window.PhotographicAisle.getState().progress,focus:document.activeElement?.closest('.aisle-slot')?.dataset.slotId||null})));}
  await settleScroll(page);return trace;
}
async function collectionResizeAudit(page,c){
  c.collectionResize=[];
  for(const [from,to] of [[{width:800,height:900},{width:390,height:844}],[{width:390,height:844},{width:800,height:900}]]){
    await page.setViewportSize(from);await settleScroll(page);await atProgress(page,.6);const before=await capture(page,c,`collection-resize-${from.width}-before`);
    const target=await enterFeaturedCollection(page);
    const saved=await page.evaluate(()=>history.state);await page.setViewportSize(to);await page.waitForTimeout(300);
    await page.locator('.collection-back').click();const trace=await settledReturnTrace(page),after=await capture(page,c,`collection-resize-${from.width}-to-${to.width}`);
    const tolerance=1.1/before.state.scrollRange+1.1/after.state.scrollRange;
    check(c.id+`: collection return preserves fraction ${from.width} to ${to.width}`,Math.abs(after.state.progress-before.state.progress)<=tolerance&&trace.slice(-5).every(s=>Math.abs(s.progress-before.state.progress)<=tolerance),{before:before.state.progress,after:after.state.progress,tolerance,trace});
    const focus=target.id?after.focusedSlot:await page.evaluate(()=>document.activeElement?.id);
    check(c.id+`: resized collection return restores selected focus ${from.width} to ${to.width}`,focus===(target.id||target.trigger),{expected:target.id||target.trigger,actual:focus});
    c.collectionResize.push({from,to,before,after,target,saved,trace});
  }
}
async function stillRawReturnAudit(page,c){
  await atProgress(page,0);await menu(page,true);await page.locator('#travel-mode').selectOption('still');await menu(page,false);await settleScroll(page);
  await page.evaluate(()=>scrollTo({top:450,behavior:'instant'}));const link=page.locator('.aisle-fallback a').nth(2);await link.scrollIntoViewIfNeeded();await settleScroll(page);
  const before=await snapshot(page),saved=await page.evaluate(()=>window.PhotographicAisle.captureReturnPosition());
  check(c.id+': Still capture uses nonzero raw scroll only',saved.scrollY>0&&saved.progress===null,{saved});
  await link.click();await page.waitForFunction(()=>document.body.dataset.view==='collection');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('.collection-back').click();const trace=await settledReturnTrace(page),after=await capture(page,c,'still-raw-return');
  check(c.id+': Still collection resize return retains raw scroll',after.state.reducedMotion&&Math.abs(after.state.scrollY-before.state.scrollY)<=1&&trace.slice(-5).every(s=>Math.abs(s.scrollY-before.state.scrollY)<=1),{before:before.state.scrollY,after:after.state.scrollY,trace});
  c.stillRawReturn={before,after,saved,trace};
  await page.locator('.aisle-start-walk').click();await page.waitForFunction(()=>!window.PhotographicAisle.getState().reducedMotion);await settleScroll(page);
}
async function stepThresholdAudit(page,c){
  await page.setViewportSize({width:800,height:900});await settleScroll(page);
  const prev=page.getByRole('button',{name:'Walk back to the previous pair of canvases',exact:true}),next=page.getByRole('button',{name:'Walk forward to the next pair of canvases',exact:true});
  for(const t of [{p:.012,disabled:prev,enabled:next,target:.2,name:'near start'},{p:.786,disabled:next,enabled:prev,target:.6,name:'near last stop'}]){
    await atProgress(page,t.p);await menu(page,true);const before=await snapshot(page);
    check(c.id+': disabled pair control matches target availability '+t.name,await t.disabled.isDisabled()&&await t.enabled.isEnabled(),{progress:before.state.progress});
    await t.enabled.click();await page.waitForFunction(p=>Math.abs(window.PhotographicAisle.getState().progress-p)<.001,t.target);await settleScroll(page);const after=await capture(page,c,'step-'+t.name.replaceAll(' ','-'));
    check(c.id+': valid neighboring pair click reaches target '+t.name,Math.abs(after.state.progress-t.target)<.001,{target:t.target,actual:after.state.progress});await menu(page,false);
  }
}

async function resizeAndReload(page,c){
  async function change(size){
    await page.setViewportSize(size);
    await page.waitForFunction(()=>{const a=window.PhotographicAisle,s=a.getState();return s.viewport.width===a.viewport.clientWidth&&s.viewport.height===a.viewport.clientHeight&&s.viewport.width>0;});
    await settleScroll(page);
  }
  await change({width:800,height:900});await atProgress(page,.51);
  const before=await capture(page,c,'resize-before');c.resize={before,steps:[]};
  // Do not call atProgress after these resizes: that would hide the regression.
  for(const size of [{width:1200,height:400},{width:800,height:900}]){
    await change(size);const after=await capture(page,c,`resize-${size.width}x${size.height}`);
    const tolerance=1.1/before.state.scrollRange+1.1/after.state.scrollRange;
    check(c.id+`: actual resize preserves progress ${size.width}x${size.height}`,Math.abs(after.state.progress-before.state.progress)<=tolerance,{before:before.state.progress,after:after.state.progress,tolerance,scrollY:after.state.scrollY,range:after.state.scrollRange});
    c.resize.steps.push(after);
    if(size.height===400){
      await menu(page,true);const open=await capture(page,c,'short-menu');
      check(c.id+': short viewport Menu stays within actual scene',open.menu.rect.top>=open.scene.top-.5&&open.menu.rect.bottom<=open.scene.bottom+.5,{scene:open.scene,menu:open.menu.rect});
      await page.locator('.aisle-step-controls button').last().scrollIntoViewIfNeeded();await settleScroll(page);
      const last=await page.locator('.aisle-step-controls button').last().evaluate(e=>{const r=e.getBoundingClientRect(),n=e.closest('nav').getBoundingClientRect();return{top:r.top,bottom:r.bottom,panelTop:n.top,panelBottom:n.bottom};});
      const internal=await snapshot(page);
      check(c.id+': short Menu last control reachable without moving journey',last.top>=last.panelTop-.5&&last.bottom<=last.panelBottom+.5&&internal.state.scrollY===open.state.scrollY,{last,before:open.state.scrollY,after:internal.state.scrollY});
      await menu(page,false);
    }
  }
  const beforeReload=await snapshot(page),hasReload=await page.evaluate(()=>Boolean(window.__guidedAuditSources?.find(s=>s.url.endsWith('/__preview_events'))?.onmessage));
  check(c.id+': actual development reload handler is available',hasReload);
  if(hasReload){
    await Promise.all([page.waitForEvent('load'),page.evaluate(()=>window.__guidedAuditSources.find(s=>s.url.endsWith('/__preview_events')).onmessage(new MessageEvent('message',{data:'reload'})))]);
    await ready(page);await page.waitForFunction(p=>Math.abs(window.PhotographicAisle.getState().progress-p)<.001,beforeReload.state.progress);await settleScroll(page);
    const afterReload=await capture(page,c,'development-reload');
    check(c.id+': framed development reload restores current progress',Math.abs(beforeReload.state.progress-afterReload.state.progress)<.001&&beforeReload.state.lookDirection===afterReload.state.lookDirection,{before:beforeReload.state.progress,after:afterReload.state.progress});
    c.resize.reload={before:beforeReload,after:afterReload};
  }
  for(const p of [.95,1]){await atProgress(page,p);await capture(page,c,p===1?'framed-end':'framed-near-end');}
}

try {
  const configs=only==='cleanup'?[{width:800,height:900,touch:false,reduced:false,full:false}]:[{width: 390, height: 844, touch: true, reduced: false, full: true}, {width: 430, height: 932, touch: true, reduced: false, full: false}, {width: 650, height: 700, touch: false, reduced: false, full: true}, {width: 390, height: 844, touch: true, reduced: true, full: false}].filter(c=>!only||(c.width===390&&!c.reduced));
  for (const config of configs) {
    const id = `${config.width}x${config.height}-${config.reduced ? 'reduced' : 'normal'}`, c = {id, config, snapshots: [], idle: []}; report.cases.push(c);
    const context = await browser.newContext({viewport: {width: config.width, height: config.height}, isMobile: config.touch, hasTouch: config.touch, deviceScaleFactor: 1, reducedMotion: config.reduced ? 'reduce' : 'no-preference'}), page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push({id, error: error.message}));
    page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') report.warnings.push({id, type: message.type(), text: message.text(),location:message.location()}); });
    page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({id, status: response.status(), url: response.url()}); });
    page.on('requestfailed',request=>report.requestFailures.push({id,url:request.url(),error:request.failure()?.errorText,duringContextClose:Boolean(c.closing)}));
    try {
      // An HTTP204 stops EventSource reconnection without invented net::ERR_FAILED.
      // The real reload handler remains callable for the explicit restoration test.
      await page.route('**/__preview_events', route => {report.fixtureRequests.push({id,url:route.request().url(),response:204,reason:'Prevent unsolicited development reload during frozen audit'});return route.fulfill({status:204,body:''});});
      await page.addInitScript(()=>{const Original=window.EventSource;window.EventSource=class extends Original{constructor(...args){super(...args);(window.__guidedAuditSources??=[]).push(this);}};});
      await page.goto(base); await ready(page);
      const entry = await capture(page, c, 'entry');
      check(id+': actual scroll range reflects current journey height',Math.abs(entry.state.scrollRange-(config.width<=600?9:5.5)*config.height)<=1,{actual:entry.state.scrollRange,expected:(config.width<=600?9:5.5)*config.height});
      check(id + ': native entry requires no Start button', !entry.startVisible && !entry.state.reducedMotion && entry.state.motionPreference === 'system' && entry.state.lookDirection === 'auto');
      check(id + ': correct system motion preference', entry.state.systemReducedMotion === config.reduced);
      check(id + ': optional video stays disabled', entry.state.video.committedFrame === null);
      const placement=entry.state.physical.galleryPlacement;
      check(id + ': exact ten expected source photographs present',JSON.stringify(entry.state.slots.map(s=>s.id).sort())===JSON.stringify([...contract.expectedIds].sort()));
      check(id + ': frozen guided placement is actually active',placement.length===10&&placement.every(m=>{const e=contract.placements.find(p=>p.id===m.id);return e&&m.worldPosition.every((v,i)=>Math.abs(v-e.worldPosition[i])<1e-8)&&m.worldRotation.every((v,i)=>Math.abs(v-e.worldRotation[i])<1e-8)&&m.worldFrontCorners.every((v,i)=>v.every((q,j)=>Math.abs(q-e.worldFrontCorners[i][j])<1e-7));}));
      check(id+': actual print sizes match independent physical source dimensions',entry.state.slots.every(s=>{const e=contract.physicalPrints.find(p=>p.id===s.id);return e&&Math.abs(s.physical.printWidth-e.width)<1e-8&&Math.abs(s.physical.printHeight-e.height)<1e-8;}));
      check(id + ': phone pitch follows actual portrait capability', Math.abs(entry.state.physical.environment.camera.viewPitchOffset - (entry.state.physical.environment.camera.sideLookSupported ? contract.phonePitch : 0)) < 1e-8);
      check(id+': continuous80m photograph environment is active',entry.state.physical.environment.continuous===true&&entry.state.physical.environment.backdropDepth===80);
      if(only==='still'){await stillAudit(page,c);continue;}
      if(only==='cleanup'){await collectionResizeAudit(page,c);await photoRoundTrip(page,c,config);await stillRawReturnAudit(page,c);await stepThresholdAudit(page,c);continue;}
      // Fresh native gestures run before programmatic pose changes or menu clicks.
      await nativeMove(context, page, config, true); const forward = await capture(page, c, 'native-forward');
      check(id + ': native forward input advances', forward.state.progress > entry.state.progress + .002, {before: entry.state.progress, after: forward.state.progress});
      check(id+': native forward input advances physical distance',forward.state.physical.cameraDistance>entry.state.physical.cameraDistance,{before:entry.state.physical.cameraDistance,after:forward.state.physical.cameraDistance});
      await nativeMove(context, page, config, false); const reverse = await snapshot(page);
      check(id + ': native reverse input retreats', reverse.state.progress < forward.state.progress - .002, {before: forward.state.progress, after: reverse.state.progress});
      check(id+': native reverse input retreats physical distance',reverse.state.physical.cameraDistance<forward.state.physical.cameraDistance,{before:forward.state.physical.cameraDistance,after:reverse.state.physical.cameraDistance});
      c.native = {entry, forward, reverse};
      await atProgress(page, .12); await atProgress(page, .37); const sameForward = await capture(page, c, 'mid-forward');
      await idleAudit(page, c, 'idle-mid', config.reduced);
      await atProgress(page, .78); await atProgress(page, .37); const sameReverse = await snapshot(page);
      check(id + ': equal progress forward/reverse gives exact camera and quads', exactPose(sameForward, sameReverse), {before: pose(sameForward), after: pose(sameReverse)});
      c.determinism = {forward: sameForward, reverse: sameReverse};
      await atProgress(page, 1); const end = await capture(page, c, 'end'); check(id + ': exact authored-travel endpoint', end.state.progress === 1 && Math.abs(end.state.physical.cameraDistance-contract.travel)<1e-8,{expected:contract.travel,actual:end.state.physical.cameraDistance});
      if (config.full) { await menuAndSteps(page, c, config); await photoRoundTrip(page, c, config); }
      if (config.touch && !config.reduced && config.width === 390) {await manualLookAudit(page,c);await stillAudit(page, c);}
      if(!config.touch){await optionalVideoAudit(page,c);await resizeAndReload(page,c);}
    } catch (error) {
      c.failure = error.stack; report.errors.push({id, phase: 'case', error: error.stack});
      try { await page.screenshot({path: path.join(output, id + '-failure.png')}); c.failureState = await snapshot(page); } catch {}
    } finally { c.closing=true;await context.close(); await save(); console.log(JSON.stringify({id, failures: report.checks.filter(q => q.name.startsWith(id) && !q.pass).map(q => q.name), error: c.failure || null})); }
  }
} finally {
  await browser.close(); report.after = await fingerprint();
  check('original photographs unchanged', JSON.stringify(report.before.originals) === JSON.stringify(report.after.originals), {count: report.before.originals.length});
  check('served runtime remains frozen during audit', JSON.stringify(report.before.modules) === JSON.stringify(report.after.modules));
  check('no unexpected console errors',!report.warnings.some(w=>w.type==='error'),{errors:report.warnings.filter(w=>w.type==='error')});
  check('no failed network requests outside intentional navigation cancellation',!report.requestFailures.some(r=>!r.duringContextClose&&r.error!=='net::ERR_ABORTED'),{requests:report.requestFailures});
  report.status = report.checks.some(c => !c.pass) || report.errors.length || report.httpErrors.length ? 'FAIL' : 'PASS';
  await save();if(report.status==='FAIL')process.exitCode=1;
  console.log(JSON.stringify({status: report.status, output, checks: report.checks.length, failures: report.checks.filter(c => !c.pass).map(c => c.name), errors: report.errors, warningCount: report.warnings.length, httpErrors: report.httpErrors}));
}
