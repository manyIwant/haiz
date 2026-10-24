export type Point = readonly [number,number];
export type Shape = readonly Point[];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export const clamp=(v:number,min=0,max=1)=>Math.min(max,Math.max(min,v));
export const ease=(t:number)=>{t=clamp(t);return t*t*(3-2*t)};
export function bar(x1:number,y1:number,x2:number,y2:number,w:number):Shape{
 const dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy)||1,nx=-dy*w/(2*d),ny=dx*w/(2*d);
 const p=(a:number,s:number):Point=>[lerp(x1,x2,a)+nx*s,lerp(y1,y2,a)+ny*s];
 return [p(0,1),p(1/3,1),p(2/3,1),p(1,1),p(1,-1),p(2/3,-1),p(1/3,-1),p(0,-1)];
}
export function ringPiece(i:number,n=12):Shape{
 const cx=500,cy=640,a=-Math.PI*.64+i*2*Math.PI/n+.02,b=a+2*Math.PI/n-.06;
 const ri=151+(i%3===0?10:0),ro=203+(i%4===1?5:0);
 const p=(r:number,t:number):Point=>[cx+Math.cos(t)*r,cy+Math.sin(t)*r];
 return [p(ro,a),p(ro,lerp(a,b,1/3)),p(ro,lerp(a,b,2/3)),p(ro,b),p(ri,b),p(ri,lerp(a,b,2/3)),p(ri,lerp(a,b,1/3)),p(ri,a)];
}
export const segments=[
 [bar(212,560,212,723,29),'#315cde'],[bar(294,560,294,723,29),'#13adae'],[bar(212,640,294,640,27),'#815bd6'],
 [bar(363,720,418,560,27),'#f27559'],[bar(418,560,472,720,27),'#efbf3f'],[bar(381,655,455,655,24),'#315cde'],
 [bar(525,559,525,722,30),'#815bd6'],[bar(501,559,549,559,22),'#13adae'],[bar(499,722,552,722,22),'#f27559'],
 [bar(610,560,754,560,27),'#315cde'],[bar(750,565,617,719,29),'#efbf3f'],[bar(608,721,755,721,27),'#13adae']
] as const;
export const interpolateShape=(from:Shape,to:Shape,t:number):Point[]=>from.map((p,i)=>[lerp(p[0],to[i][0],t),lerp(p[1],to[i][1],t)]);
export const toPath=(pts:Shape)=>'M'+pts.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' L')+' Z';
