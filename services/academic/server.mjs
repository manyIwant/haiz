import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const host=process.env.HAIZ_HOST||'127.0.0.1';
const port=Number(process.env.HAIZ_PORT||8780);
if(!['127.0.0.1','localhost','::1'].includes(host)){
 throw Error('HAIZ Academic only binds to localhost; use a reverse proxy with HTTPS for network access');
}
const database=process.env.HAIZ_DB_PATH||join(homedir(),'.local/share/haiz-academic/academic.sqlite');
mkdirSync(dirname(database),{recursive:true,mode:0o700});
chmodSync(dirname(database),0o700);
const db=new DatabaseSync(database);
chmodSync(database,0o600);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
const tables=[
'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, label TEXT NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expiry INTEGER NOT NULL)',
'CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, title TEXT NOT NULL, teacher_id TEXT REFERENCES users(id), join_code TEXT UNIQUE NOT NULL, screen_key TEXT UNIQUE NOT NULL)',
'CREATE TABLE IF NOT EXISTS memberships (class_id TEXT REFERENCES classes(id), user_id TEXT REFERENCES users(id), status TEXT NOT NULL, PRIMARY KEY(class_id,user_id))',
'CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, class_id TEXT REFERENCES classes(id), subject TEXT NOT NULL, title TEXT NOT NULL, due TEXT, details TEXT NOT NULL, source_id TEXT, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS acknowledgements (assignment_id TEXT REFERENCES assignments(id), user_id TEXT REFERENCES users(id), viewed_at TEXT, PRIMARY KEY(assignment_id,user_id))',
'CREATE TABLE IF NOT EXISTS qq_mappings (group_openid TEXT PRIMARY KEY, class_id TEXT REFERENCES classes(id))',
'CREATE TABLE IF NOT EXISTS intake (id TEXT PRIMARY KEY, class_id TEXT REFERENCES classes(id), external_id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event TEXT NOT NULL, object_id TEXT, happened_at TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS school_links (external_subject TEXT UNIQUE NOT NULL, user_id TEXT UNIQUE NOT NULL REFERENCES users(id))',
'CREATE TABLE IF NOT EXISTS school_events (event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL)'
];
for(const sql of tables)db.exec(sql);
const stamp=()=>new Date().toISOString();
const uuid=()=>randomUUID();
const token=()=>randomBytes(24).toString('hex');
const hashPass=(p,s)=>pbkdf2Sync(p,s,200000,32,'sha256').toString('hex');
const err=(code,msg)=>Object.assign(new Error(msg),{status:code});
const text=(value,max=200)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw err(400,'文字内容无效或过长');return value.trim();};
const account=(login,label,role,password)=>{
 const salt=token(),uid=uuid();
 db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(uid,login,label,role,salt,hashPass(password,salt));
 return uid;
};
function validateLogin(p){
 const login=text(p.login,48).toLowerCase();
 if(!/^[a-z0-9][a-z0-9_.-]{2,47}$/.test(login))throw err(400,'账号格式错误');
 if(typeof p.password!=='string'||p.password.length<12||p.password.length>128)throw err(400,'密码长度应为12-128字符');
 return login;
}
const dueCheck=due=>{
 if(due==null||due==='')return null;
 if(typeof due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(due))throw err(400,'截止日期格式错误');
 const n=new Date(due+'T12:00:00Z');
 if(Number.isNaN(n.valueOf())||n.toISOString().slice(0,10)!==due)throw err(400,'截止日期不存在');
 return due;
};
function equal(a,b){
 const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));
 return x.length===y.length&&timingSafeEqual(x,y);
}
if(!db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get()){
 const login=process.env.HAIZ_ADMIN_LOGIN,password=process.env.HAIZ_ADMIN_PASSWORD;
 if(!login||!password||password.length<14)throw Error('首次启动需设置 HAIZ_ADMIN_LOGIN 和不少于14位的 HAIZ_ADMIN_PASSWORD');
 account(login.toLowerCase(),'HAIZ 管理员','admin',password);
 console.log('[HAIZ Academic] Initial administrator created.');
}
function reply(res,status,payload){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(JSON.stringify(payload));
}
async function readBody(req){
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>80000)throw err(413,'请求体过大');chunks.push(chunk);}
 const raw=Buffer.concat(chunks).toString('utf8');
 let data={};
 try{if(raw)data=JSON.parse(raw);}catch{throw err(400,'JSON格式错误');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw err(400,'请求体必须是JSON对象');
 return {data,raw};
}
function loggedIn(req){
 const match=/(?:^|;\s*)hsid=([0-9a-f]{48})(?:;|$)/.exec(req.headers.cookie||'');
 if(!match)return null;
 const digest=createHash('sha256').update(match[1]).digest('hex');
 return db.prepare('SELECT u.id,u.login,u.label,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expiry>?').get(digest,Date.now())||null;
}
function requireUser(req,roles){
 const u=loggedIn(req);
 if(!u)throw err(401,'请先登录');
 if(roles&&!roles.includes(u.role))throw err(403,'此账号无权进行操作');
 return u;
}
function saveSession(req,res,u){
 const value=token();
 db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(value).digest('hex'),u.id,Date.now()+604800000);
 const secure=(req.socket.encrypted||process.env.HAIZ_PUBLIC_HTTPS==='1')?' Secure;':'';
 res.setHeader('Set-Cookie','hsid='+value+'; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800;'+secure);
}
function classAccess(classId,u,teacherOnly=false){
 const c=db.prepare('SELECT * FROM classes WHERE id=?').get(classId);
 if(!c)throw err(404,'班级不存在');
 if(u.role==='admin'||c.teacher_id===u.id)return c;
 if(teacherOnly)throw err(403,'仅班级教师可操作');
 const m=db.prepare('SELECT status FROM memberships WHERE class_id=? AND user_id=?').get(classId,u.id);
 if(m?.status!=='active')throw err(403,'尚未获得班级访问权限');
 return c;
}
function teacherAccess(classId,u){
 const c=classAccess(classId,u,true);
 if(u.role!=='admin'&&u.id!==c.teacher_id)throw err(403,'没有班级教师权限');
 return c;
}
function audit(u,event,object){db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').run(uuid(),u,event,object,stamp());}
function publicAssignment(a){
 return {id:a.id,classId:a.class_id,subject:a.subject,title:a.title,due:a.due,details:a.details,createdAt:a.created_at};
}
function publish(c,u,p,source=null){
 const title=text(p.title,240),subject=text(p.subject,32);
 const due=dueCheck(p.due);
 const details=typeof p.details==='string'?p.details.trim():'';
 if(details.length>3000)throw err(400,'详细说明过长');
 const key=uuid();
 db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?,?)').run(key,c.id,subject,title,due,details,source,u.id,stamp());
 audit(u.id,'assignment.publish',key);
 return publicAssignment(db.prepare('SELECT * FROM assignments WHERE id=?').get(key));
}
const signRelay=(ts,raw,secret)=>createHmac('sha256',secret).update(String(ts)+'.'+raw).digest('hex');
function checkRelay(req,raw){
 const secret=process.env.HAIZ_QQ_RELAY_SECRET;
 if(!secret||secret.length<32)throw err(503,'QQ机器人中继未配置');
 const ts=req.headers['x-haiz-timestamp'];
 if(!ts||!/^\d+$/.test(ts)||Math.abs(Date.now()-Number(ts))>300000)throw err(401,'事件时间戳无效');
 if(!equal(req.headers['x-haiz-signature'],signRelay(ts,raw,secret)))throw err(401,'消息签名无效');
}
const attempts=new Map();
function protectLogin(ip){
 const now=Date.now();
 const arr=(attempts.get(ip)||[]).filter(t=>t>now-900000);
 if(arr.length>=10)throw err(429,'登录尝试过多');
 arr.push(now);attempts.set(ip,arr);
 if(attempts.size>2000)attempts.clear();
}
function csrf(req){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return;
 const source=req.headers.origin;
 if(!source)return;
 let url;
 try{url=new URL(source);}catch{throw err(403,'无效来源');}
 if(url.host!==req.headers.host)throw err(403,'跨站操作被拒绝');
}
function staticFile(res,path){
 const lookup={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/ui.css':'ui.css'};
 const file=lookup[path];
 if(!file)return reply(res,404,{error:'NOT_FOUND'});
 const target=join(root,'public',file);
 if(!existsSync(target))return reply(res,404,{error:'NOT_FOUND'});
 const type=extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'text/html';
 res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'"});
 res.end(readFileSync(target));
}
const server=createServer(async(req,res)=>{
 try{
 const pathname=new URL(req.url,'http://localhost').pathname,method=req.method;
 csrf(req);
 if(method==='GET'&&pathname==='/api/health')return reply(res,200,{ok:true,mode:'local pilot',schoolOfficialConnected:false,qqRelayConfigured:!!process.env.HAIZ_QQ_RELAY_SECRET,schoolRosterConfigured:!!process.env.HAIZ_SCHOOL_ROSTER_SECRET});
 if(method==='POST'&&pathname==='/api/auth/login'){
  protectLogin(req.socket.remoteAddress||'?');
  const {data:p}=await readBody(req),login=text(p.login,48).toLowerCase();
  const u=db.prepare('SELECT * FROM users WHERE login=?').get(login);
  const digest=hashPass(typeof p.password==='string'?p.password:'',u?.salt||'fallbackfixedsalt01234567');
  if(!u||!equal(digest,u.password_hash))throw err(401,'账号或密码错误');
  saveSession(req,res,u);
  return reply(res,200,{user:{id:u.id,login:u.login,label:u.label,role:u.role}});
 }
 if(method==='POST'&&pathname==='/api/auth/register'){
  const {data:p}=await readBody(req),login=validateLogin(p),label=text(p.label,40);
  const c=db.prepare('SELECT id FROM classes WHERE join_code=?').get(text(p.joinCode,24));
  if(!c)throw err(400,'邀请码不正确');
  if(db.prepare('SELECT id FROM users WHERE login=?').get(login))throw err(409,'账号已存在');
  const uid=account(login,label,'student',p.password);
  db.prepare('INSERT INTO memberships VALUES (?,?,?)').run(c.id,uid,'pending');
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  saveSession(req,res,u);
  return reply(res,201,{status:'pending',message:'注册成功，等待教师核准'});
 }
 if(method==='POST'&&pathname==='/api/auth/logout'){
  const match=/(?:^|;\s*)hsid=([0-9a-f]{48})(?:;|$)/.exec(req.headers.cookie||'');
  if(match)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(match[1]).digest('hex'));
  res.setHeader('Set-Cookie','hsid=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  return reply(res,200,{ok:true});
 }
 if(method==='GET'&&pathname==='/api/me')return reply(res,200,{user:requireUser(req)});
 if(method==='POST'&&pathname==='/api/admin/teachers'){
  const u=requireUser(req,['admin']),{data:p}=await readBody(req),login=validateLogin(p),label=text(p.label,40);
  if(db.prepare('SELECT id FROM users WHERE login=?').get(login))throw err(409,'账号已存在');
  const uid=account(login,label,'teacher',p.password);
  audit(u.id,'teacher.create',uid);
  return reply(res,201,{id:uid,login,label});
 }
 if(method==='POST'&&pathname==='/api/admin/school-links'){
  const u=requireUser(req,['admin']),{data:p}=await readBody(req);
  if(!process.env.HAIZ_SCHOOL_ROSTER_SECRET||!process.env.HAIZ_SCHOOL_ISSUER)
    throw err(503,'未配置得到授权的校方名册连接器');
  const login=text(p.login,48).toLowerCase(),subject=text(p.externalSubject,128);
  if(!/^[A-Za-z0-9_.:-]{5,128}$/.test(subject))throw err(400,'身份映射标识只能使用不含个人信息的匿名标识');
  const student=db.prepare("SELECT id FROM users WHERE login=? AND role='student'").get(login);
  if(!student)throw err(404,'该 HAIZ 学生账号不存在');
  if(db.prepare('SELECT user_id FROM school_links WHERE external_subject=? OR user_id=?').get(subject,student.id))
    throw err(409,'该身份已完成映射，不能覆盖');
  db.prepare('INSERT INTO school_links VALUES (?,?)').run(subject,student.id);
  audit(u.id,'school.identity_link',student.id);
  return reply(res,201,{linked:true});
 }
 if(method==='POST'&&pathname==='/api/integrations/school/roster'){
  const {data:p,raw}=await readBody(req);
  const secret=process.env.HAIZ_SCHOOL_ROSTER_SECRET;
  const issuer=process.env.HAIZ_SCHOOL_ISSUER;
  if(!secret||secret.length<32||!issuer)throw err(503,'学校名册同步未启用');
  const ts=req.headers['x-haiz-timestamp'];
  if(typeof ts!=='string'||!/^[0-9]+$/.test(ts)||Math.abs(Date.now()-Number(ts))>300000)
    throw err(401,'事件时间戳无效');
  if(!equal(req.headers['x-haiz-signature'],signRelay(ts,raw,secret)))throw err(401,'校方名册签名无效');
  if(p.issuer!==issuer)throw err(403,'事件来源不在学校授权名单');
  const eventId=text(p.eventId,128);
  if(db.prepare('SELECT event_id FROM school_events WHERE event_id=?').get(eventId))
    return reply(res,200,{duplicate:true});
  if(!Array.isArray(p.records)||p.records.length>100)throw err(400,'同步批次必须是最多100条的列表');
  let activated=0,revoked=0,skipped=0;
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const record of p.records){
    const subject=text(record.externalSubject,128),classId=text(record.classId,36);
    if(record.status!=='active'&&record.status!=='revoked')throw err(400,'不支持的成员状态');
    const schoolUser=db.prepare("SELECT u.id FROM school_links l JOIN users u ON u.id=l.user_id WHERE l.external_subject=? AND u.role='student'").get(subject);
    const classRow=db.prepare('SELECT id FROM classes WHERE id=?').get(classId);
    if(!schoolUser||!classRow){skipped++;continue;}
    const newStatus=record.status==='active'?'active':'rejected';
    db.prepare('INSERT INTO memberships VALUES (?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET status=excluded.status').run(classId,schoolUser.id,newStatus);
    if(record.status==='active')activated++;else revoked++;
   }
   db.prepare('INSERT INTO school_events VALUES (?,?)').run(eventId,stamp());
   audit('school-connector','roster.import',eventId);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  return reply(res,200,{accepted:true,activated,revoked,skipped,identityProviderVerified:false});
 }
 if(method==='POST'&&pathname==='/api/classes'){
  const u=requireUser(req,['admin','teacher']),{data:p}=await readBody(req);
  const c={id:uuid(),title:text(p.title,80),joinCode:token().slice(0,12),screenKey:token()+token()};
  db.prepare('INSERT INTO classes VALUES (?,?,?,?,?)').run(c.id,c.title,u.id,c.joinCode,c.screenKey);
  audit(u.id,'class.create',c.id);
  return reply(res,201,c);
 }
 if(method==='GET'&&pathname==='/api/classes'){
  const u=requireUser(req);
  const rows=u.role==='admin'?db.prepare('SELECT * FROM classes').all():
   u.role==='teacher'?db.prepare('SELECT * FROM classes WHERE teacher_id=?').all(u.id):
   db.prepare('SELECT c.*,m.status FROM classes c JOIN memberships m ON m.class_id=c.id WHERE m.user_id=?').all(u.id);
  return reply(res,200,{classes:rows.map(c=>({id:c.id,title:c.title,status:c.status||'active',
   ...(u.role==='student'?{}:{joinCode:c.join_code,screenKey:c.screen_key})}))});
 }
 if(method==='POST'&&pathname==='/api/classes/join'){
  const u=requireUser(req,['student']),{data:p}=await readBody(req);
  const c=db.prepare('SELECT id FROM classes WHERE join_code=?').get(text(p.joinCode,24));
  if(!c)throw err(400,'邀请码无效');
  db.prepare("INSERT INTO memberships VALUES (?,?,'pending') ON CONFLICT(class_id,user_id) DO UPDATE SET status='pending'").run(c.id,u.id);
  return reply(res,200,{status:'pending'});
 }
 let m=/^\/api\/classes\/([\da-f-]{36})\/members$/.exec(pathname);
 if(method==='GET'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u);
  const members=db.prepare('SELECT u.id,u.login,u.label,m.status FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY m.status').all(c.id);
  return reply(res,200,{members});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/members\/([\da-f-]{36})\/(approve|reject)$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u);
  const changed=db.prepare('UPDATE memberships SET status=? WHERE class_id=? AND user_id=? AND status=?').run(m[3]==='approve'?'active':'rejected',c.id,m[2],'pending');
  if(!changed.changes)throw err(404,'没有待核准的成员');
  audit(u.id,'membership.'+m[3],m[2]);return reply(res,200,{ok:true});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/assignments$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u),{data:p}=await readBody(req);
  return reply(res,201,{assignment:publish(c,u,p)});
 }
 if(method==='GET'&&m){
  const u=requireUser(req),c=classAccess(m[1],u);
  return reply(res,200,{assignments:db.prepare('SELECT * FROM assignments WHERE class_id=? ORDER BY created_at DESC LIMIT 200').all(c.id).map(publicAssignment)});
 }
 if(method==='GET'&&pathname==='/api/my/assignments'){
  const u=requireUser(req,['student']);
  const rows=db.prepare("SELECT a.*,c.title AS class_name,(SELECT viewed_at FROM acknowledgements WHERE assignment_id=a.id AND user_id=?) AS viewed FROM assignments a JOIN classes c ON c.id=a.class_id JOIN memberships m ON m.class_id=c.id WHERE m.user_id=? AND m.status='active' ORDER BY a.created_at DESC LIMIT 200").all(u.id,u.id);
  return reply(res,200,{assignments:rows.map(a=>({...publicAssignment(a),className:a.class_name,viewed:!!a.viewed}))});
 }
 m=/^\/api\/assignments\/([\da-f-]{36})\/acknowledge$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['student']),a=db.prepare('SELECT class_id FROM assignments WHERE id=?').get(m[1]);
  if(!a)throw err(404,'任务不存在');
  classAccess(a.class_id,u);
  db.prepare('INSERT OR IGNORE INTO acknowledgements VALUES (?,?,?)').run(m[1],u.id,stamp());
  return reply(res,200,{viewed:true,verifiedSubmission:false});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/qq\/mapping$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u),{data:p}=await readBody(req);
  if(!process.env.HAIZ_QQ_RELAY_SECRET)throw err(503,'未配置授权的 QQ 官方机器人中继');
  const group=text(p.groupOpenid,128);
  if(!/^[\w-]+$/.test(group))throw err(400,'QQ 群组标识格式无效');
  db.prepare('INSERT INTO qq_mappings VALUES (?,?) ON CONFLICT(group_openid) DO UPDATE SET class_id=excluded.class_id').run(group,c.id);
  audit(u.id,'qq.mapping',c.id);return reply(res,200,{ok:true});
 }
 if(method==='POST'&&pathname==='/api/integrations/qq/event'){
  const {data:p,raw}=await readBody(req);checkRelay(req,raw);
  if(p.eventType!=='GROUP_AT_MESSAGE_CREATE'||p.mentioned!==true)
   return reply(res,202,{accepted:false,reason:'mention-required'});
  const map=db.prepare('SELECT class_id FROM qq_mappings WHERE group_openid=?').get(text(p.groupOpenid,128));
  if(!map)return reply(res,202,{accepted:false,reason:'group-not-mapped'});
  const externalId=text(p.messageId,128),content=text(p.content,3500);
  try{
   db.prepare("INSERT INTO intake VALUES (?,?,?,?,'pending',?)").run(uuid(),map.class_id,externalId,content,stamp());
  }catch(e){if(String(e).includes('UNIQUE'))return reply(res,200,{duplicate:true});throw e;}
  return reply(res,202,{accepted:true,reviewRequired:true});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/inbox$/.exec(pathname);
 if(method==='GET'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u);
  return reply(res,200,{inbox:db.prepare("SELECT id,content,created_at AS receivedAt FROM intake WHERE class_id=? AND status='pending' ORDER BY created_at DESC LIMIT 100").all(c.id)});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/inbox\/([\da-f-]{36})\/(publish|dismiss)$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u);
  const item=db.prepare("SELECT id FROM intake WHERE id=? AND class_id=? AND status='pending'").get(m[2],c.id);
  if(!item)throw err(404,'没有该待审消息');
  if(m[3]==='dismiss'){
   db.prepare("UPDATE intake SET status='dismissed' WHERE id=?").run(item.id);
   audit(u.id,'qq.dismiss',item.id);return reply(res,200,{ok:true});
  }
  const {data:p}=await readBody(req);
  const a=publish(c,u,p,item.id);
  db.prepare("UPDATE intake SET status='published' WHERE id=?").run(item.id);
  return reply(res,201,{assignment:a,manuallyReviewed:true});
 }
 m=/^\/api\/classes\/([\da-f-]{36})\/screens\/rotate$/.exec(pathname);
 if(method==='POST'&&m){
  const u=requireUser(req,['admin','teacher']),c=teacherAccess(m[1],u),key=token()+token();
  db.prepare('UPDATE classes SET screen_key=? WHERE id=?').run(key,c.id);
  audit(u.id,'screen.rotate',c.id);return reply(res,200,{screenKey:key});
 }
 m=/^\/api\/screens\/([0-9a-f]{96})$/.exec(pathname);
 if(method==='GET'&&m){
  const c=db.prepare('SELECT id,title FROM classes WHERE screen_key=?').get(m[1]);
  if(!c)throw err(404,'屏幕密钥失效');
  const a=db.prepare('SELECT subject,title,due FROM assignments WHERE class_id=? ORDER BY created_at DESC LIMIT 12').all(c.id);
  return reply(res,200,{className:c.title,assignments:a,readOnly:true,containsStudentIdentity:false});
 }
 if(method==='GET'&&!pathname.startsWith('/api/'))return staticFile(res,pathname);
 throw err(404,'没有该接口');
 }catch(e){
  if(!e.status)console.error('[HAIZ Academic]',e);
  return reply(res,e.status||500,{error:e.status?e.message:'内部错误'});
 }
});
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])
 server.listen(port,host,()=>console.log('[HAIZ Academic] http://'+host+':'+port));
export {server,db,signRelay};
