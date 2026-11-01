/* Photo-informed silhouettes; no surveyed branch geometry or historical reconstruction. */
(function(root){'use strict';
function decorate(g,b,pbr,quality){
 if(b.id==='lanshu')heritage(g,pbr,quality);
 if(b.id==='yanchi')shore(g,b,pbr);
}
function bark(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#716956';x.fillRect(0,0,256,256);let seed=37;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};for(let i=0;i<180;i++){const a=rnd()*256;x.strokeStyle=i%3?'rgba(29,29,22,.32)':'rgba(183,173,138,.28)';x.lineWidth=.5+rnd()*2;x.beginPath();x.moveTo(a,0);for(let y=0;y<=256;y+=8)x.lineTo(a+Math.sin(y*.045+i)*3,y);x.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,2);t.encoding=THREE.sRGBEncoding;return t;}
function heritage(g,pbr,quality){
 while(g.children.length)g.remove(g.children[0]);
 const map=bark(),mat=new THREE.MeshStandardMaterial({map,roughness:.98,color:'#b3aa8c',bumpMap:map,bumpScale:.055});
 function limb(points,r0,r1){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const segments=28,radial=12,frames=curve.computeFrenetFrames(segments,false),pos=[],uv=[],idx=[];
  for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPointAt(t),r=r0+(r1-r0)*t;for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2,q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);pos.push(q.x,q.y,q.z);uv.push(j/radial,t*curve.getLength()/3);if(i<segments&&j<radial){const n=i*(radial+1)+j;idx.push(n,n+radial+1,n+1,n+1,n+radial+1,n+radial+2);}}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;g.add(m);
 }
 limb([[0,.1,0],[.2,1.7,.15],[-.25,3.5,.2],[.4,5.8,.4],[1.1,9,.2]],1.02,.22);
 const tips=[[-8,5,-1],[7,6,-2],[-4,8,6],[5,9,5],[-3,11,-4],[2,13,0]];
 tips.forEach((p,i)=>{const h=2.5+i*.64;limb([[0,h,0],[p[0]*.36,h+.35,p[2]*.3],[p[0]*.72,p[1]-.4,p[2]*.8],p],.58-i*.055,.07);});
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2;limb([[0,.45,0],[Math.cos(a)*1,.25,Math.sin(a)],[Math.cos(a)*1.75,.09,Math.sin(a)*1.75]],.3,.035);}
 const count=quality==='low'?100:180,leaf=new THREE.MeshStandardMaterial({map:pbr.foliage,alphaTest:.46,side:THREE.DoubleSide,roughness:.95,color:'#b8c19b'});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leaf,count),o=new THREE.Object3D();
 let seed=121;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<count;i++){const tip=tips[i%tips.length],a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*3.8;o.position.set(tip[0]+Math.cos(a)*r,tip[1]+.8+rnd()*2,tip[2]+Math.sin(a)*r);o.rotation.set((rnd()-.5)*Math.PI,rnd()*Math.PI,rnd()*.5);o.scale.setScalar(1.9+rnd()*1.9);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
 mesh.castShadow=quality!=='low';mesh.receiveShadow=true;mesh.userData.foliage=true;mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:pbr.foliage,alphaTest:.46,side:THREE.DoubleSide});g.add(mesh);g.userData.memoryArt='photo-informed-low-fork';
}
function shore(g,b,pbr){
 const rockMat=new THREE.MeshStandardMaterial({color:'#73786a',roughness:.94,map:pbr.plaster?.color,normalMap:pbr.plaster?.normal,normalScale:new THREE.Vector2(.24,.24)});
 // The inherited footprint is retained. Stones lie inside the existing solid water boundary.
 const geo=new THREE.SphereGeometry(1,12,8),n=72,rocks=new THREE.InstancedMesh(geo,rockMat,n),o=new THREE.Object3D();
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=.94+.035*Math.sin(i*2.7);o.position.set(Math.cos(a)*(b.size[0]/2-.45)*r,.16+(.5+.5*Math.sin(i*3.1))*.18,Math.sin(a)*(b.size[2]/2-.35)*r);o.rotation.set(.15*Math.sin(i),i*.63,.13*Math.cos(i));o.scale.set(.45+.3*(1+Math.sin(i*1.7)),.18+.15*(1+Math.cos(i*2.1)),.55+.25*Math.sin(i));o.updateMatrix();rocks.setMatrixAt(i,o.matrix);}rocks.castShadow=rocks.receiveShadow=true;g.add(rocks);g.userData.memoryArt='layered-shore';
}
root.MemoryArt={decorate};
})(window);
