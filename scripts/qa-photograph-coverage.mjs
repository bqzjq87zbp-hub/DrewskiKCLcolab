/**
 * Reproduce the photographic gallery's actual Auto coverage audit.
 * Run a local preview first, then:
 * QA_URL=http://localhost:4278 QA_OUTPUT=/tmp/photograph-coverage node scripts/qa-photograph-coverage.mjs
 * Install Playwright separately or set PLAYWRIGHT_MODULE to its import path.
 * QA_BROWSER_CHANNEL defaults to installed Chrome. This launches a separate
 * browser profile and takes normal screenshots; it does not mutate app files.
 * Run only with exclusive GPU access. Emulation is not real-phone performance.
 * Native wheel/touch traversal is a separate test; this samples scroll poses.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const moduleName=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(moduleName?(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName):'playwright');
const work=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=(process.env.QA_URL||'http://localhost:4278').replace(/\/$/,'');
const out=path.resolve(process.env.QA_OUTPUT||path.join(os.tmpdir(),'photograph-coverage'));
const contractRelative='docs/easel-review/photo-guided/SCROLL-PATH-CONTRACT.json';
const contractPath=path.join(work,contractRelative);
const contractBytes=await fs.readFile(contractPath),contract=JSON.parse(contractBytes);
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
async function imagePaths(directory){
 const found=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const full=path.join(directory,entry.name);
  if(entry.isDirectory())found.push(...await imagePaths(full));
  else if(entry.isFile()&&/\.(?:jpe?g|png|webp)$/i.test(entry.name))found.push(path.relative(work,full));
 }
 return found.sort();
}
const originals=(await imagePaths(path.join(work,'public'))).map(p=>({path:p}));
const urls=['/main-v2.js','/collections.js','/collections.css','/canvas-wrap.js','/aisle-integration.js','/aisle/aisle.css','/aisle/photographic-aisle.js','/aisle/physical-display.js','/aisle/physical-easel.js','/aisle/photographic-environment.js','/aisle/gallery-layout.js','/aisle/water-surface.js','/aisle/assets/easel-geometry.js'];
// Runtime uses easel-geometry.js. The original GLB is preserved on disk but
// not served by the checked preview; it is not a runtime network dependency.
const localAssets=['public/aisle/assets/crafted-easel.glb'];
async function fingerprint(){return{modules:await Promise.all(urls.map(async url=>{const r=await fetch(base+url);return{url,status:r.status,sha256:sha(Buffer.from(await r.arrayBuffer()))};})),originals:await Promise.all(originals.map(async({path:p})=>({path:p,sha256:sha(await fs.readFile(path.join(work,p)))}))),localAssets:await Promise.all(localAssets.map(async p=>({path:p,sha256:sha(await fs.readFile(path.join(work,p)))})))};}
const report={scope:'Actual rendered Auto path at201 native scroll positions per viewport, normal ambient motion. Actual unchanged cloned easel/print meshes raycast from actual rendered camera parameters and world transforms, with projection equality independently checked against render dimensions. Other-easel obstruction is the clearance criterion; own retaining-shelf edge contacts are separately reported, not erased. Source photograph is a finite continuous background; no reconstructed pier occlusion claim.',contract:{path:contractRelative,sha256:sha(contractBytes)},nativeInputEvidence:'Separate wheel/touch forward/reverse audit required; this harness samples scroll positions.',before:await fingerprint(),cases:[],errors:[],warnings:[],httpErrors:[]};
const browser=await chromium.launch({channel:process.env.QA_BROWSER_CHANNEL||'chrome',headless:true});
async function write(){await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));}
async function atProgress(page,p){await page.evaluate(async({p,keys})=>{const a=window.PhotographicAisle;scrollTo({top:Math.round(a.journey.getBoundingClientRect().top+scrollY+p*a.getScrollRange()),behavior:'instant'});const value=(q,col)=>{let i=0;while(i<keys.length-2&&q>keys[i+1].progress)i++;const aa=keys[i],b=keys[i+1],t=Math.max(0,Math.min(1,(q-aa.progress)/(b.progress-aa.progress)));return aa[col]+(b[col]-aa[col])*t*t*(3-2*t);};for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const s=a.getState(),c=s.physical?.environment?.camera;if(Math.abs(s.progress-p)<.0005&&c&&Math.abs(s.physical.cameraDistance-value(s.progress,'distance'))<1e-10&&Math.abs(c.lookYaw-(c.sideLookSupported?value(s.progress,'phoneYaw'):0))<1e-10){await new Promise(requestAnimationFrame);return;}}throw Error('Rendered path did not settle at '+p);},{p,keys:contract.keys});}
async function setup(page){await page.evaluate(async()=>{
 const T=await import('/vendor/three.module.js'),{createPhysicalEasel}=await import('/aisle/physical-easel.js'),{configurePhotographicCamera,PHOTO_CALIBRATION}=await import('/aisle/photographic-environment.js'),layout=await import('/aisle/gallery-layout.js');
 const s=window.PhotographicAisle.getState();const models=s.slots.map((slot,index)=>{const model=createPhysicalEasel({THREE:T,slot:{id:slot.id},image:{naturalWidth:slot.physical.nativeWidth,naturalHeight:slot.physical.nativeHeight},index});return{...model,id:slot.id};});await Promise.all(models.map(m=>m.ready));
 const meshes=[];for(const m of models)m.group.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();meshes.push({mesh:o,id:m.id,box:new T.Box3()});}});
 const visible=e=>{if(!e||e.closest('[hidden]')||!e.getClientRects().length)return false;for(let n=e;n instanceof Element;n=n.parentElement){const c=getComputedStyle(n);if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)<.05)return false;}return true;};
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 function overlaps(q,r){const p=q.map(p=>[p.x,p.y]),b=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]],axes=[[1,0],[0,1]];for(let i=0;i<4;i++){const a=p[i],z=p[(i+1)%4];axes.push([-(z[1]-a[1]),z[0]-a[0]]);}return axes.every(n=>{const a=p.map(v=>v[0]*n[0]+v[1]*n[1]),z=b.map(v=>v[0]*n[0]+v[1]*n[1]);return Math.max(...a)>Math.min(...z)+1e-6&&Math.max(...z)>Math.min(...a)+1e-6;});}
 const ray=new T.Raycaster(),camera=new T.PerspectiveCamera();
 window.__coverage={models,meshes,T,read({denseId=null}={}){
  const a=window.PhotographicAisle,s=a.getState(),scene=rect(a.viewport),c=s.physical.environment.camera;
  configurePhotographicCamera({THREE:T,camera,width:s.viewport.width,height:s.viewport.height,distance:s.physical.cameraDistance,lookYaw:c.lookYaw,viewPitchOffset:c.viewPitchOffset,focalZoom:c.focalZoom,calibration:{...PHOTO_CALIBRATION,cameraHeight:PHOTO_CALIBRATION.cameraHeight*layout.PIER_SCENE_SCALE,maximumTravel:layout.TRAVEL}});
  const displayed=new Set(s.slots.filter(q=>!q.passed).map(q=>q.id));
  for(const m of models){const live=s.physical.galleryPlacement.find(q=>q.id===m.id);m.group.position.fromArray(live.worldPosition);m.group.rotation.fromArray([...live.worldRotation,'XYZ']);m.group.updateMatrixWorld(true);}
  for(const q of meshes)q.box.copy(q.mesh.geometry.boundingBox).applyMatrix4(q.mesh.matrixWorld);
  const overlays=[...document.querySelectorAll('#menu-toggle,#menu-panel,.aisle-progress,.aisle-invitation,.aisle-start-walk,.aisle-category-sign')].filter(visible).map(e=>({id:e.id||e.className,text:e.textContent.trim(),rect:rect(e)}));
  let maxProjectionError=0,maxCornerError=0;
  const photos=s.slots.map(slot=>{const m=models.find(q=>q.id===slot.id),live=s.physical.galleryPlacement.find(q=>q.id===slot.id),corners=m.getWorldCorners(),q=slot.projectedQuad;
   corners.forEach((p,i)=>{maxCornerError=Math.max(maxCornerError,p.distanceTo(new T.Vector3(...live.worldFrontCorners[i])));const z=p.clone().project(camera);maxProjectionError=Math.max(maxProjectionError,Math.hypot((z.x+1)*s.viewport.width/2-q[i].x,(1-z.y)*s.viewport.height/2-q[i].y));});
   const area=q.reduce((n,p,i)=>n+p.x*q[(i+1)%4].y-q[(i+1)%4].x*p.y,0)/2,normal=new T.Vector3(0,0,1).transformDirection(m.group.matrixWorld),center=corners[0].clone().add(corners[2]).multiplyScalar(.5),frontFacing=normal.dot(camera.position.clone().sub(center))>0;
   const margin=Math.min(...q.flatMap(p=>[p.x,scene.width-p.x,p.y,scene.height-p.y])),edge=Math.max(...q.map((p,i)=>Math.hypot(p.x-q[(i+1)%4].x,p.y-q[(i+1)%4].y)));
   const collisions=overlays.filter(o=>overlaps(q.map(p=>({x:p.x+scene.x,y:p.y+scene.y})),o.rect)).map(o=>({id:o.id,text:o.text}));
   const complete=!slot.passed&&frontFacing&&margin>=0&&q.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),candidate=complete&&edge>=150&&!collisions.length;
   let rays=0,blocked=0,by={},selfContactRays=0,selfContactBy={};const n=denseId===slot.id?65:13,k=denseId===slot.id?49:9;
   if(candidate){for(let iy=0;iy<k;iy++)for(let ix=0;ix<n;ix++){
    const u=ix/(n-1),v=iy/(k-1),point=corners[0].clone().lerp(corners[1],u).lerp(corners[3].clone().lerp(corners[2],u),v),dir=point.clone().sub(camera.position),length=dir.length();ray.set(camera.position,dir.multiplyScalar(1/length));ray.near=.04;ray.far=length-.0002;
    const nearMeshes=meshes.filter(o=>displayed.has(o.id)&&o.mesh!==m.printMesh&&ray.ray.intersectsBox(o.box));const objects=nearMeshes.filter(o=>o.id!==m.id).map(o=>o.mesh);const own=ray.intersectObjects(nearMeshes.filter(o=>o.id===m.id).map(o=>o.mesh),false)[0];if(own){selfContactRays++;selfContactBy[own.object.name]=(selfContactBy[own.object.name]||0)+1;}const hit=ray.intersectObjects(objects,false)[0];rays++;if(hit){blocked++;let g=hit.object;while(!g.userData.slotId&&g.parent)g=g.parent;const name=g.userData.slotId+' | '+hit.object.name;by[name]=(by[name]||0)+1;}
   }}
   return{id:slot.id,row:slot.depthGroup,passed:slot.passed,quad:q,area,frontFacing,margin,longEdge:edge,collisions,complete,candidate,rays,blocked,by,selfContactRays,selfContactBy,clear:candidate&&blocked===0};
  });
  return{progress:s.progress,scrollY,scrollRange:s.scrollRange,scene,viewport:s.viewport,lookDirection:s.lookDirection,reducedMotion:s.reducedMotion,cameraDistance:s.physical.cameraDistance,camera:s.physical.environment.camera,waterPhase:s.physical.waterPhase,worldPlacement:s.physical.galleryPlacement,maxProjectionError,maxCornerError,overlays,photos};
 }};
 });}
try{for(const [id,width,height,touch]of[['desktop',1440,900,false],['phone390',390,844,true],['phone430',430,932,true]]){
 const c={id,width,height,samples:[],coverage:[],screenshots:[]};report.cases.push(c);
 const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push({id,error:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.warnings.push({id,type:m.type(),url:m.location().url,text:m.text()});});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({id,status:r.status(),url:r.url()});});await page.route('**/__preview_events',r=>r.abort());
 try{await page.goto(base);await page.waitForFunction(()=>window.PhotographicAisle?.getState().physical?.ready&&window.PhotographicAisle.getState().slots.every(s=>s.physical)&&window.PhotographicAisle.getState().physical.environment?.camera,null,{timeout:45000});await page.evaluate(()=>document.fonts.ready);await setup(page);
 for(let i=0;i<=200;i++){await atProgress(page,i/200);const s=await page.evaluate(()=>window.__coverage.read());s.requestedProgress=i/200;c.samples.push(s);if(i===0||i===200){const file=`${id}-${i===0?'entry':'end'}.png`;await page.screenshot({path:path.join(out,file)});c.screenshots.push({file,kind:'endpoint',progress:s.progress});}if(i%50===0){await write();console.log(JSON.stringify({id,samples:i+1,sourceGuard:s.camera.sourceEnvelope.inside}));}}
 for(const photoId of contract.expectedIds){const good=c.samples.filter(s=>s.photos.find(p=>p.id===photoId)?.clear),intervals=[];for(const s of good){let last=intervals.at(-1);if(last&&s.requestedProgress-last.requestedEnd<=.00501){last.end=s.progress;last.requestedEnd=s.requestedProgress;last.endScrollY=s.scrollY;last.samples++;}else intervals.push({start:s.progress,end:s.progress,requestedStart:s.requestedProgress,requestedEnd:s.requestedProgress,startScrollY:s.scrollY,endScrollY:s.scrollY,samples:1});}
 for(const interval of intervals){interval.progressSpan=interval.end-interval.start;interval.nativeScrollPixels=interval.endScrollY-interval.startScrollY;interval.useful=interval.progressSpan>=.025-1e-4&&interval.nativeScrollPixels>=100;}
 const useful=intervals.filter(x=>x.useful);let best=null;if(useful.length){const eligible=good.filter(s=>useful.some(i=>s.progress>=i.start&&s.progress<=i.end));best=eligible.sort((a,b)=>{const ap=a.photos.find(p=>p.id===photoId),bp=b.photos.find(p=>p.id===photoId);return Math.min(bp.margin,80)*4+bp.longEdge-(Math.min(ap.margin,80)*4+ap.longEdge);})[0];}
 const coverage={id:photoId,intervals,pass:useful.length>0,best:best?{progress:best.progress,requestedProgress:best.requestedProgress,photo:best.photos.find(p=>p.id===photoId)}:null};
 if(best){await atProgress(page,best.requestedProgress);const dense=await page.evaluate(id=>window.__coverage.read({denseId:id}),photoId),p=dense.photos.find(p=>p.id===photoId);coverage.denseBest={progress:dense.progress,photo:p,maxProjectionError:dense.maxProjectionError};coverage.pass&&=p.clear;const file=`${id}-best-${photoId}.png`;const bytes=await page.screenshot({path:path.join(out,file)});coverage.screenshot={file,sha256:sha(bytes)};c.screenshots.push(coverage.screenshot);}
 c.coverage.push(coverage);
 }
 c.checks={all10Useful:c.coverage.length===10&&c.coverage.every(p=>p.pass),allSourceGuarded:c.samples.every(s=>s.camera.sourceEnvelope.inside),actualProjectionMatches:c.samples.every(s=>s.maxProjectionError<1e-6&&s.maxCornerError<1e-9),normalAutoOnly:c.samples.every(s=>s.lookDirection==='auto'&&!s.reducedMotion),all201Samples:c.samples.length===201};console.log(JSON.stringify({id,checks:c.checks,coverage:c.coverage.map(x=>({id:x.id,pass:x.pass,intervals:x.intervals.filter(i=>i.useful)}))}));
 }catch(e){c.error=e.stack;report.errors.push({id,error:e.stack});await page.screenshot({path:path.join(out,id+'-failure.png')}).catch(()=>{});}finally{await context.close();await write();}
}}finally{await browser.close();report.after=await fingerprint();report.runtimeStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.unexpectedConsoleMessages=report.warnings.filter(w=>!(w.url.endsWith('/__preview_events')&&w.text==='Failed to load resource: net::ERR_FAILED'));report.allRequiredURLsLoaded=report.before.modules.concat(report.after.modules).every(m=>m.status===200);report.status=!report.errors.length&&!report.httpErrors.length&&!report.unexpectedConsoleMessages.length&&report.allRequiredURLsLoaded&&report.runtimeStable&&report.cases.length===3&&report.cases.every(c=>c.checks&&Object.values(c.checks).every(Boolean))?'PASS':'FAIL';await write();console.log(JSON.stringify({status:report.status,errors:report.errors,httpErrors:report.httpErrors,runtimeStable:report.runtimeStable,out}));if(report.status==='FAIL')process.exitCode=1;}
