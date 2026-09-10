/**
 * Actual browser regression for direct collection entry/switch/return and
 * browser Back while a photograph is open, and Still-to-walk controls.
 * Run with exclusive GPU access against a separately running local preview:
 * QA_URL=http://127.0.0.1:4274/ QA_OUTPUT=/tmp/gallery-navigation \
 *   node scripts/qa-gallery-navigation.mjs
 * Install Playwright separately or set PLAYWRIGHT_MODULE to its import path.
 * --prepare performs no browser work. Fresh output directories preserve evidence.
 * Phone results use Chrome emulation, not physical-device performance testing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
if(process.argv.includes('--prepare')){console.log('Prepared only. Run with exclusive browser/GPU access.');process.exit(0);}
const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(moduleName?(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName):'playwright');
const out=path.resolve(process.env.QA_OUTPUT||path.join(os.tmpdir(),'gallery-navigation-'+new Date().toISOString().replaceAll(':','-')));
await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(out,{recursive:false});
const base=new URL(process.env.QA_URL||'http://127.0.0.1:4274/').href;const hash=b=>createHash('sha256').update(b).digest('hex');
async function fp(){return Promise.all(['collections.js','main-v2.js','aisle/photographic-aisle.js'].map(async u=>{let r=await fetch(base+u);return{url:u,status:r.status,sha256:hash(Buffer.from(await r.arrayBuffer()))};}));}
const report={created:new Date().toISOString(),before:await fp(),cases:[],errors:[],scope:'Two reproduced history defects and Still controls, actual browser clicks; no application mutations'};const save=()=>fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch({channel:'chrome',headless:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(p){return p.evaluate(()=>({url:location.href,hash:location.hash,length:history.length,state:history.state,view:document.body.dataset.view,viewerOpen:document.querySelector('#viewer')?.open,viewerSrc:document.querySelector('#full-photo')?.currentSrc,scrollY,progress:window.PhotographicAisle?.getState().progress,range:window.PhotographicAisle?.getScrollRange(),collectionTitle:document.querySelector('#collection-title')?.textContent}));}
async function start(profile,url){let ctx=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:profile.mobile,hasTouch:profile.mobile,reducedMotion:'no-preference'}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.route('**/__preview_events',r=>r.fulfill({status:204,body:''}));await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForSelector('#menu-toggle',{state:'attached'});return{ctx,p};}
try{for(const profile of[{id:'desktop',width:800,height:900,mobile:false},{id:'phone',width:390,height:844,mobile:true}]){
 {let{ctx,p}=await start(profile,base+'#collection/families');await p.waitForSelector('.collection-switcher');let before=await snap(p);await p.locator('.collection-switcher a[href="#collection/headshots"]').click();let switched=await snap(p);await p.locator('.collection-back').click();await sleep(1200);let after=await snap(p);let row={name:'direct-category-switch-return',profile,before,switched,after,pass:after.view==='aisle'&&!after.hash};await p.screenshot({path:path.join(out,profile.id+'-direct-switch-return.png')});report.cases.push(row);await save();console.log(JSON.stringify(row));await ctx.close();}
 {let{ctx,p}=await start(profile,base);await p.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready);await p.evaluate(()=>{let a=window.PhotographicAisle;scrollTo({top:Math.round(a.journey.getBoundingClientRect().top+scrollY+.6*a.getScrollRange()),behavior:'instant'});});await sleep(300);let aisle=await snap(p);await p.locator('#menu-toggle').click();await p.locator('#menu-panel a[href="#collection/headshots"]').click();await p.waitForSelector('.collection-grid .collection-photo');let anchor=p.locator('.collection-grid .collection-photo').nth(20);await anchor.scrollIntoViewIfNeeded();await anchor.click();await p.waitForFunction(()=>document.querySelector('#full-photo').getAttribute('aria-busy')==='false');let opened=await snap(p);await p.goBack();await sleep(1200);let afterBack=await snap(p);await p.screenshot({path:path.join(out,profile.id+'-modal-browser-back.png')});if(await p.locator('#viewer').evaluate(e=>e.open))await p.locator('#close').click();await sleep(1200);let afterClose=await snap(p);let row={name:'browser-back-while-viewer-open',profile,aisle,opened,afterBack,afterClose,pass:afterBack.view==='aisle'&&!afterBack.viewerOpen&&Math.abs(afterBack.progress-aisle.progress)<.001&&Math.abs(afterClose.progress-aisle.progress)<.001};await p.screenshot({path:path.join(out,profile.id+'-modal-close-after-back.png')});report.cases.push(row);await save();console.log(JSON.stringify(row));await ctx.close();}
 {
  const {ctx,p}=await start(profile,base);
  await p.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready);
  await p.locator('#menu-toggle').click();
  await p.locator('#travel-mode').selectOption('still');
  await p.waitForFunction(()=>window.PhotographicAisle.getState().reducedMotion);
  await sleep(200);
  const still={stepsHidden:!(await p.locator('.aisle-step-controls').isVisible()),startVisible:await p.locator('.aisle-start-walk').isVisible()};
  await p.locator('#menu-toggle').click();
  await p.locator('.aisle-start-walk').click();
  await p.waitForFunction(()=>!window.PhotographicAisle.getState().reducedMotion);
  await p.locator('#menu-toggle').click();
  const next=p.locator('.walk-step').nth(1),prev=p.locator('.walk-step').nth(0);
  await next.click();await p.waitForFunction(()=>Math.abs(window.PhotographicAisle.getState().progress-.2)<.001);
  const forward=await snap(p);
  await prev.click();await p.waitForFunction(()=>window.PhotographicAisle.getState().progress<.001);
  const back=await snap(p),row={name:'still-hides-walk-controls-and-start-restores-them',profile,still,forward,back,pass:still.stepsHidden&&still.startVisible&&Math.abs(forward.progress-.2)<.001&&back.progress<.001};
  report.cases.push(row);await p.screenshot({path:path.join(out,profile.id+'-still-to-walk-controls.png')});await save();console.log(JSON.stringify(row));await ctx.close();
 }
}}
catch(e){report.exception={message:e.message,stack:e.stack};console.log(e.stack);}
finally{await browser.close();report.after=await fp();report.runtimeStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.status=report.exception||report.errors.length||report.cases.length!==6||report.cases.some(c=>!c.pass)||!report.runtimeStable?'FAIL':'PASS';await save();console.log('BROWSER CLOSED '+report.status);if(report.status!=='PASS')process.exitCode=1;}
