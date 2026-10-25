/* HAIZ INNER WORLD · original, locally rendered classroom concept. Three.js r128, no remote requests or analytics. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('experience');
  const fail = message => {
    $('fallback').hidden = false;
    $('loading').textContent = message || '三维图形不可用';
  };
  if (!window.THREE || !window.WebGLRenderingContext) {
    fail('此设备没有可用的 WebGL 环境');
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 1;
  const lowMemory = (navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 2;
  const specs = {low:{dpr:1,shadow:0,rain:48,foliage:75},balanced:{dpr:1.35,shadow:1024,rain:92,foliage:140},high:{dpr:1.8,shadow:1536,rain:156,foliage:240}};
  const levels = ['low','balanced','high'];
  let quality = reduced || lowMemory ? 'low' : touch ? 'balanced' : 'high';
  let qualityCap = levels.indexOf(quality), manualQuality=false, qualityChangedAt=0;
  const presets = {
    sunbreak:{sky:'#465872',horizon:'#f5c8a2',fog:'#a4abae',fogDensity:.012,sun:'#ffce96',sunPower:1.75,hemi:.52,fill:'#ffddad',lamp:.55,wet:.95,cloud:.74,rain:.03,label:'雨隙金光',desc:'雨刚停，低角度的光正从云间穿过。'},
    monsoon:{sky:'#344758',horizon:'#8fa4ae',fog:'#87989b',fogDensity:.021,sun:'#c7dae7',sunPower:.60,hemi:.55,fill:'#b9d1df',lamp:1.15,wet:1,cloud:.96,rain:.85,label:'海岛骤雨',desc:'近处的窗棂清晰，远处的老楼隐进海岛雨幕。'},
    morning:{sky:'#87aab7',horizon:'#f0e1c7',fog:'#bacbca',fogDensity:.008,sun:'#fff0cf',sunPower:2.10,hemi:.60,fill:'#f5e5cc',lamp:.26,wet:.12,cloud:.25,rain:0,label:'早课晨光',desc:'光沿着书页和桌角，慢慢移动。'}
  };
  let climate='sunbreak',entered=false,focused=false,last=0,fpsFrames=0,fpsTime=0,slowSamples=0,goodSamples=0,frame=0;
  let renderer;
  try {
    renderer=new THREE.WebGLRenderer({antialias:quality!=='low',alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
  } catch (err) {
    fail('WebGL 创建失败，仍可使用普通专注书桌');
    return;
  }
  const viewport = $('viewport');
  viewport.appendChild(renderer.domElement);
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,specs[quality].dpr));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.79;
  renderer.shadowMap.enabled=!!specs[quality].shadow;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog=new THREE.FogExp2(presets.sunbreak.fog,presets.sunbreak.fogDensity);
  const camera=new THREE.PerspectiveCamera(touch?59:65,innerWidth/innerHeight,.08,180);
  camera.position.set(4.55,1.67,3.95);
  let yaw=.68,pitch=touch?-.20:-.035;
  camera.rotation.order='YXZ';
  camera.rotation.set(pitch,yaw,0,'YXZ');
  const sun=new THREE.DirectionalLight(presets.sunbreak.sun,presets.sunbreak.sunPower);
  sun.position.set(13,19,-12);sun.target.position.set(-1,0,0);sun.castShadow=quality!=='low';
  sun.shadow.mapSize.set(specs[quality].shadow||512,specs[quality].shadow||512);
  sun.shadow.camera.left=-29;sun.shadow.camera.right=29;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
  sun.shadow.camera.near=.3;sun.shadow.camera.far=100;sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;
  scene.add(sun,sun.target);
  const hemi = new THREE.HemisphereLight('#cedee1','#5d5143',presets.sunbreak.hemi);scene.add(hemi);
  const ambient=new THREE.AmbientLight('#cfddd3',.085);scene.add(ambient);
  const windowFill=new THREE.PointLight('#ffddad',.27,16,2);windowFill.position.set(-1.5,2.7,-3.65);scene.add(windowFill);
  const lampLight=new THREE.PointLight('#ffc88a',.55,5,2);lampLight.position.set(-1.18,2.16,-2.38);scene.add(lampLight);
  let lampOn=true;

  const material = (color,roughness=.76,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const mats={
    wall:material('#b6b5a9',.96),plaster:material('#c7c1b5',.92),wood:material('#a17853',.75),frame:material('#2f4145',.47,.42),
    terrazzo:material('#8f9690',.79),ceiling:material('#c5c2b9',1),tile:material('#5a857f',.38),brick:material('#a76455',.83),
    leaf:material('#506d5b',.92),trunk:material('#4f453b',.95),warm:material('#e3b682',.73),
    cloth:material('#697f7b',.94),paper:material('#e5ddc9',.96),blackboard:material('#354c48',.98),
    glass:new THREE.MeshPhysicalMaterial({color:'#d7e8e9',roughness:.055,metalness:0,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})
  };
  const loader=new THREE.TextureLoader();
  const readTexture=(path,repeatX,repeatY,encoding=false)=>{
    const tex=loader.load(path,()=>{tex.needsUpdate=true;},undefined,()=>{});
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeatX,repeatY);tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(encoding)tex.encoding=THREE.sRGBEncoding;
    return tex;
  };
  const textures='../../../assets/walk/textures/';
  mats.wood.map=readTexture(textures+'wood-color.jpg',5,4,true);
  mats.wood.normalMap=readTexture(textures+'wood-normal.jpg',5,4);
  mats.wood.roughnessMap=readTexture(textures+'wood-rough.jpg',5,4);
  mats.terrazzo.map=readTexture(textures+'terrazzo-color.jpg',4,5,true);
  mats.terrazzo.normalMap=readTexture(textures+'terrazzo-normal.jpg',4,5);
  mats.terrazzo.roughnessMap=readTexture(textures+'terrazzo-rough.jpg',4,5);
  mats.brick.map=mats.wall.map;mats.brick.normalMap=mats.wall.normalMap;mats.brick.roughnessMap=mats.wall.roughnessMap;
  mats.tile.map=readTexture(textures+'jade-glaze-generated.webp',2,2,true);
  // An original HDR already bundled with the campus. Asset is local and optional.
  if(THREE.RGBELoader){
    new THREE.RGBELoader().load(textures+'campus-light.hdr', hdr=>{
      try{
        const pmrem=new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        scene.environment=pmrem.fromEquirectangular(hdr).texture;
        pmrem.dispose();hdr.dispose();
      }catch(error){console.warn('Local environment reflection unavailable');}
    },undefined,()=>{});
  }
  mats.wall.map=readTexture(textures+'plaster-color.jpg',3,2,true);
  mats.wall.normalMap=readTexture(textures+'plaster-normal.jpg',3,2);
  mats.wall.roughnessMap=readTexture(textures+'plaster-rough.jpg',3,2);
  const box=(w,h,d,x,y,z,mat,parent=scene,shadow=true)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const sphere=(r,x,y,z,mat,parent=scene)=>{
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  // 1 unit = 1 meter. A believable 14 × 11 m teaching room, NOT a measured school interior.
  const floor=box(14,.23,11,0,-.13,.5,mats.terrazzo);floor.castShadow=false;
  const authoredBounce=window.HAIZHeroAssets?.buildBounce(THREE,scene)||null;
  box(14,.17,11,0,4.2,.5,mats.ceiling,scene,false);
  box(.22,4.2,11,-7,2.1,.5,mats.wall);
  box(.22,4.2,11,7,2.1,.5,mats.wall);
  box(14,4.2,.25,0,2.1,6,mats.plaster);
  // Window wall: continuous lintel and parapet, alternating solid piers and real glazed openings.
  box(14,1.06,.28,0,3.67,-5,mats.wall);
  box(14,.85,.28,0,.425,-5,mats.wall);
  for(const x of [-5.9,-3.12,-.34,2.44,5.22]){
    box(.40,2.34,.34,x,2.06,-5,mats.plaster);
  }
  for(const x of [-4.5,-1.72,1.06,3.84]){
    box(2.35,.045,.22,x,3.17,-4.88,mats.frame);
    box(2.35,.045,.22,x,.93,-4.88,mats.frame);
    box(.06,2.2,.21,x,2.05,-4.85,mats.frame);
    box(2.38,2.23,.018,x,2.05,-5.02,mats.glass,scene,false);
    // Rain streaks can catch some environmental light without extra reflection passes.
  }
  // Extremely cheap stained-air sunlight: one alpha texture reused across three
  // planes. Only visible when a real low sun shines through a window, no postprocess.
  const rayCanvas=document.createElement('canvas');rayCanvas.width=96;rayCanvas.height=256;
  const rayContext=rayCanvas.getContext('2d');
  const rayHorizontal=rayContext.createLinearGradient(0,0,96,0);
  rayHorizontal.addColorStop(0,'rgba(255,239,206,0)');rayHorizontal.addColorStop(.5,'rgba(255,239,206,.55)');rayHorizontal.addColorStop(1,'rgba(255,239,206,0)');
  rayContext.fillStyle=rayHorizontal;rayContext.fillRect(0,0,96,256);
  rayContext.globalCompositeOperation='destination-in';
  const rayVertical=rayContext.createLinearGradient(0,0,0,256);
  rayVertical.addColorStop(0,'rgba(0,0,0,0)');rayVertical.addColorStop(.35,'rgba(0,0,0,.32)');rayVertical.addColorStop(.75,'rgba(0,0,0,.72)');rayVertical.addColorStop(1,'rgba(0,0,0,0)');
  rayContext.fillStyle=rayVertical;rayContext.fillRect(0,0,96,256);
  const rayTexture=new THREE.CanvasTexture(rayCanvas);
  const shafts=[];
  for(const x of [-4.45,-1.67,1.11]){
    const beam=new THREE.Mesh(new THREE.PlaneGeometry(1.9,5.4),new THREE.MeshBasicMaterial({
      color:'#ffdbad',map:rayTexture,transparent:true,opacity:.1,side:THREE.DoubleSide,
      depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
    }));
    beam.position.set(x+.35,1.85,-2.65);
    beam.rotation.set(-.60,-.20,-.09);
    beam.renderOrder=8;beam.castShadow=false;beam.receiveShadow=false;
    scene.add(beam);shafts.push(beam);
  }
  box(14,.12,.43,0,.88,-4.7,mats.terrazzo);
  for(let i=0;i<9;i++){
    const z=-4.3+i*1.27;
    box(14,.05,.04,0,.065,z,mats.warm,scene,false);
  }
  // Ceiling coffers, repeated without separate expensive dynamic lights.
  for(const x of [-6.1,-2.1,1.9,5.9])box(.12,.19,11,x,4.01,.5,mats.plaster);
  const areaLampMat=new THREE.MeshBasicMaterial({color:'#d9cbb6'});
  for(const x of [-4,0,4])for(const z of [-2.8,1.4]){
    box(1.4,.035,.21,x,4.005,z,areaLampMat,scene,false);
    box(1.4,.016,.014,x,3.977,z+.11,mats.frame,scene,false);
  }
  // Real-world model silhouettes, depth and broad reflection on architecture outside.
  box(74,.13,110,0,-.28,-53,material('#8eaaa5',.86),scene,false);
  const exterior=new THREE.Group();scene.add(exterior);
  for(let i=0;i<5;i++){
    const x=-33+i*17,depth=-48-(i%2)*18;
    box(11,6.3,6.2,x,3,depth,mats.brick,exterior);
    box(12.5,.42,7.4,x,6.45,depth,mats.tile,exterior);
    // Shallow projecting eaves and a sheltered hall make the skyline read as architecture.
    box(13.1,.14,7.75,x,6.17,depth,mats.frame,exterior);
    box(12.8,.11,7.65,x,6.72,depth,mats.tile,exterior);
    for(const xx of [-4.65,4.65]){
      box(.15,5.25,.15,x+xx,3.28,depth+3.50,mats.plaster,exterior);
    }
    for(let k=0;k<5;k++){
      const wx=x-4.2+k*2.05;
      box(1.13,1.9,.07,wx,3,depth+3.15,mats.frame,exterior,false);
      box(.93,1.6,.08,wx,3,depth+3.21,material('#728e94',.2,.09),exterior,false);
    }
    box(11.7,.35,.8,x,1.0,depth+3.2,mats.terrazzo,exterior);
  }
  // Crossed alpha-cutout foliage clusters share the locally generated campus
  // leaf atlas. Three planes give volume without solid toy-sphere silhouettes.
  function foliageGeometry(){
    const points=[],uvs=[],indices=[];
    for(let layer=0;layer<3;layer++){
      const angle=layer*Math.PI/3,cs=Math.cos(angle),sn=Math.sin(angle),base=points.length/3;
      for(const [u,v] of [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){
        points.push(cs*u,v,sn*u);uvs.push(u+.5,v+.5);
      }
      indices.push(base,base+1,base+2,base+2,base+1,base+3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return geometry;
  }
  const leafGeo=foliageGeometry();
  const leafAtlas=readTexture(textures+'terminalia-leaves.webp',1,1,true);
  leafAtlas.wrapS=leafAtlas.wrapT=THREE.ClampToEdgeWrapping;
  const naturalLeafMaterial=new THREE.MeshStandardMaterial({
    map:leafAtlas,color:'#c4d5af',roughness:.93,metalness:0,
    alphaTest:.45,side:THREE.DoubleSide,depthWrite:true
  });
  const branchMats=[material('#6e5945',.91),material('#4a4a3b',.88)];
  const leaves=new THREE.InstancedMesh(leafGeo,naturalLeafMaterial,specs.high.foliage);
  leaves.castShadow=quality==='high';leaves.receiveShadow=false;scene.add(leaves);
  const dummy=new THREE.Object3D();let leafCount=0;const palette=['#48685a','#57725f','#6b8469','#3f5c50','#759276','#526e5f'];
  const leafColors=palette.map(c=>new THREE.Color(c));
  let seed=26491;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const [idx,cx,cz] of [[0,-8,-11],[1,-15,-16],[2,11,-17],[3,22,-11],[4,-27,-10]]){
    const height=6.5+rnd()*5;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.14,.28,height,7),branchMats[idx%2]);
    trunk.position.set(cx,height/2-.1,cz);trunk.castShadow=true;scene.add(trunk);
    for(let j=0;j<48 && leafCount<specs.high.foliage;j++){
      dummy.position.set(cx+(rnd()-.5)*6,3.9+rnd()*height*.7,cz+(rnd()-.5)*4.8);
      dummy.scale.set(.8+rnd()*1.4,.48+rnd()*.94,.75+rnd()*1.2);dummy.rotation.set(rnd()*1.2,rnd()*6.28,rnd()*.7);dummy.updateMatrix();
      leaves.setMatrixAt(leafCount,dummy.matrix);leaves.setColorAt(leafCount,leafColors[Math.floor(rnd()*leafColors.length)]);leafCount++;
    }
  }
  leaves.count=leafCount;leaves.instanceMatrix.needsUpdate=true;if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;
  // A naturally cluttered desk: books, paper, warm ceramic, lamp and chair. Everything is original geometry.
  const desks=[];const legMaterial=material('#414a47',.48,.24);
  // Regrade the ORIGINAL locally shipped timber photo into natural warm walnut:
  // preserve every real grain variation instead of painting synthetic stripes.
  // The texture is recolored once on image load, never in the render loop.
  const deskTop=material('#e5d8c8',.79);
  const woodAlbedo=loader.load(textures+'wood-color.jpg',loaded=>{
    const image=loaded.image;if(!image)return;
    const tile=document.createElement('canvas');tile.width=image.width;tile.height=image.height;
    const context=tile.getContext('2d',{willReadFrequently:true});if(!context)return;
    context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,tile.width,tile.height),a=pixels.data;
    for(let k=0;k<a.length;k+=4){
      const luminance=a[k]*.26+a[k+1]*.62+a[k+2]*.12;
      const detail=(luminance-115)*.58;
      a[k]=Math.max(0,Math.min(255,153+detail));
      a[k+1]=Math.max(0,Math.min(255,117+detail*.83));
      a[k+2]=Math.max(0,Math.min(255,85+detail*.72));
    }
    context.putImageData(pixels,0,0);loaded.image=tile;loaded.needsUpdate=true;
  },undefined,()=>{});
  woodAlbedo.encoding=THREE.sRGBEncoding;woodAlbedo.wrapS=woodAlbedo.wrapT=THREE.RepeatWrapping;
  woodAlbedo.repeat.set(1.8,.9);woodAlbedo.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  deskTop.map=woodAlbedo;
  deskTop.normalMap=readTexture(textures+'wood-normal.jpg',1.8,.9);
  const chairMat=material('#45645c',.79);
  const ink=material('#455961',.38);const gold=material('#bc9763',.52,.45);
  let heroAsset=null;
  function buildDesk(x,z,featured=false) {
    const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
    // The hero kit provides its OWN legs, chair and braces. Do not draw the
    // ordinary class furniture again beneath it (the old model overlapped).
    if(!featured || !window.HAIZHeroAssets){
      box(1.76,.07,.78,0,.79,0,deskTop,g);
      for(const dx of [-.79,.79])for(const dz of [-.3,.3])box(.055,.72,.055,dx,.38,dz,legMaterial,g);
      box(1.55,.09,.04,0,.49,-.29,legMaterial,g);
    }
    // Economical base furniture stays instanced; the hero station adds fine geometry.
    if(!featured || !window.HAIZHeroAssets){
      box(.33,.025,.37,-.43,.85,-.10,mats.paper,g);
      for(let b=0;b<4;b++){
        const bm=material(['#7e8879','#9c785d','#657e8b','#b28f68'][b],.87);
        box(.095,.023,.28,-.44+b*.10,.89,-.12,bm,g,false);
      }
    }
    const laptop=material('#485056',.42,.30);
    if(featured && window.HAIZHeroAssets){
      heroAsset=window.HAIZHeroAssets.build(THREE,g,{wood:deskTop,metal:legMaterial,chairFabric:chairMat,paper:mats.paper});
    } else if(featured){
      box(.38,.026,.29,.24,.845,.04,laptop,g);
      const screen=box(.38,.24,.019,.24,.99,-.102,laptop,g);
      screen.rotation.x=-.14;
      box(.3,.18,.008,.24,1,-.115,material('#9fb0a5',.78),g,false);
      sphere(.12,-.63,.92,.16,mats.warm,g);
      box(.18,.03,.21,-.62,.842,.16,mats.paper,g);
      const lampPole=box(.028,.79,.028,-.72,1.23,-.16,legMaterial,g);
      lampPole.rotation.z=-.20;
      box(.46,.09,.30,-.86,1.66,-.13,gold,g);
      const shade=box(.36,.02,.22,-.86,1.60,-.13,material('#f1e8cd',.8),g,false);
      shade.userData.lamp=true;
    } else{
      box(.44,.02,.32,.30,.84,-.10,mats.paper,g,false);
      box(.14,.02,.30,-.57,.84,.11,ink,g,false);
    }
    // Chair beside table, with thin metal structure instead of a solid block.
    if(!featured || !window.HAIZHeroAssets){
      const chair=new THREE.Group();chair.position.set(.18,0,.92);g.add(chair);
      box(.66,.08,.61,0,.49,0,chairMat,chair);
      box(.66,.64,.065,0,.82,.275,chairMat,chair);
      for(const dx of [-.27,.27])for(const dz of [-.22,.22])box(.042,.47,.042,dx,.24,dz,legMaterial,chair);
    }
    const footprint={x,z,w:.98,d:1.03};desks.push(footprint);return g;
  }
  for(const x of [-4.25,-1.55,1.15,3.85])for(const z of [-2.95,-.48,2.00]){
    buildDesk(x,z,x===-1.55&&z===-2.95);
  }
  // Blackboard with subtle actual writing, rasterized locally once.
  const sign=document.createElement('canvas');sign.width=1024;sign.height=400;const ctx=sign.getContext('2d');
  ctx.fillStyle='#29413e';ctx.fillRect(0,0,1024,400);
  ctx.fillStyle='#dfddd0';ctx.textAlign='center';ctx.font='400 60px serif';ctx.fillText('此间有光',512,175);
  ctx.font='24px sans-serif';ctx.letterSpacing='5px';ctx.fillText('THE ROOM WHERE THOUGHTS BEGIN',512,244);
  const signTexture=new THREE.CanvasTexture(sign);signTexture.encoding=THREE.sRGBEncoding;
  box(6.2,2.13,.12,0,2.3,5.85,new THREE.MeshStandardMaterial({map:signTexture,color:'#ffffff',roughness:.94}));
  box(6.45,.07,.19,0,1.2,5.69,mats.warm);
  for(const x of [-6.35,6.35])box(.11,4.3,.12,x,2.1,.4,mats.frame);
  // Atmosphere: sky responds to light preset using one cheap shader and a depth fog.
  const skyUniforms={top:{value:new THREE.Color(presets.sunbreak.sky)},horizon:{value:new THREE.Color(presets.sunbreak.horizon)},cloud:{value:presets.sunbreak.cloud},light:{value:new THREE.Vector3(.4,.14,-.9)},brightness:{value:1}};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150,32,14),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyUniforms,
    vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 top,horizon,light;uniform float cloud,brightness;varying vec3 vD;
    float hash(vec2 p){return fract(sin(dot(p,vec2(128.4,312.9)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec3 d=normalize(vD);float h=max(0.,d.y);
    vec3 base=mix(horizon,top,smoothstep(-.06,.74,d.y));
    vec2 uv=d.xz/max(.25,d.y+.30)*2.8;
    float mass=noise(uv*.43)*.61+noise(uv*.87+5.7)*.27+noise(uv*1.84+7.3)*.12;
    float cover=smoothstep(mix(.71,.31,cloud),mix(.87,.51,cloud),mass)*smoothstep(-.05,.14,d.y);
    float glow=pow(max(dot(d,normalize(light)),0.),13.);
    vec3 shadow=mix(base*.46,base*.76,clamp(mass,0.,1.));
    vec3 lit=mix(vec3(.79,.80,.81),horizon, .45)*(.9+glow*.5);
    vec3 col=mix(base,mix(shadow,lit,smoothstep(.35,.75,mass)),cover*.86);
    col+=horizon*glow*.10;gl_FragColor=vec4(col*brightness,1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    }`
  }));
  sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
  const rainMax=specs.high.rain,rainPositions=new Float32Array(rainMax*6),drops=[];
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3).setUsage(THREE.DynamicDrawUsage));rainGeo.setDrawRange(0,0);
  const rainMat=new THREE.LineBasicMaterial({color:'#bbd3d8',transparent:true,opacity:.34,depthWrite:false});
  const rainMesh=new THREE.LineSegments(rainGeo,rainMat);rainMesh.frustumCulled=false;scene.add(rainMesh);
  for(let i=0;i<rainMax;i++)drops.push({x:(rnd()-.5)*23,y:rnd()*10,z:-7-rnd()*12,speed:5+rnd()*6,length:.15+rnd()*.40});
  const climateColors={fog:new THREE.Color(presets.sunbreak.fog),sun:new THREE.Color(presets.sunbreak.sun),fill:new THREE.Color(presets.sunbreak.fill)};
  let weatherCurrent={rain:presets.sunbreak.rain,wet:presets.sunbreak.wet,cloud:presets.sunbreak.cloud,fogDensity:presets.sunbreak.fogDensity};
  function selectClimate(name){
    if(!presets[name])return;climate=name;document.body.dataset.climate=name;
    for(const button of document.querySelectorAll('[data-weather]')){
      const yes=button.dataset.weather===name;button.classList.toggle('active',yes);button.setAttribute('aria-pressed',String(yes));
    }
    $('atmosphereNote').textContent=presets[name].desc;
  }
  function applyWeather(dt,elapsed){
    const p=presets[climate],alpha=reduced?1:1-Math.exp(-dt*1.2);
    skyUniforms.top.value.lerp(new THREE.Color(p.sky),alpha);skyUniforms.horizon.value.lerp(new THREE.Color(p.horizon),alpha);
    skyUniforms.cloud.value+=(p.cloud-skyUniforms.cloud.value)*alpha;
    scene.fog.color.lerp(new THREE.Color(p.fog),alpha);scene.fog.density+=(p.fogDensity-scene.fog.density)*alpha;
    sun.color.lerp(new THREE.Color(p.sun),alpha);sun.intensity+=(p.sunPower-sun.intensity)*alpha;hemi.intensity+=(p.hemi-hemi.intensity)*alpha;
    windowFill.color.lerp(new THREE.Color(p.fill),alpha);lampLight.intensity+=((lampOn?p.lamp:0)-lampLight.intensity)*alpha;
    weatherCurrent.rain+=(p.rain-weatherCurrent.rain)*alpha;weatherCurrent.cloud+=(p.cloud-weatherCurrent.cloud)*alpha;weatherCurrent.wet+=(p.wet-weatherCurrent.wet)*alpha;
    if(authoredBounce){
      // The atlas represents static diffuse bounce, not a costly global-illumination pass.
      const target=climate==='sunbreak'?.25:climate==='morning'?.12:.025;
      authoredBounce.setIntensity(authoredBounce.mesh.material.opacity+(target-authoredBounce.mesh.material.opacity)*alpha);
    }
    const rays=quality==='low'||reduced?0:(climate==='sunbreak'?.12:climate==='morning'?.06:0);
    for(const beam of shafts)beam.material.opacity+=(rays-beam.material.opacity)*alpha;
    mats.tile.roughness=.5-weatherCurrent.wet*.23;mats.terrazzo.roughness=.76-weatherCurrent.wet*.12;
    rainMesh.visible=weatherCurrent.rain>.06&&!reduced;
    if(!rainMesh.visible){rainGeo.setDrawRange(0,0);return;}
    const count=Math.min(specs[quality].rain,Math.floor(specs[quality].rain*weatherCurrent.rain)),delta=Math.min(.05,dt);
    for(let i=0;i<count;i++){
      const drop=drops[i];drop.y-=drop.speed*delta;if(drop.y<0){drop.y=9+rnd()*3;drop.x=(rnd()-.5)*23;}
      const k=i*6;rainPositions[k]=drop.x;rainPositions[k+1]=drop.y;rainPositions[k+2]=drop.z;
      rainPositions[k+3]=drop.x-.06;rainPositions[k+4]=drop.y-drop.length;rainPositions[k+5]=drop.z;
    }
    rainGeo.attributes.position.needsUpdate=true;rainGeo.setDrawRange(0,count*2);
  }
  // Meshes that share static PBR materials and box topology are batched only
  // after the authored room is assembled. Furniture contacts are one transparent
  // instanced draw call even when mobile dynamic shadows are disabled.
  const roomContacts=window.HAIZRoomGeometry?.addContactShadows(scene,THREE,desks)||null;
  const geometryStats=window.HAIZRoomGeometry?.batchBoxes(scene,THREE,2)||{instances:0,batches:0,drawCallsSaved:0};
  if(heroAsset?.detailMeshes && quality==='low')for(const detail of heroAsset.detailMeshes)detail.visible=false;
  const collision=(x,z)=>{
    if(x < -6.48 || x>6.48 || z< -4.62 || z>5.48)return true;
    return desks.some(d=>Math.abs(x-d.x)<d.w+.25&&Math.abs(z-d.z)<d.d+.13);
  };
  const pressed=new Set();let moving={x:0,y:0},lookId=null,lastTouch=null;
  function begin(){
    if(entered)return;entered=true;root.classList.add('entered');$('exploreUI').hidden=false;$('loading').hidden=true;
    if(touch){$('touchControls').hidden=false;}else $('walkHint').textContent='W A S D 行走 · 点击画面锁定鼠标 · Esc 释放后可操作书桌按钮';
  }
  $('explore').addEventListener('click',begin);
  for(const btn of document.querySelectorAll('[data-weather]'))btn.addEventListener('click',()=>selectClimate(btn.dataset.weather));
  const updateQualityText=()=>{$('qualityText').textContent=({low:'轻量',balanced:'均衡',high:'精细'})[quality]+' · '+(manualQuality?'手动':'自适应');};
  function setQuality(next){
    if(!specs[next]||quality===next)return;
    quality=next;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,specs[quality].dpr));
    sun.castShadow=quality!=='low';renderer.shadowMap.enabled=quality!=='low';
    if(quality!=='low'){
      sun.shadow.mapSize.set(specs[quality].shadow,specs[quality].shadow);
      sun.shadow.map?.dispose();sun.shadow.map=null;
    }
    leaves.count=Math.min(leafCount,specs[quality].foliage);
    leaves.castShadow=quality==='high';
    if(heroAsset?.detailMeshes)for(const detail of heroAsset.detailMeshes)detail.visible=quality!=='low';
    updateQualityText();qualityChangedAt=performance.now();
    resize();
  }
  $('qualityToggle').addEventListener('click',()=>{
    manualQuality=true;qualityCap=2;
    setQuality(levels[(levels.indexOf(quality)+1)%3]);updateQualityText();
  });
  updateQualityText();
  const bodyKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  window.addEventListener('keydown',e=>{
    if(bodyKeys.has(e.code))e.preventDefault();
    pressed.add(e.code);
    if(e.code==='Escape'&&document.pointerLockElement)document.exitPointerLock();
    if(/^Digit[123]$/.test(e.code))selectClimate(['sunbreak','monsoon','morning'][Number(e.code.slice(-1))-1]);
  });
  window.addEventListener('keyup',e=>pressed.delete(e.code));
  window.addEventListener('blur',()=>{pressed.clear();moving={x:0,y:0};});
  const canvas=renderer.domElement;
  canvas.addEventListener('click',e=>{
    if(!entered)return;
    if(!touch && document.pointerLockElement!==canvas)canvas.requestPointerLock?.();
    const rect=canvas.getBoundingClientRect(),point=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(point,camera);
    const hits=ray.intersectObjects(scene.children,true);
    if(hits.some(hit=>hit.object.userData.lamp)){lampOn=!lampOn;$('walkHint').textContent=lampOn?'灯亮了 · 就从这一页开始':'灯关了 · 雨还在窗外';}
  });
  document.addEventListener('mousemove',e=>{
    if(!entered||document.pointerLockElement!==canvas)return;
    yaw-=e.movementX*.0022;pitch=Math.max(-1.20,Math.min(1.10,pitch-e.movementY*.0022));
  });
  canvas.addEventListener('pointerdown',e=>{
    if(!touch||e.clientX<innerWidth*.3)return;
    lookId=e.pointerId;lastTouch={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==lookId||!lastTouch)return;
    yaw-=(e.clientX-lastTouch.x)*.0045;pitch=Math.max(-1.10,Math.min(1.10,pitch-(e.clientY-lastTouch.y)*.0045));
    lastTouch={x:e.clientX,y:e.clientY};
  });
  canvas.addEventListener('pointerup',e=>{if(e.pointerId===lookId){lookId=null;lastTouch=null;}});
  canvas.addEventListener('pointercancel',()=>{lookId=null;lastTouch=null;});
  const pad=$('movePad'),knob=$('moveKnob');let padId=null;
  const padMove=e=>{
    const rect=pad.getBoundingClientRect();
    const dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2,m=Math.hypot(dx,dy)||1,r=Math.min(32,m);
    moving={x:dx/m*r/32,y:-dy/m*r/32};
    knob.style.setProperty('--knob-x',moving.x*32+'px');knob.style.setProperty('--knob-y',-moving.y*32+'px');
  };
  const padEnd=()=>{padId=null;moving={x:0,y:0};knob.style.setProperty('--knob-x','0px');knob.style.setProperty('--knob-y','0px');};
  pad.addEventListener('pointerdown',e=>{padId=e.pointerId;pad.setPointerCapture(e.pointerId);padMove(e)});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===padId)padMove(e)});
  pad.addEventListener('pointerup',padEnd);pad.addEventListener('pointercancel',padEnd);
  let seatTween=null;
  $('deskAction').addEventListener('click',()=>{
    if(!entered)begin();
    if(focused){location.href='../../stillroom/';return;}
    focused=true;
    $('deskAction').innerHTML='打开 STILLROOM 专注书桌 <span>↗</span>';
    seatTween={from:camera.position.clone(),to:new THREE.Vector3(-1.55,1.54,-1.72),start:performance.now(),duration:1200,yaw,yawTo:0,pitch,pitchTo:-.18};
    if(document.pointerLockElement)document.exitPointerLock();
    $('walkHint').textContent='座位已准备好 · 继续进入原有专注工具';
  });
  const resize=()=>{
    camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  };
  window.addEventListener('resize',resize,{passive:true});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').hidden=false;$('loading').textContent='正在恢复图形环境…';});
  canvas.addEventListener('webglcontextrestored',()=>{$('loading').hidden=true;});
  let previousWeather=performance.now(),qualityStats={fps:60,rendered:0};
  function animate(ts){
    requestAnimationFrame(animate);
    if(document.hidden){last=ts;return;}
    const dt=Math.min(.05,Math.max(0,(ts-(last||ts))/1000));last=ts;
    if(seatTween){
      const t=Math.min(1,(ts-seatTween.start)/seatTween.duration),ease=1-Math.pow(1-t,3);
      camera.position.copy(seatTween.from).lerp(seatTween.to,ease);
      yaw=seatTween.yaw+(seatTween.yawTo-seatTween.yaw)*ease;
      pitch=seatTween.pitch+(seatTween.pitchTo-seatTween.pitch)*ease;
      if(t>=1)seatTween=null;
    }else if(entered){
      const forward=(pressed.has('KeyW')||pressed.has('ArrowUp')?1:0)-(pressed.has('KeyS')||pressed.has('ArrowDown')?1:0)+moving.y;
      const side=(pressed.has('KeyD')||pressed.has('ArrowRight')?1:0)-(pressed.has('KeyA')||pressed.has('ArrowLeft')?1:0)+moving.x;
      const length=Math.max(1,Math.hypot(forward,side)),speed=dt*2.3/length;
      const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed;
      const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;
      if(!collision(camera.position.x+dx,camera.position.z))camera.position.x+=dx;
      if(!collision(camera.position.x,camera.position.z+dz))camera.position.z+=dz;
    }
    camera.rotation.set(pitch,yaw,0,'YXZ');
    applyWeather(dt,ts);
    renderer.render(scene,camera);qualityStats.rendered++;
    if(!entered||reduced||manualQuality)return;
    if(dt>.005&&dt<.25){fpsTime+=dt;fpsFrames++;}
    if(fpsTime>=2){
      const fps=fpsFrames/fpsTime;qualityStats.fps=Math.round(fps);fpsTime=0;fpsFrames=0;
      if(fps<32){slowSamples++;goodSamples=0;}else if(fps>53){goodSamples++;slowSamples=0;}else{slowSamples=0;goodSamples=0;}
      if(slowSamples>=2&&levels.indexOf(quality)>0){setQuality(levels[levels.indexOf(quality)-1]);slowSamples=goodSamples=0;}
      if(goodSamples>=9&&levels.indexOf(quality)<qualityCap){setQuality(levels[levels.indexOf(quality)+1]);slowSamples=goodSamples=0;}
    }
  }
  // Expose only read-only diagnostics for real-device acceptance and test automation.
  window.HAIZ_IMMERSIVE={
    ready:true,kind:'original-concept-room',version:1,
    getDiagnostics:()=>({climate,quality,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:qualityStats.fps,rendered:qualityStats.rendered,instancedBoxes:geometryStats.instances,geometryBatches:geometryStats.batches,drawCallsSaved:geometryStats.drawCallsSaved,groundedContactShadows:!!roomContacts,heroDeskGeometry:!!heroAsset,heroDetailCount:heroAsset?.detailCount||0,staticBounceAtlas:!!authoredBounce,webgl:true,entered,focused,units:'meters',thirdPartyAssets:false}),
    setClimate:selectClimate,enter:begin
  };
  // Carry only the user-selected artistic weather across campus and room routes.
  const requested=new URLSearchParams(location.search).get('climate');
  if(presets[requested])selectClimate(requested);
  $('loading').hidden=true;
  if(touch)$('touchControls').hidden=true;
  requestAnimationFrame(animate);
})();
