import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makeBaseline, makeHybrid } from './driver.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const total = 13;
const dt = 1/60;
const turn = Math.PI/2;
const stages = [
  [0,0,0,'等候'], [1.25,1.47,0,'起步与步行'], [4,3.75,0,'加速与跑步'],
  [6.55,1.2,turn,'左转'], [8.1,1.2,0,'右转'], [9.45,3.55,0,'再加速'], [10.8,0,0,'停步'],
];
function intent(time) {
  const [start,speed,yaw,stage] = stages.findLast(stage => stage[0] <= time);
  return {start,speed,yaw,stage};
}
const heightAt = (x,z) => .18 * T.MathUtils.smoothstep(z,5,7.8) + .09 * T.MathUtils.smoothstep(x,1,3.5);

const renderer = new T.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.6));
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.setScissorTest(true);
const camera = new T.PerspectiveCamera(39,1,.03,120);
const aim = new T.Vector3();

function stage(model) {
  const scene = new T.Scene();
  scene.background = new T.Color('#303d37');
  scene.fog = new T.FogExp2('#303d37',.095);
  const sun = new T.DirectionalLight(0xffebd5,2.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:1,far:15});
  sun.shadow.normalBias = .017;
  sun.shadow.bias = -.00045;
  sun.shadow.camera.updateProjectionMatrix();
  const fill = new T.HemisphereLight(0xe4edff,0x96a495,2.12);
  const rim = new T.DirectionalLight(0xb6ccea,.69);
  rim.position.set(-2,3,-2);
  const ground = new T.PlaneGeometry(65,80,100,125);
  ground.rotateX(-Math.PI/2);
  ground.translate(0,-.014,18);
  const positions = ground.attributes.position;
  for(let i=0;i<positions.count;i++) positions.setY(i,heightAt(positions.getX(i),positions.getZ(i))-.013);
  ground.computeVertexNormals();
  const surface = new T.MeshStandardMaterial({ color:0x56685e, roughness:.94 });
  surface.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvGround = position.xz;');
    shader.fragmentShader = 'varying vec2 vGround;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 gradient = max(fwidth(vGround), vec2(.00001));
      vec2 line = 1. - smoothstep(vec2(0.), gradient * 1.2, abs(fract(vGround + .5)-.5));
      diffuseColor.rgb *= 1. - max(line.x,line.y)*.16;`);
  };
  const mesh = new T.Mesh(ground,surface);
  mesh.receiveShadow = true;
  model.traverse(node => {
    if (!node.isSkinnedMesh) return;
    node.castShadow = node.receiveShadow = true;
    node.frustumCulled = false;
  });
  scene.add(model,mesh,sun,sun.target,fill,rim);
  return {scene,sun};
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let time = 0, angle = .78, play = true, dims = [], last, accumulator = 0;
let baseline, hybrid, a, b, stages3d, source;

function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  if (dims[0] !== w || dims[1] !== h) {
    renderer.setSize(w,h,false);
    dims = [w,h];
  }
  const half = Math.floor(w/2);
  const distance = Math.max(3.5, 1.7*h/half);
  aim.copy(a.position).addScaledVector(new T.Vector3(0,1,0),.85);
  camera.position.copy(aim).add(new T.Vector3(distance*Math.sin(angle),.48,distance*Math.cos(angle)));
  camera.lookAt(aim);
  const widths = [half,w-half];
  for (let i=0;i<2;i++) {
    const {scene,sun} = stages3d[i];
    sun.target.position.copy(a.position);
    sun.position.copy(a.position).add(new T.Vector3(2.5,4,3));
    camera.aspect = widths[i]/h;
    camera.updateProjectionMatrix();
    renderer.setViewport(i*half,0,widths[i],h);
    renderer.setScissor(i*half,0,widths[i],h);
    renderer.render(scene,camera);
  }
  $('time').value = time;
  $('clock').textContent = `${time.toFixed(1)} / ${total.toFixed(1)} s`;
  $('status').textContent = `${intent(time).stage} · ${baseline.human.speed.toFixed(1)} m/s`;
}

function step() {
  const target = intent(time);
  baseline.step(target, dt);
  hybrid.update(target, baseline.human.speed, dt);
  time += dt;
}
function reset() {
  baseline.reset();
  hybrid.reset();
  time = accumulator = 0;
  step();
}
function seek(to) {
  play = false;
  $('play').textContent = '播放';
  reset();
  while (time + dt/2 < Math.min(total,to)) step();
  render();
}
function resume() {
  if (time >= total) reset();
  play = true;
  $('play').textContent = '暂停';
}
function frame(now) {
  const delta = Math.min(.08,(now-(last||now))/1000);
  last = now;
  if (play) {
    accumulator += delta;
    while (accumulator >= dt && time < total) {
      step();
      accumulator -= dt;
    }
    if (time >= total) {
      play = false;
      $('play').textContent = '播放';
    }
    render();
  }
  requestAnimationFrame(frame);
}
function measure() {
  seek(0);
  const data = {};
  const stateCounts = {};
  const prev = {};
  const upper = [a,b].map(model => [model.getObjectByName('hips'),model.getObjectByName('head')]);
  let maximumPathDifference = 0;
  while (time < total) {
    const current = intent(time);
    step();
    stateCounts[hybrid.state] = (stateCounts[hybrid.state] || 0)+1;
    maximumPathDifference = Math.max(maximumPathDifference,a.position.distanceTo(b.position));
    const stats = data[current.stage] ||= {A:[], B:[], gapA:[], gapB:[], tilt:[[],[]]};
    for(let i=0;i<upper.length;i++) {
      const [hip,head] = upper[i];
      const axis = head.getWorldPosition(new T.Vector3()).sub(hip.getWorldPosition(new T.Vector3())).normalize();
      stats.tilt[i].push(T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(axis.y,-1,1))));
    }
    for (const [side, pose] of Object.entries(hybrid.poses())) {
      if (!pose.planted) {prev[side] = null; continue;}
      stats.gapA.push(Math.abs(pose.a.gap)*100);
      stats.gapB.push(Math.abs(pose.b.gap)*100);
      if (prev[side]?.anchor.equals(pose.anchor) && prev[side].a.pivot === pose.a.pivot && prev[side].b.pivot === pose.b.pivot) {
        for (const [id,key] of [['A','a'],['B','b']]) {
          const p = pose[key].point, q = prev[side][key].point;
          stats[id].push(100*Math.hypot(p.x-q.x,p.z-q.z));
        }
      }
      prev[side] = pose;
    }
  }
  const p95 = values => {
    const ordered = values.sort((a,b)=>a-b);
    return ordered[Math.floor((ordered.length-1)*.95)] ?? null;
  };
  const summarize = values => ({samples:values.length,p95_cm:p95(values)});
  return {
    model:'HAIZ Hunyuan LOD 1', template:source.templateMatches, assetClips:source.report, tickHz:60,
    maximumPathDifference_m:maximumPathDifference, stateFrames:stateCounts,
    stages:Object.fromEntries(Object.entries(data).map(([name,m])=>[name,{
      slideA:summarize(m.A), slideB:summarize(m.B), gapA:summarize(m.gapA), gapB:summarize(m.gapB),
      torsoTiltP95_deg: m.tilt.map(p95),
    }])),
  };
}

async function init() {
  const model = '../models/student-mid.glb';
  const [first,second,clips] = await Promise.all([loader.loadAsync(model),loader.loadAsync(model),fetch('./clips.json').then(r=>r.json())]);
  source = clips;
  a = first.scene;
  b = second.scene;
  stages3d = [stage(a),stage(b)];
  baseline = makeBaseline(a,heightAt);
  hybrid = makeHybrid(a,b,clips,heightAt,baseline.human);
  reset();
  for (const id of ['time','play','restart']) $(id).disabled = false;
  $('time').addEventListener('input',()=>seek(+$('time').value));
  $('restart').addEventListener('click',()=>{reset();resume();});
  $('play').addEventListener('click',()=>play ? seek(time) : resume());
  for (const button of document.querySelectorAll('[data-angle]')) button.addEventListener('click',()=>{
    angle = +button.dataset.angle;
    for (const sibling of document.querySelectorAll('[data-angle]')) sibling.setAttribute('aria-pressed',String(sibling===button));
    render();
  });
  addEventListener('resize',render);
  window.__motionAB = {ready:true,seek,measure,current:()=>({time,state:hybrid.state}),duration:total};
  render();
  requestAnimationFrame(frame);
}
init().catch(error=>{$('status').textContent = '动作载入失败';console.error(error);});
