/* Shared map details, in legacy world coordinates. Planting positions are
   photographic interpretations, not surveyed trees or botanical identification. */
(function(root){'use strict';
function planting(area,c){
  if(!area.median)return [];
  const m=area.median,[cols,rows]=area.grid;if(rows!==2)return [];
  return Array.from({length:cols},(_,col)=>m.offsets.map(offset=>({x:-c.w/2+(col+.5)*c.w/cols+offset,z:0,w:m.bedLength,d:m.width,height:m.treeHeight}))).flat();
}
function details(data,rectWorld){
  const groups=[];
  for(const b of data.buildings){
    if(b.form!=='field')continue;const c=rectWorld(b.rect),r=c.d/2,h=Math.max(0,c.w/2-r),shapes=[];
    function oval(inset,fill,stroke){const points=[],radius=r-inset;for(const side of [-1,1])for(let i=0;i<=32;i++){const a=(side===1?-.5:.5)*Math.PI+i*Math.PI/32;points.push([c.x+side*h+Math.cos(a)*radius,c.z+Math.sin(a)*radius]);}shapes.push({type:'poly',points,fill,stroke});}
    oval(0,'#b9826e');for(const inset of [2.44,4.88,7.32])oval(inset,'none','#e3cbbb');oval(9.76,'#a2b192');
    const w=Math.min(100,2*h+2*(r-9.76)-12),d=Math.min(64,2*(r-9.76)-8);
    shapes.push({type:'rect',x:c.x-w/2,z:c.z-d/2,w,d,fill:'none',stroke:'#f5f1df'});
    shapes.push({type:'poly',points:[[c.x,c.z-d/2],[c.x,c.z+d/2]],open:true,fill:'none',stroke:'#f5f1df'});
    shapes.push({type:'circle',x:c.x,z:c.z,r:9.15,fill:'none',stroke:'#f5f1df'});
    for(const side of [-1,1])shapes.push({type:'rect',x:side<0?c.x-w/2:c.x+w/2-16.5,z:c.z-20.15,w:16.5,d:40.3,fill:'none',stroke:'#f5f1df'});
    groups.push({id:b.id,shapes});
  }
  for(const a of data.sports||[]){const c=rectWorld(a.rect),shapes=[];for(const p of planting(a,c)){
    shapes.push({type:'rect',x:c.x+p.x-p.w/2,z:c.z+p.z-p.d/2,w:p.w,d:p.d,fill:'#7a8962'});
    shapes.push({type:'circle',x:c.x+p.x,z:c.z+p.z,r:1.5,fill:'#4f7356'});
  }if(shapes.length)groups.push({id:a.id+'-shade',shapes});}
  return groups;
}
function canvas(ctx,groups,project){
  ctx.lineWidth=.65;
  for(const g of groups)for(const shape of g.shapes){ctx.beginPath();
    if(shape.type==='poly'){shape.points.forEach(([x,z],i)=>{const p=project(x,z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});if(!shape.open)ctx.closePath();}
    else{const p=project(shape.x,shape.z);if(shape.type==='circle')ctx.arc(p.x,p.y,shape.r*p.s,0,Math.PI*2);else ctx.rect(p.x,p.y-shape.d*p.s,shape.w*p.s,shape.d*p.s);}
    if(shape.fill&&shape.fill!=='none'){ctx.fillStyle=shape.fill;ctx.fill();}if(shape.stroke){ctx.strokeStyle=shape.stroke;ctx.stroke();}
  }
}
function svg(groups,selectable=false){
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return groups.map(g=>'<g data-atlas-detail="'+escape(g.id)+'">'+g.shapes.map((s,i)=>{
    const style=' fill="'+(s.fill||'none')+'" stroke="'+(s.stroke||'none')+'" stroke-width=".45"'+(selectable&&i===0&&s.type==='poly'?' class="map-node" data-map-building="'+escape(g.id)+'"':'');
    if(s.type==='poly')return '<'+(s.open?'polyline':'polygon')+' points="'+s.points.map(([x,z])=>x+','+-z).join(' ')+'"'+style+'/>';
    if(s.type==='circle')return '<circle cx="'+s.x+'" cy="'+-s.z+'" r="'+s.r+'"'+style+'/>';
    return '<rect x="'+s.x+'" y="'+(-s.z-s.d)+'" width="'+s.w+'" height="'+s.d+'"'+style+'/>';
  }).join('')+'</g>').join('');
}
root.CampusAtlasDetails={planting,details,canvas,svg};
})(typeof window==='undefined'?globalThis:window);
