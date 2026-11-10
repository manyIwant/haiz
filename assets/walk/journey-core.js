/* Pure route and camera data helpers; model coordinates, not real-world navigation. */
(function(root){'use strict';
const climates=['morning','afterrain','dusk'];
function stops(value,catalog,max=6){
 const allowed=new Set(catalog.map(p=>typeof p==='string'?p:p.id));
 const input=typeof value==='string'?value.split(','):Array.isArray(value)?value:[];
 return [...new Set(input.filter(id=>typeof id==='string'&&allowed.has(id)))].slice(0,max);
}
function move(list,from,to){
 const out=list.slice();if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=out.length||to<0||to>=out.length)return out;
 const item=out.splice(from,1)[0];out.splice(to,0,item);return out;
}
function query(ids,climate='morning'){
 return 'journey='+ids.map(encodeURIComponent).join(',')+'&climate='+(climates.includes(climate)?climate:'morning');
}
function distance(points){
 let total=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(![a.x,a.z,b.x,b.z].every(Number.isFinite))return null;total+=Math.hypot(b.x-a.x,b.z-a.z);}return total;
}
function camera(value,bounds){
 if(!value||typeof value!=='object')return null;
 const p=value.position||value,x=p.x,z=p.z,yaw=value.yaw,pitch=value.pitch,lens=value.lens;
 if(![x,z,yaw,pitch,lens].every(Number.isFinite))return null;
 if(bounds&&(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ))return null;
 return {position:{x,z},yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),pitch:Math.max(-1.2,Math.min(1.2,pitch)),lens:Math.max(32,Math.min(80,lens)),climate:climates.includes(value.climate)?value.climate:'morning',name:(typeof value.name==='string'?value.name.trim().slice(0,32):'')||'我的取景点'};
}
function viewQuery(value){
 const c=camera(value);if(!c)return null;
 return 'view='+[c.position.x,c.position.z,c.yaw,c.pitch,c.lens].map((n,i)=>n.toFixed(i<2?2:3)).join(',')+'&climate='+c.climate;
}
function parseView(text,bounds){
 if(typeof text!=='string'||text.length>180)return null;
 const fields=text.split(',');if(fields.length!==5||fields.some(s=>!s.trim()))return null;
 const [x,z,yaw,pitch,lens]=fields.map(Number);
 return camera({position:{x,z},yaw,pitch,lens},bounds);
}
const api={stops,move,query,distance,camera,viewQuery,parseView,climates};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusJourneyCore=api;
})(typeof window==='undefined'?globalThis:window);
