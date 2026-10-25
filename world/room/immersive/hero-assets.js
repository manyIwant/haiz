/* HAIZ INNER WORLD / original hero furniture + cheap authored bounce atlas.
 * Geometric dimensions are meters. No external resources and no per-frame texture generation.
 * This is NOT Blender-baked global illumination: the bounce is an analytic static approximation.
 */
(function(root){
 'use strict';
 function slab(T,w,d,depth,r,mat){
   const a=w/2,b=d/2,s=new T.Shape();
   s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);
   s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);
   s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);
   s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
   const bevel=Math.min(depth*.20,.009);
   const geo=new T.ExtrudeGeometry(s,{depth:depth-2*bevel,steps:1,curveSegments:5,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3});
   geo.translate(0,0,-depth/2+bevel);geo.rotateX(-Math.PI/2);
   const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
 function vessel(T,material,points,seg=20){
   const geo=new T.LatheGeometry(points.map(p=>new T.Vector2(p[0],p[1])),seg);
   const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
 function coverTexture(T){
   const c=document.createElement('canvas');c.width=512;c.height=640;const p=c.getContext('2d');
   p.fillStyle='#ede8d9';p.fillRect(0,0,512,640);
   p.fillStyle='#d8d1bd';for(let k=0;k<23;k++)p.fillRect(58,140+k*18,397,.8);
   p.fillStyle='#61736d';p.font='500 17px system-ui';p.fillText('HAIZ  /  2026',58,72);
   p.fillStyle='#53574f';p.font='400 38px serif';p.fillText('A QUIET PLACE',58,112);
   p.strokeStyle='#c0b7a3';p.strokeRect(28,25,456,586);
   p.fillStyle='#a46d52';p.fillRect(58,557,95,6);
   const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;
   texture.anisotropy=4;return texture;
 }
 function build(T,parent,props){
   const wood=props.wood,metal=props.metal,chairFabric=props.chairFabric;
   const marker=new T.Group();marker.name='HAIZ / authored hero desk';parent.add(marker);
   const walnut=new T.MeshStandardMaterial({color:'#906741',roughness:.61,metalness:.02});
   const edge=new T.MeshStandardMaterial({color:'#6a5441',roughness:.58,metalness:.08});
   const enamel=new T.MeshStandardMaterial({color:'#b9c4b9',metalness:.08,roughness:.27});
   const ceramic=new T.MeshStandardMaterial({color:'#e2d7c2',roughness:.29,metalness:.03});
   const brass=new T.MeshStandardMaterial({color:'#b78f61',metalness:.77,roughness:.28});
   const textPaper=new T.MeshStandardMaterial({map:coverTexture(T),color:'#f3eee3',roughness:.94});
   const fabric=new T.MeshStandardMaterial({color:'#506e68',roughness:.99,metalness:0});
   const ink=new T.MeshStandardMaterial({color:'#303d39',roughness:.35,metalness:.15});
   // Hero tabletop. Radius and edge-band are genuine geometry; not a bloom trick.
   const top=slab(T,1.76,.78,.075,.055,wood);top.position.y=.79;marker.add(top);
   const edgeBand=slab(T,1.70,.725,.018,.046,edge);edgeBand.position.y=.743;marker.add(edgeBand);
   const exposedEdge=slab(T,1.72,.745,.009,.044,walnut);exposedEdge.position.y=.733;marker.add(exposedEdge);
   // A printed exercise journal, including page block, spine and authoring marks.
   const journal=slab(T,.40,.55,.024,.014,textPaper);
   journal.position.set(.39,.848,-.04);marker.add(journal);
   const pageBlock=slab(T,.385,.535,.018,.009,props.paper);
   pageBlock.position.set(.39,.826,-.04);marker.add(pageBlock);
   const spine=slab(T,.026,.55,.031,.005,walnut);spine.position.set(.18,.844,-.04);marker.add(spine);
   // Real proportions: fountain pen, clip and cap.
   const penBody=new T.Mesh(new T.CylinderGeometry(.010,.012,.26,10),ink);
   penBody.rotation.z=Math.PI/2;penBody.position.set(.10,.857,.24);marker.add(penBody);
   const penCap=new T.Mesh(new T.CylinderGeometry(.012,.010,.06,10),brass);
   penCap.rotation.z=Math.PI/2;penCap.position.set(-.047,.857,.24);marker.add(penCap);
   // Replaces the old solid sphere cup with physically legible thin-walled porcelain.
   const mug=vessel(T,ceramic,[[0,0],[.055,0],[.064,.008],[.067,.075],[.064,.113],[.056,.119],[.054,.113],[.057,.095],[.057,.015],[.0,.012]],28);
   mug.position.set(-.62,.834,.16);marker.add(mug);
   const tea=new T.Mesh(new T.CircleGeometry(.052,22),new T.MeshStandardMaterial({color:'#695039',roughness:.24}));
   tea.rotation.x=-Math.PI/2;tea.position.set(-.62,.935,.16);marker.add(tea);
   const handle=new T.Mesh(new T.TorusGeometry(.045,.012,9,18,Math.PI*1.55),ceramic);
   handle.position.set(-.542,.896,.16);handle.rotation.y=Math.PI/2;marker.add(handle);
   // Articulated desk lamp: soft reflector, collar, real lamp switch target.
   const lampBase=new T.Mesh(new T.CylinderGeometry(.090,.10,.018,20),metal);
   lampBase.position.set(-.72,.838,-.16);marker.add(lampBase);
   const pole=new T.Mesh(new T.CylinderGeometry(.011,.013,.47,14),brass);
   pole.position.set(-.71,1.06,-.16);pole.rotation.z=-.13;marker.add(pole);
   const socket=new T.Mesh(new T.SphereGeometry(.026,14,10),brass);
   socket.position.set(-.745,1.28,-.16);marker.add(socket);
   const head=vessel(T,enamel,[[.008,0],[.035,.002],[.060,.024],[.110,.068],[.125,.086],[.127,.091],[.120,.094]],24);
   head.position.set(-.76,1.40,-.16);
   head.rotation.z=Math.PI;head.userData.lamp=true;marker.add(head);
   const diffuser=new T.Mesh(new T.CircleGeometry(.117,24),new T.MeshBasicMaterial({color:'#f5e9cf',side:T.DoubleSide,toneMapped:true}));
   diffuser.rotation.x=Math.PI/2;diffuser.position.set(-.76,1.313,-.16);diffuser.userData.lamp=true;marker.add(diffuser);
   // Chair upholstery is bevelled fabric over existing thin steel supports.
   const cushion=slab(T,.60,.57,.056,.09,fabric);cushion.position.set(.18,.55,.92);marker.add(cushion);
   const back=slab(T,.60,.59,.050,.075,chairFabric);
   back.rotation.x=Math.PI/2;back.position.set(.18,.83,1.20);marker.add(back);
   const trim=new T.Mesh(new T.TorusGeometry(.026,.004,8,15),brass);
   trim.rotation.x=Math.PI/2;trim.position.set(.18,.84,1.235);marker.add(trim);
   marker.userData.haizHero=true;
   return {root:marker,detailCount:marker.children.length};
 }
 // A single hand-authored light-bounce atlas: floor illumination roughly obeys
 // the location of four windows. It is computed once on scene construction,
 // is not physically baked global illumination and does not require runtime GI.
 function bounceAtlas(T){
   const size=256,c=document.createElement('canvas');c.width=c.height=size;
   const ctx=c.getContext('2d');ctx.clearRect(0,0,size,size);
   const image=ctx.createImageData(size,size);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
     const xx=(x/size-.5)*14,zz=(y/size-.5)*11+.5;
     let strength=0;
     for(const windowX of [-4.5,-1.72,1.06,3.84]){
       const dx=xx-windowX,dz=zz+5,spread=Math.max(.6,dz*.53);
       const beam=Math.exp(-dx*dx/(spread*spread)) * Math.exp(-dz*.27);
       strength=Math.max(strength,beam);
     }
     const falloff=Math.max(0,Math.min(1,strength));
     const value=Math.pow(falloff,.8);
     const i=(y*size+x)*4;
     image.data[i]=255;image.data[i+1]=195;image.data[i+2]=133;image.data[i+3]=Math.floor(165*value);
   }
   ctx.putImageData(image,0,0);const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;
   return texture;
 }
 function buildBounce(T,scene){
   const material=new T.MeshBasicMaterial({
     map:bounceAtlas(T),color:'#ffd4a9',transparent:true,opacity:.22,
     blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false
   });
   const mesh=new T.Mesh(new T.PlaneGeometry(14,11),material);
   mesh.rotation.x=-Math.PI/2;mesh.position.set(0,.009,.5);
   mesh.renderOrder=1;mesh.receiveShadow=false;mesh.castShadow=false;scene.add(mesh);
   return {mesh,setIntensity(value){material.opacity=Math.max(0,Math.min(.35,value));}};
 }
 root.HAIZHeroAssets=Object.freeze({build,buildBounce});
})(typeof window!=='undefined'?window:globalThis);
