/* Shared, deterministic horizontal capsule controller. World scale: approximately metres. */
(function(root){'use strict';
  const RADIUS=.32;
  function intersects(x,z,o,r=RADIUS){
    const px=Math.max(o.minX,Math.min(x,o.maxX)),pz=Math.max(o.minZ,Math.min(z,o.maxZ));
    return (x-px)**2+(z-pz)**2<r*r;
  }
  function blocked(x,z,colliders,bounds,r=RADIUS){
    if(x<bounds.minX+r||x>bounds.maxX-r||z<bounds.minZ+r||z>bounds.maxZ-r)return true;
    return colliders.queryBlocked?colliders.queryBlocked(x,z,r):colliders.some(o=>intersects(x,z,o,r));
  }
  // Exact broad phase for immutable world colliders. The same circle/AABB
  // narrow phase and movement substeps remain; no simplified collisions.
  function spatialIndex(colliders,cellSize=8){
    const cells=new Map();
    for(const o of colliders)for(let x=Math.floor(o.minX/cellSize);x<=Math.floor(o.maxX/cellSize);x++)for(let z=Math.floor(o.minZ/cellSize);z<=Math.floor(o.maxZ/cellSize);z++){
      const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);
    }
    return {size:colliders.length,queryBlocked(x,z,r){
      for(let cx=Math.floor((x-r)/cellSize);cx<=Math.floor((x+r)/cellSize);cx++)for(let cz=Math.floor((z-r)/cellSize);cz<=Math.floor((z+r)/cellSize);cz++){
        const list=cells.get(cx+':'+cz);if(list)for(const o of list)if(intersects(x,z,o,r))return true;
      }return false;
    }};
  }
  function step(pos,input,yaw,seconds,colliders,bounds){
    const dt=Math.min(Math.max(seconds,0),.1),len=Math.hypot(input.x,input.y);
    if(!len)return 0;
    const norm=Math.max(1,len),speed=(input.run?6:3.1)*(input.speedScale??1);
    const side=input.x/norm,forward=input.y/norm;
    const dx=(Math.cos(yaw)*side-Math.sin(yaw)*forward)*speed*dt;
    const dz=(-Math.sin(yaw)*side-Math.cos(yaw)*forward)*speed*dt;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
    const oldX=pos.x,oldZ=pos.z;
    for(let i=0;i<steps;i++){
      if(!blocked(pos.x+dx/steps,pos.z,colliders,bounds))pos.x+=dx/steps;
      if(!blocked(pos.x,pos.z+dz/steps,colliders,bounds))pos.z+=dz/steps;
    }
    return Math.hypot(pos.x-oldX,pos.z-oldZ);
  }
  function safePoint(x,z,colliders,bounds){
    if(!blocked(x,z,colliders,bounds,.6))return {x,z};
    for(let r=1;r<=35;r+=1)for(let i=0;i<32;i++){
      const a=i/32*Math.PI*2,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
      if(!blocked(px,pz,colliders,bounds,.6))return {x:px,z:pz};
    }
    return null;
  }
  function look(yaw,pitch,dx,dy,sensitivity=1,touch=false){
    const gain=(touch ? .004 : .002)*sensitivity;
    return {yaw:yaw-dx*gain,pitch:Math.max(-1.35,Math.min(1.35,pitch-dy*gain))};
  }
  function joystick(dx,dy,radius=40){const n=Math.max(1,Math.hypot(dx,dy)/radius);return {x:dx/(radius*n),y:-dy/(radius*n)};}
  const api={RADIUS,intersects,blocked,step,safePoint,look,joystick,spatialIndex};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusMotion=api;
})(typeof window==='undefined'?globalThis:window);
