import http from 'node:http';
import path from 'node:path';
import {readdir,readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=await realpath(path.join(path.dirname(fileURLToPath(import.meta.url)),'public'));
const port=Number(process.env.PORT||4260),host=process.env.HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
const allowed=new Map(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon','.svg':'image/svg+xml','.hdr':'application/octet-stream'};
async function inventory(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())await inventory(file);
    else if(entry.isFile()&&types[path.extname(file).toLowerCase()])allowed.set('/'+path.relative(root,file).split(path.sep).join('/'),file);
  }
}
await inventory(root);
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-cache');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  try{
    const url=new URL(req.url,'http://localhost'),requested=decodeURIComponent(url.pathname);
    if(requested.includes('\0')||requested.includes('\\')){res.writeHead(400).end();return;}
    // A folder is served by its index.html; a folder asked for without its
    // trailing slash is redirected first, so the page's relative URLs resolve.
    const file=allowed.get(requested.endsWith('/')?requested+'index.html':requested);
    if(!file){
      if(allowed.has(requested+'/index.html')){res.writeHead(301,{'Location':requested+'/'+url.search}).end();return;}
      res.writeHead(404).end('Not found');return;
    }
    const resolved=await realpath(file);
    if(!resolved.startsWith(root+path.sep)||resolved!==file){res.writeHead(403).end();return;}
    const bytes=await readFile(file);
    const head={'Content-Type':types[path.extname(file).toLowerCase()],'Accept-Ranges':'bytes'};
    // Byte ranges, so a browser can seek inside the scrubbed videos.
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
    if(range&&(range[1]||range[2])){
      const start=range[1]?Number(range[1]):Math.max(0,bytes.length-Number(range[2]));
      const end=range[1]&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
      if(start>end||start>=bytes.length){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`}).end();return;}
      res.writeHead(206,{...head,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});
      res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));return;
    }
    res.writeHead(200,{...head,'Content-Length':bytes.length});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(port,host,()=>console.log(`Portfolio preview: http://${host}:${port}/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
