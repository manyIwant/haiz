import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const error=(status,message,extra={})=>Object.assign(new Error(message),{status,...extra});
const text=(v,max)=>String(v??'').trim().slice(0,max);
export function createFlowStore(file,persist=true){
 let db={drafts:[],notices:[],audit:[],requests:{},sequence:0};
 if(persist&&existsSync(file))db=JSON.parse(readFileSync(file,'utf8'));
 const save=()=>{if(persist){writeFileSync(file+'.tmp',JSON.stringify(db),{mode:0o600});renameSync(file+'.tmp',file)}};
 const owned=(who,id)=>{const d=db.drafts.find(d=>d.id===id&&d.ownerId===who.name);if(!d)throw error(404,'草稿不存在或不属于当前身份');return d};
 const feed=(who)=>db.notices.filter(n=>n.scope===who.scope&&n.state==='published'&&Date.parse(n.startsAt)<=Date.now()&&Date.parse(n.expiresAt)>Date.now()).map(({id,revision,title,summary,scope,startsAt,expiresAt,updatedAt})=>({id,revision,title,summary,scope,startsAt,expiresAt,updatedAt}));
 return async function handle(req,res,url,who){
  if(!url.pathname.startsWith('/api/flow/'))return false;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return true};
  let before;
  try{
   if(req.method==='GET'){
    if(url.pathname==='/api/flow/me')return reply(200,{identity:who,demo:true,serverTime:new Date().toISOString()});
    if(url.pathname==='/api/flow/feed')return reply(200,{notices:feed(who),sequence:db.sequence,serverTime:new Date().toISOString()});
    if(who.role!=='teacher')throw error(403,'仅教师可读自己的草稿');
    if(url.pathname==='/api/flow/drafts')return reply(200,{drafts:db.drafts.filter(d=>d.ownerId===who.name),notices:db.notices.filter(n=>n.ownerId===who.name),audit:db.audit.filter(a=>a.actorId===who.name),serverTime:new Date().toISOString()});
    throw error(404,'接口不存在');
   }
   if(req.method!=='POST')throw error(405,'不支持此方法');
   if(who.role!=='teacher')throw error(403,'当前身份不能编辑或发布教师内容');
   if(!String(req.headers['content-type']).startsWith('application/json'))throw error(415,'只接受JSON');
   let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>40000)throw error(413,'草稿过大')}
   let input;try{input=JSON.parse(raw)}catch{throw error(400,'JSON无效')}
   const key=text(req.headers['idempotency-key'],100);if(!/^[\w-]{12,100}$/.test(key))throw error(400,'需要有效的幂等键');
   const requestKey=who.name+':'+key,hash=createHash('sha256').update(url.pathname+raw).digest('hex');
   if(db.requests[requestKey]){const r=db.requests[requestKey];if(r.hash!==hash)throw error(409,'同一请求键不能用于不同操作');return reply(200,r.result)}
   before=structuredClone(db);
   let result,action;
   if(url.pathname==='/api/flow/drafts'){
    const id=text(input.id,80);if(!/^[\w-]{8,80}$/.test(id))throw error(400,'草稿ID无效');
    const old=db.drafts.find(d=>d.id===id);if(old&&old.ownerId!==who.name)throw error(404,'草稿不存在');
    if((old?.revision||0)!==Number(input.expectedRevision))throw error(409,'另一台设备已更新，请选择如何合并',{remote:old});
    if(old&&db.notices.some(n=>n.draftId===id&&n.state==='published'))throw error(409,'请先撤回已发布内容，再修改草稿');
    const startsAt=new Date(input.startsAt).toISOString(),expiresAt=new Date(input.expiresAt).toISOString();
    if(Date.parse(expiresAt)<=Date.parse(startsAt))throw error(400,'失效时间必须晚于生效时间');
    if(input.scope!==who.scope)throw error(403,'当前身份未获该班级授权');
    const d={id,ownerId:who.name,scope:who.scope,title:text(input.title,100),body:text(input.body,8000),summary:text(input.summary,600),startsAt,expiresAt,revision:(old?.revision||0)+1,updatedAt:new Date().toISOString(),updatedBy:who.name,sourceDevice:text(input.sourceDevice,30),step:'editing',visibility:'private',cursor:Math.max(0,Math.min(8000,Number(input.cursor)||0))};
    if(!d.title)throw error(400,'请填写标题');
    if(old)db.drafts[db.drafts.indexOf(old)]=d;else db.drafts.push(d);
    result={draft:d};action='draft_saved';
   }else if(url.pathname==='/api/flow/publish'){
    const d=owned(who,input.id);if(d.revision!==Number(input.expectedRevision))throw error(409,'草稿版本已变化，请重新预览',{remote:d});
    if(input.confirmed!==true||input.confirmedSummary!==d.summary)throw error(400,'需要核对公开摘要并明确确认');
    if(!d.summary||Date.parse(d.expiresAt)<=Date.now())throw error(400,'摘要为空或内容已过期');
    if(db.notices.some(n=>n.draftId===d.id&&n.state==='published'))throw error(409,'该草稿已发布');
    const n={id:randomUUID(),draftId:d.id,ownerId:who.name,scope:who.scope,title:d.title,summary:d.summary,startsAt:d.startsAt,expiresAt:d.expiresAt,revision:1,state:'published',updatedAt:new Date().toISOString(),approval:{actorId:who.name,confirmedAt:new Date().toISOString(),policy:'demo-authorized-class-teacher'}};
    db.notices.push(n);result={notice:n};action='notice_published';
   }else if(url.pathname==='/api/flow/revoke'){
    const n=db.notices.find(n=>n.id===input.id&&n.ownerId===who.name);if(!n)throw error(404,'公告不存在');
    if(n.revision!==Number(input.expectedRevision))throw error(409,'公告版本已变化');
    if(n.state!=='published')throw error(409,'公告已经撤回');
    n.state='revoked';n.revision++;n.updatedAt=new Date().toISOString();result={notice:n};action='notice_revoked';
   }else throw error(404,'接口不存在');
   db.sequence++;db.audit.push({id:randomUUID(),actorId:who.name,action,objectId:result.draft?.id||result.notice.id,revision:result.draft?.revision||result.notice.revision,at:new Date().toISOString()});
   db.requests[requestKey]={hash,result:structuredClone(result)};save();return reply(200,result);
  }catch(e){if(before)db=before;return reply(e.status||400,{error:e.message,...(e.remote?{remote:e.remote}:{})})}
 };
}
