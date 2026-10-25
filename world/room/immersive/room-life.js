/* HAIZ Inner World — lived-in interior details.
 * Original geometry and shaders. Metres. THREE r128 / WebGL1 compatible.
 * Static fabric is GPU-instanced; rain is a single instanced shader draw,
 * never individual particle meshes or a full-screen postprocess.
 */
(function(root){
'use strict';
function build(T,scene,quality){
  const linen=new T.MeshStandardMaterial({
    color:'#beb6a4',roughness:.98,metalness:0,side:T.DoubleSide
  });
  const rodMat=new T.MeshStandardMaterial({color:'#536266',roughness:.48,metalness:.32});
  const seamMat=new T.MeshStandardMaterial({color:'#727871',roughness:.85,metalness:0});
  const bodyMat=new T.MeshStandardMaterial({color:'#d1cbc0',roughness:.94});
  // Genuine sinusoidal fabric folds on a constrained hanging curtain surface.
  // Bottom gathers open; top pleats are 4x tighter. UV normals are generated once.
  const cloth=new T.PlaneGeometry(.45,1.82,26,24);
  const attr=cloth.attributes.position;
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),y=attr.getY(i);
    const topness=(y+.91)/1.82;
    const gathered=x*(.92-.23*topness);
    attr.setXYZ(i,gathered,y,Math.sin((x/.45+.5)*Math.PI*8)*(.035+.010*(1-topness)));
  }
  cloth.computeVertexNormals();
  const curtains=new T.InstancedMesh(cloth,linen,8);
  curtains.name='HAIZ original folded classroom curtains (instanced)';
  curtains.castShadow=false;curtains.receiveShadow=true;
  const rods=new T.InstancedMesh(new T.CylinderGeometry(.015,.015,2.45,9),rodMat,4);
  rods.name='HAIZ curtain rails';rods.castShadow=false;
  const dummy=new T.Object3D(),windows=[-4.5,-1.72,1.06,3.84];
  let count=0;
  for(let i=0;i<windows.length;i++){
    const x=windows[i];
    for(let side of [-1,1]){
      dummy.position.set(x+side*1.00,2.18,-4.74);
      dummy.rotation.set(0,side===1?Math.PI:0,0);
      dummy.scale.set(side===1?1:1,1,1);
      dummy.updateMatrix();curtains.setMatrixAt(count++,dummy.matrix);
    }
    dummy.position.set(x,3.17,-4.78);
    dummy.rotation.set(0,0,Math.PI/2);dummy.scale.set(1,1,1);
    dummy.updateMatrix();rods.setMatrixAt(i,dummy.matrix);
  }
  curtains.instanceMatrix.needsUpdate=true;rods.instanceMatrix.needsUpdate=true;
  scene.add(curtains,rods);
  // Static classroom life: practical wall AC, visible outlet, clock.
  const box=(w,h,d,x,y,z,mat,group=scene)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  const ac=new T.Group();ac.name='HAIZ air-conditioning and vents';scene.add(ac);
  box(1.25,.39,.27,5.54,3.45,5.65,bodyMat,ac);
  box(1.05,.034,.289,5.54,3.29,5.49,seamMat,ac);
  for(let j=0;j<8;j++)box(.108,.015,.30,5.06+j*.137,3.29,5.47,seamMat,ac);
  box(.20,.16,.024,4.99,3.49,5.49,rodMat,ac);
  // A small understated mechanical clock, not a billboard.
  const clock=new T.Group();clock.name='HAIZ wall clock';clock.position.set(-5.68,2.75,5.77);scene.add(clock);
  const dial=new T.Mesh(new T.CylinderGeometry(.23,.23,.028,36),bodyMat);dial.rotation.x=Math.PI/2;clock.add(dial);
  const ring=new T.Mesh(new T.TorusGeometry(.23,.011,6,36),rodMat);ring.position.z=-.026;clock.add(ring);
  const face=box(.012,.12,.008,0,.042,-.038,rodMat,clock);face.rotation.z=.55;
  const hand=box(.012,.09,.008,.032,-.012,-.039,rodMat,clock);hand.rotation.z=-1.2;
  // Glass rain streaks: a single low-overdraw instanced shader. No screen
  // resolution based buffers, frame textures or per-window drawn particles.
  const rainMaterial=new T.ShaderMaterial({
    uniforms:{uTime:{value:0},uWet:{value:0}},
    transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:`
      varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime,uWet;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        float band=floor(vUv.x*54.);
        float seed=hash(band+7.1);
        float pos=.2+seed*.6;
        float width=abs(fract(vUv.x*54.)-pos);
        float line=1.-smoothstep(.010,.060,width);
        float speed=.08+seed*.12;
        float travel=fract(vUv.y*2.4+uTime*speed+hash(band+59.));
        float tail=pow(1.-travel,3.2);
        float alpha=uWet*line*tail*(.12+.20*hash(band+13.));
        gl_FragColor=vec4(.70,.82,.84,alpha);
      }
    `
  });
  const rainGlass=new T.InstancedMesh(new T.PlaneGeometry(2.28,2.13),rainMaterial,4);
  rainGlass.name='HAIZ rain on classroom glazing';
  rainGlass.frustumCulled=false;rainGlass.renderOrder=3;
  for(let i=0;i<windows.length;i++){
    dummy.position.set(windows[i],2.05,-4.975);
    dummy.rotation.set(0,0,0);
    dummy.scale.set(1,1,1);dummy.updateMatrix();
    rainGlass.setMatrixAt(i,dummy.matrix);
  }
  rainGlass.instanceMatrix.needsUpdate=true;
  rainGlass.visible=false;scene.add(rainGlass);
  // A real geometry louver at each pane adds shadowed depth without alpha.
  const louvers=new T.InstancedMesh(new T.BoxGeometry(.82,.018,.045),seamMat,8);
  let n=0;
  for(let i=0;i<4;i++)for(let side of [-.51,.51]){
    dummy.position.set(windows[i]+side,2.53,-4.80);dummy.rotation.set(0,0,0);
    dummy.updateMatrix();louvers.setMatrixAt(n++,dummy.matrix);
  }
  louvers.instanceMatrix.needsUpdate=true;scene.add(louvers);
  function update(climate,rain,time,tier){
    const strength=(climate==='monsoon'?rain:climate==='sunbreak'?rain*.32:0);
    rainMaterial.uniforms.uWet.value=Math.min(.85,Math.max(0,strength));
    rainMaterial.uniforms.uTime.value=time*.001;
    rainGlass.visible=tier!=='low'&&rainMaterial.uniforms.uWet.value>.01;
    curtains.visible=true;
  }
  return {
    update,
    counts:{curtains:8,rods:4,rainPanes:4,louvers:8},
    areEssentialVisible:()=>curtains.visible&&rods.visible&&ac.visible&&clock.visible,
    isRainVisible:()=>rainGlass.visible,
    shaderGpuBatches:4
  };
}
root.HAIZRoomLife=Object.freeze({build});
})(typeof window!=='undefined'?window:globalThis);
