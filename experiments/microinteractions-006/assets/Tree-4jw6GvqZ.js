import{q as ce,y as ue,z as oe,r as G,n as de,j as f,S as Ne,f as je,i as Fe}from"./store-DAOYBpo0.js";import{s as le,P as Te,b as De,n as Ge,l as Pe}from"./index-fgCWph9v.js";import{M as fe,V as w,B as _e,F as me,Q as ze,a as Ve,l as Ie,b as he,c as ge,S as te,D as ae,I as re,d as pe,E as ke,G as Ee,e as Oe}from"./assets-B4cxCz94.js";const se={bud:.035,unfold:.2,mature:.3},Re=`
uniform float uTime;
uniform float uWind;      // 0 calm … 1 strong breeze
uniform float uGust;      // slowly varying 0..1
uniform vec3  uWindDir;
uniform vec4  uTouchO[4]; // ray origin, start time
uniform vec4  uTouchD[4]; // ray direction, strength
vec3 windSway(vec3 p, float flex){
  float ph = dot(p, vec3(0.31, 0.17, 0.23));
  float g = uWind * (0.45 + 0.55 * uGust);
  float t = uTime;
  float w = sin(t * 0.83 + ph) * 0.55 + sin(t * 1.71 + ph * 1.37) * 0.28 + sin(t * 0.29 + ph * 0.6) * 0.35;
  vec3 d = uWindDir * (g * 0.55 + w * g * 0.45);
  d.y += sin(t * 2.1 + ph * 2.0) * 0.12 * g;
  d += cross(uWindDir, vec3(0.0, 1.0, 0.0)) * sin(t * 1.13 + ph * 0.8) * 0.18 * g;
  return d * flex * flex * 0.42;
}
vec3 touchPush(vec3 p, out float energy){
  vec3 acc = vec3(0.0);
  energy = 0.0;
  for (int i = 0; i < 4; i++) {
    float dt = uTime - uTouchO[i].w;
    if (dt < 0.0 || dt > 5.0) continue;
    vec3 v = p - uTouchO[i].xyz;
    vec3 dir = uTouchD[i].xyz;
    vec3 perp = v - dir * dot(v, dir);
    float k = uTouchD[i].w * exp(-dot(perp, perp) / 0.55);
    float osc = exp(-dt * 1.9) * sin(dt * 8.5);
    acc += normalize(perp + vec3(1e-4)) * k * osc * 0.16 + vec3(0.0, -0.05, 0.0) * k * exp(-dt * 3.0);
    energy += k * exp(-dt * 1.5);
  }
  return acc;
}
`,Ae=`
vec3 leafColour(float age, float sen, float young, float variant){
  vec3 green  = mix(vec3(0.034, 0.072, 0.020), vec3(0.052, 0.098, 0.026), variant);
  vec3 yellow = vec3(0.60, 0.40, 0.045);
  vec3 red    = vec3(0.42, 0.035, 0.018);
  vec3 brown  = vec3(0.17, 0.075, 0.03);
  float a = age * 1.35;
  vec3 c = mix(green, yellow, smoothstep(sen, sen + 0.16, a));
  c = mix(c, red, smoothstep(sen + 0.30, sen + 0.46, a));
  c = mix(c, brown, smoothstep(sen + 0.95, sen + 1.2, a));
  // Terminalia's new flush: bronze-red buds, then a bright yellow-green
  vec3 fresh = mix(vec3(0.075, 0.15, 0.03), vec3(0.30, 0.10, 0.04), smoothstep(0.66, 0.95, young));
  return mix(c, fresh, smoothstep(0.0, 0.45, young));
}
`,Ce=`
uniform float uGrow;
// 年轮 (lanren/rings): a whole year on the same leaves. Off (uYear = 0) everywhere else,
// where the lines below reduce to V4's growth exactly.
//   uTurn   last cohort's senescence, as lanren/js/season.js: 0 green … 1.4 every leaf fallen
//   uFlushG growth of the new cohort in uGrow's own units
uniform float uYear; uniform float uTurn; uniform float uFlushG;
void leafGrow(float tE, float old, out float u, out float scl, out float young, out float fold, out float erect, out float age){
  age = 0.0;
  if (old > 0.0) {                       // last year's leaf
    u = 1.0; young = 0.0; fold = 0.0; erect = 0.0;
    scl = (uYear < 0.5 && uGrow < old) ? 1.0 : 0.0;
    age = 0.80 + fract(old * 37.0) * 0.32 + smoothstep(old - 0.12, old, uGrow) * 0.15;
    return;
  }
  float g = uGrow;
  if (uYear > 0.5) {
    // the blade this bud carried through last season: it colours, then lets go (each leaf in its own time)
    float r1 = fract(tE * 917.31 + 0.37);
    float oldAge = (uTurn - r1 * 0.85) * 2.2;
    if (uTurn > 0.0 && oldAge < 1.0) {
      u = 1.0; young = 0.0; fold = 0.0; erect = 0.0; scl = 1.0;
      age = clamp(oldAge, 0.0, 1.0) * 1.12;
      return;
    }
    g = uFlushG;
  }
  u = clamp((g - tE) / ${se.unfold.toFixed(3)}, 0.0, 1.0);
  float m = clamp((g - tE - ${se.unfold.toFixed(3)} * 0.6) / ${se.mature.toFixed(3)}, 0.0, 1.0);
  scl = g < tE - ${se.bud.toFixed(3)} ? 0.0 : mix(0.07, 1.0, smoothstep(0.0, 0.9, u));
  fold = (1.0 - smoothstep(0.1, 0.8, u)) * 1.3;
  erect = (1.0 - smoothstep(0.15, 0.9, u)) * 1.1;
  // bronze while the bud opens, then a bright, thin yellow-green that deepens as it matures
  young = (1.0 - m) * 0.62 + (1.0 - smoothstep(0.15, 0.55, u)) * 0.38;
}
`;function xe(t=2,r=4,g=.62,p=null){const Y=[],i=[],l=[];for(let F=0;F<=r;F++){const x=F/r;for(let T=0;T<=t;T++){const y=T/t*2-1;let L=x,s=Math.abs(y)*g*.5*.16-.1*x*x+.05*x,d=y*g*.5;if(p){s-=p.cup*y*y*g*.5,s+=p.wave*Math.sin(x*Math.PI*p.waves+Math.sign(y)*1.3)*Math.abs(y)**1.5,s+=p.lift*x*x*x;const E=p.twist*x,$=Math.cos(E),D=Math.sin(E);[s,d]=[s*$-d*D,s*D+d*$]}Y.push(L,s,d),i.push((y+1)/2,x)}}for(let F=0;F<r;F++)for(let x=0;x<t;x++){const T=F*(t+1)+x,y=T+1,L=T+t+1,s=L+1;l.push(T,L,y,y,L,s)}const j=new _e;return j.setAttribute("position",new me(Y,3)),j.setAttribute("uv",new me(i,2)),j.setIndex(l),j.computeVertexNormals(),j}function Se(t){let r=t>>>0;return()=>{r|=0,r=r+1831565813|0;let g=Math.imul(r^r>>>15,1|r);return g=g+Math.imul(g^g>>>7,61|g)^g,((g^g>>>14)>>>0)/4294967296}}function Ue(t,r,g=1,p=1){const Y=t.length/r,i=Se(20231030),l=[],j=[],F=[],x=[],T=new fe,y=new ze,L=new w(0,1,0),s=new w,d=new w,E=new w,$=new w,D=new fe,V=new w,O=new w,P=new w,ee=new w,H=Math.pow(1/Math.max(.3,g),.22)*p;let n=0,o=0,c=0,b=1,M=0,m=0;const R=(A,u,C,k,S,q,Q,Z,W,J,K)=>{const B=Ve.lerp(.8,-.3,S)+(i()-.5)*.7+M*Math.cos(k-m);d.set(Math.cos(k),0,Math.sin(k)).addScaledVector(q,.45).normalize(),d.y=Math.sin(B),d.normalize(),E.crossVectors(L,d).normalize(),$.crossVectors(d,E).normalize();const _=(i()-.5)*1.3;V.copy(E).multiplyScalar(Math.cos(_)).addScaledVector($,Math.sin(_)),O.crossVectors(d,V).normalize(),D.makeBasis(d,O,V.multiplyScalar(-1)),y.setFromRotationMatrix(D);const e=(.19+i()*.15)*(.58+.5*S)*H*K,h=.015+i()*.03,N=(1-S)*0+S*(.02+i()*.07);P.set(A+d.x*h-I.x*N,u+d.y*h*.5-I.y*N,C+d.z*h-I.z*N),T.compose(P,y,ee.set(e,e,e));for(let v=0;v<16;v++)l.push(T.elements[v]);j.push(A,u,C,Q),x.push(n,o,c,b),F.push(Z+(1-S)*.025+i()*.012,W,Math.floor(i()*4),J)},z=new w,I=new w;for(let A=0;A<Y;A++){const u=A*r,C=t[u],k=t[u+1],S=t[u+2];s.set(t[u+3],t[u+4],t[u+5]).normalize();const q=t[u+6],Q=t[u+7],Z=t[u+8],W=t[u+9],J=t[u+10];r>=15?(n=t[u+12],o=t[u+13],c=t[u+14]):(n=C,o=k-1,c=S),b=r>=16?t[u+15]:1,I.copy(s),z.set(s.x,0,s.z),z.lengthSq()<1e-4&&z.set(1,0,0),z.normalize();const K=i()*Math.PI*2;if(M=(i()-.5)*.9,m=i()*Math.PI*2,W>=0){const B=Math.round((9+i()*5)*q);for(let _=0;_<B;_++)i()>g||R(C,k,S,K+_*2.39996,1-_/B,z,Q,W,-1,Z,1)}if(J>0){const B=W>=0?2+Math.floor(i()*2):Math.round((5+i()*4)*q);for(let _=0;_<B;_++)W<0&&i()>Math.max(.5,g)||R(C,k,S,K+1.2+_*2.39996,.75+.25*i(),z,Q,0,J,Z,1.12)}}return{count:j.length/4,matrices:new Float32Array(l),rosette:new Float32Array(j),leaf:new Float32Array(F),pad:new Float32Array(x)}}const ye=`
  float isoAng = atan(vIsoPos.z, vIsoPos.x);
  float isoLim = 6.2 + 0.45 * sin(isoAng * 3.0 + 0.5) + 0.28 * cos(isoAng * 5.0);
  if (length(vIsoPos.xz) > isoLim) discard;`,we=t=>`
  ${Re}
  ${Ce}
  attribute vec4 aRosette; attribute vec4 aLeaf; attribute vec4 aPad;
  ${t?"uniform float uInflate;":""}
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    float variant = aLeaf.z; float uu, scl, young, fold, erect, age;
    leafGrow(aLeaf.x, aLeaf.y, uu, scl, young, fold, erect, age);
    if (scl == 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vUv = vec2((variant + uv.x) * 0.25, uv.y);
    vAge = age; vYoung = young; vVar = fract(variant * 0.37 + aLeaf.x * 13.0); vOcc = aLeaf.w; vShell = aPad.w;
    vec3 t = position;
    float sz = sign(t.z), az = abs(t.z);
    t.y += az * sin(fold); t.z = sz * az * cos(fold);
    float ce = cos(erect), se = sin(erect);
    t.xy = vec2(t.x * ce - t.y * se, t.x * se + t.y * ce);
    t *= scl${t?" * uInflate":""};
    float touchE;
    vec3 rp = aRosette.xyz;
    vec3 disp = windSway(rp, aRosette.w) + touchPush(rp, touchE);
    float fl = sin(uTime * (5.5 + aLeaf.y * 3.0 + aLeaf.x * 4.0) + aLeaf.x * 40.0) * (0.05 + 0.2 * uWind * uGust + 0.6 * touchE) * (1.0 + young);
    t.y += fl * t.x;
    mat3 lim = mat3(instanceMatrix);
    t += transpose(lim) * disp / dot(lim[0], lim[0]);
    vec3 padN = normalize((aRosette.xyz - aPad.xyz) * vec3(1.0, 1.45, 1.0) + vec3(0.0, 0.35, 0.0));
    vPadN = ${t?"normalize(normalMatrix * padN)":"normalize(mat3(modelMatrix) * padN)"};
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(t, 1.0);
  }
`,$e=`
  ${Ae}
  uniform sampler2D uAtlas; uniform vec3 uSunDir; uniform float uLight; uniform float uNight;
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    vec4 lt = texture2D(uAtlas, vUv);
    if (lt.a < 0.5) discard;
    vec3 lc = leafColour(vAge, lt.b, vYoung, vVar);
    float lum = lt.r * 1.38 * (0.82 + 0.36 * fract(vVar * 7.31));
    vec3 base = lc * lum;
    base = mix(base, base * vec3(1.42, 1.36, 0.82), lt.g * 0.55 * (1.0 - vAge));
    float ndl = dot(normalize(vPadN), uSunDir) * 0.5 + 0.5;
    float ao = mix(1.0, 0.5, clamp(vOcc * 0.9, 0.0, 0.9));
    vec3 lit = base * (0.55 + 1.75 * ndl * ndl) * ao * uLight;
    lit += base * vec3(1.2, 1.0, 0.55) * pow(max(0.0, ndl), 3.0) * 0.35 * vShell;   // sun through the outer leaves
    lit = mix(lit, lit * vec3(0.55, 0.65, 0.95), uNight);
    gl_FragColor = vec4(lit * 2.2, 1.0);
  }
`,Ye=`
  uniform sampler2D uAtlas;
  varying vec2 vUv; varying vec3 vPadN; varying float vAge; varying float vYoung; varying float vVar; varying float vOcc; varying float vShell;
  void main() {
    if (texture2D(uAtlas, vUv).a < 0.54) discard;
    gl_FragColor = vec4(normalize(vPadN) * 0.5 + 0.5, 0.89);
  }
`,Me=t=>`
  attribute vec4 aLoose;   // age, variant, seed, on
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() {
    vUv = vec2((aLoose.y + uv.x) * 0.25, uv.y);
    vAge = aLoose.x; vVar = aLoose.z;
    vec3 n = normalize(mat3(instanceMatrix) * normal);
    vN = ${t?"normalize(normalMatrix * n)":"normalize(mat3(modelMatrix) * n)"};
    if (aLoose.w < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`,We=`
  ${Ae}
  uniform sampler2D uAtlas; uniform vec3 uSunDir; uniform float uLight;
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() {
    vec4 lt = texture2D(uAtlas, vUv);
    if (lt.a < 0.5) discard;
    vec3 c = leafColour(vAge, lt.b * 0.5, 0.0, vVar) * lt.r * 1.38;
    float ndl = abs(dot(normalize(vN), uSunDir)) * 0.6 + 0.4;
    gl_FragColor = vec4(c * (0.6 + 1.6 * ndl) * uLight * 2.0, 1.0);
  }
`,Be=`
  uniform sampler2D uAtlas;
  varying vec2 vUv; varying vec3 vN; varying float vAge; varying float vVar;
  void main() { if (texture2D(uAtlas, vUv).a < 0.54) discard; vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n * 0.5 + 0.5, 0.89); }
`;async function He(t,{density:r=.42,onReady:g}={}){const p=await Ie(),i=p.meta.rosetteStride||16,l={uTime:{value:0},uWind:{value:.2},uGust:{value:.5},uWindDir:{value:new w(.8,0,-.6).normalize()},uTouchO:{value:[0,1,2,3].map(()=>new he(0,-99,0,-99))},uTouchD:{value:[0,1,2,3].map(()=>new he(0,1,0,0))},uGrow:{value:1},uYear:{value:1},uTurn:{value:0},uFlushG:{value:1},uAtlas:{value:p.leafAtlas},uSunDir:{value:new w(.55,.76,.35).normalize()},uLight:{value:1},uNight:{value:0}},j=new ge({name:"TerminaliaBark",map:p.barkColor,normalMap:p.barkNormal,color:12164226,roughness:.92,metalness:0}),F=new ge({name:"TaihuIsland",color:9406587,roughness:.94,metalness:0});F.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vIsoPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vIsoPos = position;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vIsoPos;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
`+ye)};const x=new te({side:ae,uniforms:{uMatA:{value:.34}},vertexShader:"varying vec3 vVN; varying vec3 vIsoPos; void main(){ vIsoPos = position; vVN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",fragmentShader:`uniform float uMatA; varying vec3 vVN; varying vec3 vIsoPos; void main(){ ${ye} gl_FragColor = vec4(normalize(vVN)*0.5+0.5, uMatA); }`}),T=p.tree.clone(!0);T.traverse(e=>{e.isMesh&&(e.material=j,e.castShadow=!0,e.receiveShadow=!0)});const y=p.island.clone(!0),L=new Set;y.traverse(e=>{e.isMesh&&(e.material=F,e.receiveShadow=!0,L.add(e))});const s=Ue(p.rosettes,i,r),d=xe(2,3,.62);d.setAttribute("aRosette",new re(s.rosette,4)),d.setAttribute("aLeaf",new re(s.leaf,4)),d.setAttribute("aPad",new re(s.pad,4));const E=new te({name:"TerminaliaFoliage",side:ae,uniforms:l,vertexShader:we(!1),fragmentShader:$e}),$=new te({side:ae,uniforms:{...l,uMatA:{value:.89},uInflate:{value:1.75}},vertexShader:we(!0),fragmentShader:Ye}),D=new pe(d,E,s.count);D.instanceMatrix.array.set(s.matrices),D.instanceMatrix.needsUpdate=!0,D.frustumCulled=!1,D.castShadow=!1;const V=220,O=xe(2,2,.62),P=new Float32Array(V*4);O.setAttribute("aLoose",new re(P,4));const ee=new te({name:"LooseLeaf",side:ae,uniforms:l,vertexShader:Me(!1),fragmentShader:We}),H=new te({side:ae,uniforms:{uAtlas:l.uAtlas,uMatA:{value:.89}},vertexShader:Me(!0),fragmentShader:Be}),n=new pe(O,ee,V);n.frustumCulled=!1;const o=Array.from({length:V},()=>({on:0,p:new w,v:new w,r:new ke,w:new w,t:0,s:.3,land:0})),c=new fe,b=new ze,M=new w;for(let e=0;e<V;e++)c.makeScale(0,0,0),n.setMatrixAt(e,c);const m=Se(7),R=new Ee;R.add(y,T,D,n),t.scene.add(R),t.registerObject(R,{customNd:e=>e===D?$:e===n?H:L.has(e)?x:null}),t.sun.position.set(-60,90,70),t.sun.shadow.camera.left=-22,t.sun.shadow.camera.right=22,t.sun.shadow.camera.top=22,t.sun.shadow.camera.bottom=-22,t.sun.shadow.camera.near=1,t.sun.shadow.camera.far=320,t.sun.shadow.camera.updateProjectionMatrix(),l.uSunDir.value.copy(t.sun.position).normalize(),t.renderer.shadowMap.needsUpdate=!0;const z=ce(0,{k:26,c:10.5}),I=ce(1,{k:26,c:10.5}),A=ce(.18,{k:18,c:8});let u=le(320),C=320,k=0,S=0,q=0;function Q(e,h=!1){C=(e%365+365)%365,u=le(C);const N=.15+.85*Math.max(0,Math.min(1,u.flush)),v=Math.abs(u.turn-z.t)>.45,a=Math.abs(N-I.t)>.45;return z.t=u.turn,I.t=N,(h||v)&&(z.x=z.t,z.v=0),(h||a)&&(I.x=I.t,I.v=0),t.wake(),u}function Z(e){A.t=oe(.18+e,.18,1.2),S=Math.max(S,2.5+e*3),t.setLive(!0)}function W(e){const h=p.rosettes;for(let N=0;N<e;N++){const v=o.find(a=>!a.on);if(!v)return;for(let a=0;a<30;a++){const U=Math.floor(m()*(h.length/i))*i;if(h[U+9]<0||h[U+1]<4)continue;v.on=1,v.land=0,v.t=0,v.p.set(h[U],h[U+1],h[U+2]),v.v.set((m()-.5)*.4,-.2,(m()-.5)*.4),v.r.set(m()*6.28,m()*6.28,m()*6.28),v.w.set((m()-.5)*6,(m()-.5)*6,(m()-.5)*6),v.s=.26+m()*.14;const X=o.indexOf(v),Le=z.x>.05?.55+m()*.5:.08+m()*.3;P[X*4]=Le,P[X*4+1]=Math.floor(m()*4),P[X*4+2]=m(),P[X*4+3]=1;break}}O.attributes.aLoose.needsUpdate=!0}function J(e,h=1){const N=q++%4;l.uTouchO.value[N].set(e.origin.x,e.origin.y,e.origin.z,l.uTime.value),l.uTouchD.value[N].set(e.direction.x,e.direction.y,e.direction.z,oe(h,0,1.6)),S=Math.max(S,3.2),t.setLive(!0)}const K=(e,h)=>Math.hypot(e+.5,h)<5.6?.12:-.82;function B(e){let h=!1;if(ue(z,e)&&(h=!0),ue(I,e)&&(h=!0),ue(A,e)&&(h=!0),l.uTurn.value=z.x,l.uFlushG.value=I.x,l.uWind.value=A.x,A.t>.2&&Math.abs(A.x-A.t)<.05&&(A.t=.18),S>0){S-=e,l.uTime.value+=e,l.uGust.value=.5+.5*Math.sin(l.uTime.value*.7);const v=z.x>0?oe((1.38-z.x)/.9,0,1):1,a=u.fallRate/60*(.6+A.x*5);if(k+=e*Math.min(6,a*2.5)*(v>.05?1:0),k>1){const U=Math.floor(k);k-=U,W(U)}}let N=!1;for(let v=0;v<V;v++){const a=o[v];if(!a.on)continue;if(N=!0,a.t+=e,a.land)a.t-a.land>6&&(a.on=0,P[v*4+3]=0,O.attributes.aLoose.needsUpdate=!0);else{a.v.y+=(-1.6-a.v.y*1.8)*e,a.v.x+=(l.uWindDir.value.x*A.x*1.2-a.v.x*.8+Math.sin(a.t*3+v)*.9)*e,a.v.z+=(l.uWindDir.value.z*A.x*1.2-a.v.z*.8+Math.cos(a.t*2.6+v)*.9)*e,a.p.addScaledVector(a.v,e),a.r.x+=a.w.x*e,a.r.y+=a.w.y*e,a.r.z+=a.w.z*e;const X=K(a.p.x,a.p.z);a.p.y<=X&&(a.p.y=X+.01,a.land=a.t,a.r.x=-Math.PI/2+(m()-.5)*.3,a.r.z=0)}const U=a.land?oe(1-(a.t-a.land-4)/2,0,1):1;b.setFromEuler(a.r),M.setScalar(a.s*U),c.compose(a.p,b,M),n.setMatrixAt(v,c)}return N&&(n.instanceMatrix.needsUpdate=!0,h=!0),S<=0&&!N&&t.setLive(!1),h}function _(e){l.uNight.value=e?1:0,l.uLight.value=e?.75:1,t.wake()}return g?.(),{group:R,leafCount:s.count,setDay:Q,gust:Z,touch:J,update:B,setNight:_,get season(){return u},get doy(){return C}}}const ie=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],ne=t=>t/12*365;function be(t){const r=le(t),g=r.turn>0?Math.min(1,Math.max(0,(r.turn-.25)*.95)):0,p=r.flush<.95?(1-r.flush)*.9:0,i=Pe(g,.3,p,.5).map(j=>Math.round(255*Math.pow(Math.min(1,j*2.1),1/2.2)));return r.fallen>.85&&r.flush<.12?"rgb(150, 128, 104)":`rgb(${i.join(",")})`}const ve={ink:0,clay:.5,real:1,lens:1};function Ze({phone:t}){const[r,g]=G.useState(()=>{const n=Ge();return n.getMonth()+(n.getDate()-1)/31}),[p,Y]=G.useState("real"),[i,l]=G.useState(!1),[j,F]=G.useState(!1),[x,T]=G.useState(0),y=G.useRef(null),L=G.useRef(null),s=G.useRef(null),d=G.useRef({v:r,t:performance.now()}),E=G.useMemo(()=>le(ne(r)),[r]),$=G.useMemo(()=>Array.from({length:48},(n,o)=>be(ne((o+.5)/4))),[]),D=be(ne(r));G.useLayoutEffect(()=>{const n=y.current;let o=!1,c;try{c=Oe({host:n,reveal:0,ortho:!1,creaseLo:.36,creaseHi:.72,depthScale:.76,realInk:.03,view:t?{az:34,el:8,dist:74,tx:-1.2,ty:6.4,tz:-.2,fov:28}:{az:34,el:7,dist:58,tx:-1.8,ty:6.9,tz:-.2,fov:26},orbit:{az:!0,el:!0,zoom:!0,elMin:2,elMax:60},maxDpr:t?1.5:1.75,onFrame:M=>s.current?.update(M)??!1})}catch{F(!0);return}L.current=c,c.U.uInkR.value=0,He(c,{density:t?.3:.42}).then(M=>{if(o)return;s.current=M,M.setDay(ne(r),!0),M.setNight(de()),T(M.leafCount),l(!0);const m=c.project(new w(0,.6,0)),R=[m.x/c.size.width,1-m.y/c.size.height];c.inkIn(R,1.25),window.setTimeout(()=>{o||c.develop(ve[p],R,1.7)},950)}).catch(()=>l(!1));const b=new MutationObserver(()=>s.current?.setNight(de()));return b.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme"]}),()=>{o=!0,b.disconnect(),c.dispose(),L.current=null,s.current=null}},[t]);const V=n=>{const o=performance.now(),c=Math.max(16,o-d.current.t),b=Math.abs(n-d.current.v)/(c/1e3);d.current={v:n,t:o},g(n),s.current?.setDay(ne(n)),b>.4&&s.current?.gust(Math.min(1,b/14))},O=n=>{Y(n);const o=L.current;if(o&&(o.setLoupe(n==="lens"?t?.17:.15:0,!0),Math.abs(o.reveal-ve[n])>.01)){const c=o.project(new w(0,.6,0));o.develop(ve[n],[c.x/o.size.width,1-c.y/o.size.height],1.2)}},P=G.useRef({x:0,y:0,t:0}),ee=n=>{const o=L.current,c=s.current;if(!o||!c||n.buttons)return;const b=performance.now(),M=P.current,m=Math.hypot(n.clientX-M.x,n.clientY-M.y)/Math.max(8,b-M.t);b-M.t>70&&m>.25?(c.touch(o.rayAt(n.clientX,n.clientY),Math.min(1.4,m*.9)),P.current={x:n.clientX,y:n.clientY,t:b}):b-M.t>70&&(P.current={x:n.clientX,y:n.clientY,t:b})};G.useEffect(()=>(window.__tree={month:V,mode:O,get stage(){return L.current},get ctrl(){return s.current}},()=>{delete window.__tree}));const H=Math.floor(r)%12;return f.jsxs("div",{className:"tree",children:[f.jsx(Te,{kicker:"榄仁 · Terminalia catappa",title:"榄仁",sub:"北门入口与一号教学楼前，各立一株大叶榄仁。拖动月份，看它的一年。"}),f.jsxs("div",{className:"tree-body","data-rv":!0,children:[f.jsxs("figure",{className:"tree-photo",children:[f.jsx("img",{src:"img/web/lanshu-1600.jpg",alt:"海南中学校园里的大叶榄仁树，枝干横展",loading:"lazy",decoding:"async"}),f.jsx("figcaption",{children:"校园里的百年榄仁 · 图：海南中学官网"})]}),f.jsxs("div",{className:"tree-fig",children:[f.jsxs("div",{className:"tree-stage"+(i?" is-ready":""),onPointerMove:ee,children:[f.jsx("div",{ref:y,className:"tree-canvas","aria-label":`三维榄仁树 · ${ie[H]} · ${E.label}。拖动可环绕。`,role:"img"}),!i&&f.jsx("div",{className:"tree-wait",children:j?"这台设备没有可用的 WebGL，三维榄仁无法显示；左侧照片与下方月份仍可使用。":"正在载入真实的榄仁树…"}),f.jsx("div",{className:"tree-modes",children:f.jsx(Ne,{size:"sm",value:p,onChange:O,label:"表达",options:[{id:"ink",label:"线稿"},{id:"clay",label:"白模"},{id:"real",label:"实景"},{id:"lens",label:"透镜"}]})})]}),f.jsxs("div",{className:"tree-phase",children:[f.jsx("b",{children:ie[H]}),f.jsx("span",{children:E.label}),f.jsx("span",{className:"demo-tag",children:"推演"})]}),f.jsx(je,{value:r,min:0,max:11.99,step:.01,onChange:V,format:n=>ie[Math.floor(n)%12],label:"月份",tint:D,onGrab:n=>{n||s.current?.gust(.05)},backdrop:f.jsx("div",{className:"tree-ribbon",children:$.map((n,o)=>f.jsx("i",{style:{background:n}},o))})}),f.jsx("div",{className:"tree-months","aria-hidden":"true",children:ie.map((n,o)=>f.jsx("span",{className:o===H?"is-on":"",children:o+1},o))})]})]}),f.jsx(De,{kicker:"Notes",title:"关于这株树",children:f.jsxs("p",{className:"prose",children:["右边是 HAIZ 已有的真实榄仁资产：",f.jsx("code",{children:"tree.glb"})," 的树干与板根（约 25 万顶点）、10,947 个叶簇展开的 ",x?x.toLocaleString():"约三万"," 片叶，和它站立的太湖石岛；同一个模型、同一台相机，画成线稿、白模或实景，像素对齐（Experiment 003 的同源显影）。 每片叶有自己的萌发时间；月份滑块驱动的是主站「年轮」使用的物候模型：旧叶先转红、各自落下，新梢在早春抽出古铜色的嫩叶再转绿。它是对海口一带大叶榄仁常见物候的推演，不是这株树的逐年观测，模型也是树种的概念模型而非实测。",f.jsx(Fe,{children:"物候为推演"})]})})]})}export{Ze as default};
