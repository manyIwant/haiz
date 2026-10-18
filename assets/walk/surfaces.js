/* Original procedural material studies. Photo-informed, not scans of the school.
   Metric UV projection keeps joints the same size on different buildings. */
(function(root){'use strict';
  const cache={};let glaze=null;
  function setGlaze(texture){glaze=texture;texture.wrapS=texture.wrapT=THREE.MirroredRepeatWrapping;texture.encoding=THREE.sRGBEncoding;texture.userData={...texture.userData,generatedGlaze:true};texture.needsUpdate=true;}
  function maps(kind){
    if(cache[kind])return cache[kind];
    const size=512,canvases={};
    for(const type of ['color','height','rough','normal']){const c=document.createElement('canvas');c.width=c.height=size;canvases[type]=c;}
    const contexts=Object.fromEntries(Object.entries(canvases).map(([k,c])=>[k,c.getContext('2d')]));
    const images=Object.fromEntries(Object.entries(contexts).map(([k,c])=>[k,c.createImageData(size,size)]));
    const heights=new Float32Array(size*size),tau=Math.PI*2;
    const hash=(x,y)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
    // Periodic low-frequency detail remains continuous across texture edges.
    const broad=(x,y)=>Math.sin(tau*x/size*3+Math.sin(tau*y/size*2))*.5+Math.cos(tau*y/size*5-tau*x/size*2)*.3;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const noise=hash(x,y)-.5,macro=broad(x,y),i=(y*size+x)*4;
      let color=222,height=160,rough=220;
      if(kind==='ceramic'){
        const xx=x%64,yy=y%32,edge=Math.min(xx,64-xx,yy,32-yy),bevel=Math.min(1,Math.max(0,(edge-1)/2.5));
        const tileTone=hash(Math.floor(x/64),Math.floor(y/32))-.5;
        color=138+bevel*(94+tileTone*9)+noise*3;height=68+bevel*100+macro*1.5;rough=241-bevel*79+noise*7+tileTone*12;
      }else if(kind==='roof'){
        const wave=(Math.cos(x*tau/64)+1)/2,row=y%128,joint=Math.min(1,row/7),tileTone=hash(Math.floor(x/64),Math.floor(y/128))-.5;
        color=joint*(198+wave*36+tileTone*13)+(!joint?117:0)+noise*5+macro*3;
        height=(84+wave*116)*(.7+.3*joint)+noise*.8;rough=146+(1-wave)*40+(1-joint)*65+macro*8+noise*7;
      }else if(kind==='stone'){
        const xx=(x+(Math.floor(y/64)%2)*64)%128,yy=y%64,edge=Math.min(xx,128-xx,yy,64-yy),bevel=Math.min(1,Math.max(0,edge-1));
        const block=hash(Math.floor((x+(Math.floor(y/64)%2)*64)/128),Math.floor(y/64))-.5,vein=Math.pow(Math.max(0,Math.sin(x*.1+macro*4+y*.03)),18);
        color=112+bevel*(91+noise*42+macro*7+block*12+vein*9);height=62+bevel*(95+noise*15+macro*3);rough=235-bevel*30+noise*17;
      }else if(kind==='timber'){
        const warp=Math.sin(y*tau/size)*2.6+Math.sin(y*tau*3/size)*.65;
        const grain=Math.sin(x*tau*24/size+warp)+Math.sin(x*tau*79/size+warp*.6)*.25,pores=Math.pow(Math.max(0,grain/1.25),7);
        color=208+grain*14+noise*7+macro*3;height=149+grain*7-pores*4;rough=192+grain*9+noise*8;
      }
      heights[y*size+x]=height;
      for(const [type,value]of [['color',color],['height',height],['rough',rough]]){
        const p=images[type].data;p[i]=p[i+1]=p[i+2]=value;p[i+3]=255;
      }
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const h=(xx,yy)=>heights[((yy+size)%size)*size+(xx+size)%size];
      // OpenGL tangent normal: Canvas rows run downward, texture V upward.
      const dx=(h(x+1,y)-h(x-1,y))*.08,dy=(h(x,y+1)-h(x,y-1))*.08,length=Math.hypot(dx,dy,1),i=(y*size+x)*4,p=images.normal.data;
      p[i]=128-dx/length*127;p[i+1]=128+dy/length*127;p[i+2]=128+127/length;p[i+3]=255;
    }
    const out={};for(const type of Object.keys(contexts)){
      contexts[type].putImageData(images[type],0,0);const t=new THREE.CanvasTexture(canvases[type]);
      t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;
      if(type==='color')t.encoding=THREE.sRGBEncoding;out[type]=t;
    }
    cache[kind]=out;return out;
  }
  function bind(material,kind,tile,bump){
    const m=maps(kind);material.map=m.color;material.bumpMap=m.height;material.bumpScale=bump;
    material.roughnessMap=m.rough;material.normalMap=m.normal;material.normalScale.set(kind==='roof'?.65:.32,kind==='roof'?.65:.32);
    material.userData.surfaceStudy=kind;material.userData.metricTile=tile;
    material.needsUpdate=true;
  }
  function init(m,bank={}){
    function coat(key,amount,rough){
      const old=m[key],physical=new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(physical,old);
      physical.defines={STANDARD:'',PHYSICAL:''};
      physical.clearcoat=amount;physical.clearcoatRoughness=rough;m[key]=physical;
    }
    coat('wallLight',.1,.45);coat('roofHerit',.16,.48);
    coat('roofRed',.06,.6);coat('roofPorch',.06,.6);coat('roofTile',.08,.5);
    bind(m.wallLight,'ceramic',1.6,.018);
    for(const k of ['roofHerit','roofRed','roofPorch','roofTile'])bind(m[k],'roof',1.6,.035);
    m.roofHerit.normalScale.set(.18,.18);m.roofHerit.bumpScale=.004;
    for(const k of ['baseStone','plinth','step','poolEdge'])bind(m[k],'stone',2.4,.024);
    for(const k of ['beam','door'])bind(m[k],'timber',1.4,.012);
    m.roofHerit.roughness=.62;m.roofRed.roughness=.85;m.roofPorch.roughness=.82;
    m.wallLight.color.set('#e8e6de');m.baseStone.color.set('#525953');
    if(bank.glaze){setGlaze(bank.glaze);m.roofHerit.map=glaze;m.roofHerit.color.set('#e4e4d6');m.roofHerit.userData.generatedGlaze=true;}
    m.glassTeal.roughness=.22;m.glassTeal.envMapIntensity=.8;
  }
  function sample(kind,color,wet=0){
    const result=new THREE.MeshPhysicalMaterial({color:new THREE.Color(color).convertSRGBToLinear(),roughness:.8});
    bind(result,kind,1.6,.02);result.clearcoat=kind==='roof'?.3:.08;result.clearcoatRoughness=.3;
    if(kind==='roof'&&glaze){result.map=glaze;result.color.set('#e4e4d6').convertSRGBToLinear();result.userData.generatedGlaze=true;}
    result.color.multiplyScalar(1-wet*.22);result.roughness=.8*(1-wet)+.24*wet;result.clearcoat+=wet*.3;
    return result;
  }
  function project(group){
    group.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))return;
      const tile=mesh.material.userData.metricTile;if(!tile)return;
      const geo=mesh.geometry,position=geo.attributes.position,normal=geo.attributes.normal,uv=geo.attributes.uv;
      if(!position||!normal||!uv||geo.userData.metricUV)return;
      // Geometry is local and unique here, before static batching. Object scale is
      // included for unit boxes; rotation does not stretch a material's joints.
      for(let i=0;i<position.count;i++){
        const x=position.getX(i)*mesh.scale.x,y=position.getY(i)*mesh.scale.y,z=position.getZ(i)*mesh.scale.z;
        const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        if(ny>=nx&&ny>=nz)uv.setXY(i,x/tile,z/tile);
        else if(nx>nz)uv.setXY(i,z/tile,y/tile);
        else uv.setXY(i,x/tile,y/tile);
      }
      uv.needsUpdate=true;geo.userData.metricUV=true;
    });
  }
  root.CampusSurfaces={init,project,maps,sample,setGlaze,albedo:kind=>kind==='roof'&&glaze?glaze:maps(kind).color};
})(window);
