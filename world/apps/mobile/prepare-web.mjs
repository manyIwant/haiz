import {mkdirSync,readdirSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../../',import.meta.url)),target=fileURLToPath(new URL('./www/',import.meta.url));
const standalone=existsSync(path.join(project,'dist/index.html')),source=standalone?path.join(project,'dist'):project;
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
const excluded=new Set(['downloads','apps','plugins','scripts','tests','portable','node_modules','docs','build','dist','.haiz-demo','.git','.github']);
const copy=(from,to)=>{mkdirSync(to,{recursive:true});for(const name of readdirSync(from))if(!name.startsWith('.')&&!excluded.has(name))cpSync(path.join(from,name),path.join(to,name),{recursive:true})};
let entry;
if(standalone){copy(source,target);entry=target}else{
 // Preserve /world and its sibling original assets: campus.html uses base ../.
 const original=path.dirname(project);for(const name of readdirSync(original))if(!name.startsWith('.')&&!excluded.has(name)&&name!=='world')cpSync(path.join(original,name),path.join(target,name),{recursive:true});
 entry=path.join(target,'world');copy(source,entry);
 writeFileSync(path.join(target,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HAIZ Study</title><script>location.replace("world/#study")</script><a href="world/#study">打开 HAIZ Study</a></html>');
}
const index=path.join(entry,'index.html');writeFileSync(index,readFileSync(index,'utf8').replace('</head>','<link rel="stylesheet" href="mobile-shell.css"><script defer src="mobile-shell.js"></script></head>'));
for(const file of ['mobile-shell.js','mobile-shell.css'])cpSync(new URL(file,import.meta.url),path.join(entry,file));
writeFileSync(path.join(target,'build-info.json'),JSON.stringify({version:'0.4.0-preview.1',builtAt:new Date().toISOString(),dataMode:'offline-local-demo',entry:standalone?'/':'/world/'},null,2));
console.log('Native assets prepared: original campus assets + shared app; no backend address or credentials embedded.');
