import http from 'node:http';
import path from 'node:path';
import {readdir,readFile,realpath} from 'node:fs/promises';
import {watch} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=await realpath(path.join(path.dirname(fileURLToPath(import.meta.url)),'public'));
const port=Number(process.env.PORT||4260),host=process.env.HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
const allowed=new Map(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon','.svg':'image/svg+xml'};
async function inventory(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())await inventory(file);
    else if(entry.isFile()&&types[path.extname(file).toLowerCase()])allowed.set('/'+path.relative(root,file).split(path.sep).join('/'),file);
  }
}
await inventory(root);
// Explicit local development mode. Production/static hosting has no reload
// endpoint or injected script. Rebuild the same public-only allowlist so newly
// exported assets appear without restarting the preview.
const liveReload=process.env.LIVE_RELOAD==='1',clients=new Set();
const reloadScript=`<script>
(() => {
 let lastInput=0,pending;
 for(const type of ['pointerdown','wheel','touchstart','keydown'])addEventListener(type,()=>lastInput=Date.now(),{passive:true});
 const reload=()=>{const wait=1800-(Date.now()-lastInput);if(wait>0){pending=setTimeout(reload,wait);return;}
  const s=window.PhotographicAisle?.getState();
  if(s)sessionStorage.setItem('kcl-live-preview-state',JSON.stringify({version:2,progress:s.progress,look:s.lookDirection||'auto',mode:s.motionPreference}));
  location.reload();};
 new EventSource('/__preview_events').onmessage=e=>{if(e.data==='reload'){clearTimeout(pending);pending=setTimeout(reload,900);}};
 const saved=sessionStorage.getItem('kcl-live-preview-state');
 if(saved){sessionStorage.removeItem('kcl-live-preview-state');const s=JSON.parse(saved);let attempts=0;
  const restore=()=>{const a=window.PhotographicAisle;if(!a?.getState().physical?.ready){if(++attempts<200)setTimeout(restore,100);return;}
   if(s.version===2&&['guided','system','still'].includes(s.mode)){a.setMotionPreference(s.mode);const select=document.querySelector('#travel-mode');if(select)select.value=s.mode;}
   a.setLook(s.look||'auto');
   if(!location.hash.startsWith('#collection'))requestAnimationFrame(()=>scrollTo({top:a.journey.getBoundingClientRect().top+scrollY+s.progress*(a.getScrollRange?.()??(a.journey.offsetHeight-a.viewport.clientHeight)),behavior:'instant'}));
  };setTimeout(restore,0);
 }
})();</script>`;
let reloadTimer,watcher;
if(liveReload)watcher=watch(root,{recursive:true},()=>{
  clearTimeout(reloadTimer);
  reloadTimer=setTimeout(async()=>{
    await inventory(root);
    for(const client of clients)client.write('data: reload\n\n');
  },800);
});
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-cache');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  try{
    const url=new URL(req.url,'http://localhost'),requested=decodeURIComponent(url.pathname);
    if(liveReload&&requested==='/__preview_events'&&req.method==='GET'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      res.write('data: connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
    }
    if(requested.includes('\0')||requested.includes('\\')){res.writeHead(400).end();return;}
    const file=allowed.get(requested==='/'?'/index.html':requested);
    if(!file){res.writeHead(404).end('Not found');return;}
    const resolved=await realpath(file);
    if(!resolved.startsWith(root+path.sep)||resolved!==file){res.writeHead(403).end();return;}
    let bytes=await readFile(file);
    if(liveReload&&path.extname(file)==='.html')bytes=Buffer.from(bytes.toString().replace('</body>',reloadScript+'</body>'));
    res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()],'Content-Length':bytes.length});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,host,()=>console.log(`Portfolio preview: http://${host}:${port}/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{watcher?.close();clearTimeout(reloadTimer);for(const client of clients)client.end();server.close(()=>process.exit(0));});
