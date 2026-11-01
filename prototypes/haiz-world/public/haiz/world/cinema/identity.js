// Original HAIZ vector construction. Each bar keeps the same four vertices through every phase.
export const palettes={obsidian:{base:'#0E121D',ink:'#F0F2F8',action:'#ABBCFF',warm:'#F0A77B',extra:'#83C8C4'},porcelain:{base:'#F3F1EC',ink:'#242A38',action:'#3C5ABC',warm:'#CF7156',extra:'#338A82'},ocean:{base:'#091D27',ink:'#EAF6F2',action:'#83DAD1',warm:'#F2AD7B',extra:'#A8B9EE'}};
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const bars=[rect(150,620,34,180),rect(270,620,34,180),rect(184,692,86,34),[[350,800],[384,800],[440,620],[404,620]],[[404,620],[440,620],[496,800],[460,800]],rect(384,734,78,30),rect(546,620,36,180),rect(634,620,176,34),[[634,770],[660,800],[810,648],[784,620]],rect(634,766,176,34)];
const book=[[[225,610],[480,650],[480,854],[225,810]],[[520,650],[775,610],[775,810],[520,854]],rect(485,650,30,204),rect(280,690,150,9),rect(280,727,150,9),rect(280,764,150,9),rect(570,690,150,9),rect(570,727,150,9),rect(570,764,150,9),[[225,830],[500,875],[775,830],[500,897]]];
const windowShapes=[rect(290,370,24,600),rect(686,370,24,600),rect(314,370,372,24),rect(314,946,372,24),rect(489,394,22,552),rect(314,650,372,18),rect(240,980,520,24),rect(305,1004,22,155),rect(673,1004,22,155),[[448,956],[500,965],[553,956],[500,944]]];
const offsets=[[-22,-72],[22,72],[0,-8],[-28,25],[28,-25],[0,52],[-12,-70],[22,-32],[-20,15],[10,60]];
const clamp=v=>Math.max(0,Math.min(1,v));const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};
const lerp=(a,b,t)=>a+(b-a)*t;
const shape=(a,b,t)=>a.map((p,i)=>p.map((v,j)=>lerp(v,b[i][j],t)));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const color=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(lerp(v,rgb(b)[i],t)).toString(16).padStart(2,'0')).join('');
export function outline(points,curvature=0){
 // Cubic control points bow the page edges while retaining corresponding anchors.
 let d=`M${points[0].join(' ')}`;
 for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],dx=b[0]-a[0],dy=b[1]-a[1];const bend=(i%2?1:-1)*curvature;d+=`C${a[0]+dx/3-dy*bend} ${a[1]+dy/3+dx*bend} ${a[0]+dx*2/3-dy*bend} ${a[1]+dy*2/3+dx*bend} ${b[0]} ${b[1]}`;}return d+'Z';
}
export function identityFrame(frame,theme='porcelain'){
 const palette=palettes[theme]||palettes.porcelain;
 const pieces=bars.map((bar,i)=>{
  const delay=[0,3,7,2,6,9,4,1,5,8][i];
  const split=bar.map(([x,y])=>[x+offsets[i][0],y+offsets[i][1]]);
  let points=shape(bar,split,ease((frame-8-delay*.25)/16));
  points=shape(points,book[i],ease((frame-22-delay*.32)/21));
  points=shape(points,windowShapes[i],ease((frame-43-delay*.2)/18));
  const accent=[palette.action,palette.warm,palette.extra][i%3];
  const fill=color(palette.ink,accent,ease((frame-10-delay*.4)/21)*.94);
  const curvature=.045*Math.sin(Math.PI*clamp((frame-25)/34));
  return {id:i,points,d:outline(points,curvature),fill};
 });
 return {pieces,palette,aperture:ease((frame-57)/15),label:frame<20?'HAIZ':frame<43?'拆开，再接续。':frame<58?'把思路接回书桌。':'概念学习空间'};
}
