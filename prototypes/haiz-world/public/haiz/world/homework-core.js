// Public class assignments only. No student identities, submissions, scores or progress.
export const SUBJECTS=['语文','数学','英语','物理','化学','生物','政治','历史','地理','其他'];
const fail=s=>{throw Error(s)};
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
export function schoolDate(now=Date.now()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-')}
export function cleanAssignment(raw){
 if(!raw||!/^\d{4}-\d{2}-\d{2}$/.test(raw.studyDate)||!SUBJECTS.includes(raw.subject)||!Number.isFinite(Date.parse(raw.studyDate+'T00:00:00Z'))||new Date(raw.studyDate+'T00:00:00Z').toISOString().slice(0,10)!==raw.studyDate)fail('请选择有效日期和学科。');
 const content=str(raw.content,401).trim();if(!content||content.length>400)fail('请填写 1–400 字的作业要求，便于教室屏完整阅读。');
 return {id:str(raw.id,80),version:Math.max(1,Number(raw.version)||1),scope:str(raw.scope,60),studyDate:raw.studyDate,subject:raw.subject,content,materials:str(raw.materials,100),due:str(raw.due,100),status:raw.status==='withdrawn'?'withdrawn':'published',review:raw.review==='pending'?'pending':'approved',actor:str(raw.actor,80),updatedAt:str(raw.updatedAt,40),demo:true};
}
export function cleanAssignments(list){return (Array.isArray(list)?list:[]).slice(0,500).flatMap(x=>{try{return [cleanAssignment(x)]}catch{return []}})}
export function upsertAssignment(list,input,{scope,actor,admin=false},now=Date.now()){
 const old=list.find(x=>x.id===input.id);
 if(!admin&&input.scope!==scope)fail('不能向其他班级发布作业。');
 if(old&&!admin&&(old.scope!==scope||old.actor!==actor))fail('只能修改自己发布的本班作业。');
 if(old&&Number(input.version)!==old.version)fail('作业已有新版本，请刷新后再修改。');
 const n=cleanAssignment({...input,id:old?.id||crypto.randomUUID(),version:(old?.version||0)+1,actor:old?.actor||actor,updatedAt:new Date(now).toISOString(),status:'published',review:input.submitForReview?'pending':'approved'});
 return [n,...list.filter(x=>x.id!==n.id)].slice(0,500);
}
export function assignmentAction(list,input,{scope,actor,admin=false},now=Date.now()){
 const old=list.find(x=>x.id===input.id);if(!old)fail('作业不存在。');if(!admin&&(old.actor!==actor||old.scope!==scope))fail('不能修改其他发布者或班级的作业。');if(Number(input.version)!==old.version)fail('作业已有新版本，请刷新后重试。');if(!['withdraw','approve'].includes(input.operation))fail('不支持此操作。');if(input.operation==='approve'&&!admin)fail('待审作业需要管理员审核。');return list.map(x=>x.id===old.id?{...x,version:x.version+1,status:input.operation==='withdraw'?'withdrawn':x.status,review:input.operation==='approve'?'approved':x.review,updatedAt:new Date(now).toISOString()}:x);
}
export function todayAssignments(list,scope,now=Date.now()){return cleanAssignments(list).filter(x=>x.scope===scope&&x.studyDate===schoolDate(now)&&x.status==='published'&&x.review==='approved').sort((a,b)=>SUBJECTS.indexOf(a.subject)-SUBJECTS.indexOf(b.subject)||Date.parse(a.updatedAt)-Date.parse(b.updatedAt))}
export function eveningSessions(bridge,now=Date.now()){
 if(!bridge||bridge.conflict||!bridge.available||bridge.scheduleDate!==schoolDate(now))return [];
 const rows=(bridge.schedule||[]).filter(r=>r.kind==='self-study'||/自习|晚修/.test(r.subject||'')).map(r=>({...r,start:Date.parse(r.startAt),end:Date.parse(r.endAt)})).filter(r=>Number.isFinite(r.start)&&r.end>r.start&&schoolDate(r.start)===schoolDate(now)&&schoolDate(r.end-1)===schoolDate(now)).sort((a,b)=>a.start-b.start);
 if(rows.length<2)return [];const last=rows.slice(-2);if(last[0].end>last[1].start)return [];return last.map((r,i)=>({...r,session:i+1}));
}
export function eveningWindow(bridge,now=Date.now()){return eveningSessions(bridge,now).find(r=>now>=r.start&&now<r.end)||null}
export function mockEveningBridge(now=Date.now()){
 const date=schoolDate(now),at=t=>new Date(date+'T'+t+':00+08:00').toISOString();
 return {source:'simulator',version:'SIM-2',label:'本地模拟课表 · 非 ClassIsland 实时数据',available:true,conflict:false,scheduleDate:date,state:'class',current:'自习',next:'自习',schedule:[{period:'午间自习',subject:'自习',kind:'self-study',startAt:at('12:30'),endAt:at('13:00'),time:'12:30–13:00'},{period:'第九节',subject:'自习',kind:'self-study',startAt:at('19:00'),endAt:at('19:45'),time:'19:00–19:45'},{period:'第十节',subject:'自习',kind:'self-study',startAt:at('19:55'),endAt:at('20:40'),time:'19:55–20:40'}]};
}
