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
 writeFileSync(path.join(target,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f5f3ea"><title>HAIZ Study</title><style>html,body{height:100%;margin:0}body{background:#f5f3ea;color:#1e372f;display:grid;place-items:center;font:15px system-ui,-apple-system,sans-serif;text-align:center}.mark{width:76px;height:76px;margin:0 auto 18px;border:5px solid #214337;border-radius:45px 45px 12px 12px;box-sizing:border-box;position:relative}.mark:after{content:"";position:absolute;top:21px;left:26px;width:14px;height:14px;background:#b88b53;border-radius:50%}h1{font-size:21px;letter-spacing:.16em}a{color:#24513e}</style></head><body><main><div class="mark"></div><h1>HAIZ STUDY</h1><p>正在打开你的校园书桌…</p><a href="./world/index.html#study">轻触继续进入</a></main><script>location.replace("./world/index.html#study");</script></body></html>`);
}
const index=path.join(entry,'index.html');
let html=readFileSync(index,'utf8');
const appScript='<script type="module" src="app.js"></script>';
if(!html.includes(appScript))throw Error('Native web entry does not contain the HAIZ app module');
html=html.replace('</head>','<link rel="stylesheet" href="mobile-shell.css"><script defer src="mobile-shell.js"></script></head>')
 .replace(appScript,'<script src="mobile-boot.js"></script>'+appScript);
writeFileSync(index,html);
for(const file of ['mobile-shell.js','mobile-shell.css','mobile-boot.js'])cpSync(new URL(file,import.meta.url),path.join(entry,file));
writeFileSync(path.join(target,'build-info.json'),JSON.stringify({version:'0.4.1-preview.1',builtAt:new Date().toISOString(),dataMode:'offline-local-demo',entry:standalone?'/':'/world/'},null,2));
console.log('Native assets prepared: branded entry + startup diagnostics + offline campus assets.');
