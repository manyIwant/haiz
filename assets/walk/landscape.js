/* Original tropical planting and Blender-authored limestone, informed by the
   bundled pond photograph. See models/campus-limestone.json and build-landscape.py. */
(function(root){'use strict';
const T=THREE,bank=new Map(),ponds=[];
let quality='balanced',assetStatus='pending',assetPromise,leafMat,barkMat,leafGeo,stele;
function random(seed){let x=2166136261;for(const c of String(seed))x=Math.imul(x^c.charCodeAt(0),16777619);return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function geometry(p,uv,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;}
function add(parent,geo,mat){const m=new T.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function load(){
  if(assetPromise)return assetPromise;
  if(!T.GLTFLoader||root.location?.protocol==='file:'){assetStatus='fallback';return Promise.resolve(false);}
  assetStatus='loading';
  assetPromise=new Promise(resolve=>{
    let settled=false;const timer=setTimeout(()=>finish(null),16000);
    function finish(gltf){
      if(settled){gltf?.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();}});return;}
      settled=true;clearTimeout(timer);
      if(gltf){stele=gltf.scene.getObjectByName('PondStele');gltf.scene.traverse(o=>{if(!o.isMesh)return;
        if(/^Limestone_\d_(high|low)$/.test(o.name))bank.set(o.name,o);
        for(const m of Array.isArray(o.material)?o.material:[o.material]){
          m.userData.linearColor=true;m.side=T.FrontSide;
          if(!m.normalMap)continue;
          m.userData.landscapeStone=true;m.aoMapIntensity=.85;m.envMapIntensity=.35;
          m.color.set('#a7aca0').convertSRGBToLinear();m.normalScale.set(.26,.26);
        }
      });}
      assetStatus=bank.size===6?'ready':'fallback';resolve(assetStatus==='ready');
    }
    new T.GLTFLoader().load('assets/walk/models/campus-limestone.glb',finish,undefined,()=>finish(null));
  });return assetPromise;
}
function init(q){
  quality=q;ponds.length=0;
  if(leafMat)return;
  leafMat=new T.MeshStandardMaterial({color:'#91aa70',vertexColors:true,roughness:.58,side:T.DoubleSide});
  const veinCanvas=document.createElement('canvas');veinCanvas.width=256;veinCanvas.height=512;
  const veinContext=veinCanvas.getContext('2d'),veins=veinContext.createImageData(256,512);
  for(let y=0;y<512;y++)for(let x=0;x<256;x++){
    const u=x/255-.5,v=y/511,rib=Math.exp(-Math.abs(u)*115),lateral=Math.pow(Math.max(0,Math.cos((v-Math.abs(u)*.66)*Math.PI*36)),24);
    const value=205+rib*26+lateral*10+Math.sin(x*1.7+y*2.3)*3,i=(y*256+x)*4;
    veins.data[i]=veins.data[i+1]=veins.data[i+2]=value;veins.data[i+3]=255;
  }
  veinContext.putImageData(veins,0,0);const veinMap=new T.CanvasTexture(veinCanvas);veinMap.encoding=T.sRGBEncoding;veinMap.anisotropy=8;
  const relief=veinMap.clone();relief.encoding=T.LinearEncoding;relief.needsUpdate=true;
  leafMat.map=veinMap;leafMat.bumpMap=relief;leafMat.bumpScale=.003;
  // Leaf colour is vertex-varying; these folded blades have actual gaps and edges.
  const c=document.createElement('canvas');c.width=128;c.height=512;const cx=c.getContext('2d'),r=random('palm-bark');
  cx.fillStyle='#9b9280';cx.fillRect(0,0,128,512);
  for(let y=0;y<512;y+=9){cx.fillStyle=`rgba(46,42,32,${.15+r()*.22})`;cx.fillRect(0,y,128,1+r()*2);cx.fillStyle='#c3ba9c44';cx.fillRect(0,y+3,128,2);}
  for(let i=0;i<750;i++){cx.fillStyle=i%2?'#473d2b33':'#c9bea444';cx.fillRect(r()*128,r()*512,.5+r(),2+r()*9);}
  const map=new T.CanvasTexture(c);map.encoding=T.sRGBEncoding;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2,6);
  const bump=map.clone();bump.encoding=T.LinearEncoding;bump.needsUpdate=true;
  barkMat=new T.MeshStandardMaterial({color:'#c5bda8',map,bumpMap:bump,bumpScale:.035,roughness:.95});
}
function blade(p,uv,colors,start,end,width,side,color,segments=3){
  const dir=end.clone().sub(start),fold=new T.Vector3(0,.035,0),rows=[];
  for(let j=0;j<=segments;j++){
    const t=j/segments,center=start.clone().addScaledVector(dir,t);center.y+=Math.sin(t*Math.PI)*dir.length()*.06;
    const w=Math.sin(Math.PI*Math.pow(t,.74))*width;
    rows.push([center.clone().addScaledVector(side,-w),center.clone().addScaledVector(fold,Math.sin(t*Math.PI)),center.clone().addScaledVector(side,w)]);
  }
  for(let j=0;j<segments;j++)for(let k=0;k<2;k++)for(const [a,b] of [[j,k],[j+1,k],[j,k+1],[j,k+1],[j+1,k],[j+1,k+1]]){
    const point=rows[a][b];p.push(point.x,point.y,point.z);uv.push(b/2,a/segments);
    const factor=.8+.2*a/segments;colors.push(color.r*factor,color.g*factor,color.b*factor);
  }
}
function palm(parent,x,z,h,seed){
  const r=random(seed),g=new T.Group();g.position.set(x,0,z);g.userData.botanicalPalm=true;parent.add(g);
  const trunk=new T.CylinderGeometry(.16,.32,h,quality==='low'?8:12,28);
  const a=trunk.attributes.position;
  for(let i=0;i<a.count;i++){const t=(a.getY(i)+h/2)/h,ring=1+.04*Math.sin(t*92);a.setXYZ(i,a.getX(i)*ring+.52*t*t,a.getY(i)+h/2,a.getZ(i)*ring+.23*Math.sin(t*1.8));}
  trunk.computeVertexNormals();add(g,trunk,barkMat);
  const p=[],uv=[],colors=[],fronds=quality==='low'?9:12,leaflets=quality==='low'?12:22;
  for(let f=0;f<fronds;f++){
    const angle=f/fronds*Math.PI*2+r()*.25,len=3.6+r()*1.6,lift=.65+r()*.8,drop=1.5+r()*1.5;
    const out=new T.Vector3(Math.cos(angle),0,Math.sin(angle)),side=new T.Vector3(-out.z,0,out.x);
    const point=t=>new T.Vector3(.52,h,.23).addScaledVector(out,len*t).add(new T.Vector3(0,Math.sin(t*Math.PI)*lift-t*t*drop,0));
    for(let k=1;k<=leaflets;k++)for(const sign of [-1,1]){
      const t=.05+k/(leaflets+1)*.91,start=point(t),length=Math.sin(Math.pow(t,.65)*Math.PI)*(.82+r()*.22)+.10;
      const end=start.clone().addScaledVector(side,sign*length).addScaledVector(out,length*.31);end.y-=length*(.35+r()*.25);
      const color=new T.Color().setHSL(.22+r()*.035,.38,.23+r()*.11);
      blade(p,uv,colors,start,end,.07,out,color,quality==='low'?1:3);
    }
    const points=[];for(let k=0;k<=12;k++)points.push(point(k/12));
    add(g,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.018,3,false),barkMat);
  }
  const leaves=add(g,geometry(p,uv,colors),leafMat);leaves.userData.foliage=true;
  leaves.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
  return g;
}
function broadLeaves(){
  if(leafGeo)return leafGeo;
  const p=[],uv=[],colors=[],r=random('pond-broadleaves');
  for(let i=0;i<16;i++){
    const a=i*2.39996,side=new T.Vector3(-Math.sin(a),0,Math.cos(a)),length=.9+r()*.75;
    const start=new T.Vector3(Math.cos(a)*.08,.12,Math.sin(a)*.08),end=new T.Vector3(Math.cos(a)*length*.72,.45+r()*.62,Math.sin(a)*length*.72);
    blade(p,uv,colors,start,end,.17+r()*.12,side,new T.Color().setHSL(.25+r()*.045,.38,.19+r()*.12),8);
  }
  leafGeo=geometry(p,uv,colors);return leafGeo;
}
function fallbackStone(seed){
  const g=new T.SphereGeometry(1,20,12),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.08*Math.sin(x*13+seed)*Math.sin(z*9+y*16)+.055*Math.sin(y*28);
    p.setXYZ(i,x*n*1.6,y*.64+Math.sin(x*12+z*8)*.045,z*n*1.1);
  }
  g.computeVertexNormals();return g;
}
function pond(g,b,waterLevel){
  const w=b.size[0],d=b.size[2],r=random('pond-shore-19'),high=new T.Group(),low=new T.Group();
  high.userData.noMerge=low.userData.noMerge=true;g.add(high,low);
  const positions=[];
  // Three irregularly interlocking shelves rise from the photographed rocky bank.
  for(let tier=0;tier<4;tier++)for(let j=0;j<8-tier;j++){
    const z=(j-(7-tier)/2)*1.52+(r()-.5)*.8;
    positions.push({x:-w*.32-tier*.43+(r()-.5)*1.5,y:waterLevel+.20+tier*.5*(.55+.45*Math.cos(z*.32)),z,
      sx:.70+r()*.65,sy:.40+r()*.38,sz:.65+r()*.58,ry:r()*6.28,v:j%3});
  }
  // Small submerged edge stones; the central water plane remains unobstructed.
  for(let j=0;j<15;j++)positions.push({x:-w*.22+r()*w*.12,y:waterLevel+.06,z:-d*.43+j*d*.86/14,sx:.35+r()*.3,sy:.28,sz:.45,ry:r()*6.28,v:j%3});
  const fallback=new T.MeshStandardMaterial({color:'#6f7560',roughness:.88});
  for(const [level,parent]of [['high',high],['low',low]])for(let variant=0;variant<3;variant++){
    const template=bank.get(`Limestone_${variant}_${level}`),items=positions.filter(p=>p.v===variant);
    const mesh=new T.InstancedMesh(template?.geometry||fallbackStone(variant),template?.material||fallback,items.length),dummy=new T.Object3D();
    items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(.04*Math.sin(i),p.ry,.05*Math.cos(i));dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.limestoneLOD=level;parent.add(mesh);
  }
  const plants=new T.InstancedMesh(broadLeaves(),leafMat,23),dummy=new T.Object3D();
  for(let i=0;i<23;i++){
    dummy.position.set(-w*.23+r()*2.0,waterLevel+.18+r()*.2,-d*.42+r()*d*.84);dummy.rotation.set(0,r()*6.28,0);dummy.scale.setScalar(.72+r()*.65);dummy.updateMatrix();plants.setMatrixAt(i,dummy.matrix);
  }
  plants.castShadow=plants.receiveShadow=true;plants.userData.foliage=true;
  plants.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});g.add(plants);
  for(let i=0;i<3;i++)palm(g,-w*.42,-d*.3+i*d*.3,7.5+i*1.1,'pond-palm-'+i);
  if(stele&&b.id==='yanchi'){const marker=stele.clone(true);marker.position.set(-w*.10,waterLevel+.08,d*.36);marker.rotation.y=Math.PI/2;
    marker.userData.noMerge=true;marker.userData.pondInscription=true;
    marker.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});g.add(marker);
  }
  high.visible=quality!=='low';low.visible=!high.visible;
  g.userData.landscape='layered-limestone-tropical-bank';
  ponds.push({group:g,high,low,stoneCount:positions.length,wetMaterials:[...new Set([...bank.values()].map(o=>o.material))].map(m=>({m,color:m.color.clone(),rough:m.roughness}))});
}
function tick(camera,q,wet=0){
  for(const pond of ponds){
    const pos=pond.group.getWorldPosition(new T.Vector3()),distance=Math.hypot(pos.x-camera.position.x,pos.z-camera.position.z);
    pond.high.visible=q!=='low'&&distance<48;pond.low.visible=!pond.high.visible;
    for(const {m,color,rough}of pond.wetMaterials){m.color.copy(color).multiplyScalar(1-wet*.22);m.roughness=rough*(1-wet*.32);}
  }
}
root.CampusLandscape={load,init,palm,pond,tick,get diagnostics(){return {assetStatus,variants:bank.size,ponds:ponds.length,stones:ponds.reduce((n,p)=>n+p.stoneCount,0),highDetail:ponds.some(p=>p.high.visible)};}};
})(window);
