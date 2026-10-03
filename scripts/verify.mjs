import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),pub=path.join(root,'public');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const categories=JSON.parse(await fs.readFile(path.join(pub,'categories.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/asset-manifest.json'),'utf8'));
const expected={branding:13,families:21,headshots:31,coastal:4};
// what the exhibitions hang: every gallery photograph but the badged pier, which lives on only blurred (public/brand/pier-blur.jpg)
const hung={...expected,branding:12};
const seen=new Set();
async function local(url){
  assert(typeof url==='string'&&url.startsWith('/')&&!url.startsWith('//')&&!url.includes('..'),'Invalid local asset URL');
  const file=path.join(pub,url.slice(1));assert((await fs.stat(file)).isFile(),'Missing asset '+url);return file;
}
for(const c of categories.categories){
  assert(c.items.length===expected[c.id],'Unexpected category count: '+c.id);
  assert(c.rooms.length===0,'Purchased room assets must remain excluded');
  for(const item of c.items){assert(!seen.has(c.id+':'+item.id),'Duplicate item ID');seen.add(c.id+':'+item.id);await local(item.src);await local(item.full);assert(item.alt&&item.width>0&&item.height>0,'Incomplete photo metadata');}
}
assert(seen.size===69,'Unexpected total photo entries');
// The exhibitions: every plate is a web copy of an approved photograph from its own collection.
const catalog=JSON.parse(await fs.readFile(path.join(pub,'catalog.json'),'utf8'));
const approved=new Map(categories.categories.map(c=>[c.id,new Set(c.items.map(i=>i.full.split('/').pop()))]));
let exhibitionPlates=0;
for(const ex of catalog.issues){
  const issue=JSON.parse(await fs.readFile(path.join(pub,ex.slug,'issue.json'),'utf8'));
  const plates=issue.stories.flatMap(s=>s.plates);
  assert(plates.length===ex.plates&&plates.length===hung[ex.slug],'Unexpected exhibition plate count: '+ex.slug);
  for(const shell of ['index.html','book/index.html','atelier/index.html'])await local('/'+ex.slug+'/'+shell);
  await local('/'+ex.slug+'/'+issue.cover);
  for(const p of plates){
    await local('/'+ex.slug+'/'+p.img);
    assert(approved.get(ex.slug).has(p.img.split('/').pop()),'Exhibition plate is not an approved '+ex.slug+' photograph: '+p.img);
    assert(p.kicker&&p.caption&&p.w>0&&p.h>0&&p.palette.every(c=>/^#[0-9a-f]{6}$/.test(c)),'Incomplete plate data: '+p.img);
  }
  exhibitionPlates+=plates.length;
}
assert(exhibitionPlates===68,'Unexpected exhibition plate total');
assert(manifest.assets.length===91,'Unexpected image allowlist count');
assert(manifest.uniqueImageFiles===manifest.assets.length&&manifest.imageBytes===manifest.assets.reduce((n,a)=>n+a.bytes,0),'Manifest totals do not match its assets');
for(const item of manifest.assets){const bytes=await fs.readFile(path.join(root,item.path));assert(bytes.length===item.bytes&&hash(bytes)===item.sha256,'Asset hash mismatch: '+item.path);}
const forbidden=/(?:\/(?:Users|Volumes|home)\/[^\s"']+|file:\/\/|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const textFiles=[],files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){
  if(e.name==='.git'||e.name==='node_modules')continue;
  const file=path.join(dir,e.name);assert(!e.isSymbolicLink(),'Symlinks are not allowed');
  if(e.isDirectory())await walk(file);else{files.push(file);if(/\.(?:html|js|mjs|css|json|md)$/.test(file)){const text=await fs.readFile(file,'utf8');assert(!forbidden.test(text),'Private path or secret-shaped value in '+path.relative(root,file));textFiles.push(file);}}
}}
await walk(root);
const port=Number(process.env.CHECK_PORT||4261);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test server did not start: '+output)),5000);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code+': '+output)));child.stdout.on('data',()=>{if(output.includes('Portfolio preview:')){clearTimeout(timer);resolve();}});});
  const base='http://127.0.0.1:'+port;
  for(const url of ['/','/categories.json','/catalog.json','/assets/x/exhibit.js','/assets/x/x.css','/brand/pier-blur.jpg',...catalog.issues.flatMap(e=>['/'+e.slug+'/','/'+e.slug+'/issue.json','/'+e.slug+'/book/','/'+e.slug+'/atelier/'])])assert((await fetch(base+url)).status===200,'Runtime route failed '+url);
  // the pier walk is retired: none of its pages or scripts are served
  for(const url of ['/walk/','/main.js','/archive/archive.js'])assert((await fetch(base+url)).status===404,'Retired walk route still served '+url);
  const folder=await fetch(base+'/branding',{redirect:'manual'});
  assert(folder.status===301&&folder.headers.get('location')==='/branding/','A folder without its trailing slash should redirect to it');
  const part=await fetch(base+'/media/underpier-photograph.jpg',{headers:{Range:'bytes=0-99'}});
  assert(part.status===206&&(await part.arrayBuffer()).byteLength===100&&/^bytes 0-99\//.test(part.headers.get('content-range')||''),'Byte ranges must work on a large file');
  assert((await fetch(base+'/media/underpier-photograph.jpg',{headers:{Range:'bytes=999999999-'}})).status===416,'An unsatisfiable range should be 416');
  for(const url of ['/server.mjs','/package.json','/docs/asset-manifest.json','/.git/config','/.env','/%2e%2e/package.json','/media/%2e%2e/%2e%2e/server.mjs','/tools/exhibitions.json','/tools/build_exhibitions.py'])assert((await fetch(base+url)).status===404,'Private route exposed '+url);
  assert((await fetch(base+'/',{method:'POST'})).status===405,'POST should be rejected');
  assert((await fetch(base+'/',{method:'HEAD'})).status===200,'HEAD failed');
  console.log(JSON.stringify({status:'PASS',categories:expected,photoEntries:69,exhibitions:catalog.issues.length,exhibitionPlates,folderRedirect:'301',byteRanges:'206',purchasedRooms:0,uniquePhotographs:manifest.assets.length,imageBytes:manifest.imageBytes,assetHashes:'all match',textFilesScanned:textFiles.length,privatePathOrSecretPatternMatches:0,symlinks:0,serverRuntimeRoutes:'PASS',retiredWalkRoutes:'404',privateServerRoutes:'404',writeMethods:'405',files:files.length},null,2));
}finally{child.kill('SIGTERM');}
