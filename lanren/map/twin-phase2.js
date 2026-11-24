// Replace old campus meshes with a single rigidly registered atelier edition.
import * as THREE from 'three';
import { atelierEnabled,loadAtelierPart,placeAtelierPart,trimForecourt,terrainSampler } from './atelier.js';
const BUILDINGS=[
 {part:'yihao',id:'yihao'},{part:'erhao',id:'erhao',aliases:['corr_w12','corr_e12']},
 {part:'science',id:'kexue'},{part:'south_classrooms',id:'sanhao',aliases:['sihao','corr_34']},
 {part:'arts',id:'yishu'},{part:'gate',id:'beimen'}
];
const EXTRAS=['forecourt','landmark','yanchi'];
function install(entry,model,frame,aliases){
  const root=entry.root;root.updateWorldMatrix(true,false);
  const placed=placeAtelierPart(model,frame),matrix=root.matrixWorld.clone().invert().multiply(placed.matrixWorld);
  const box=new THREE.Box3().setFromObject(model);if(box.isEmpty())throw Error('Empty master');
  placed.matrix.copy(matrix);placed.matrixAutoUpdate=false;
  root.clear();root.add(placed);root.userData.haizTwinPart=model.userData.haizAtelierPart;root.userData.haizTwinAliases=aliases;
  root.updateWorldMatrix(true,true);
  return {part:model.userData.haizAtelierPart,source:model.userData.haizAtelierPart==='gate'?'phase2':'atelier'};
}
export async function upgradeCampusLandmarks(entries,geo,scene,hulls){
  const extra=new THREE.Group();extra.name='ATELIER_precinct';scene.add(extra);
  const status={edition:'atelier',applied:[],skipped:[],suppressed:[]};
  if(!atelierEnabled()){status.skipped.push('disabled');return {status,extra,terrainAt:()=>geo.frame.ground+.02};}
  const byId=new Map(entries.map(e=>[e.building.id,e]));
  const jobs=[...BUILDINGS.filter(b=>byId.has(b.id)),...EXTRAS.map(part=>({part}))];
  const work=async job=>{
    try{
      const model=await loadAtelierPart(job.part);
      if(job.id){
        status.applied.push(install(byId.get(job.id),model,geo.frame,job.aliases||[]));
        for(const id of job.aliases||[]){const e=byId.get(id);if(!e)continue;e.root.clear();e.root.userData.haizTwinSuppressed=true;e.root.visible=false;status.suppressed.push(id);}
      }else{
        if(job.part==='forecourt')trimForecourt(model);
        const placed=placeAtelierPart(model,geo.frame);extra.add(placed);extra.updateMatrixWorld(true);
        status.applied.push({part:job.part,source:'atelier'});
        if(job.part==='landmark'){const box=new THREE.Box3().setFromObject(placed),p=box.getCenter(new THREE.Vector3()),s=box.getSize(new THREE.Vector3());hulls.push({id:'atelier-landmark',cx:p.x,cz:p.z,hw:s.x/2,hd:s.z/2,rot:0,tall:false});}
      }
    }catch(e){console.warn('HAIZ kept legacy where available',job.part,e);status.skipped.push(job.part);}
  };
  let next=0;const n=matchMedia('(pointer: coarse) and (max-width: 760px)').matches?2:3;
  await Promise.all(Array.from({length:n},async()=>{while(next<jobs.length)await work(jobs[next++]);}));
  status.applied.sort((a,b)=>a.part.localeCompare(b.part));status.skipped.sort();
  const forecourt=extra.children.find(o=>o.userData.haizAtelierPart==='forecourt');
  return {status,extra,terrainAt:forecourt?terrainSampler(forecourt,geo.frame.ground):()=>geo.frame.ground+.02};
}
