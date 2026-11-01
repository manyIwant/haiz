// A voluntary, local work interval. This is not an attention or attendance measure.
const text=(v,n=2000)=>typeof v==='string'?v.slice(0,n):'';
export function cleanFocus(raw){
 if(!raw||typeof raw!=='object'||!['running','paused','ready','done'].includes(raw.status))return null;
 const duration=[5,15,25,45].includes(raw.minutes)?raw.minutes:25;
 return {thoughtId:text(raw.thoughtId,80),title:text(raw.title,100),next:text(raw.next,500),minutes:duration,remaining:Math.min(duration*60000,Math.max(0,Number(raw.remaining)||0)),startedAt:Number(raw.startedAt)||0,status:raw.status,checkpoint:text(raw.checkpoint),reason:text(raw.reason,100)};
}
export function startFocus(thought,minutes=25){
 if(!thought?.id)throw Error('先留下一件想做的小事。');
 return cleanFocus({thoughtId:thought.id,title:thought.title,next:thought.next,minutes,remaining:minutes*60000,status:'paused',checkpoint:'',reason:''});
}
export function focusLeft(session,now=Date.now()){
 if(!session)return 0;
 return Math.max(0,session.remaining-(session.status==='running'?Math.max(0,now-session.startedAt):0));
}
export function resumeFocus(session,now=Date.now()){
 if(!session||session.status!=='paused'||session.remaining<=0)return session;
 return {...session,status:'running',startedAt:now,reason:''};
}
export function pauseFocus(session,now=Date.now(),reason='已经暂停。线索还在。'){
 if(!session||session.status!=='running')return session;
 const remaining=focusLeft(session,now);
 return {...session,remaining,startedAt:0,status:remaining?'paused':'ready',reason};
}
export function recoverFocus(session){
 // Never infer work performed while the document was closed or suspended.
 return session?.status==='running'?{...session,status:'paused',startedAt:0,reason:'页面重新打开，计时已暂停。可以从留下的线索继续。'}:session;
}
export function clockInterrupted(wallDelta,monoDelta){return wallDelta<0||wallDelta>90000||monoDelta>90000||Math.abs(wallDelta-monoDelta)>5000}
