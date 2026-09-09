/** Short local continuous traversal evidence. Requires Playwright and Chrome.
 * QA_URL and QA_OUTPUT select the preview and evidence directory.
 * Outputs browser viewport video; this does not measure physical phone speed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(moduleName?(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName):'playwright');
const out=path.resolve(process.env.QA_OUTPUT||path.join(os.tmpdir(),'easel-qa'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.QA_BROWSER_CHANNEL||'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage();
await page.route('**/__preview_events',route=>route.abort());
try{
  await page.goto(process.env.QA_URL||'http://localhost:4274',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready,{},{timeout:30000});
  const timing=await page.evaluate(()=>{
    const a=window.PhotographicAisle;a.setMotionPreference('guided');
    const j=a.journey,top=j.getBoundingClientRect().top+scrollY,range=j.offsetHeight-a.viewport.clientHeight;
    return new Promise(resolve=>{let start,last;const intervals=[];function tick(now){start??=now;if(last!==undefined)intervals.push(now-last);last=now;const t=(now-start)/16000,p=t<.0625?0:t<.4375?(t-.0625)/.375:t<.5625?1:t<.9375?1-(t-.5625)/.375:0;
      scrollTo({top:top+Math.max(0,Math.min(1,p))*range,behavior:'instant'});
      if(t>=1){const sorted=[...intervals].sort((a,b)=>a-b);resolve({durationMs:now-start,frames:intervals.length,medianRafIntervalMs:sorted[Math.floor(sorted.length*.5)],p95RafIntervalMs:sorted[Math.floor(sorted.length*.95)],maxRafIntervalMs:Math.max(...intervals)});}else requestAnimationFrame(tick);
    }requestAnimationFrame(tick);});
  });
  await fs.writeFile(path.join(out,'recording-metrics.json'),JSON.stringify({browser:browser.version(),viewport:{width:1440,height:900},...timing,limit:'Headless desktop browser cadence during video recording; not physical phone or production performance.'},null,2)+'\n');
}finally{
  const video=page.video();await context.close();
  if(video)await video.saveAs(path.join(out,'continuous-forward-reverse.webm'));
  await browser.close();
}
console.log(path.join(out,'continuous-forward-reverse.webm'));
