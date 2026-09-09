/**
 * Local browser acceptance evidence. This launches its own browser profile.
 * Usage: QA_URL=http://localhost:4274 QA_OUTPUT=/tmp/easel-qa node scripts/qa-easel.mjs
 * Install Playwright separately, or set PLAYWRIGHT_MODULE to its import path.
 * Uses installed Chrome; QA_BROWSER_CHANNEL can select another installed channel.
 * QA_VIDEO_STEP defaults to 1 (every committed source frame, both directions).
 * Viewport emulation is not a measurement of real phone/GPU performance.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(moduleName ? (path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName) : 'playwright');
const base=process.env.QA_URL||'http://localhost:4274';
const output=path.resolve(process.env.QA_OUTPUT||path.join(os.tmpdir(),'easel-qa'));
const videoStep=Math.max(1,Number(process.env.QA_VIDEO_STEP||1));
const skipVideo=process.env.QA_SKIP_VIDEO==='1';
const stops=[0,.16,.3,.51,.79,1];
const checks=[],gaps=[],cases=[];
const check=(name,pass,detail={})=>checks.push({name,pass:Boolean(pass),...detail});
const near=(a,b,tol=1e-7)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;
const distinct=items=>[...new Set(items)];
async function fingerprint(){return Promise.all(['/main-v2.js','/aisle-integration.js','/canvas-wrap.js','/aisle/photographic-aisle.js','/aisle/physical-display.js','/aisle/physical-easel.js','/aisle/photographic-environment.js','/aisle/gallery-layout.js','/aisle/video-frame-seam.js','/aisle/aisle.css','/collections.css','/aisle/assets/easel-geometry.js','/aisle/assets/texture-manifest.json'].map(async url=>{const response=await fetch(new URL(url,base)),bytes=Buffer.from(await response.arrayBuffer());return{url,status:response.status,sha256:createHash('sha256').update(bytes).digest('hex')};}));}
await fs.mkdir(output,{recursive:true});
const sourceBefore=await fingerprint();
const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});

async function state(page){return page.evaluate(()=>window.PhotographicAisle.getState());}
async function menu(page,open){if(await page.locator('#menu-panel').isVisible()!==open)await page.locator('#menu-toggle').click();}
async function scrollIdle(page){
  await page.evaluate(()=>window.__easelQaIdle={y:scrollY,changed:performance.now()});
  await page.waitForFunction(()=>{const q=window.__easelQaIdle,now=performance.now();if(q.y!==scrollY){q.y=scrollY;q.changed=now;}return now-q.changed>300;},{},{timeout:10000});
}
async function nativeNavigation(page,device,label){
  await menu(page,false);await settle(page,0);
  const before=await state(page);
  if(device.hasTouch){
    const cdp=await page.context().newCDPSession(page),x=device.viewport.width*.5,y=device.viewport.height*.75;
    try{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*24,id:1}]});await page.waitForTimeout(24);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{await cdp.detach();}
  }else{await page.mouse.move(device.viewport.width*.5,device.viewport.height*.65);await page.mouse.wheel(0,600);}
  await page.waitForFunction(()=>window.PhotographicAisle.getState().progress>.01);
  const after=await state(page);
  check(label+(device.hasTouch?': native emulated swipe advances walk':': native wheel advances walk'),after.progress>before.progress&&after.physical.cameraDistance>before.physical.cameraDistance&&!after.reducedMotion,{before:before.progress,after:after.progress,systemReducedMotion:after.systemReducedMotion});
  check(label+': native navigation preserves system motion preference',before.systemReducedMotion===after.systemReducedMotion);
  await scrollIdle(page);
  await settle(page,0);return {before,after};
}
async function settle(page,progress,{video=false,reduced=false}={}){
  await page.evaluate(p=>{const a=window.PhotographicAisle,j=a.journey;scrollTo({top:j.getBoundingClientRect().top+scrollY+p*(j.offsetHeight-a.viewport.clientHeight),behavior:'instant'});},progress);
  await page.waitForFunction(({p,video,reduced})=>{
    const s=window.PhotographicAisle.getState();
    return s.physical?.ready && (reduced?s.reducedMotion&&s.progress===0:Math.abs(s.progress-p)<.012) && (!video || (s.video.status==='ready'&&s.video.requestedFrame===s.video.committedFrame));
  },{p:progress,video,reduced},{timeout:15000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  return state(page);
}

function dimensions(slot){const d=slot.physical||{};return {width:d.printWidth??d.width,height:d.printHeight??d.height,depth:d.canvasDepth??d.depth,source:slot.source||[d.nativeWidth,d.nativeHeight]};}
function geometry(slot,s){return slot.geometry||s.physical?.prints?.find(p=>p.id===slot.id)?.geometry||s.physical?.printInvariants?.find(p=>p.id===slot.id);}
function invariantChecks(label,samples){
  const first=samples[0].state;
  for(const original of first.slots){
    const d0=dimensions(original),sourceRatio=d0.source[0]/d0.source[1];
    check(`${label}: ${original.id} full source aspect`,near(d0.width/d0.height,sourceRatio,1e-6),{physical:[d0.width,d0.height],source:d0.source});
    check(`${label}: ${original.id} fixed physical size`,samples.every(({state:s})=>{const d=dimensions(s.slots.find(x=>x.id===original.id));return near(d.width,d0.width)&&near(d.height,d0.height)&&near(d.depth,d0.depth); }));
    const actual=geometry(original,first);
    if(!actual){gaps.push(`${label}: ${original.id} actual front vertex/UV diagnostic is absent; reported dimensions alone cannot prove runtime UV invariance.`);continue;}
    check(`${label}: ${original.id} actual geometry invariant`,samples.every(({state:s})=>JSON.stringify(geometry(s.slots.find(x=>x.id===original.id),s))===JSON.stringify(actual)));
    const uv=actual.frontUV||actual.frontUVs;
    check(`${label}: ${original.id} full 0..1 front UV corners`,Array.isArray(uv)&&uv.length>=4&&uv.every(p=>p.length===2&&p.every(v=>near(v,0)||near(v,1)))&&distinct(uv.map(p=>p.join(','))).length===4,{uv});
    for(const key of ['meshScale','groupScale'])if(actual[key])check(`${label}: ${original.id} ${key} uniform`,near(actual[key][0],actual[key][1])&&near(actual[key][1],actual[key][2]),{scale:actual[key]});
    if(actual.frontVertices){const v=actual.frontVertices;const xs=v.map(p=>p[0]),ys=v.map(p=>p[1]);check(`${label}: ${original.id} actual front aspect`,near((Math.max(...xs)-Math.min(...xs))/(Math.max(...ys)-Math.min(...ys)),sourceRatio,1e-5));}
  }
}

async function capture(page,name,progress,opts={}){
  const s=await settle(page,progress,opts);
  const file=name+'.png';await page.screenshot({path:path.join(output,file),fullPage:false});
  const images=await page.evaluate(()=>[...document.images].filter(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth).map(i=>i.src));
  check(name+': no broken visible images',images.length===0,{images});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  check(name+': no horizontal overflow',overflow<=1,{pixels:overflow});
  return {name,requestedProgress:progress,screenshot:file,state:s};
}

async function waterMotion(page,label,{reduced=false,frozen=reduced}={}){
  await settle(page,reduced?0:.51,{reduced});
  await scrollIdle(page);
  const before=await state(page),a=await page.locator('.aisle-viewport').screenshot({path:path.join(output,label+'-water-time-a.png')});
  await page.waitForTimeout(1000);
  const b=await page.locator('.aisle-viewport').screenshot({path:path.join(output,label+'-water-time-b.png')}),after=await state(page);
  const difference=await page.evaluate(async({a,b})=>{
    const images=await Promise.all([a,b].map(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();return image;}));
    const canvas=document.createElement('canvas');canvas.width=images[0].naturalWidth;canvas.height=images[0].naturalHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=images.map(image=>{ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;});
    function region(y0,y1){let count=0,changed=0,total=0;for(let y=Math.floor(canvas.height*y0);y<Math.floor(canvas.height*y1);y++)for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4,d=Math.abs(pixels[0][i]-pixels[1][i])+Math.abs(pixels[0][i+1]-pixels[1][i+1])+Math.abs(pixels[0][i+2]-pixels[1][i+2]);
      count++;total+=d/3;if(d>15)changed++;
    }return{pixels:count,changed,changedRatio:changed/count,meanChannelDifference:total/count};}
    return {upperPier:region(.02,.6),lowerWater:region(.88,.98)};
  },{a:a.toString('base64'),b:b.toString('base64')});
  check(label+': idle camera stays fixed',near(before.physical.cameraDistance,after.physical.cameraDistance)&&near(before.progress,after.progress));
  check(label+(frozen?': water remains visually still':': visibly changing lower water at idle'),frozen?difference.lowerWater.changedRatio<.0005:difference.lowerWater.changedRatio>.002&&difference.lowerWater.meanChannelDifference>.02,difference.lowerWater);
  check(label+': upper pier stays visually still at idle',difference.upperPier.changedRatio<.005,difference.upperPier);
  return {difference,before,after,intervalMs:1000,limitations:'Screen-region difference establishes visible change, not a physically accurate fluid simulation.'};
}

async function lookControls(page,label){
  const samples=[];
  for(const p of [.51,1]){
    const straight=await settle(page,p);
    for(const direction of ['left','right']){
      await menu(page,true);
      const button=page.getByRole('button',{name:'Look '+direction,exact:true});
      await button.click();
      const selected=await button.getAttribute('aria-pressed');
      await page.waitForFunction(sign=>Math.sign(window.PhotographicAisle.getState().physical.lookYaw)===sign,direction==='left'?1:-1);
      await menu(page,false);
      const shot=await capture(page,`${label}-look-${direction}-${Math.round(p*100)}`,p);samples.push(shot);
      check(`${label}: look ${direction} keeps world distance at ${p}`,near(straight.physical.cameraDistance,shot.state.physical.cameraDistance));
      check(`${label}: look ${direction} control selected at ${p}`,selected==='true');
      if(p===1){
        const id=direction==='left'?'coke-beach-cold-detail':'coastal-panorama',target=shot.state.slots.find(s=>s.id===id);
        check(`${label}: final ${id} fully inspectable looking ${direction}`,target&&!target.passed&&target.projectedQuad.every(q=>q.x>=0&&q.x<=shot.state.viewport.width&&q.y>=0&&q.y<=shot.state.viewport.height),{quad:target?.projectedQuad});
        if(direction==='left'&&target?.interactive){
          const center=target.projectedQuad.reduce((a,q)=>({x:a.x+q.x/4,y:a.y+q.y/4}),{x:0,y:0});
          await page.mouse.click(center.x,center.y);
          await page.waitForFunction(()=>window.PhotographicCollections.collections.active==='branding');
          check(label+': projected Coke print opens its collection',true);
          await page.keyboard.press('Escape');await page.waitForFunction(()=>window.PhotographicCollections.collections.active===null);
          await settle(page,1);
        }
      }
    }
    await menu(page,true);await page.getByRole('button',{name:'Auto',exact:true}).click();await menu(page,false);
    await page.waitForFunction(()=>window.PhotographicAisle.getState().lookDirection==='auto');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const restored=await state(page);
    check(`${label}: Auto restores scroll-guided projection at ${p}`,JSON.stringify(restored.slots.map(s=>s.projectedQuad))===JSON.stringify(straight.slots.map(s=>s.projectedQuad)));
  }
  invariantChecks(label+' look',samples);return samples;
}

async function startFromReduced(page,label){
  check(label+': external Start walk visible in explicit Still view',await page.getByRole('button',{name:'Start walk',exact:true}).isVisible());
  await page.getByRole('button',{name:'Start walk',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.PhotographicAisle.getState();return s.systemReducedMotion&&!s.reducedMotion&&s.motionPreference==='guided';});
  const shot=await capture(page,label+'-guided-with-system-reduced',.3);
  check(label+': Start walk enables travel while retaining system preference',shot.state.systemReducedMotion&&!shot.state.reducedMotion&&near(shot.state.progress,.3,.002));
  await page.locator('#menu-toggle').click();await page.locator('#travel-mode').selectOption('system');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!window.PhotographicAisle.getState().reducedMotion);
  return shot;
}

async function interactions(page,label){
  const results={};
  await settle(page,.3);
  const initial=await state(page);
  await page.locator('#menu-toggle').focus();await page.keyboard.press('Enter');
  check(label+': keyboard opens menu',await page.locator('#menu-panel').isVisible());
  await page.keyboard.press('Escape');
  check(label+': escape closes menu and restores focus',await page.evaluate(()=>document.querySelector('#menu-panel').hidden&&document.activeElement.id==='menu-toggle'));
  await page.locator('#menu-toggle').click();
  await page.locator('#menu-panel a[href="#collection/branding"]').click();
  await page.waitForFunction(()=>window.PhotographicCollections.collections.active==='branding');
  check(label+': category opens',await page.locator('#collection-view').isVisible());
  await page.locator('.collection-photo').first().click();
  await page.waitForFunction(()=>document.querySelector('#viewer').open&&document.querySelector('#full-photo').getAttribute('aria-busy')==='false');
  const first=await page.locator('#full-photo').getAttribute('src');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(src=>document.querySelector('#full-photo').getAttribute('src')!==src&&document.querySelector('#full-photo').getAttribute('aria-busy')==='false',first);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(src=>document.querySelector('#full-photo').getAttribute('src')===src&&document.querySelector('#full-photo').getAttribute('aria-busy')==='false',first);
  check(label+': detail keyboard next/previous',true);
  await page.screenshot({path:path.join(output,label+'-detail.png')});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#viewer').open);
  check(label+': detail returns focus',await page.evaluate(()=>document.activeElement.classList.contains('collection-photo')));
  await page.locator('.collection-switcher a[href="#collection/headshots"]').click();
  await page.waitForFunction(()=>window.PhotographicCollections.collections.active==='headshots');
  check(label+': category switch',await page.locator('.collection-photo').count()===31);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.PhotographicCollections.collections.active===null);
  await page.waitForFunction(y=>Math.abs(scrollY-y)<2,initial.scrollY);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const returned=await state(page);
  check(label+': category return restores aisle position',near(returned.progress,initial.progress,.002),{before:initial.progress,after:returned.progress,scrollBefore:initial.scrollY,scrollAfter:returned.scrollY});
  await settle(page,0);
  await menu(page,true);
  await page.getByRole('button',{name:'Walk forward to the next pair of canvases'}).click();
  await page.waitForFunction(()=>{
    const s=window.PhotographicAisle.getState();
    const q=window.__easelQaScroll||(window.__easelQaScroll={last:null,stable:0});
    q.stable=q.last===scrollY?q.stable+1:0;q.last=scrollY;
    return s.progress>.02&&q.stable>=6;
  });
  const advanced=await state(page);
  await page.getByRole('button',{name:'Walk back to the previous pair of canvases'}).click();
  await page.waitForFunction(()=>window.PhotographicAisle.getState().progress<.003);
  check(label+': forward/back step controls',advanced.progress>0&&advanced.progress<1,{firstStop:advanced.progress});
  await menu(page,true);
  await page.locator('#travel-mode').selectOption('still');
  await page.waitForFunction(()=>window.PhotographicAisle.getState().reducedMotion);
  check(label+': explicit Still view',await page.locator('.aisle-fallback').isVisible());
  await page.locator('#travel-mode').selectOption('system');await page.keyboard.press('Escape');
  results.restored=await state(page);return results;
}

async function videoChecks(page,label){
  await settle(page,0);
  await menu(page,true);
  await page.locator('.aisle-video-toggle').click();
  await page.waitForFunction(()=>window.PhotographicAisle.getState().video.status==='ready',{},{timeout:20000});
  await menu(page,false);
  const manifest=await page.evaluate(async()=>await(await fetch('/video/frames.json')).json());
  const lastTime=manifest.frames.at(-1).time;
  const targets=manifest.frames.filter((_,i)=>i%videoStep===0||i===manifest.frames.length-1).map(f=>f.time/lastTime);
  const runs=[];
  for(const [direction,values]of [['forward',targets],['reverse',[...targets].reverse()]]){
    const samples=[];
    for(const p of values){const s=await settle(page,p,{video:true});samples.push({requestedProgress:p,state:s});}
    for(const p of stops)runs.push(await capture(page,`${label}-video-${direction}-${String(Math.round(p*100)).padStart(3,'0')}`,p,{video:true}));
    const distances=samples.map(x=>x.state.physical?.cameraDistance);
    const deltas=distances.slice(1).map((v,i)=>v-distances[i]);
    check(`${label}: video ${direction} finite camera`,distances.every(Number.isFinite));
    check(`${label}: video ${direction} monotonic camera`,deltas.every(d=>direction==='forward'?d>=-1e-5:d<=1e-5),{minStep:Math.min(...deltas),maxStep:Math.max(...deltas)});
    check(`${label}: video ${direction} decoded frame commit`,samples.every(({state:s})=>s.video.requestedFrame===s.video.committedFrame&&s.video.status==='ready'&&s.backgroundAnimated));
    runs.push({name:`${label}-video-${direction}-trajectory`,samples});
  }
  const forward=runs.find(r=>r.name.endsWith('forward-trajectory')).samples;
  const reverse=runs.find(r=>r.name.endsWith('reverse-trajectory')).samples;
  check(label+': video reversible camera/projection',forward.every(a=>{const b=reverse.find(b=>b.state.video.committedFrame===a.state.video.committedFrame);return b&&near(a.state.physical.cameraDistance,b.state.physical.cameraDistance)&&a.state.slots.every(sa=>{const sb=b.state.slots.find(x=>x.id===sa.id);return JSON.stringify(sa.projectedQuad)===JSON.stringify(sb.projectedQuad);});}));
  invariantChecks(label+' video',forward.concat(reverse));
  const steps=forward.slice(1).map((a,i)=>Math.abs(a.state.physical.cameraDistance-forward[i].state.physical.cameraDistance));
  const sorted=[...steps].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]||0;
  check(label+': video no isolated large camera step',Math.max(...steps)<=Math.max(.12,median*5),{sampledFrames:forward.length,totalFrames:manifest.frames.length,medianStep:median,maxStep:Math.max(...steps),threshold:Math.max(.12,median*5)});
  if(videoStep>1)gaps.push(`${label}: video trajectory sampled every ${videoStep} frames; intervening camera jumps are untested.`);
  const beforeOff=await state(page);
  await menu(page,true);
  await page.locator('.aisle-video-toggle').click();
  await page.waitForFunction(()=>window.PhotographicAisle.getState().video.status==='off');
  await menu(page,false);
  const afterOff=await state(page);
  check(label+': video returns to still',!afterOff.backgroundAnimated);
  check(label+': video off preserves camera position',near(beforeOff.physical.cameraDistance,afterOff.physical.cameraDistance,.2),{before:beforeOff.physical.cameraDistance,after:afterOff.physical.cameraDistance});
  return runs;
}

try{
  for(const device of [{name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false},{name:'phone-emulation',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
    const {name,...contextOptions}=device;
    const context=await browser.newContext({...contextOptions,deviceScaleFactor:1,reducedMotion:'no-preference'});
    const page=await context.newPage();const errors=[],warnings=[],failedRequests=[],badResponses=[];
    // Keep an already loaded test page stable while another worker edits files.
    await page.route('**/__preview_events',route=>route.abort());
    page.on('pageerror',e=>errors.push({message:e.message,type:'pageerror'}));
    page.on('console',m=>{if(m.location().url.endsWith('/__preview_events'))return;if(m.type()==='error')errors.push({message:m.text(),...m.location()});if(m.type()==='warning')warnings.push(m.text());});
    page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
    page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
    const entry={device,errors,warnings,failedRequests,badResponses,samples:[]};cases.push(entry);
    try{
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready,{},{timeout:30000});
      entry.nativeNavigation=await nativeNavigation(page,device,device.name);
      for(const [direction,values]of [['forward',stops],['reverse',[...stops].reverse()]])for(const p of values){entry.samples.push(await capture(page,`${device.name}-${direction}-${String(Math.round(p*100)).padStart(3,'0')}`,p));}
      const focusStops=await page.evaluate(async()=>{try{return (await import('/aisle/gallery-layout.js')).FOCUS_STOPS;}catch{return[];}});
      for(const [i,p]of focusStops.entries())entry.samples.push(await capture(page,`${device.name}-pair-focus-${i+1}`,p));
      invariantChecks(device.name,entry.samples);
      for(const p of stops){const a=entry.samples.find(s=>s.name.includes('forward')&&s.requestedProgress===p);const b=entry.samples.find(s=>s.name.includes('reverse')&&s.requestedProgress===p);check(`${device.name}: still path reversible at ${p}`,JSON.stringify(a.state.slots.map(s=>s.projectedQuad))===JSON.stringify(b.state.slots.map(s=>s.projectedQuad)));}
      entry.interactions=await interactions(page,device.name);
      if(device.name==='desktop'){
        await page.setViewportSize({width:390,height:844});
        await page.waitForFunction(()=>window.PhotographicAisle.getState().viewport.width===390);
        const narrow=await capture(page,'desktop-resize-to-phone',.51);
        await page.setViewportSize(device.viewport);
        await page.waitForFunction(()=>window.PhotographicAisle.getState().viewport.width===1440);
        const wide=await capture(page,'desktop-resize-back',.51);
        invariantChecks('resize',[narrow,wide]);entry.resize=[narrow,wide];
      }
      if(device.viewport.width<=600)entry.look=await lookControls(page,device.name);
      else check(device.name+': desktop remains ahead',near((await state(page)).physical.lookYaw,0));
      entry.waterMotion=await waterMotion(page,device.name);
      if(!skipVideo)entry.video=await videoChecks(page,device.name);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>window.PhotographicAisle.getState().systemReducedMotion);
      entry.reducedNativeNavigation=await nativeNavigation(page,device,device.name+' system-reduced');
      entry.reducedAmbient=await waterMotion(page,device.name+'-system-reduced',{frozen:true});
      await menu(page,true);await page.locator('#travel-mode').selectOption('still');await menu(page,false);
      entry.reduced=await capture(page,device.name+'-explicit-still',0,{reduced:true});
      check(device.name+': reduced motion suppresses video',entry.reduced.state.video.suppressed&&!entry.reduced.state.backgroundAnimated);
      entry.reducedWaterMotion=await waterMotion(page,device.name+'-reduced',{reduced:true});
      entry.startFromReduced=await startFromReduced(page,device.name);
      const decode=await page.evaluate(async()=>{const manifest=await(await fetch('/categories.json')).json();const srcs=[...new Set(manifest.categories.flatMap(c=>c.items.flatMap(i=>[i.src,i.full||i.src])))];const result=await Promise.all(srcs.map(async src=>{const im=new Image();im.src=src;try{await im.decode();return {src,width:im.naturalWidth,height:im.naturalHeight};}catch(e){return{src,error:e.message};}}));return{count:srcs.length,failures:result.filter(i=>i.error)};});
      check(device.name+': collection source/full images decode',decode.failures.length===0,decode);
    }catch(error){entry.fatal={message:error.message,stack:error.stack};check(device.name+': QA flow completes',false,{message:error.message});await page.screenshot({path:path.join(output,device.name+'-failure.png')}).catch(()=>{});}
    check(device.name+': no browser errors',errors.length===0,{errors});
    check(device.name+': no HTTP asset failures',badResponses.length===0,{responses:badResponses});
    const unexpected=failedRequests.filter(r=>!r.error?.includes('ERR_ABORTED')&&!r.url.endsWith('/__preview_events'));
    check(device.name+': no unexpected request failures',unexpected.length===0,{requests:unexpected,aborted:failedRequests.length-unexpected.length});
    await context.close();
    console.log(JSON.stringify({device:device.name,checks:checks.length,failures:checks.filter(c=>!c.pass).length,screenshots:entry.samples.length}));
  }
}finally{await browser.close();}

