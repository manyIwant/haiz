const fs=require('fs'),path=require('path'),assert=require('assert');
const {parseHTML}=require(require.resolve('linkedom',{paths:[process.env.HAIZ_TEST_NODE_MODULES,__dirname].filter(Boolean)}));
const pages=fs.readdirSync('.').filter(p=>p.endsWith('.html')),docs=new Map(pages.map(p=>[p,parseHTML(fs.readFileSync(p,'utf8')).document]));
let links=0,images=0;
for(const [file,doc]of docs){
 assert(doc.querySelector('title')?.textContent.trim(),file+' title');assert(doc.querySelector('meta[name="viewport"]'),file+' viewport');
 const ids=new Set();for(const el of doc.querySelectorAll('[id]')){assert(!ids.has(el.id),file+' duplicate id '+el.id);ids.add(el.id);}
 for(const el of doc.querySelectorAll('[href],[src]')){
  const ref=el.getAttribute('href')||el.getAttribute('src');if(!ref||/^(https?:|data:|mailto:|tel:|javascript:)/.test(ref))continue;
  const [resource,fragment]=ref.split('#'),resolved=resource.split('?')[0]||file;
  assert(fs.existsSync(resolved),file+' missing '+ref);links++;
  if(fragment&&resolved.endsWith('.html'))assert(docs.get(resolved)?.getElementById(fragment),file+' missing fragment '+ref);
 }
 for(const image of doc.querySelectorAll('img')){assert(image.hasAttribute('alt'),file+' missing image alt');images++;}
}
const contact=docs.get('contact.html');
assert(contact.querySelector('a[href="https://github.com/manyIwant/haiz"]'),'Contact page keeps public project attribution');
assert(!contact.querySelector('.creator-contact [data-copy]'),'Do not publish a copyable personal messenger handle');
const journal=JSON.parse(fs.readFileSync('data/campus-journal.json'));assert(journal.clubs.length===6&&journal.radio.length===4);assert(journal.clubs.every(c=>c.sample===true));assert(journal.radio.every(c=>c.sample===true));assert.equal(fs.readFileSync('CNAME','utf8').trim(),'haiz.space');
assert.equal(fs.readFileSync('index.html','utf8'),fs.readFileSync('descent.html','utf8'),'root must serve the cinematic homepage');
for(const file of ['journal.html','about.html','news.html','clubs.html','life.html','alumni.html','admissions.html','contact.html']){
 const doc=docs.get(file);assert(doc.querySelector('a[href="campus-3d.html"]'),file+' campus navigation');assert(doc.querySelector('script[src^="assets/js/journal.js"]'),file+' shared interactions');
}
const files=[];function scan(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(d.name))continue;const p=path.join(dir,d.name);if(d.isDirectory())scan(p);else if(/\.(js|cjs|mjs|json|html|md|css)$/.test(p))files.push(p);}}scan('.');
for(const file of files){const s=fs.readFileSync(file,'utf8');assert(!/gh[pousr]_[A-Za-z0-9]{30,}/.test(s),file+' must not contain access credentials');assert(!/github_pat_[A-Za-z0-9]{25,}/.test(s),file+' must not contain access credentials');}
const results={pages:pages.length,localLinks:links,images,checks:['All original page routes preserved plus life.html','No broken local links or anchor references','Unique IDs, page metadata and image descriptions','Shared navigation on all editorial pages','Public contact page does not expose a copyable messenger handle','Sample clubs and fictional micro-stories explicitly labelled','CNAME retained','No access credentials in source'],browserQA:'Static and DOM checks only; see tests/browser-results.json for real Chromium validation.'};
fs.writeFileSync('tests/site-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
