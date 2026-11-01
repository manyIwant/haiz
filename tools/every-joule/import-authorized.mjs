#!/usr/bin/env node
/**
 * Installs only a locally supplied, author-authorized, browser-ready export.
 * This script DOES NOT crawl, fetch, scrape, mirror or download Every Joule.
 * Source files and permission evidence are never automatically committed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const thisDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(thisDir,'../..');
const destination=path.join(root,'every-joule-offline/app');
const manifestPath=path.join(root,'every-joule-offline/offline-index.json');
const auditPath=path.join(root,'every-joule-offline/import-audit.json');
const args=process.argv.slice(2);
const options={};
for(let i=0;i<args.length;i++){
  if(['--source','--permission-file'].includes(args[i])) options[args[i].slice(2)]=args[++i];
  else if(args[i]==='--help'){console.log('Usage: node tools/every-joule/import-authorized.mjs --source /path/to/author-export --permission-file /path/to/explicit-authorization.txt');process.exit(0);}
  else throw new Error('Unrecognized argument '+args[i]);
}
if(!options.source||!options['permission-file'])throw new Error('Both --source and --permission-file are mandatory. See tools/every-joule/README.md');
const source=path.resolve(options.source);
const evidence=path.resolve(options['permission-file']);
if(source===destination||destination.startsWith(source+path.sep)||source.startsWith(destination+path.sep))throw new Error('Source and destination must not overlap');
const permission=await fs.readFile(evidence,'utf8');
if(permission.trim().length<20)throw new Error('The authorization evidence file must contain the author’s explicit written permission. It is never uploaded automatically.');
const allowed=await fs.stat(source);
if(!allowed.isDirectory())throw new Error('--source must be a directory containing the author-supplied runnable HTML export');
if(!(await fs.stat(path.join(source,'index.html')).catch(()=>null))?.isFile())throw new Error('The source folder must contain index.html at its top level');
const walk=async(base,relative='')=>{
  const entries=await fs.readdir(path.join(base,relative),{withFileTypes:true});
  const result=[];
  for(const entry of entries){
    if(['.git','.DS_Store','Thumbs.db'].includes(entry.name))continue;
    const rel=path.join(relative,entry.name);
    if(entry.isSymbolicLink())throw new Error('Symlinks are not allowed in imported sources: '+rel);
    if(entry.isDirectory())result.push(...await walk(base,rel));
    else if(entry.isFile())result.push(rel.split(path.sep).join('/'));
    else throw new Error('Unsupported source entry '+rel);
  }
  return result;
};
const files=(await walk(source)).sort();
if(!files.length)throw new Error('The export is empty');
const audit={created:new Date().toISOString(),sourceFileCount:files.length,permissionEvidenceSha256:crypto.createHash('sha256').update(permission).digest('hex'),missingReferences:[],externalDependencies:[],rootAbsoluteReferences:[],dynamicCheck:'A static scan cannot prove runtime independence. A browser test with networking disabled is required before releasing.'};
const known=new Set(files);
const regexSources=[
 /<(?:script|img|source|video|audio|iframe)\b[^>]*?\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi,
 /<link\b(?=[^>]*\brel\s*=\s*["'](?:stylesheet|icon|preload|modulepreload|manifest|apple-touch-icon)["'])[^>]*\bhref\s*=\s*["']([^"']+)["']/gi,
 /\burl\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
 /@import\s+(?:url\()?["']([^"']+)["']/gi,
 /\b(?:fetch|import|require|Worker|SharedWorker)\s*\(\s*["']([^"']+)["']/gi,
 /\bfrom\s+["']([^"']+)["']/gi
];
function auditReference(from,raw){
 if(!raw||raw.startsWith('#')||/^(data:|blob:|about:|mailto:|tel:)/i.test(raw))return;
 if(/^(https?:|wss?:|\/\/)/i.test(raw)){audit.externalDependencies.push({from,url:raw});return;}
 if(raw.startsWith('/')){audit.rootAbsoluteReferences.push({from,url:raw});return;}
 let clean=raw.split(/[?#]/)[0];
 try{clean=decodeURIComponent(clean);}catch{}
 if(!clean||clean.includes('\\'))return;
 const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),clean));
 if(resolved.startsWith('../')){audit.rootAbsoluteReferences.push({from,url:raw});return;}
 // Ignore package imports: a separate browser test will catch unresolved module specifiers.
 if(!raw.startsWith('.')&&!raw.startsWith('/')&&!raw.includes('/')&&!/\.[a-z0-9]{1,8}$/i.test(raw))return;
 if(!known.has(resolved))audit.missingReferences.push({from,url:raw,resolved});
}
for(const rel of files){
 if(!/\.(html?|css|m?js|json|svg)$/i.test(rel))continue;
 const stat=await fs.stat(path.join(source,rel));
 if(stat.size>20*1024*1024)continue;
 const content=await fs.readFile(path.join(source,rel),'utf8');
 for(const re of regexSources){
  re.lastIndex=0;
  for(const match of content.matchAll(re))auditReference(rel,match[1]);
 }
}
await fs.writeFile(auditPath,JSON.stringify(audit,null,2)+'\n');
if(audit.externalDependencies.length||audit.rootAbsoluteReferences.length||audit.missingReferences.length){
 console.error(JSON.stringify({error:'Source export is not yet self-contained',auditPath,external:audit.externalDependencies.length,rootAbsolute:audit.rootAbsoluteReferences.length,missing:audit.missingReferences.length},null,2));
 process.exitCode=2;
}else{
 // Copy only after basic static dependency checks pass.
 await fs.rm(destination,{recursive:true,force:true});
 await fs.mkdir(destination,{recursive:true});
 const items=[];
 for(const rel of files){
  const target=path.join(destination,rel);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(source,rel),target);
  const bytes=await fs.readFile(target);
  items.push({path:'app/'+rel,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 const version=crypto.createHash('sha256').update(items.map(x=>x.path+':'+x.sha256).join('\n')).digest('hex').slice(0,20);
 const manifest={version,author:'Techartist',source:'Author-supplied, expressly licensed local export',generatedAt:new Date().toISOString(),totalBytes:items.reduce((n,f)=>n+f.bytes,0),files:items.map(x=>x.path),items};
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({ok:true,version,files:items.length,totalBytes:manifest.totalBytes,manifestPath,auditPath,note:'Only the original source files you supplied were copied. Confirm full offline operation with a browser network-block test.'},null,2));
}
