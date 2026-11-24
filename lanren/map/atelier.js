// Shared photo-derived atelier master. Runtime derivatives preserve its metric frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const RUNTIME=new URL('../../twin/assets/runtime/',import.meta.url);
const MASTER=new URL('../../twin/assets/atelier/',import.meta.url);
const PHASE2=new URL('../../twin/assets/phase1/',import.meta.url);
const DRACO=new URL('../vendor/three/addons/libs/draco/',import.meta.url);
export const ATELIER_PARTS=Object.freeze(['yihao','erhao','science','south_classrooms','arts','forecourt','landmark','terminalia','yanchi','gate']);
export const ATELIER_ORIGIN=Object.freeze([38.91,-17.67]);
export const ATELIER_HOME_ROT=Math.PI/2;
export const atelierEnabled=()=>new URLSearchParams(location.search).get('twin')!=='off';
const cache=new Map(), loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let draco;
function deadline(p,ms,label){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]).finally(()=>clearTimeout(timer));}
export function cloneAtelier(root){
  const copy=root.clone(true),mats=new Map();
  copy.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!mats.has(m))mats.set(m,m.clone());return mats.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);o.castShadow=o.receiveShadow=true;});
  return copy;
}
async function source(part){
  if(!ATELIER_PARTS.includes(part))throw Error('Unknown atelier part '+part);
  if(!cache.has(part))cache.set(part,(async()=>{
    if(part==='gate'){
      const {DRACOLoader}=await import('three/addons/loaders/DRACOLoader.js');
      draco??=new DRACOLoader().setDecoderPath(DRACO.href);
      return (await deadline(new GLTFLoader().setDRACOLoader(draco).loadAsync(new URL('gate.glb',PHASE2).href),45000,part)).scene;
    }
    try{return (await deadline(loader.loadAsync(new URL(part+'.glb',RUNTIME).href),90000,part)).scene;}
    catch(e){console.warn('HAIZ runtime failed; trying unchanged master',part,e);return (await deadline(loader.loadAsync(new URL(part+'.glb',MASTER).href),90000,part+' master')).scene;}
  })());
  try{return await cache.get(part);}catch(e){cache.delete(part);throw e;}
}
export async function loadAtelierPart(part){const g=cloneAtelier(await source(part));g.userData.haizAtelierPart=part;return g;}
export function atelierPoint(x,y,z,rotation=0,ground=-.85){
  const dx=x-ATELIER_ORIGIN[0],dz=z-ATELIER_ORIGIN[1],c=Math.cos(rotation),s=Math.sin(rotation);
  return [dx*c+dz*s,y+ground,-dx*s+dz*c];
}
export function placeAtelierPart(model,frame){
  const g=new THREE.Group();g.name='ATELIER_'+model.userData.haizAtelierPart;
  g.position.fromArray(atelierPoint(0,0,0,frame.rotation||0,frame.ground));g.rotation.y=frame.rotation||0;
  g.add(model);g.userData.haizAtelierPart=model.userData.haizAtelierPart;g.updateMatrixWorld(true);return g;
}
export const isLeafObject=o=>/terminalia[._]?leaves/i.test(o.name||'')||/terminalia[._]?leaves/i.test(o.userData?.name||'');
export function hideMasterLeaves(root){const leaves=[];root.traverse(o=>{if(isLeafObject(o))leaves.push(o);});for(const o of leaves)o.removeFromParent();}
export async function loadAtelierTree(){
  if(!atelierEnabled())return null;
  try{
    const [model,data,buffer]=await Promise.all([
      loadAtelierPart('terminalia'),
      fetch(new URL('../../twin/data/trees.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('tree source');return r.json();}),
      fetch(new URL('rosettes.bin',RUNTIME)).then(r=>{if(!r.ok)throw Error('rosettes');return r.arrayBuffer();})
    ]);
    const ros=new Float32Array(buffer);if(!ros.length||ros.length%16)throw Error('Invalid rosettes');
    const root=placeAtelierPart(model,{rotation:ATELIER_HOME_ROT,ground:-.85});hideMasterLeaves(root);
    const L=data.lanren,point=p=>atelierPoint(p[0],p[2],-p[1],ATELIER_HOME_ROT,-.85);
    const limb=L.limbs.find(x=>x.id==='L_low_limb_on_boulder').pts;
    const anchors={trunk:point(L.limbs[0].pts[2]),fork:point(L.limbs[0].pts.at(-1)),limbDip:point(limb[9]),limbEnd:point(limb[16])};
    const path=[...L.limbs[0].pts,...limb.slice(2)].map(point);
    const result={root,rosettes:ros,anchors,path,source:'atelier/terminalia.glb'};
    window.__haizAtelierTree={source:result.source,rosettes:ros.length/16,meshes:0};root.traverse(o=>{if(o.isMesh)window.__haizAtelierTree.meshes++;});
    return result;
  }catch(e){console.warn('HAIZ atelier tree unavailable; original animated tree retained',e);return null;}
}
// Retain the artistic lagoon substrate in acts 01–03, not its old stone inscription.
export function islandWithoutOldInscription(geometry){
  const col=geometry.getAttribute('color');if(!col||col.itemSize<4)return geometry;
  const g=geometry.clone(),idx=g.index,n=idx?idx.count:g.getAttribute('position').count,indices=[],at=i=>idx?idx.getX(i):i;
  for(let i=0;i<n;i+=3){const a=at(i),b=at(i+1),c=at(i+2);if((col.getW(a)+col.getW(b)+col.getW(c))/3>.74)indices.push(a,b,c);}
  if(indices.length)g.setIndex(indices);return g;
}
export function trimForecourt(root){
  const drop=[];root.traverse(o=>{const n=(o.userData?.name||o.name||'').replace(/[._-]/g,'').toLowerCase();if(/^siteground(base|context|street|gate)$/.test(n))drop.push(o);});
  for(const o of drop)o.removeFromParent();return root;
}
export function terrainSampler(root,ground){
  const parts=[];root.updateMatrixWorld(true);
  root.traverse(o=>{if(!o.isMesh)return;let named=false;for(let p=o;p&&p!==root;p=p.parent)if(/site[._]?ground|site[._]?steps/i.test(p.name||''))named=true;
    if(named){const box=new THREE.Box3().setFromObject(o);if(!box.isEmpty())parts.push({o,box});}});
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,100),cache=new Map();
  return (x,z)=>{if(!parts.length)return ground+.02;const ix=Math.round(x*4),iz=Math.round(z*4),k=ix+','+iz;
    if(cache.has(k))return cache.get(k);const xx=ix/4,zz=iz/4;let y=ground+.02;ray.ray.origin.set(xx,ground+20,zz);
    for(const {o,box} of parts)if(xx>=box.min.x&&xx<=box.max.x&&zz>=box.min.z&&zz<=box.max.z){const hits=ray.intersectObject(o,false);if(hits.length)y=Math.max(y,hits[0].point.y+.02);}
    if(cache.size>8192)cache.clear();cache.set(k,y);return y;};
}
