// Reproduce the published gallery's asset URLs without changing the standalone public/ tree.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..');
const args=process.argv.slice(2),check=args.length===1&&args[0]==='--check';
if(!check&&(args.length!==2||args[0]!=='--output'||!path.isAbsolute(args[1])))throw new Error('Use --check, or --output /absolute/new-directory');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'asset-map.json'),'utf8')),seen=new Set();
const files=manifest.map(row=>{
 if(!row.accepted||path.isAbsolute(row.accepted)||row.accepted.split('/').includes('..')||row.accepted.includes('\\'))throw new Error('Unsafe source path');
 if(!/^\/(?:pier-v1-20260909|pier-v2-20260910)\//.test(row.url)||row.url.includes('\\')||row.url.split('/').includes('..')||seen.has(row.url))throw new Error('Unsafe/duplicate output path');seen.add(row.url);
 const overlay=path.join(here,'runtime',row.accepted),source=fs.existsSync(overlay)?overlay:path.join(repo,'public',row.accepted),bytes=fs.readFileSync(source);
 if(bytes.length!==row.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new Error('Source integrity failure: '+row.accepted);
 return {row,source};
});
if(!check){const output=args[1];if(fs.existsSync(output))throw new Error('Output already exists; originals will not be overwritten');fs.mkdirSync(output);for(const {row,source} of files){const target=path.join(output,row.url.slice(1));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);const b=fs.readFileSync(target);if(crypto.createHash('sha256').update(b).digest('hex')!==row.sha256)throw new Error('Output integrity failure: '+row.url);}}
console.log(JSON.stringify({verified:files.length,reusedPhotographs:manifest.filter(x=>x.reused).length,bytes:manifest.reduce((n,x)=>n+x.bytes,0),output:check?null:args[1]}));
