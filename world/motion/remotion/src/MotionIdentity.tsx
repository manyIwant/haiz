import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';
import {clamp,ease,segments,ringPiece,interpolateShape,toPath} from './geometry';
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const colors={blue:'#315cde',cyan:'#13adae',coral:'#f27559',yellow:'#efbf3f',violet:'#815bd6'};
const FinalUI:React.FC=()=> <AbsoluteFill style={{background:'#f7f5f0',color:'#1e2736',fontFamily:'Arial,sans-serif'}}>
 <div style={{position:'absolute',top:40,left:42,fontWeight:800,fontSize:35,letterSpacing:-2}}>HAIZ<span style={{color:colors.coral}}>•</span></div>
 <div style={{position:'absolute',top:175,left:44,color:colors.blue,fontSize:18,fontWeight:750,letterSpacing:3}}>PERSONAL / STUDY</div>
 <div style={{position:'absolute',top:220,left:44,fontSize:74,fontWeight:650,letterSpacing:-5}}>我的书桌。</div>
 <div style={{position:'absolute',top:325,left:47,fontSize:25,color:'#768296'}}>上次的记录保留在这里。</div>
 <div style={{position:'absolute',top:425,left:39,right:39,height:500,background:'linear-gradient(135deg,#fffefa,#ece9f7)',borderRadius:45,overflow:'hidden',boxShadow:'0 24px 62px #1d274023'}}>
   <svg viewBox="0 0 650 500" style={{width:'100%',height:'90%',position:'absolute',top:20}}>
    <path d="M260 70A184 184 0 1 0 260 438" stroke={colors.violet} strokeWidth="76" opacity=".7" fill="none"/>
    <path d="M260 70A184 184 0 0 1 260 438" stroke={colors.coral} strokeWidth="62" fill="none"/>
    <path d="M104 407L518 91" stroke={colors.blue} strokeWidth="48" strokeLinecap="round"/>
    <path d="M376 153V398" stroke={colors.cyan} strokeWidth="30" strokeLinecap="round"/>
    <circle cx="510" cy="371" r="52" fill={colors.yellow}/><circle cx="510" cy="371" r="23" fill="#fff"/>
   </svg>
   <div style={{position:'absolute',bottom:27,left:29,fontSize:40,fontWeight:700}}>几何光学</div>
 </div>
 <div style={{position:'absolute',bottom:180,left:44,fontSize:21,color:'#768296'}}>专注计时</div>
 <div style={{position:'absolute',bottom:83,left:44,fontSize:64,fontWeight:500}}>25:00</div>
 <div style={{position:'absolute',bottom:35,left:32,right:32,height:10,borderRadius:10,background:'#dce2f0'}}/>
</AbsoluteFill>;
/** Original 12-segment morph; no Google/Gemini brand assets or font copied. */
export const MotionIdentity:React.FC=()=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();const sec=frame/fps;
 const disrupt=ease((sec-.53)/.90),aperture=ease((sec-2.02)/1.23),opacity=1-ease((sec-2.63)/.48);
 const scale=lerp(1,1.07,disrupt)*(1+aperture*3.8),rotation=disrupt*24+aperture*95;
 const words=sec<.55?'01 — TYPE':sec<1.5?'02 — DECONSTRUCT':sec<2.4?'03 — MORPH':sec<3.2?'04 — OPEN':'05 — ARRIVE';
 return <AbsoluteFill style={{background:'#f7f5f0',overflow:'hidden',fontFamily:'Arial,sans-serif'}}>
  <svg viewBox="0 0 1000 1500" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',width:'100%',height:'100%'}}>
   <g transform={`translate(500 640) rotate(${rotation}) scale(${scale}) translate(-500 -640)`} opacity={opacity}>
    {segments.map(([pts,color],i)=>{
     const u=ease((sec-.55-i*.027)/.95),w=ease((sec-1.28-i*.018)/.52),rot=sec>.55?Math.sin(i*1.7)*w*8:0;
     return <path key={i} fill={color} d={toPath(interpolateShape(pts,ringPiece(i),u))} transform={`rotate(${rot} 500 640)`}/>;
    })}
   </g>
   <circle cx="500" cy="640" r={190+aperture*200} fill="none" stroke="#b6cae5" strokeWidth="1" opacity={ease((sec-1.3)/.4)*(1-ease((sec-2.7)/.55))*.7}/>
   <circle cx="500" cy="640" r={40+aperture*155} fill="none" stroke={colors.blue} strokeWidth="2" opacity={ease((sec-1.58)/.36)*(1-ease((sec-2.7)/.35))*.65}/>
  </svg>
  <AbsoluteFill style={{clipPath:`circle(${aperture*2150}px at 50% 42.7%)`}}><FinalUI/></AbsoluteFill>
  <div style={{position:'absolute',bottom:50,left:43,fontSize:16,fontWeight:700,letterSpacing:3,color:'#283963'}}>HAIZ / MOTION STUDY</div>
  <div style={{position:'absolute',bottom:50,right:43,fontSize:16,fontWeight:700,letterSpacing:3,color:'#283963'}}>{words}</div>
  <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${clamp(sec/3.87)*100}%`,background:colors.blue}}/>
 </AbsoluteFill>;
};
