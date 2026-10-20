/* Cache immutable cartography at the exact canvas resolution. Position and
   heading remain live; no throttling, resampling or loss of map detail. */
(function(root){'use strict';
function create(data,world,destinations){
  let cache=new WeakMap();const stats={staticBuilds:0,uncachedBuilds:0,blits:0,skipped:0};
  function point(x,z,size,pad){const scale=(size-2*pad)/620;return {x:size/2+x*scale,y:size/2-z*scale,s:scale};}
  function base(canvas,large){
    const ctx=canvas.getContext('2d'),s=canvas.width,pad=large?40:12;
    ctx.fillStyle='#eeeadc';ctx.fillRect(0,0,s,s);ctx.strokeStyle='#203f350c';ctx.lineWidth=1;
    for(let i=0;i<s;i+=s/10){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}
    function rect(r,color){const c=world.rectWorld(r),p=point(c.x,c.z,s,pad);ctx.fillStyle=color;ctx.fillRect(p.x-c.w*p.s/2,p.y-c.d*p.s/2,c.w*p.s,c.d*p.s);}
    for(const lawn of data.lawns||[])if(!(data.sports||[]).some(area=>area.sourceLawn===lawn.id))rect(lawn.rect,'#d0d8bc');
    for(const road of data.roads||[]){
      ctx.fillStyle='#dedbcf';if(road.poly){ctx.beginPath();road.poly.forEach((v,i)=>{const p=point(v[0],v[1],s,pad);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fill();}else rect(road.rect,'#dedbcf');
    }
    for(const b of world.buildings){if(b.data.form==='field')continue;let color='#b0b9a4';if(b.data.form==='pond')color='#8eafa5';else if(['garden','oldtree','botanic'].includes(b.data.form))color='#a8b791';else if(b.data.form==='gate')color='#a87852';rect(b.data.rect,color);}
    for(const area of data.sports||[]){
      const c=world.rectWorld(area.rect),p=point(c.x,c.z,s,pad),[cols,rows]=area.grid;rect(area.rect,area.color);
      ctx.strokeStyle='#eeeadc';ctx.lineWidth=large?1.2:.6;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const cw=c.w/cols*p.s,cd=c.d/rows*p.s,x=p.x-c.w*p.s/2+col*cw,y=p.y-c.d*p.s/2+row*cd;
        ctx.strokeRect(x+cw*.1,y+cd*.1,cw*.8,cd*.8);ctx.beginPath();ctx.moveTo(x+cw*.1,y+cd/2);ctx.lineTo(x+cw*.9,y+cd/2);ctx.stroke();
      }
    }
    root.CampusAtlasDetails.canvas(ctx,root.CampusAtlasDetails.details(data,world.rectWorld),(x,z)=>point(x,z,s,pad));
    if(large){ctx.font='16px sans-serif';ctx.textAlign='center';for(const d of destinations){const b=world.buildings.find(b=>b.data.id===d.id),p=point(b.center.x,b.center.z,s,pad);ctx.fillStyle='#f5f1e5';ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#8e4a32';ctx.fillText(d.tag,p.x,p.y+6);}}
    ctx.fillStyle='#64715b';ctx.font=(large?'14':'17')+'px serif';ctx.textAlign='left';ctx.fillText('南',pad,pad+15);ctx.fillText('北',pad,s-pad-5);
    if(large){ctx.fillStyle='#8d947f';ctx.fillRect(s-160,s-45,80,2);ctx.font='13px sans-serif';ctx.fillText('约 50 m',s-160,s-55);ctx.fillText('蓝：篮球区 · 棕：排球区（配置推演）',pad,s-pad-24);}
  }
  function draw(canvas,large,pos,yaw,options={}){
    let entry=cache.get(canvas);const changed=!entry||entry.width!==canvas.width||entry.height!==canvas.height||entry.large!==large;
    if(changed||options.fresh){const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;base(layer,large);entry={layer,width:canvas.width,height:canvas.height,large};if(!options.fresh){cache.set(canvas,entry);stats.staticBuilds++;}else stats.uncachedBuilds++;}
    if(!options.fresh&&entry.x===pos.x&&entry.z===pos.z&&entry.yaw===yaw){stats.skipped++;return;}
    const ctx=canvas.getContext('2d'),p=point(pos.x,pos.z,canvas.width,large?40:12);
    ctx.drawImage(entry.layer,0,0);stats.blits++;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(yaw);
    ctx.fillStyle='#a6533630';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,large?38:26,Math.PI*.22,Math.PI*.78);ctx.closePath();ctx.fill();
    ctx.fillStyle='#a65336';ctx.strokeStyle='#f5f1e5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,large?8:6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    entry.x=pos.x;entry.z=pos.z;entry.yaw=yaw;
  }
  return {draw,invalidate(){cache=new WeakMap();},get diagnostics(){return {...stats};}};
}
root.CampusMap={create};
})(window);
