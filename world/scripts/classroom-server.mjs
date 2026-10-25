import {createFlowStore} from '../flow/store.mjs';
import {upsertAssignment,assignmentAction,cleanAssignments,mockEveningBridge} from '../homework-core.js';
// Authorized localhost-only DEMO backend. No production school integration.
import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync,renameSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seedPublic,publishNotice,changeNotice,SCOPES} from '../round2-core.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const INTEGRATED=!existsSync(path.join(ROOT,'dist/index.html'))&&existsSync(path.join(ROOT,'../campus-3d.html'));
const STATIC=INTEGRATED?path.resolve(ROOT,'..'):existsSync(path.join(ROOT,'dist/index.html'))?path.join(ROOT,'dist'):ROOT;
const ENTRY=INTEGRATED?'/world/':'/';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const fault=(status,message)=>Object.assign(new Error(message),{status});
export function createDemoServer({directory=path.join(ROOT,'.haiz-demo'),tokens=null,persist=true}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const dbPath=path.join(directory,'public-state.json'),keysPath=path.join(directory,'local-demo-keys.json');
 const roles=[['teacher-a','teacher',SCOPES[0]],['teacher-b','teacher',SCOPES[1]],['display-a','display',SCOPES[0]],['display-b','display',SCOPES[1]],['student-a','student',SCOPES[0]],['admin','admin',SCOPES[2]]];
 const credentials=tokens||Object.fromEntries(roles.map(([name])=>[name,randomBytes(32).toString('hex')]));
 const identities=new Map(roles.map(([name,role,scope])=>[credentials[name],{name,role,scope}]));
 if(!tokens)writeFileSync(keysPath,JSON.stringify(credentials,null,2),{mode:0o600});
 let state=seedPublic(),revision=1,assignmentRequests={},courseNotes={},adapter={source:'simulator',version:'SIM-1',available:true,state:'break',conflict:false,sequence:1,current:'课间',next:'物理',schedule:[{period:'第三节',time:'10:10–10:50',subject:'语文'},{period:'第四节',time:'11:00–11:40',subject:'物理'},{period:'第五节',time:'14:30–15:10',subject:'数学'}]};
 if(persist&&existsSync(dbPath)){try{const stored=JSON.parse(readFileSync(dbPath,'utf8'));if(stored.format==='haiz-local-server-v1'){state=stored.state;revision=stored.revision;assignmentRequests=stored.assignmentRequests||{};courseNotes=stored.courseNotes||{};adapter={...adapter,...stored.adapter}}}catch{throw Error('本地服务数据损坏；请先备份并修复 public-state.json，服务未覆盖原数据。')}}
 state.assignments=cleanAssignments(state.assignments);
 const flowHandler=createFlowStore(path.join(directory,'flow-state.json'),persist,()=>({source:'simulator',current:adapter.current,next:adapter.next,available:adapter.available}));
 const peers=new Map();
 function snapshot(who){const scope=who.scope,allowed=n=>who.role==='admin'||[scope,SCOPES[2]].includes(n.scope);let notices=state.notices.filter(allowed);if(['display','student'].includes(who.role))notices=notices.filter(n=>n.review==='approved'&&n.status==='published');return {format:'haiz-local-sync',version:1,revision,serverTime:new Date().toISOString(),identity:who,notices,assignments:state.assignments.filter(n=>(who.role==='admin'||n.scope===scope)&&(!['display','student'].includes(who.role)||(n.review==='approved'&&n.status==='published'))),audit:['teacher','admin'].includes(who.role)?state.audit.filter(a=>who.role==='admin'||a.actor===who.name):[],bridge:{...adapter,receivedAt:new Date().toISOString(),label:'本地模拟适配器 · 不是 ClassIsland 实时数据'},courseNote:courseNotes[scope]||null}}
 function save(){if(persist){const payload=JSON.stringify({format:'haiz-local-server-v1',state,revision,courseNotes,adapter,assignmentRequests});writeFileSync(dbPath+'.tmp',payload,{mode:0o600});renameSync(dbPath+'.tmp',dbPath)}}
 function broadcast(){revision++;save();for(const [res,who] of peers){if(!res.destroyed){try{res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot(who))}\n\n`)}catch{peers.delete(res);res.end()}}}}
 const server=http.createServer(async(req,res)=>{const allowedHosts=new Set([`127.0.0.1:${server.address()?.port}`,`localhost:${server.address()?.port}`]);const host=req.headers.host||'';if(!allowedHosts.has(host))return json(res,403,{error:'仅接受已知 loopback 主机名'});const origin=`http://${host}`;if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'拒绝跨来源请求'});const url=new URL(req.url,origin);
  try{
   if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{demo:true,service:'HAIZ localhost classroom',authRequired:true});
   if(url.pathname.startsWith('/api/')){
    const token=req.headers.authorization?.replace(/^Bearer /,'');const who=identities.get(token);if(!who)throw fault(401,'请输入本地演示凭据；这不是学校账号密码。');
    if(await flowHandler(req,res,url,who))return;
    if(req.method==='GET'&&url.pathname==='/api/snapshot')return json(res,200,snapshot(who));
    if(req.method==='GET'&&url.pathname==='/api/events'){if(peers.size>=24)throw fault(429,'本地演示连接数已达上限');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Content-Type-Options':'nosniff'});res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot(who))}\n\n`);peers.set(res,who);req.on('close',()=>peers.delete(res));return}
    if(req.method!=='POST')throw fault(405,'不支持此请求');if(!['teacher','admin'].includes(who.role))throw fault(403,'当前凭据仅可读取公共内容');if(!String(req.headers['content-type']).startsWith('application/json'))throw fault(415,'只接受 JSON');
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768)throw fault(413,'请求内容过大')}let input;try{input=JSON.parse(raw)}catch{throw fault(400,'JSON 格式错误')}
    const findOwned=key=>{const old=state.notices.find(n=>n.id===key);if(!old)throw fault(404,'内容不存在');if(who.role!=='admin'&&(old.scope!==who.scope||old.actor!==who.name))throw fault(403,'不能修改其他班级或发布者的内容');if(Number(input.version)!==old.version)throw fault(409,'内容已有新版本，请刷新后重新核对');return old};
    if(url.pathname==='/api/assignments'||url.pathname==='/api/assignment-action'){
     // Optional retry contract, persisted atomically with the assignment snapshot.
     const requestId=req.headers['idempotency-key'];
     if(requestId!==undefined&&(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)))throw fault(400,'发布请求标识无效');
     const requestKey=requestId?createHash('sha256').update(JSON.stringify([who.name,url.pathname,requestId])).digest('hex'):null;
     const requestHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
     const previous=requestKey&&assignmentRequests[requestKey];
     if(previous){if(previous.hash!==requestHash)throw fault(409,'同一发布请求内容已改变，请重新预览');return json(res,200,{...previous.result,replayed:true});}
     if(requestKey&&Object.keys(assignmentRequests).length>=5000)throw fault(503,'演示发布记录容量已满，请管理员备份处理；未丢弃已有内容');
     const policy={scope:who.scope,actor:who.name,admin:who.role==='admin'};
     if(input.id){const old=state.assignments.find(x=>x.id===input.id);if(!old)throw fault(404,'作业不存在');if(!policy.admin&&(old.actor!==who.name||old.scope!==who.scope))throw fault(403,'无权修改此作业');if(Number(input.version)!==old.version)throw fault(409,'作业已有新版本，请刷新后重试');}
     if(!policy.admin&&url.pathname==='/api/assignments'&&input.scope!==who.scope)throw fault(403,'凭据不允许向此班发布作业');
     if(url.pathname==='/api/assignment-action'&&input.operation==='approve'&&!policy.admin)throw fault(403,'待审作业需要管理员审核');
     const priorState=state,priorRevision=revision;state={...state,audit:[...state.audit]};try{
     state.assignments=url.pathname==='/api/assignments'?upsertAssignment(state.assignments,input,policy):assignmentAction(state.assignments,input,policy);
     state.audit.push({actor:who.name,role:who.role,at:new Date().toISOString(),message:url.pathname==='/api/assignments'?'发布或修改班级作业':'审核或撤回班级作业'});state.audit=state.audit.slice(-200);
     const item=state.assignments.find(n=>input.id?n.id===input.id:n.actor===who.name&&n.scope===input.scope&&n.studyDate===input.studyDate&&n.subject===input.subject);
     const result={revision:revision+1,id:item?.id,version:item?.version,review:item?.review};
     if(requestKey)assignmentRequests[requestKey]={hash:requestHash,result};
     broadcast();return json(res,200,result);
     }catch(error){state=priorState;revision=priorRevision;if(requestKey)delete assignmentRequests[requestKey];throw error}
    }
    if(url.pathname==='/api/notices'){
     if(who.role!=='admin'&&input.scope!==who.scope)throw fault(403,'凭据不允许向此班发布');if(input.id)findOwned(input.id);const oldIds=new Set(state.notices.map(n=>n.id));state=publishNotice({...state,scope:who.scope},input,who.role);const n=state.notices.find(n=>input.id?n.id===input.id:!oldIds.has(n.id));n.actor=who.name;n.review=input.submitForReview?'pending':'approved';state.audit.at(-1).actor=who.name;state.audit.at(-1).message=(input.submitForReview?'提交审核：':'')+state.audit.at(-1).message;broadcast();return json(res,200,{id:n.id,version:n.version,revision,review:n.review});
    }
    if(url.pathname==='/api/notice-action'){const old=findOwned(input.id);if(input.operation==='approve'&&who.role!=='admin')throw fault(403,'服务器待审内容需要管理员审核');state=changeNotice(state,old.id,input.operation,who.role);state.audit.at(-1).actor=who.name;broadcast();return json(res,200,{revision})}
    if(url.pathname==='/api/course-note'){if(!input.confirmed)throw fault(400,'请先核对并明确确认准备事项');courseNotes[who.scope]={subject:String(input.subject||'').slice(0,50),text:String(input.text||'').slice(0,300),confirmed:true,by:who.name,at:new Date().toISOString()};broadcast();return json(res,200,{revision})}
    if(url.pathname==='/api/adapter'){if(who.role!=='admin')throw fault(403,'只有本地管理员演示可驱动适配器');if(input.evening===true){adapter={...adapter,...mockEveningBridge(),sequence:adapter.sequence+1};broadcast();return json(res,200,{revision})}if(input.state&&!['class','break','after'].includes(input.state))throw fault(400,'未知模拟状态');adapter={...adapter,state:input.state||adapter.state,available:input.available!==false,conflict:input.conflict===true,current:input.state==='class'?'语文':input.state==='after'?'已放学':'课间',sequence:adapter.sequence+1};broadcast();return json(res,200,{revision})}
    throw fault(404,'接口不存在');
   }
   if(INTEGRATED&&url.pathname==='/'){res.writeHead(302,{Location:'/world/'});res.end();return}if(req.method!=='GET'&&req.method!=='HEAD')throw fault(405,'不支持此请求');let relative;try{relative=decodeURIComponent(url.pathname)}catch{throw fault(400,'地址无效')};if(relative.split('/').some(part=>part.startsWith('.')))throw fault(403,'隐藏目录不可通过静态服务读取');const file=path.resolve(STATIC,'.'+relative+(relative.endsWith('/')?'index.html':''));const staticRoot=STATIC+path.sep;if(!file.startsWith(staticRoot)||!existsSync(file)||!statSync(file).isFile())throw fault(404,'文件不存在');const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message});else res.end()}
 });
 const heartbeat=setInterval(()=>{for(const [res] of peers)if(!res.destroyed)res.write(': heartbeat\n\n')},15000);heartbeat.unref();server.on('close',()=>clearInterval(heartbeat));return {server,credentials,keysPath,snapshot,close:()=>{for(const [res] of peers)res.end();server.closeAllConnections();return new Promise(resolve=>server.close(resolve))}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const demo=createDemoServer(),port=Number(process.env.HAIZ_DEMO_PORT||8787);demo.server.listen(port,'127.0.0.1',()=>{console.log(`HAIZ local-only demo: http://127.0.0.1:${port}${ENTRY}#teach\n本地演示凭据文件：${demo.keysPath}\n在教师发布台的“连接本地演示服务”中输入相应凭据。仅监听 loopback，不接入真实学校。\nCtrl+C 停止。`)});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>demo.close().then(()=>process.exit(0)));
}
