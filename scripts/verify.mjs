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
const baselineBytes=await fs.readFile(path.join(root,'docs/expansion-baseline.json'));
assert(hash(baselineBytes)==='6eb94e96d67f8a6103b1414ab8b72aef4d265d9ed0ec346802395a7892a2134c','Accepted category baseline changed');
const baseline=JSON.parse(baselineBytes);
const additions=JSON.parse(await fs.readFile(path.join(root,'docs/expansion-assets.json'),'utf8'));
const review=JSON.parse(await fs.readFile(path.join(pub,'expansion-review.json'),'utf8'));
const fulls=additions.assets.filter(a=>a.role==='full');
assert(new Set(fulls.map(a=>a.photo_id)).size===fulls.length,'Duplicate reviewed photo identity');
assert(JSON.stringify([...review.reviewedIDs].sort())===JSON.stringify(fulls.map(a=>a.photo_id).sort()),'Review and asset allowlist disagree');
for(const c of categories.categories){
  const base=baseline.categories.find(b=>b.id===c.id);
  const originalIDs=new Set(base?.items.map(i=>i.id));
  assert(base&&JSON.stringify({...c,items:c.items.filter(i=>originalIDs.has(i.id))})===JSON.stringify(base),'Accepted category content or relative order changed');
  const newItems=c.items.filter(i=>!originalIDs.has(i.id));
  assert(newItems.length===fulls.filter(a=>a.category===c.id).length,'Unreviewed category addition');
  for(const item of newItems)for(const [role,key] of [['full','full'],['thumbnail','src']]){
    const asset=additions.assets.find(a=>a.photo_id===item.id&&a.role===role&&a.category===c.id);
    assert(asset&&asset.path==='public'+item[key],'Added photo is outside derivative allowlist');
    if(role==='full')assert(item.width===asset.width&&item.height===asset.height,'Added photo dimensions differ from reviewed export');
  }
  expected[c.id]+=newItems.length;
}
assert(categories.categories.length===baseline.categories.length,'Unexpected category');
for(const asset of additions.assets){
  assert(/^public\/media\/expansion\/[a-f0-9]{64}\.(jpg|jpeg|png|webp)$/.test(asset.path),'Invalid derivative path');
  const bytes=await fs.readFile(path.join(root,asset.path));
  assert(bytes.length===asset.bytes&&hash(bytes)===asset.sha256,'Expansion asset changed');
  assert(['eligible','local-review-only','unverified'].includes(asset.public_eligibility),'Missing explicit public eligibility');
}
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
assert(seen.size===69+fulls.length,'Unexpected total photo entries');
const slots=JSON.parse(await fs.readFile(path.join(pub,'slots.json'),'utf8'));
assert(hash(await fs.readFile(path.join(pub,'slots.json')))==='f6bbcd495c1533a5e5f3f1ca10a06343e6d8ba5ea68d99a789fad85dd9cb07b8','Accepted easel slots changed');
assert(slots.length===10,'Expected ten easel slots');
for(const slot of slots){await local(slot.src);await local(slot.full);assert(slot.quad.length===4,'Invalid slot corners');}
assert(manifest.assets.length===92,'Unexpected image allowlist count');
for(const item of manifest.assets){const bytes=await fs.readFile(path.join(root,item.path));assert(bytes.length===item.bytes&&hash(bytes)===item.sha256,'Asset hash mismatch: '+item.path);}
const sequence=JSON.parse(await fs.readFile(path.join(pub,'video/frames.json'),'utf8'));
assert(sequence.reviewStatus==='preview-only','Video must remain labeled preview-only until tracking is reviewed');
assert(sequence.frames.length===121,'Expected 121 actual video samples');
let previousTime=-1,videoFrameBytes=0;
for(const frame of sequence.frames){
  assert(/^frame-\d{4}\.jpg$/.test(frame.file),'Invalid video frame filename');
  assert(frame.time>previousTime&&frame.width===1280&&frame.height===960,'Invalid video frame order/dimensions');
  previousTime=frame.time;
  const bytes=await fs.readFile(path.join(pub,'video',frame.file));
  assert(hash(bytes)===frame.sha256,'Video frame hash mismatch: '+frame.file);
  videoFrameBytes+=bytes.length;
}
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
  for(const url of ['/','/categories.json','/main-v2.js','/aisle/photographic-aisle.js','/aisle/video-frame-seam.js','/video/frames.json','/video/frame-0000.jpg','/video/frame-0120.jpg'])assert((await fetch(base+url)).status===200,'Runtime route failed '+url);
  for(const url of ['/server.mjs','/package.json','/docs/asset-manifest.json','/.git/config','/.env','/%2e%2e/package.json','/media/%2e%2e/%2e%2e/server.mjs'])assert((await fetch(base+url)).status===404,'Private route exposed '+url);
  assert((await fetch(base+'/',{method:'POST'})).status===405,'POST should be rejected');
  assert((await fetch(base+'/',{method:'HEAD'})).status===200,'HEAD failed');
  console.log(JSON.stringify({status:'PASS',categories:expected,photoEntries:seen.size,easelSlots:10,purchasedRooms:0,baselineImageFiles:92,addedPhotographs:fulls.length,addedDerivativeBytes:additions.assets.reduce((n,a)=>n+a.bytes,0),imageBytes:manifest.imageBytes,videoFrames:sequence.frames.length,videoFrameBytes,videoReviewStatus:sequence.reviewStatus,assetHashes:'all match',textFilesScanned:textFiles.length,privatePathOrSecretPatternMatches:0,symlinks:0,serverRuntimeRoutes:'PASS',privateServerRoutes:'404',writeMethods:'405',files:files.length},null,2));
}finally{child.kill('SIGTERM');}
