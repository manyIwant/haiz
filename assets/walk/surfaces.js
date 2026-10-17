/* Original procedural material studies. Photo-informed, not scans of the school.
   Metric UV projection keeps joints the same size on different buildings. */
(function(root){'use strict';
  const cache={};
  function maps(kind){
    if(cache[kind])return cache[kind];
    const size=256,canvases={};
    for(const type of ['color','height','rough']){const c=document.createElement('canvas');c.width=c.height=size;canvases[type]=c;}
    const contexts=Object.fromEntries(Object.entries(canvases).map(([k,c])=>[k,c.getContext('2d')]));
    const images=Object.fromEntries(Object.entries(contexts).map(([k,c])=>[k,c.createImageData(size,size)]));
    let seed=173;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=seed/4294967296-.5,i=(y*size+x)*4;
      let color=222,height=160,rough=220;
      if(kind==='ceramic'){
        const joint=x%64<2||y%32<2,edge=x%64<4||y%32<4;
        color=joint?133:edge?207:232+noise*10;height=joint?54:edge?145:176;rough=joint?245:172+noise*20;
      }else if(kind==='roof'){
        const wave=(Math.cos(x*Math.PI/16)+1)/2,joint=y%64<4;
        color=(joint?138:190+wave*55)+noise*9;height=joint?50:85+wave*150;rough=joint?236:120+(1-wave)*55+noise*15;
      }else if(kind==='stone'){
        const joint=(x+(Math.floor(y/64)%2)*64)%128<2||y%64<2;
        color=joint?108:206+noise*54;height=joint?45:155+noise*24;rough=joint?240:200+noise*28;
      }else if(kind==='timber'){
        const grain=Math.sin(x*.32+Math.sin(y*.025)*2)+Math.sin(x*1.1+y*.015)*.22;
        color=210+grain*17+noise*11;height=150+grain*16;rough=190+grain*12;
      }
      for(const [type,value]of [['color',color],['height',height],['rough',rough]]){
        const p=images[type].data;p[i]=p[i+1]=p[i+2]=value;p[i+3]=255;
      }
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
    material.roughnessMap=m.rough;material.normalMap=null;material.userData.surfaceStudy=kind;material.userData.metricTile=tile;
    material.needsUpdate=true;
  }
  function init(m){
    bind(m.wallLight,'ceramic',1.6,.018);
    for(const k of ['roofHerit','roofRed','roofPorch','roofTile'])bind(m[k],'roof',1.6,.035);
    for(const k of ['baseStone','plinth','step','poolEdge'])bind(m[k],'stone',2.4,.024);
    for(const k of ['beam','door'])bind(m[k],'timber',1.4,.012);
    m.roofHerit.roughness=.62;m.roofRed.roughness=.85;m.roofPorch.roughness=.82;
    m.wallLight.color.set('#e8e6de');m.baseStone.color.set('#525953');
    m.glassTeal.roughness=.22;m.glassTeal.envMapIntensity=.8;
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
  root.CampusSurfaces={init,project,maps};
})(window);
