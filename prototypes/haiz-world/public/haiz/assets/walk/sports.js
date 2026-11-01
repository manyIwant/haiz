/* Original court geometry; footprints are legacy data, layout confidence is
   recorded in data/campus-sports.json. No aerial photograph is used as a texture. */
(function(root){'use strict';
const T=THREE;
let materials;
function init(){
  if(materials)return materials;
  const grain=root.CampusSurfaces.maps('granite');
  const blue=new T.MeshStandardMaterial({color:'#657f91',map:grain.color,roughnessMap:grain.rough,normalMap:grain.normal,roughness:.94});blue.normalScale.set(.08,.08);blue.userData.metricTile=.8;
  const clay=blue.clone();clay.color.set('#a77d67');
  const key=blue.clone();key.color.set('#b18d86');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle='#d5d8cc';
  for(let i=0;i<128;i+=16){ctx.fillRect(i,0,2,128);ctx.fillRect(0,i,128,2);}
  const netMap=new T.CanvasTexture(canvas);netMap.wrapS=netMap.wrapT=T.RepeatWrapping;netMap.repeat.set(9,1);
  const hoopMap=netMap.clone();hoopMap.repeat.set(1.5,.5);hoopMap.needsUpdate=true;
  materials={blue,clay,key,apron:new T.MeshStandardMaterial({color:'#b4afa0',roughness:.95}),line:new T.MeshBasicMaterial({color:'#e8e6db'}),metal:new T.MeshStandardMaterial({color:'#436e67',metalness:.35,roughness:.5}),board:new T.MeshStandardMaterial({color:'#e0e3da',roughness:.7}),rim:new T.MeshStandardMaterial({color:'#b44e32',roughness:.65}),net:new T.MeshStandardMaterial({map:netMap,alphaTest:.5,side:T.DoubleSide,roughness:1}),hoopNet:new T.MeshStandardMaterial({map:hoopMap,alphaTest:.5,side:T.DoubleSide,roughness:1})};
  // Paint lies only millimetres above the floor. Keep it stable at long aerial
  // distances without moving the court, increasing resolution or adding a pass.
  for(const [material,offset]of [[key,-1],[materials.line,-2]]){material.polygonOffset=true;material.polygonOffsetFactor=offset;material.polygonOffsetUnits=offset;}
  materials.soil=new T.MeshStandardMaterial({color:'#68694d',map:grain.color,roughnessMap:grain.rough,roughness:1});materials.soil.userData.metricTile=.8;
  return materials;
}
function mesh(g,geometry,material,x,y,z){const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function box(g,m,w,h,d,x,y,z){return mesh(g,new T.BoxGeometry(w,h,d),m,x,y,z);}
function plane(g,m,w,d,x,z,y=.18){const o=mesh(g,new T.PlaneGeometry(w,d),m,x,y,z);o.rotation.x=-Math.PI/2;o.castShadow=false;return o;}
function arc(g,m,r,x,z,start=0,length=Math.PI*2){const o=mesh(g,new T.RingGeometry(r-.025,r+.025,48,1,start,length),m,x,.194,z);o.rotation.x=-Math.PI/2;o.castShadow=o.receiveShadow=false;return o;}
function disc(g,m,r,x,z){const o=mesh(g,new T.CircleGeometry(r,40),m,x,.186,z);o.rotation.x=-Math.PI/2;o.castShadow=false;return o;}
function create(spec,center){
  const m=init(),g=new T.Group();g.position.set(center.x,0,center.z);g.userData.sportsArea=spec.id;
  const [cols,rows]=spec.grid,[w,d]=spec.play,cw=center.w/cols,cd=center.d/rows,courts=[];
  if(cw<w||cd<d)throw Error('Court exceeds source footprint: '+spec.id);
  plane(g,m.apron,center.w,center.d,0,0,.145);
  function line(x,z,width,depth){const o=plane(g,m.line,width,depth,x,z,.194);o.receiveShadow=false;}
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=-center.w/2+(col+.5)*cw,z=-center.d/2+(row+.5)*cd;
    plane(g,spec.kind==='basketball'?m.blue:m.clay,cw-.3,cd-.3,x,z);
    line(x-w/2,z,.05,d);line(x+w/2,z,.05,d);line(x,z-d/2,w,.05);line(x,z+d/2,w,.05);line(x,z,w,.05);
    courts.push({x:center.x+x,z:center.z+z,width:w,depth:d,kind:spec.kind});
    if(spec.kind==='basketball'){
      disc(g,m.key,1.8,x,z);
      arc(g,m.line,1.8,x,z);
      for(const side of [-1,1]){
        const end=z+side*d/2,hoop=end-side*1.575;
        plane(g,m.key,4.9,5.8,x,end-side*2.9,.186);
        line(x,end-side*5.8,4.9,.05);line(x-2.45,end-side*2.9,.05,5.8);line(x+2.45,end-side*2.9,.05,5.8);
        arc(g,m.line,1.8,x,end-side*5.8);arc(g,m.line,6.75,x,hoop,side>0?0:Math.PI,Math.PI);
        line(x-6.75,end-side*.7875,.05,1.575);line(x+6.75,end-side*.7875,.05,1.575);
        // The support stays within its own cell, outside the playing boundary.
        const support=end+side*.65;
        box(g,m.metal,.18,3.25,.18,x,1.625,support);box(g,m.metal,.14,.14,1.85,x,3.25,support-side*.88);
        box(g,m.board,1.8,1.05,.065,x,3.575,hoop+side*.35);
        const face=hoop+side*.31;
        box(g,m.metal,.59,.025,.012,x,3.1,face);box(g,m.metal,.59,.025,.012,x,3.55,face);
        box(g,m.metal,.025,.45,.012,x-.295,3.325,face);box(g,m.metal,.025,.45,.012,x+.295,3.325,face);
        box(g,m.rim,.07,.035,.18,x,3.05,hoop+side*.27);
        const ring=mesh(g,new T.TorusGeometry(.225,.018,6,24),m.rim,x,3.05,hoop);ring.rotation.x=Math.PI/2;
        mesh(g,new T.CylinderGeometry(.22,.13,.43,16,1,true),m.hoopNet,x,2.825,hoop);
        g.userData.hoops=(g.userData.hoops||0)+1;
      }
    }else{
      line(x,z-3,w,.05);line(x,z+3,w,.05);
      for(const side of [-1,1])box(g,m.metal,.09,2.6,.09,x+side*(w/2+.6),1.3,z);
      const net=mesh(g,new T.PlaneGeometry(w+1,1),m.net,x,1.93,z);net.userData.courtNet=true;
      box(g,m.board,w+1,.035,.035,x,2.43,z);
    }
  }
  const planting=root.CampusAtlasDetails.planting(spec,center);
  for(const p of planting){
    box(g,m.apron,p.w,.18,p.d,p.x,.24,p.z);plane(g,m.soil,p.w-.16,p.d-.16,p.x,p.z,.338);
  }
  g.userData.courtCount=courts.length;
  return {data:spec,center,group:g,courts,planting};
}
root.CampusSports={create};
})(window);
