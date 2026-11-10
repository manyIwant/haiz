/* Real-time PBR study using the same local textures as the walking scene. */
(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer,scene,camera,mesh,slab,keyLight,rim,hemi,ready=false,failed=false,visible=false,frame=0,material=null,environment;
let current={kind:'roof',color:'#446b53'},wet=0,repeat=1,drag=null,rotate=!reduced,shape='sphere',angle=.25,wants3d=true;
const host=document.createElement('div');host.id='material3d';host.className='material-3d';host.setAttribute('aria-label','可拖动旋转的三维材质样本');
host.hidden=true;
const preview=document.querySelector('.material-preview'),canvas=document.getElementById('materialCanvas');
canvas.before(host);
const controls=document.createElement('div');controls.className='material-lab-controls';
controls.innerHTML='<div class="lab-mode"><button id="lab3d" aria-pressed="true">立体看材质</button><button id="lab2d" aria-pressed="false">平面纹理</button><button id="labRotate" aria-pressed="'+rotate+'">缓慢转动</button></div><div class="lab-sliders"><label>雨后湿度 <input id="labWet" type="range" min="0" max="1" step="0.05" value="0"></label><label>铺设密度 <input id="labRepeat" type="range" min="1" max="4" step="0.5" value="1"></label><label>观察形状<select id="labShape"><option value="sphere">材质球</option><option value="slab">铺装板</option></select></label><label>光的方向<select id="labLight"><option value="side">侧光</option><option value="cloud">阴天</option><option value="warm">暖光</option></select></label></div><p id="labStatus" role="status">拖动旋转样本，移动指针改变光向。三维视图在接近时加载。</p>';
preview.append(controls);
const $=id=>document.getElementById(id);
function mode(three){
  if(three&&failed)return;
  wants3d=three;
  if(three){$('reliefToggle').checked=false;boot();}
  host.hidden=!three;canvas.hidden=three&&ready;
  $('lab3d').setAttribute('aria-pressed',String(three));$('lab2d').setAttribute('aria-pressed',String(!three));render();
}
function disposeMaterial(){if(!material)return;for(const field of ['map','normalMap','bumpMap','roughnessMap'])material[field]?.dispose();material.dispose();}
function update(){
  if(!ready)return;disposeMaterial();material=window.CampusSurfaces.sample(current.kind,current.color,wet);
  for(const field of ['map','normalMap','bumpMap','roughnessMap']){material[field]=material[field].clone();material[field].repeat.set(repeat,repeat);material[field].needsUpdate=true;}
  material.envMapIntensity=.3;mesh.material=slab.material=material;render();
}
function render(){
  if(!ready||!visible||host.hidden||document.hidden)return;
  mesh.visible=shape==='sphere';slab.visible=shape==='slab';
  mesh.rotation.y=angle;slab.rotation.y=angle;renderer.render(scene,camera);
}
function animate(){cancelAnimationFrame(frame);if(!ready||!visible||host.hidden||document.hidden)return;
  if(rotate&&!reduced&&!drag){angle+=.003;render();frame=requestAnimationFrame(animate);}else render();
}
function resize(){if(!ready)return;const size=Math.max(1,host.clientWidth);renderer.setSize(size,size,false);render();}
function boot(){
  if(ready||failed)return;
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    scene=new THREE.Scene();scene.background=new THREE.Color('#192f27');
    camera=new THREE.PerspectiveCamera(36,1,.1,30);camera.position.set(0,1.05,4.8);camera.lookAt(0,0,0);
    hemi=new THREE.HemisphereLight('#d8e7e0','#3e4a37',.85);scene.add(hemi);
    keyLight=new THREE.DirectionalLight('#fff1d5',2.1);keyLight.position.set(-2.8,3.2,2.5);scene.add(keyLight);
    rim=new THREE.DirectionalLight('#a6d6d2',.85);rim.position.set(2.5,.8,-2);scene.add(rim);
    mesh=new THREE.Mesh(new THREE.SphereGeometry(.95,80,48));mesh.position.y=.1;scene.add(mesh);
    slab=new THREE.Mesh(new THREE.BoxGeometry(2.5,.16,1.85));slab.rotation.x=.15;slab.position.y=-.05;scene.add(slab);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(2.1,64),new THREE.MeshStandardMaterial({color:new THREE.Color('#182d24').convertSRGBToLinear(),roughness:1,envMapIntensity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.9;scene.add(floor);
    // Soft local contact shade, with no third-party image or extra shadow pass.
    const shade=document.createElement('canvas');shade.width=shade.height=128;const c=shade.getContext('2d'),g=c.createRadialGradient(64,64,6,64,64,64);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shade),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.893;scene.add(contact);
    host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','拖动旋转材质，使用下方控件调整湿度、密度、形状与光照');
    ready=true;host.hidden=!wants3d;canvas.hidden=wants3d;update();resize();
    new THREE.TextureLoader().load('assets/walk/textures/jade-glaze-generated.webp',texture=>{
      if(!ready){texture.dispose();return;}window.CampusSurfaces.setGlaze(texture);update();if(current.kind==='roof')window.HaizArchitecture?.preview('roof');
    },undefined,()=>{});
    renderer.domElement.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId){angle+=(e.clientX-drag.x)*.01;drag.x=e.clientX;render();}else{const r=host.getBoundingClientRect();keyLight.position.x=((e.clientX-r.left)/r.width-.5)*7;render();}});
    for(const type of ['pointerup','pointercancel'])renderer.domElement.addEventListener(type,()=>{drag=null;animate();});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;ready=false;host.hidden=true;canvas.hidden=false;$('labStatus').textContent='三维视图暂时中断，仍可使用平面纹理与高度图。';});
    if(THREE.RGBELoader)new THREE.RGBELoader().load('assets/walk/textures/campus-light.hdr',texture=>{
      if(!ready){texture.dispose();return;}texture.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromEquirectangular(texture).texture;scene.environment=environment;texture.dispose();pmrem.dispose();render();
    },undefined,()=>{});
    $('labStatus').textContent='拖动旋转，移动指针改变光向。湿度与密度会真实改变材质表现。';animate();
  }catch(error){failed=true;ready=false;host.hidden=true;canvas.hidden=false;$('lab3d').disabled=true;$('labStatus').textContent='当前设备使用平面材质预览；颜色和高度图仍可查看。';}
}
$('lab3d').onclick=()=>mode(true);$('lab2d').onclick=()=>mode(false);
$('labWet').oninput=e=>{wet=Number(e.target.value);update();};$('labRepeat').oninput=e=>{repeat=Number(e.target.value);update();};
$('labShape').onchange=e=>{shape=e.target.value;render();};
$('labRotate').onclick=()=>{rotate=!rotate;$('labRotate').setAttribute('aria-pressed',String(rotate));animate();};
$('labLight').onchange=e=>{boot();if(!ready)return;const warm=e.target.value==='warm',cloud=e.target.value==='cloud';keyLight.color.set(warm?'#ffd1a0':'#fff1d5');keyLight.intensity=cloud?.7:2.1;hemi.intensity=cloud?1.15:.85;keyLight.position.set(-2.8,3.2,2.5);render();};
$('reliefToggle').addEventListener('change',()=>{if($('reliefToggle').checked)mode(false);});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',animate);
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){if(wants3d)boot();animate();}else cancelAnimationFrame(frame);},{rootMargin:'150px'});observer.observe(preview);}else{visible=true;boot();}
window.CampusMaterialLab={set(kind,color){current={kind,color};update();},get ready(){return ready;},get state(){return {kind:current.kind,wet,repeat,shape};}};
})();
