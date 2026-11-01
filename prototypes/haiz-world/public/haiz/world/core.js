// Local demo domain. No identity, permissions or data are trusted outside this browser.
export const STORE='haiz.world.demo.v1';
export const empty=()=>({version:1,demo:true,todos:[false,false,false],notes:'',lessonNote:'从「观点」到「论据」，还可以再多一个生活里的例子。',lessonTitle:'议论文中的逻辑结构',lessonTime:'14:00—14:45',drafts:[],enrolled:[],works:[],audit:[],bookmarks:[],prefs:{mood:'sunset',quality:'balanced'},timer:{duration:1500,remaining:1500,end:null}});
export const text=(v,max=2000)=>typeof v==='string'?v.slice(0,max):'';
export function validate(raw){const d=empty();if(!raw||raw.version!==1)return d;for(const k of ['notes','lessonNote','lessonTitle','lessonTime'])d[k]=text(raw[k],2000)||d[k];for(const k of ['drafts','works','audit','bookmarks'])if(Array.isArray(raw[k]))d[k]=raw[k].filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(0,100);d.todos=Array.isArray(raw.todos)?raw.todos.slice(0,3).map(Boolean):d.todos;d.enrolled=Array.isArray(raw.enrolled)?raw.enrolled.filter(x=>['light','sound'].includes(x)):[];if(['morning','shade','rain','sunset','night'].includes(raw.prefs?.mood))d.prefs.mood=raw.prefs.mood;if(['cinematic','balanced','low'].includes(raw.prefs?.quality))d.prefs.quality=raw.prefs.quality;if(raw.timer&&Number.isFinite(raw.timer.remaining)&&raw.timer.remaining>=0&&raw.timer.remaining<=3600){d.timer={duration:[1500,3000,300].includes(raw.timer.duration)?raw.timer.duration:1500,remaining:raw.timer.remaining,end:Number.isFinite(raw.timer.end)?raw.timer.end:null}}return d;}
export function timerRemaining(timer,now=Date.now()){return timer.end===null?timer.remaining:Math.max(0,Math.ceil((timer.end-now)/1000));}
export function timerToggle(timer,now=Date.now()){const left=timerRemaining(timer,now);return timer.end!==null?{...timer,remaining:left,end:null}:{...timer,remaining:left||timer.duration,end:now+(left||timer.duration)*1000};}
export function canDisplay(work){return work.demo===true&&work.state==='published'&&work.consent===true&&work.completed===true&&work.teacherApproved===true;}
export function transition(work,action,role,now=new Date().toISOString()){
 const w={...work};
 if(action==='submit'&&role==='student'&&['draft','returned','withdrawn'].includes(w.state)){if(!w.title?.trim()||!w.body?.trim()||!w.completed)throw Error('请填写作品与活动记录，并确认演示活动已完成');w.state='submitted';w.consent=false;w.teacherApproved=false;}
 else if(action==='approve'&&role==='teacher'&&w.state==='submitted'&&w.completed){w.state='teacher_approved';w.teacherApproved=true;}
 else if(action==='return'&&role==='teacher'&&w.state==='submitted'){w.state='returned';w.teacherApproved=false;}
 else if(action==='consent'&&role==='student'&&w.state==='teacher_approved'){w.consent=true;w.state='public_requested';}
 else if(action==='publish'&&role==='moderator'&&w.state==='public_requested'&&w.consent&&w.completed&&w.teacherApproved){w.state='published';}
 else if(action==='withdraw'&&role==='student'&&!['draft','withdrawn'].includes(w.state)){w.state='withdrawn';w.consent=false;w.teacherApproved=false;}
 else if(action==='remove'&&role==='moderator'&&w.state==='published'){w.state='removed';w.consent=false;}
 else throw Error('当前状态无法执行此操作');
 w.updatedAt=now;return w;
}
export function enroll(event,ids){if(!event.approved)throw Error('创作提案尚未审核，不能报名');if(ids.includes(event.id))return ids.filter(x=>x!==event.id);return [...ids,event.id];}
