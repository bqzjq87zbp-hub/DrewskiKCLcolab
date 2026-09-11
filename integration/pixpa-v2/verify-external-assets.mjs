// Verify ordinary-image transport without adding non-CORS files to WebGL or the host archive.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const map=read(path.join(here,'external-collection-assets.json'));
const hosted=read(path.join(here,'runtime/categories.json')),standalone=read(path.join(root,'public/categories.json'));
const assets=read(path.join(here,'asset-map.json')),slots=read(path.join(here,'runtime/slots.json'));
assert.equal(map.files.length,58);assert.equal(map.corsTextureUse,false);
assert.equal(new Set(map.files.map(x=>x.url)).size,58);
const hostedItems=hosted.categories.flatMap(c=>c.items),sourceItems=standalone.categories.flatMap(c=>c.items);
assert.equal(hostedItems.length,111);assert.deepEqual(hosted.categories.map(c=>c.items.length),[25,28,36,22]);
for(const row of map.files){
  assert.match(row.path,/^public\/media\/expansion\/[a-f0-9]{64}\.jpg$/);
  assert.match(row.url,/^https:\/\/px-files\.pixpa\.com\/848127\/\d+-\d+\.jpg$/);
  const bytes=fs.readFileSync(path.join(root,row.path));assert.equal(bytes.length,row.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);
  const sourceURL=row.path.slice('public'.length),matches=sourceItems.filter(i=>i.src===sourceURL||i.full===sourceURL);assert.equal(matches.length,1);
  const item=hostedItems.find(i=>i.id===matches[0].id);assert(item);
  for(const role of ['src','full'])if(matches[0][role]===sourceURL)assert.equal(item[role],row.url);
  assert(!JSON.stringify(slots).includes(row.url));assert(!assets.some(x=>x.accepted===row.path.slice('public/'.length)));
}
console.log(JSON.stringify({status:'PASS',externalDerivatives:58,bytes:map.files.reduce((n,x)=>n+x.bytes,0),photoEntries:111,hostedOutputFiles:assets.length,easelBindingsUnchanged:true}));
