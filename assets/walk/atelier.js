/* Architectural geometry studies from the bundled photographs, not surveyed replicas.
   Real curved surfaces, tile ends, recessed openings and metal ribs — no photo billboards. */
(function(root){'use strict';
const T=THREE;
const recessGlass=new T.MeshStandardMaterial({color:'#244650',roughness:.18,metalness:.35});
const roofLining=new T.MeshStandardMaterial({color:'#675441',roughness:.9});
function mesh(g,geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function box(g,m,w,h,d,x,y,z){return mesh(g,new T.BoxGeometry(w,h,d),m,x,y,z);}
function tube(g,m,points,r=.035){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(curve,Math.max(12,points.length*3),r,6,false),m);}
let contactMaterial;
function contact(g,x,y,z,r){
  if(!contactMaterial){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),fade=c.createRadialGradient(64,64,12,64,64,64);fade.addColorStop(0,'rgba(16,23,15,.45)');fade.addColorStop(.45,'rgba(16,23,15,.23)');fade.addColorStop(1,'rgba(16,23,15,0)');c.fillStyle=fade;c.fillRect(0,0,128,128);contactMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,opacity:.65});}
  const o=mesh(g,new T.PlaneGeometry(r*2,r*2),contactMaterial,x,y+.008,z);o.rotation.x=-Math.PI/2;o.castShadow=o.receiveShadow=false;o.userData.approximateContact=true;o.userData.noMerge=true;return o;
}
function planter(g,m,x,z){const slot=new T.Group();slot.position.set(x,.12,z);slot.userData.openPlantSlot=true;slot.userData.noMerge=true;mesh(slot,new T.CylinderGeometry(.41,.34,.72,24),m,0,.36,0);g.add(slot);return slot;}
function roof(w,d,rise,overhang,mat,ridgeMat,detail=false){
  const g=new T.Group(),ow=w+overhang*2,od=d+overhang*2,ridge=Math.max(.6,ow-od),segments=detail?Math.ceil(ow/.24)*3:24,rows=detail?12:10;
  function point(face,u,t){
    const end=Math.abs(face)===2,s=Math.sign(face),x=end?s*(ridge/2+(ow-ridge)/2*t):u*(ridge+(ow-ridge)*t)/2,z=end?u*od*t/2:s*od*t/2;
    let y=rise*Math.pow(1-t,1.3)+.2*Math.pow(t,7)*Math.pow(Math.abs(x)/(ow/2),6);
    if(detail)y+=.035*(1+Math.cos((end?z:x)*Math.PI*2/.24))*Math.min(1,t*12);
    return [x,y,z];
  }
  for(const face of [-1,1,-2,2]){
    const cols=Math.abs(face)===2?(detail?Math.ceil(od/.24)*3:16):segments,p=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const v=point(face,i/cols*2-1,j/rows);p.push(...v);uv.push(v[0]/1.6,v[2]/1.6);}
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,e=c+1;const reverse=face===-1||face===2;indices.push(...(reverse?[a,b,c,b,e,c]:[a,c,b,b,c,e]));}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();geo.userData.metricUV=true;mesh(g,geo,mat);
    // A roof needs an intrados as well as its upward tile skin. Otherwise an
    // eye-level visitor sees through the slopes and only the ridge tubes remain.
    const lining=geo.clone(),back=indices.slice();for(let i=0;i<back.length;i+=3){const v=back[i+1];back[i+1]=back[i+2];back[i+2]=v;}lining.translate(0,-.12,0);lining.setIndex(back);lining.computeVertexNormals();lining.userData={architecturalIntrados:true};mesh(g,lining,roofLining);
  }
  // The eave has a real thickness, rather than the old exposed vertical green box.
  for(const s of [-1,1]){
    const points=[];for(let i=0;i<=24;i++){const p=point(s,i/12-1,1);p[1]-=.035;points.push(p);}tube(g,ridgeMat||mat,points,.065);
  }
  if(ridgeMat){tube(g,ridgeMat,[[-ridge/2,rise+.12,0],[0,rise+.15,0],[ridge/2,rise+.12,0]],.11);
    for(const s of [-1,1])for(const z of [-1,1]){const p=[];for(let i=0;i<=12;i++){const v=point(z,s,i/12);v[1]+=.06;p.push(v);}tube(g,ridgeMat,p,.075);}}
  if(detail){
    const count=Math.floor(ow/.24),geo=new T.CylinderGeometry(.09,.095,.12,10,1,true,0,Math.PI),caps=new T.InstancedMesh(geo,mat,count*2),dummy=new T.Object3D();let index=0;
    for(const s of [-1,1])for(let i=0;i<count;i++){const v=point(s,(i+.5)/count*2-1,1);dummy.position.set(v[0],v[1]-.025,v[2]);dummy.rotation.set(Math.PI/2,0,0);dummy.updateMatrix();caps.setMatrixAt(index++,dummy.matrix);}caps.castShadow=caps.receiveShadow=true;g.add(caps);
  }
  g.userData.architecturalRoof=true;g.userData.tileDetail=detail;return g;
}
function windowFrame(g,m,x,y,z,w,h){
  box(g,recessGlass,w,h,.06,x,y,z-.16);
  for(const sign of [-1,1]){box(g,m,w+.14,.11,.19,x,y+sign*h/2,z);box(g,m,.10,h,.19,x+sign*w/2,y,z);}
  for(let k=1;k<3;k++)box(g,m,.045,h,.11,x-w/2+w*k/3,y,z+.015);
  for(let k=1;k<4;k++)box(g,m,w,.045,.11,x,y-h/2+h*k/4,z+.015);
}
function hall(g,w,d,m,detail=true){
  g.userData.atelier='double-eave-hall';
  const wall=m.wallHerit.clone();wall.color.set('#eeeae0');wall.roughness=.95;
  const red=m.column.clone();red.color.set('#923e27');red.roughness=.72;
  const wood=m.beam.clone();wood.color.set('#62412b');wood.roughness=.72;
  const gold=m.goldLine.clone();gold.color.set('#ba943f');gold.metalness=.22;gold.roughness=.55;
  const stone=m.step,base=.62,top=5.55,cz=d/2+1.3,n=8;
  box(g,stone,w+1.5,base,d+4,0,base/2,.8);
  box(g,wall,w,top-base,.24,0,(top+base)/2,-d/2);
  for(const sign of [-1,1])box(g,wall,.25,top-base,d,sign*w/2,(top+base)/2,0);
  box(g,wall,w,.95,.26,0,base+.475,d/2);box(g,wall,w,1,.26,0,top-.5,d/2);
  const bay=w/n;
  for(let i=0;i<=n;i++)box(g,wall,.55,top-base,.32,-w/2+i*bay,(top+base)/2,d/2);
  for(let i=0;i<n;i++){
    const x=-w/2+(i+.5)*bay;
    if(i===3||i===4){box(g,wood,bay-.55,3.4,.22,x,base+1.7,d/2+.04);for(let k=1;k<4;k++)box(g,gold,.025,2.85,.025,x-bay/2+k*bay/4,base+1.65,d/2+.17);}
    else windowFrame(g,wood,x,2.9,d/2+.12,Math.min(2.2,bay-.8),2.35);
    const col=mesh(g,new T.CylinderGeometry(.19,.23,4.75,24),red,x,base+2.375,cz);
    col.userData.hallColumn=true;
    mesh(g,new T.CylinderGeometry(.30,.34,.18,24),stone,x,base+.09,cz);
    contact(g,x,base,cz,.54);
    for(const yy of [base+.25,5.05])mesh(g,new T.CylinderGeometry(.235,.235,.08,24),gold,x,yy,cz);
    for(const dx of [-.11,.11])box(g,gold,.022,4.12,.025,x+dx,2.82,cz+.20);
    box(g,red,.7,.16,.55,x,5.24,cz);box(g,gold,.9,.07,.40,x,5.36,cz);box(g,red,1.15,.13,.35,x,5.46,cz);
    // Small curved bracket profiles and capital medallions read in silhouette.
    for(const side of [-1,1])tube(g,gold,[[x+side*.08,5.08,cz+.28],[x+side*.31,5.25,cz+.28],[x+side*.46,5.42,cz+.28],[x+side*.51,5.55,cz+.28]],.027);
    const disc=mesh(g,new T.CylinderGeometry(.11,.11,.025,20),gold,x,5.27,cz+.30);disc.rotation.x=Math.PI/2;
  }
  box(g,wood,w+1.1,.24,.35,0,5.58,cz);box(g,gold,w+1.2,.045,.4,0,5.71,cz);
  for(let i=0;i<Math.ceil(w/.45);i++)box(g,wood,.08,.12,2.8,-w/2+i*.45,5.64,d/2+.6);
  const lower=roof(w,d+1.8,2.05,1.1,m.roofHerit,m.ridge,detail);lower.position.set(0,5.85,.65);g.add(lower);
  const upperDepth=d*.58;
  // Solid clerestory/soffit between the tiers: no sky leak under a floating roof.
  box(g,wood,w-1.4,.95,upperDepth,0,6.975,-.1);
  box(g,red,w-.9,.16,upperDepth+.2,0,7.36,-.1);
  const upper=roof(w-1.4,upperDepth,2.0,.45,m.roofHerit,m.ridge,detail);upper.position.set(0,7.45,-.1);g.add(upper);
  for(let i=0;i<5;i++)box(g,stone,w*.52,.125,.43,0,.56-i*.11,d/2+2.35+i*.43);
  // Balustrade panels flank the central doorway; dimensions remain an interpretation.
  for(const sign of [-1,1]){const x=sign*w*.35;box(g,red,w*.22,.12,.18,x,1.61,cz+.4);box(g,stone,w*.22,.12,.32,x,.78,cz+.4);
    for(let k=0;k<10;k++)box(g,gold,.055,.67,.06,x-w*.11+k*w*.22/9,1.17,cz+.4);}
  planter(g,stone,-w*.40,d/2+5);planter(g,stone,w*.40,d/2+5);
  return g;
}
function archedGlass(g,m,x,y,z,w,h){
  const r=w/2,shape=new T.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,h-r);shape.absarc(0,h-r,r,0,Math.PI,false);shape.lineTo(-r,0);
  const pane=mesh(g,new T.ShapeGeometry(shape,32),m,x,y,z);pane.userData.libraryArch=true;
  const outline=[[-r,0,0],[-r,h-r,0]];for(let i=0;i<=24;i++){const a=Math.PI-i/24*Math.PI;outline.push([Math.cos(a)*r,h-r+Math.sin(a)*r,0]);}outline.push([r,0,0]);
  const frameMaterial=new T.MeshStandardMaterial({color:'#c5c7bf',metalness:.35,roughness:.4});
  const frame=new T.Group();tube(frame,frameMaterial,outline,.10);frame.position.set(x,y,z+.04);g.add(frame);
  for(let i=1;i<4;i++)box(g,frameMaterial,w,.045,.045,x,y+i*(h-r)/4,z+.05);
  for(const sign of [-1,1])box(g,frameMaterial,.045,h-r,.045,x+sign*w/6,y+(h-r)/2,z+.05);
}
function library(g,b,m){
  const [w,H,d]=b.size,fh=b.floorH,face=d/2;
  g.userData.atelier='library-dome-arcade';
  const white=m.wallLight.clone();white.color.set('#ecece6');white.roughness=.83;
  const metal=root.CampusSurfaces?.brushedMetal();
  const zinc=new T.MeshStandardMaterial({color:'#8c9496',roughness:.57,metalness:.75,roughnessMap:metal?.rough||null,normalMap:metal?.normal||null,normalScale:new T.Vector2(.12,.12)});
  const rib=new T.MeshStandardMaterial({color:'#4e5b5e',roughness:.48,metalness:.6});
  box(g,white,w,H,d-.65,0,H/2,-.325);
  for(let floor=0;floor<4;floor++){
    const y=floor*fh;
    box(g,white,w+.6,.38,d+.45,0,y+fh-.12,0);
    for(let i=0;i<11;i++){const x=-w/2+1.3+i*(w-2.6)/10;windowFrame(g,m.frame,x,y+2.05,face+.04,2.35,2.35);}
    box(g,white,w,.88,.3,0,y+.44,face+.58);
    for(let i=0;i<=14;i++)box(g,m.frame,.035,.72,.035,-w/2+i*w/14,y+1.02,face+.73);
    box(g,m.frame,w,.055,.08,0,y+1.38,face+.73);
  }
  archedGlass(g,m.glassTeal,-w*.13,H*.57,face+.82,4.8,8);
  box(g,white,5.5,1,.8,-w*.13,H*.57-.5,face+.6);
  // Onion-profile metal cupola with actual three-dimensional standing seams.
  const dx=w*.34,dz=d*.42,base=H+.9,profile=[[0,3.6],[.28,3.35],[1.15,2.8],[2.15,1.9],[2.45,1.0],[2.3,.3],[2.2,0]];
  mesh(g,new T.CylinderGeometry(2.25,2.25,1.6,48),white,dx,H+.4,dz);
  const dome=mesh(g,new T.LatheGeometry(profile.slice().reverse().map(p=>new T.Vector2(...p)),64),zinc,dx,base,dz);dome.userData.libraryDome=true;
  dome.userData.brushedMetal=true;
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;tube(g,rib,profile.map(([r,y])=>[dx+Math.cos(a)*r,base+y,dz+Math.sin(a)*r]),.027);}
  mesh(g,new T.SphereGeometry(.12,12,8),rib,dx,base+3.65,dz);
  const sx=-w*.20,stairN=22,tread=.46;
  for(let i=0;i<stairN;i++){const h=(stairN-i)/stairN*3.85;box(g,m.step,10.8,h,tread+.025,sx,h/2,face+1.4+i*tread);}
  for(const sign of [-1,1]){
    const x=sx+sign*5.65;for(let i=0;i<=11;i++){const z=face+1.4+i*tread*2,y=3.85-i*3.85/11;box(g,white,.22,1.05,.22,x,y+.525,z);}
    tube(g,m.frame,[[x,4.90,face+1.4],[x,1.05,face+1.4+stairN*tread]],.055);
  }
  box(g,white,13,.3,5,sx,4.28,face+1.7);
  for(const sign of [-1,1])box(g,white,.36,4.1,.36,sx+sign*6,2.05,face+3.8);
  planter(g,m.step,w*.30,face+2);
  return g;
}
function recessedFacade(g,b,m){
  const w=b.size[0],d=b.size[2],H=b.size[1],fh=b.floorH,body=g.children.find(o=>o.name==='body');
  if(body){body.geometry.dispose();body.geometry=new T.BoxGeometry(w,H-fh,d-.9);}
  const len=w*.94,ww=1.9,gap=1.5,n=Math.max(1,Math.floor((len-gap)/(ww+gap))),start=-(n-1)*(ww+gap)/2;
  for(const sign of [-1,1])for(let floor=1;floor<b.floors;floor++){
    const cy=floor*fh+fh*.56,wh=fh*.52,z=sign*(d/2+.18),bottom=floor*fh,lo=cy-wh/2,hi=cy+wh/2;
    box(g,m.wallLight,w,lo-bottom,.38,0,(bottom+lo)/2,z);box(g,m.wallLight,w,fh-(hi-bottom),.38,0,(hi+(floor+1)*fh)/2,z);
    for(let i=0;i<=n;i++){const left=i===0?-w/2:start+(i-1)*(ww+gap)+ww/2,right=i===n?w/2:start+i*(ww+gap)-ww/2;if(right>left)box(g,m.wallLight,right-left,wh,.38,(left+right)/2,cy,z);}
  }
  g.userData.recessedFacade=true;
}
function science(g,b,m,queueWindow){
  const [w,h,d]=b.size,fh=b.floorH,front=d/2,depth=2.15,n=Math.round(w/3.5),bay=w/n;
  const white=m.wallLight,rail=m.metalDark;
  // Photograph: deep open galleries behind continuous horizontal white bands.
  // All components remain inside the inherited footprint; the core stays solid.
  box(g,white,w,h,d-depth,0,h/2,-depth/2);
  box(g,m.plinth,w,.5,d,0,.25,0);
  for(let floor=0;floor<b.floors;floor++){
    const y=floor*fh;
    box(g,white,w+.10,.22,depth+.12,0,y+fh-.11,front-depth/2);
    if(floor>0){
      box(g,white,w,1.05,.18,0,y+.525,front-.09);
      box(g,m.wallGrey,w,.06,.23,0,y+1.08,front-.08);
      box(g,rail,w,.04,.045,0,y+1.37,front-.09);
      for(let k=0;k<=n*3;k++)box(g,rail,.022,.28,.022,-w/2+k*w/(n*3),y+1.22,front-.09);
    }
    for(let k=0;k<n;k++){
      const x=-w/2+(k+.5)*bay,wy=y+fh*.55,z=front-depth+.03,ww=1.55,wh=1.85;
      queueWindow(x,wy,z,ww,wh,'z',.13,m.glassTeal);
      for(let bar=0;bar<7;bar++)box(g,rail,.022,wh,.035,x-ww/2+bar*ww/6,wy,z+.22);
      for(let bar=0;bar<5;bar++)box(g,rail,ww,.022,.035,x,wy-wh/2+bar*wh/4,z+.23);
      if(floor>0)box(g,white,.26,fh-.22,.27,x+bay/2,y+fh/2,front-.25);
      box(g,white,ww+.22,.10,.36,x,wy+wh/2+.12,z+.12);
    }
  }
  box(g,white,w+.4,.25,d+.35,0,h+.12,0);
  box(g,white,7,2.1,5,0,h+1.05,-.5);
  box(g,white,7.7,.22,5.7,0,h+2.21,-.5);
  for(const x of [-3.1,0,3.1])box(g,rail,.055,2.6,.055,x,h+2.5,-.4);
  box(g,white,8.2,.26,3.2,0,3.45,front-1.5);
  for(const x of [-3.5,3.5])box(g,white,.34,3.3,.34,x,1.65,front-.3);
  g.userData.atelier='science-open-galleries';
}
root.CampusAtelier={roof,hall,library,recessedFacade,science};
})(window);
