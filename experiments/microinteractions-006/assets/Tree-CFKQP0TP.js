import{q as ce,y as ue,z as oe,r as V,n as de,j as f,S as Ne,f as je,i as Fe}from"./store-BwOtzHES.js";import{s as le,P as Te,b as De,n as Pe,l as _e}from"./index-DI_ZAG3n.js";import{M as fe,V as b,B as Ge,F as me,Q as ze,a as Ve,l as Ie,b as he,c as ge,S as te,D as ae,I as re,d as pe,E as ke,G as Ee,e as Oe}from"./assets-qxrqpRth.js";const se={bud:.035,unfold:.2,mature:.3},Re=`
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
`;function xe(t=2,o=4,h=.62,g=null){const Y=[],s=[],i=[];for(let F=0;F<=o;F++){const p=F/o;for(let w=0;w<=t;w++){const c=w/t*2-1;let D=p,d=Math.abs(c)*h*.5*.16-.1*p*p+.05*p,x=c*h*.5;if(g){d-=g.cup*c*c*h*.5,d+=g.wave*Math.sin(p*Math.PI*g.waves+Math.sign(c)*1.3)*Math.abs(c)**1.5,d+=g.lift*p*p*p;const O=g.twist*p,R=Math.cos(O),T=Math.sin(O);[d,x]=[d*R-x*T,d*T+x*R]}Y.push(D,d,x),s.push((c+1)/2,p)}}for(let F=0;F<o;F++)for(let p=0;p<t;p++){const w=F*(t+1)+p,c=w+1,D=w+t+1,d=D+1;i.push(w,D,c,c,D,d)}const N=new Ge;return N.setAttribute("position",new me(Y,3)),N.setAttribute("uv",new me(s,2)),N.setIndex(i),N.computeVertexNormals(),N}function Se(t){let o=t>>>0;return()=>{o|=0,o=o+1831565813|0;let h=Math.imul(o^o>>>15,1|o);return h=h+Math.imul(h^h>>>7,61|h)^h,((h^h>>>14)>>>0)/4294967296}}function Ue(t,o,h=1,g=1){const Y=t.length/o,s=Se(20231030),i=[],N=[],F=[],p=[],w=new fe,c=new ze,D=new b(0,1,0),d=new b,x=new b,O=new b,R=new b,T=new fe,P=new b,$=new b,_=new b,n=new b,r=Math.pow(1/Math.max(.3,h),.22)*g;let l=0,M=0,y=0,E=1,W=0,z=0;const X=(S,u,C,k,L,Q,Z,J,B,K,ee)=>{const H=Ve.lerp(.8,-.3,L)+(s()-.5)*.7+W*Math.cos(k-z);x.set(Math.cos(k),0,Math.sin(k)).addScaledVector(Q,.45).normalize(),x.y=Math.sin(H),x.normalize(),O.crossVectors(D,x).normalize(),R.crossVectors(x,O).normalize();const G=(s()-.5)*1.3;P.copy(O).multiplyScalar(Math.cos(G)).addScaledVector(R,Math.sin(G)),$.crossVectors(x,P).normalize(),T.makeBasis(x,$,P.multiplyScalar(-1)),c.setFromRotationMatrix(T);const e=(.19+s()*.15)*(.58+.5*L)*r*ee,m=.015+s()*.03,j=(1-L)*0+L*(.02+s()*.07);_.set(S+x.x*m-I.x*j,u+x.y*m*.5-I.y*j,C+x.z*m-I.z*j),w.compose(_,c,n.set(e,e,e));for(let v=0;v<16;v++)i.push(w.elements[v]);N.push(S,u,C,Z),p.push(l,M,y,E),F.push(J+(1-L)*.025+s()*.012,B,Math.floor(s()*4),K)},A=new b,I=new b;for(let S=0;S<Y;S++){const u=S*o,C=t[u],k=t[u+1],L=t[u+2];d.set(t[u+3],t[u+4],t[u+5]).normalize();const Q=t[u+6],Z=t[u+7],J=t[u+8],B=t[u+9],K=t[u+10];o>=15?(l=t[u+12],M=t[u+13],y=t[u+14]):(l=C,M=k-1,y=L),E=o>=16?t[u+15]:1,I.copy(d),A.set(d.x,0,d.z),A.lengthSq()<1e-4&&A.set(1,0,0),A.normalize();const ee=s()*Math.PI*2;if(W=(s()-.5)*.9,z=s()*Math.PI*2,B>=0){const H=Math.round((9+s()*5)*Q);for(let G=0;G<H;G++)s()>h||X(C,k,L,ee+G*2.39996,1-G/H,A,Z,B,-1,J,1)}if(K>0){const H=B>=0?2+Math.floor(s()*2):Math.round((5+s()*4)*Q);for(let G=0;G<H;G++)B<0&&s()>Math.max(.5,h)||X(C,k,L,ee+1.2+G*2.39996,.75+.25*s(),A,Z,0,K,J,1.12)}}return{count:N.length/4,matrices:new Float32Array(i),rosette:new Float32Array(N),leaf:new Float32Array(F),pad:new Float32Array(p)}}const ye=`
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
`;async function He(t,{density:o=.42,onReady:h}={}){const g=await Ie(),s=g.meta.rosetteStride||16,i={uTime:{value:0},uWind:{value:.2},uGust:{value:.5},uWindDir:{value:new b(.8,0,-.6).normalize()},uTouchO:{value:[0,1,2,3].map(()=>new he(0,-99,0,-99))},uTouchD:{value:[0,1,2,3].map(()=>new he(0,1,0,0))},uGrow:{value:1},uYear:{value:1},uTurn:{value:0},uFlushG:{value:1},uAtlas:{value:g.leafAtlas},uSunDir:{value:new b(.55,.76,.35).normalize()},uLight:{value:1},uNight:{value:0}},N=new ge({name:"TerminaliaBark",map:g.barkColor,normalMap:g.barkNormal,color:12164226,roughness:.92,metalness:0}),F=new ge({name:"TaihuIsland",color:9406587,roughness:.94,metalness:0});F.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vIsoPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vIsoPos = position;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vIsoPos;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
`+ye)};const p=new te({side:ae,uniforms:{uMatA:{value:.34}},vertexShader:"varying vec3 vVN; varying vec3 vIsoPos; void main(){ vIsoPos = position; vVN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",fragmentShader:`uniform float uMatA; varying vec3 vVN; varying vec3 vIsoPos; void main(){ ${ye} gl_FragColor = vec4(normalize(vVN)*0.5+0.5, uMatA); }`}),w=g.tree.clone(!0);w.traverse(e=>{e.isMesh&&(e.material=N,e.castShadow=!0,e.receiveShadow=!0)});const c=g.island.clone(!0),D=new Set;c.traverse(e=>{e.isMesh&&(e.material=F,e.receiveShadow=!0,D.add(e))});const d=Ue(g.rosettes,s,o),x=xe(2,3,.62);x.setAttribute("aRosette",new re(d.rosette,4)),x.setAttribute("aLeaf",new re(d.leaf,4)),x.setAttribute("aPad",new re(d.pad,4));const O=new te({name:"TerminaliaFoliage",side:ae,uniforms:i,vertexShader:we(!1),fragmentShader:$e}),R=new te({side:ae,uniforms:{...i,uMatA:{value:.89},uInflate:{value:1.75}},vertexShader:we(!0),fragmentShader:Ye}),T=new pe(x,O,d.count);T.instanceMatrix.array.set(d.matrices),T.instanceMatrix.needsUpdate=!0,T.frustumCulled=!1,T.castShadow=!1;const P=220,$=xe(2,2,.62),_=new Float32Array(P*4);$.setAttribute("aLoose",new re(_,4));const n=new te({name:"LooseLeaf",side:ae,uniforms:i,vertexShader:Me(!1),fragmentShader:We}),r=new te({side:ae,uniforms:{uAtlas:i.uAtlas,uMatA:{value:.89}},vertexShader:Me(!0),fragmentShader:Be}),l=new pe($,n,P);l.frustumCulled=!1;const M=Array.from({length:P},()=>({on:0,p:new b,v:new b,r:new ke,w:new b,t:0,s:.3,land:0})),y=new fe,E=new ze,W=new b;for(let e=0;e<P;e++)y.makeScale(0,0,0),l.setMatrixAt(e,y);const z=Se(7),X=new Ee;X.add(c,w,T,l),t.scene.add(X),t.registerObject(X,{customNd:e=>e===T?R:e===l?r:D.has(e)?p:null}),t.sun.position.set(-60,90,70),t.sun.shadow.camera.left=-22,t.sun.shadow.camera.right=22,t.sun.shadow.camera.top=22,t.sun.shadow.camera.bottom=-22,t.sun.shadow.camera.near=1,t.sun.shadow.camera.far=320,t.sun.shadow.camera.updateProjectionMatrix(),i.uSunDir.value.copy(t.sun.position).normalize(),t.renderer.shadowMap.needsUpdate=!0;const A=ce(0,{k:26,c:10.5}),I=ce(1,{k:26,c:10.5}),S=ce(.18,{k:18,c:8});let u=le(320),C=320,k=0,L=0,Q=0;function Z(e,m=!1){C=(e%365+365)%365,u=le(C);const j=.15+.85*Math.max(0,Math.min(1,u.flush)),v=Math.abs(u.turn-A.t)>.45,a=Math.abs(j-I.t)>.45;return A.t=u.turn,I.t=j,(m||v)&&(A.x=A.t,A.v=0),(m||a)&&(I.x=I.t,I.v=0),t.wake(),u}function J(e){S.t=oe(.18+e,.18,1.2),L=Math.max(L,2.5+e*3),t.setLive(!0)}function B(e){const m=g.rosettes;for(let j=0;j<e;j++){const v=M.find(a=>!a.on);if(!v)return;for(let a=0;a<30;a++){const U=Math.floor(z()*(m.length/s))*s;if(m[U+9]<0||m[U+1]<4)continue;v.on=1,v.land=0,v.t=0,v.p.set(m[U],m[U+1],m[U+2]),v.v.set((z()-.5)*.4,-.2,(z()-.5)*.4),v.r.set(z()*6.28,z()*6.28,z()*6.28),v.w.set((z()-.5)*6,(z()-.5)*6,(z()-.5)*6),v.s=.26+z()*.14;const q=M.indexOf(v),Le=A.x>.05?.55+z()*.5:.08+z()*.3;_[q*4]=Le,_[q*4+1]=Math.floor(z()*4),_[q*4+2]=z(),_[q*4+3]=1;break}}$.attributes.aLoose.needsUpdate=!0}function K(e,m=1){const j=Q++%4;i.uTouchO.value[j].set(e.origin.x,e.origin.y,e.origin.z,i.uTime.value),i.uTouchD.value[j].set(e.direction.x,e.direction.y,e.direction.z,oe(m,0,1.6)),L=Math.max(L,3.2),t.setLive(!0)}const ee=(e,m)=>Math.hypot(e+.5,m)<5.6?.12:-.82;function H(e){let m=!1;if(ue(A,e)&&(m=!0),ue(I,e)&&(m=!0),ue(S,e)&&(m=!0),i.uTurn.value=A.x,i.uFlushG.value=I.x,i.uWind.value=S.x,S.t>.2&&Math.abs(S.x-S.t)<.05&&(S.t=.18),L>0){L-=e,i.uTime.value+=e,i.uGust.value=.5+.5*Math.sin(i.uTime.value*.7);const v=A.x>0?oe((1.38-A.x)/.9,0,1):1,a=u.fallRate/60*(.6+S.x*5);if(k+=e*Math.min(6,a*2.5)*(v>.05?1:0),k>1){const U=Math.floor(k);k-=U,B(U)}}let j=!1;for(let v=0;v<P;v++){const a=M[v];if(!a.on)continue;if(j=!0,a.t+=e,a.land)a.t-a.land>6&&(a.on=0,_[v*4+3]=0,$.attributes.aLoose.needsUpdate=!0);else{a.v.y+=(-1.6-a.v.y*1.8)*e,a.v.x+=(i.uWindDir.value.x*S.x*1.2-a.v.x*.8+Math.sin(a.t*3+v)*.9)*e,a.v.z+=(i.uWindDir.value.z*S.x*1.2-a.v.z*.8+Math.cos(a.t*2.6+v)*.9)*e,a.p.addScaledVector(a.v,e),a.r.x+=a.w.x*e,a.r.y+=a.w.y*e,a.r.z+=a.w.z*e;const q=ee(a.p.x,a.p.z);a.p.y<=q&&(a.p.y=q+.01,a.land=a.t,a.r.x=-Math.PI/2+(z()-.5)*.3,a.r.z=0)}const U=a.land?oe(1-(a.t-a.land-4)/2,0,1):1;E.setFromEuler(a.r),W.setScalar(a.s*U),y.compose(a.p,E,W),l.setMatrixAt(v,y)}return j&&(l.instanceMatrix.needsUpdate=!0,m=!0),L<=0&&!j&&t.setLive(!1),m}function G(e){i.uNight.value=e?1:0,i.uLight.value=e?.75:1,t.wake()}return h?.(),{group:X,leafCount:d.count,setDay:Z,gust:J,touch:K,update:H,setNight:G,get season(){return u},get doy(){return C}}}const ie=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],ne=t=>t/12*365;function be(t){const o=le(t),h=o.turn>0?Math.min(1,Math.max(0,(o.turn-.25)*.95)):0,g=o.flush<.95?(1-o.flush)*.9:0,s=_e(h,.3,g,.5).map(N=>Math.round(255*Math.pow(Math.min(1,N*2.1),1/2.2)));return o.fallen>.85&&o.flush<.12?"rgb(150, 128, 104)":`rgb(${s.join(",")})`}const ve={ink:0,clay:.5,real:1,lens:1};function Ze({phone:t}){const[o,h]=V.useState(()=>{const n=Pe();return n.getMonth()+(n.getDate()-1)/31}),[g,Y]=V.useState("real"),[s,i]=V.useState(!1),[N,F]=V.useState(0),p=V.useRef(null),w=V.useRef(null),c=V.useRef(null),D=V.useRef({v:o,t:performance.now()}),d=V.useMemo(()=>le(ne(o)),[o]),x=V.useMemo(()=>Array.from({length:48},(n,r)=>be(ne((r+.5)/4))),[]),O=be(ne(o));V.useLayoutEffect(()=>{const n=p.current;let r=!1;const l=Oe({host:n,reveal:0,ortho:!1,creaseLo:.36,creaseHi:.72,depthScale:.76,realInk:.03,view:t?{az:34,el:8,dist:74,tx:-1.2,ty:6.4,tz:-.2,fov:28}:{az:34,el:7,dist:58,tx:-1.8,ty:6.9,tz:-.2,fov:26},orbit:{az:!0,el:!0,zoom:!0,elMin:2,elMax:60},maxDpr:t?1.5:1.75,onFrame:y=>c.current?.update(y)??!1});w.current=l,l.U.uInkR.value=0,He(l,{density:t?.3:.42}).then(y=>{if(r)return;c.current=y,y.setDay(ne(o),!0),y.setNight(de()),F(y.leafCount),i(!0);const E=l.project(new b(0,.6,0)),W=[E.x/l.size.width,1-E.y/l.size.height];l.inkIn(W,1.25),window.setTimeout(()=>{r||l.develop(ve[g],W,1.7)},950)}).catch(()=>i(!1));const M=new MutationObserver(()=>c.current?.setNight(de()));return M.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme"]}),()=>{r=!0,M.disconnect(),l.dispose(),w.current=null,c.current=null}},[t]);const R=n=>{const r=performance.now(),l=Math.max(16,r-D.current.t),M=Math.abs(n-D.current.v)/(l/1e3);D.current={v:n,t:r},h(n),c.current?.setDay(ne(n)),M>.4&&c.current?.gust(Math.min(1,M/14))},T=n=>{Y(n);const r=w.current;if(r&&(r.setLoupe(n==="lens"?t?.17:.15:0,!0),Math.abs(r.reveal-ve[n])>.01)){const l=r.project(new b(0,.6,0));r.develop(ve[n],[l.x/r.size.width,1-l.y/r.size.height],1.2)}},P=V.useRef({x:0,y:0,t:0}),$=n=>{const r=w.current,l=c.current;if(!r||!l||n.buttons)return;const M=performance.now(),y=P.current,E=Math.hypot(n.clientX-y.x,n.clientY-y.y)/Math.max(8,M-y.t);M-y.t>70&&E>.25?(l.touch(r.rayAt(n.clientX,n.clientY),Math.min(1.4,E*.9)),P.current={x:n.clientX,y:n.clientY,t:M}):M-y.t>70&&(P.current={x:n.clientX,y:n.clientY,t:M})};V.useEffect(()=>(window.__tree={month:R,mode:T,get stage(){return w.current},get ctrl(){return c.current}},()=>{delete window.__tree}));const _=Math.floor(o)%12;return f.jsxs("div",{className:"tree",children:[f.jsx(Te,{kicker:"榄仁 · Terminalia catappa",title:"榄仁",sub:"北门入口与一号教学楼前，各立一株大叶榄仁。拖动月份，看它的一年。"}),f.jsxs("div",{className:"tree-body","data-rv":!0,children:[f.jsxs("figure",{className:"tree-photo",children:[f.jsx("img",{src:"img/web/lanshu-1600.jpg",alt:"海南中学校园里的大叶榄仁树，枝干横展",loading:"lazy",decoding:"async"}),f.jsx("figcaption",{children:"校园里的百年榄仁 · 图：海南中学官网"})]}),f.jsxs("div",{className:"tree-fig",children:[f.jsxs("div",{className:"tree-stage"+(s?" is-ready":""),onPointerMove:$,children:[f.jsx("div",{ref:p,className:"tree-canvas","aria-label":`三维榄仁树 · ${ie[_]} · ${d.label}。拖动可环绕。`,role:"img"}),!s&&f.jsx("div",{className:"tree-wait",children:"正在载入真实的榄仁树…"}),f.jsx("div",{className:"tree-modes",children:f.jsx(Ne,{size:"sm",value:g,onChange:T,label:"表达",options:[{id:"ink",label:"线稿"},{id:"clay",label:"白模"},{id:"real",label:"实景"},{id:"lens",label:"透镜"}]})})]}),f.jsxs("div",{className:"tree-phase",children:[f.jsx("b",{children:ie[_]}),f.jsx("span",{children:d.label}),f.jsx("span",{className:"demo-tag",children:"推演"})]}),f.jsx(je,{value:o,min:0,max:11.99,step:.01,onChange:R,format:n=>ie[Math.floor(n)%12],label:"月份",tint:O,onGrab:n=>{n||c.current?.gust(.05)},backdrop:f.jsx("div",{className:"tree-ribbon",children:x.map((n,r)=>f.jsx("i",{style:{background:n}},r))})}),f.jsx("div",{className:"tree-months","aria-hidden":"true",children:ie.map((n,r)=>f.jsx("span",{className:r===_?"is-on":"",children:r+1},r))})]})]}),f.jsx(De,{kicker:"Notes",title:"关于这株树",children:f.jsxs("p",{className:"prose",children:["右边是 HAIZ 已有的真实榄仁资产：",f.jsx("code",{children:"tree.glb"})," 的树干与板根（约 25 万顶点）、10,947 个叶簇展开的 ",N?N.toLocaleString():"约三万"," 片叶，和它站立的太湖石岛；同一个模型、同一台相机，画成线稿、白模或实景，像素对齐（Experiment 003 的同源显影）。 每片叶有自己的萌发时间；月份滑块驱动的是主站「年轮」使用的物候模型：旧叶先转红、各自落下，新梢在早春抽出古铜色的嫩叶再转绿。它是对海口一带大叶榄仁常见物候的推演，不是这株树的逐年观测，模型也是树种的概念模型而非实测。",f.jsx(Fe,{children:"物候为推演"})]})})]})}export{Ze as default};