const sourceAfter=await fingerprint();
check('runtime source files unchanged during QA',JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter));
const summary={created:new Date().toISOString(),base,sourceBefore,sourceAfter,status:checks.some(c=>!c.pass)?'FAIL':gaps.length?'PASS_WITH_EVIDENCE_GAPS':'PASS',checks:checks.length,failures:checks.filter(c=>!c.pass),gaps:distinct(gaps),limits:['Rendered screenshots require visual review. Passing dimensions does not establish photorealism or camera-to-photograph alignment.','Phone browser is viewport/touch emulation on desktop hardware; real device performance remains unmeasured.','No deployment, account change, GitHub write, or message is performed by this script.'],cases};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({...summary,allChecks:checks},null,2)+'\n');
await fs.writeFile(path.join(output,'summary.md'),`# Browser acceptance evidence\n\nStatus: ${summary.status}\n\n${checks.filter(c=>c.pass).length}/${checks.length} checks passed.\n\n## Failures\n\n${summary.failures.map(c=>'- '+c.name+': '+JSON.stringify(c)).join('\n')||'None.'}\n\n## Evidence gaps\n\n${summary.gaps.map(g=>'- '+g).join('\n')||'None recorded.'}\n\n## Limits\n\n${summary.limits.map(g=>'- '+g).join('\n')}\n`);
console.log(JSON.stringify({status:summary.status,output,checks:summary.checks,failed:summary.failures.length,gaps:summary.gaps.length},null,2));
if(summary.failures.length)process.exitCode=1;
