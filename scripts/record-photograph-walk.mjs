/** Native wheel and emulated-touch forward/reverse evidence in a separate Chrome profile.
 * QA_URL, QA_OUTPUT, PLAYWRIGHT_MODULE and optional QA_DEVICE=desktop|phone.
 * Records actual browser input and lossless milestones; does not measure physical-device performance.
 * Old checkpoints without water-surface.js are supported for a labeled baseline comparison.
 */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import os from 'node:os';import {pathToFileURL} from 'node:url';
const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(moduleName?(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName):'playwright');
const out=path.resolve(process.env.QA_OUTPUT||path.join(os.tmpdir(),'photograph-walk')),base=process.env.QA_URL||'http://127.0.0.1:4260';await fs.mkdir(out,{recursive:true});
const files=['/main-v2.js','/collections.js','/aisle/photographic-environment.js','/aisle/physical-display.js','/aisle/gallery-layout.js','/aisle/photographic-aisle.js','/aisle-integration.js','/aisle/aisle.css'];if((await fetch(base+'/aisle/water-surface.js')).ok)files.push('/aisle/water-surface.js');
const fingerprint=()=>Promise.all(files.map(async url=>{const r=await fetch(base+url);return{url,status:r.status,sha256:createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')}}));
const devices=[['desktop',1440,900,false],['phone',390,844,true]].filter(d=>!process.env.QA_DEVICE||d[0]===process.env.QA_DEVICE);
if(!devices.length)throw Error('QA_DEVICE must be desktop or phone');
const report={base,before:await fingerprint(),cases:[],errors:[],scope:'Actual native wheel and emulated touch forward/reverse viewport recordings; camera timing is not physical-device performance.'};const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'chrome',headless:true});
try{for(const [device,width,height,touch]of devices){
 const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:'no-preference',recordVideo:{dir:out,size:{width,height}}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push({device,error:e.message}));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/__preview_events'))report.errors.push({device,error:m.text()})});await page.route('**/__preview_events',r=>r.abort());await page.goto(base);await page.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready,null,{timeout:45000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
 await page.evaluate(()=>{window.__nativeTrace=[];let last=0;const timer=setInterval(()=>{const a=window.PhotographicAisle,s=a.getState();window.__nativeTrace.push({time:performance.now(),progress:s.progress,scrollY,camera:s.physical?.environment?.camera,distance:s.physical?.cameraDistance,quads:s.slots.map(x=>({id:x.id,quad:x.projectedQuad,passed:x.passed})),waterPhase:s.physical?.environment?.waterMotion?.phase});if(window.__stopNativeTrace)clearInterval(timer)},60)});
 const start=await page.evaluate(()=>window.PhotographicAisle.getState()),cdp=touch?await context.newCDPSession(page):null;await page.screenshot({path:path.join(out,device+'-entry.png')});const milestones=[];
 for(const direction of [1,-1]){
  let seen=new Set(),loops=0;
  while(loops++<140){
   const s=await page.evaluate(()=>window.PhotographicAisle.getState());if(direction===1?s.progress>=.999:s.progress<=.001)break;
   if(touch){const x=width*.52,from=direction===1?height*.79:height*.36,to=direction===1?height*.35:height*.78;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from,id:1}]});
    for(let i=1;i<=16;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/16,id:1}]});await page.waitForTimeout(24)}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(160);
   }else{await page.mouse.move(width*.5,height*.75);await page.mouse.wheel(0,direction*start.scrollRange/90);await page.waitForTimeout(95)}
   const next=await page.evaluate(()=>window.PhotographicAisle.getState()),bucket=Math.round(next.progress*10);
   if(!seen.has(bucket)){seen.add(bucket);const file=`${device}-${direction===1?'forward':'reverse'}-${bucket}.png`;await page.screenshot({path:path.join(out,file)});milestones.push({direction,progress:next.progress,file,state:next});}
  }
  await page.waitForTimeout(500);
  const end=await page.evaluate(()=>window.PhotographicAisle.getState());if(direction===1?end.progress<.99:end.progress>.01)report.errors.push({device,direction,error:'Native traversal did not reach endpoint',progress:end.progress,loops});
 }
 const end=await page.evaluate(()=>{window.__stopNativeTrace=true;return{state:window.PhotographicAisle.getState(),trace:window.__nativeTrace}});await page.screenshot({path:path.join(out,device+'-returned.png')});const video=page.video();await context.close();await video.saveAs(path.join(out,device+'-native-forward-reverse.webm'));
 report.cases.push({device,start,end:end.state,trace:end.trace,milestones});console.log(JSON.stringify({device,samples:end.trace.length,milestones:milestones.length,start:start.progress,end:end.state.progress}));
}}catch(e){report.errors.push({error:e.stack})}finally{await browser.close();report.after=await fingerprint();report.runtimeStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.status=report.cases.length===devices.length&&!report.errors.length&&report.runtimeStable?'TECHNICAL PASS; MOTION REVIEW REQUIRED':'FAIL';await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,errors:report.errors,runtimeStable:report.runtimeStable}));if(report.status==='FAIL')process.exitCode=1;}
