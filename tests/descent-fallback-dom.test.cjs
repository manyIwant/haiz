// node tests/descent-fallback-dom.test.cjs
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../assets/cinematic/descent.js'),'utf8');
const start=src.indexOf('function ensureJourneyFallback(){');
const end=src.indexOf('async function boot(){',start);
assert.ok(start>=0&&end>start,'Fallback helpers must exist');
assert.match(src,/P\\?\\.create\\?P\\.create/,'Missing optional image planner must preserve globe');
assert.match(src,/samplerBudget:renderer\\.capabilities\\.maxTextures\\|\\|8/);

class Element {
 constructor(id=''){this.id=id;this.children=[];this.style={};this.hidden=false;this.attrs={};}
 appendChild(node){this.children.push(node);return node;}
 insertBefore(node,ref){
  const at=this.children.indexOf(ref);
  this.children.splice(at<0?this.children.length:at,0,node);return node;
 }
 setAttribute(key,value){this.attrs[key]=value;}
 querySelector(selector){return selector==='.fallback-orb'?
  this.children.find(el=>el.className==='fallback-orb')||null:null;}
}
function run(hasFallback,disposeThrows){
 const body=new Element('body'),stage=new Element('stage');
 const canvas=new Element('journey'),image=new Element('fallback'),status=new Element('loadStatus');
 body.appendChild(stage);stage.appendChild(canvas);
 if(hasFallback){const planet=new Element('planetFallback');planet.appendChild(new Element());stage.appendChild(planet);}
 stage.appendChild(image);stage.appendChild(status);
 function find(el,id){if(el.id===id)return el;for(const x of el.children){const v=find(x,id);if(v)return v;}return null;}
 const doc={body,createElement:()=>new Element(),getElementById:id=>find(body,id)};
 const win={};let original=null;
 const log={warn:(...x)=>{if(x[0]?.includes('initialization failed'))original=x[1];}};
 const renderer={dispose(){if(disposeThrows)throw Error('GPU context already lost');}};
 const create=new Function('document','$','window','console','renderer','material','layerState',
  src.slice(start,end)+'return {recoverJourney,ensureJourneyFallback}');
 const helpers=create(doc,doc.getElementById.bind(doc),win,log,renderer,{},null);
 const error=new Error('WebGL shader compilation failed');
 assert.doesNotThrow(()=>helpers.recoverJourney(error));
 assert.equal(original,error,'Preserve the original error instead of a null DOM error');
 assert.equal(win.HAIZDescentBootError.message,error.message);
 assert.equal(doc.getElementById('journey').hidden,true);
 assert.equal(doc.getElementById('planetFallback').hidden,false);
 assert.ok(doc.getElementById('planetFallback').querySelector('.fallback-orb'));
 assert.equal(doc.getElementById('fallback').hidden,false);
 assert.equal(doc.getElementById('fallback').style.opacity,'0');
 assert.match(status.textContent,/备用视图/);
}
run(false,false); // stale HTML, new JS
run(true,false);  // matching HTML
run(false,true);  // GPU resource cleanup also failed
console.log('Fallback DOM recovery verified with stale HTML and WebGL failures');
