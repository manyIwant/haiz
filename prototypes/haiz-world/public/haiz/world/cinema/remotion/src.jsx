import React from 'react';
import {registerRoot,Composition,AbsoluteFill,useCurrentFrame,Sequence,Video,Img,staticFile} from 'remotion';
import {identityFrame,palettes} from '../identity.js';
const Film=({theme='porcelain'})=>{
 const f=useCurrentFrame(),s=identityFrame(f,theme),a=s.aperture;
 const hole={x:314-(314+200)*a,y:394-(394+100)*a,w:372+(1000+400-372)*a,h:552+(1778+200-552)*a};
 return <AbsoluteFill style={{background:s.palette.base}}>
 <Sequence from={54} durationInFrames={108}><Video src={staticFile('room.mp4')} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></Sequence>
 {f>=162&&<Img src={staticFile('poster.png')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
 {f<72&&<svg viewBox="0 0 1000 1778" style={{position:'absolute',width:'100%',height:'100%'}}>
 <defs><mask id="opening"><rect width="1000" height="1778" fill="white"/>{f>=57&&<rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} fill="black" rx={3+18*a}/>}</mask></defs>
 <g mask="url(#opening)"><rect width="1000" height="1778" fill={s.palette.base}/>{s.pieces.map(p=><path key={p.id} d={p.d} fill={p.fill}/>)}
 <text x="500" y="1190" textAnchor="middle" fill={s.palette.ink} fontSize="23" fontFamily="sans-serif" letterSpacing="4">{s.label}</text>
 <path d="M440 1270h120" stroke={s.palette.warm} strokeWidth="2"/></g></svg>}
 </AbsoluteFill>;
};
const Root=()=>Object.keys(palettes).map(theme=><Composition key={theme} id={'HAIZ-'+theme} component={Film} durationInFrames={168} fps={30} width={1080} height={1920} defaultProps={{theme}}/>);
registerRoot(Root);
