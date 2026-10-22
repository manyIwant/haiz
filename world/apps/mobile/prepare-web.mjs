import {mkdirSync,readdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
const source=new URL('../../',import.meta.url),target=new URL('./www/',import.meta.url);
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
for(const name of readdirSync(source))if(!['downloads','apps','plugins','scripts','tests','portable','.haiz-demo','.gitignore','README.md','MIGRATION.md','package.json','start-local-demo.cmd'].includes(name))cpSync(new URL(name,source),new URL(name,target),{recursive:true});
const p=new URL('index.html',target);writeFileSync(p,readFileSync(p,'utf8').replace('</head>',`<script>if(!location.hash)location.hash='assignments';</script></head>`));
console.log('Shared website copied into native shell. No school endpoint or credentials embedded.');
