// Reproducible buildless Sites output; no external requests or injected credentials.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
fs.mkdirSync(dist,{recursive:true});
for(const name of fs.readdirSync(root))if(name.endsWith('.html')||name==='favicon.ico')fs.copyFileSync(path.join(root,name),path.join(dist,name));
for(const name of ['assets','data'])fs.cpSync(path.join(root,name),path.join(dist,name),{recursive:true});
console.log('Static output prepared in dist/');
