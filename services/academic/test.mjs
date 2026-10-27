import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const tmp=mkdtempSync(join(tmpdir(),'haiz-class-'));
process.env.HAIZ_DB_PATH=join(tmp,'db.sqlite');
process.env.HAIZ_ADMIN_LOGIN='admin';
process.env.HAIZ_ADMIN_PASSWORD='CorrectHorseBattery2026!';
process.env.HAIZ_QQ_RELAY_SECRET='0123456789ABCDEF0123456789ABCDEF';
process.env.HAIZ_SCHOOL_ROSTER_SECRET='FEDCBA9876543210FEDCBA9876543210';
process.env.HAIZ_SCHOOL_ISSUER='authorized-test-school';

const {server,db,signRelay}=await import('./server.mjs');
server.listen(0,'127.0.0.1');
await once(server,'listening');
const root='http://127.0.0.1:'+server.address().port;
const clients={admin:'',teacher:'',student:''};
async function call(client,path,method='GET',data=null,headers={}){
 const h={...headers};
 if(clients[client])h.Cookie=clients[client];
 if(data!==null)h['Content-Type']='application/json';
 const response=await fetch(root+'/api'+path,{
  method,headers:h,body:data===null?undefined:typeof data==='string'?data:JSON.stringify(data)
 });
 const c=response.headers.get('set-cookie');
 if(c&&c.startsWith('hsid='))clients[client]=c.split(';')[0];
 const result=await response.json();
 return {status:response.status,result};
}
test('HAIZ Academic: role checks, enrollment approval, tasks and QQ manual confirmation',async()=>{
 try{
  let x=await call('student','/health');
  assert.equal(x.status,200);
  assert.equal(x.result.schoolOfficialConnected,false);
  x=await call('student','/classes');assert.equal(x.status,401);
  x=await call('admin','/auth/login','POST',{login:'admin',password:process.env.HAIZ_ADMIN_PASSWORD});
  assert.equal(x.status,200);assert.equal(x.result.user.role,'admin');
  x=await call('admin','/admin/teachers','POST',{login:'teacher01',label:'演示教师',password:'TeacherDemoPassword2026'});
  assert.equal(x.status,201);
  x=await call('teacher','/auth/login','POST',{login:'teacher01',password:'TeacherDemoPassword2026'});
  assert.equal(x.status,200);
  x=await call('teacher','/classes','POST',{title:'实验班（虚构数据）'});
  assert.equal(x.status,201);
  const c=x.result;assert.equal(c.screenKey.length,96);
  x=await call('student','/auth/register','POST',{login:'student01',label:'匿名学生',password:'StudentDemoPassword2026',joinCode:c.joinCode});
  assert.equal(x.status,201);
  x=await call('student','/classes/'+c.id+'/assignments');
  assert.equal(x.status,403,'Student must not see assignments before approval');
  x=await call('student','/classes/'+c.id+'/assignments','POST',{subject:'物理',title:'注入作业'});
  assert.equal(x.status,403,'Student cannot publish assignments');
  x=await call('teacher','/classes/'+c.id+'/members');
  assert.equal(x.status,200);assert.equal(x.result.members[0].status,'pending');
  const sid=x.result.members[0].id;
  x=await call('teacher','/classes/'+c.id+'/members/'+sid+'/approve','POST',{});
  assert.equal(x.status,200);
  x=await call('teacher','/classes/'+c.id+'/assignments','POST',{subject:'物理',title:'打点计时器报告',due:'2026-10-29'});
  assert.equal(x.status,201);
  const aid=x.result.assignment.id;
  x=await call('student','/my/assignments');
  assert.equal(x.status,200);assert.equal(x.result.assignments.length,1);
  assert.equal(x.result.assignments[0].viewed,false);
  x=await call('student','/assignments/'+aid+'/acknowledge','POST',{});
  assert.deepEqual(x.result,{viewed:true,verifiedSubmission:false});
  x=await call('student','/my/assignments');assert.equal(x.result.assignments[0].viewed,true);
  x=await call('student','/classes/'+c.id+'/members');
  assert.equal(x.status,403,'Student cannot enumerate classmates');
  x=await call('admin','/screens/'+c.screenKey);
  assert.equal(x.status,200);
  assert.equal(x.result.containsStudentIdentity,false);
  assert.equal(JSON.stringify(x.result).includes('匿名学生'),false);
  x=await call('teacher','/classes/'+c.id+'/qq/mapping','POST',{groupOpenid:'group-openid-1'});
  assert.equal(x.status,200);
  const relay={eventType:'GROUP_AT_MESSAGE_CREATE',mentioned:true,groupOpenid:'group-openid-1',messageId:'qq-event-001',content:'明天物理交实验报告'};
  const raw=JSON.stringify(relay),ts=String(Date.now());
  x=await call('student','/integrations/qq/event','POST',raw,{'x-haiz-timestamp':ts,'x-haiz-signature':'wrong'});
  assert.equal(x.status,401);
  const signed={'x-haiz-timestamp':ts,'x-haiz-signature':signRelay(ts,raw,process.env.HAIZ_QQ_RELAY_SECRET)};
  x=await call('student','/integrations/qq/event','POST',raw,signed);
  assert.equal(x.status,202);assert.equal(x.result.reviewRequired,true);
  x=await call('student','/my/assignments');
  assert.equal(x.result.assignments.length,1,'QQ message is not automatically published');
  x=await call('student','/integrations/qq/event','POST',raw,signed);
  assert.equal(x.result.duplicate,true);
  x=await call('teacher','/classes/'+c.id+'/inbox');
  assert.equal(x.result.inbox.length,1);
  x=await call('student','/classes/'+c.id+'/inbox');
  assert.equal(x.status,403);
  const pending=(await call('teacher','/classes/'+c.id+'/inbox')).result.inbox[0];
  x=await call('student','/classes/'+c.id+'/inbox/'+pending.id+'/publish','POST',{
    subject:'恶意任务',title:'越权发布'});
  assert.equal(x.status,403);
  x=await call('teacher','/classes/'+c.id+'/inbox/'+pending.id+'/publish','POST',{
   subject:'物理',title:'提交实验报告',due:'2026-10-30'});
  assert.equal(x.status,201);
  assert.equal(x.result.manuallyReviewed,true);
  x=await call('student','/my/assignments');assert.equal(x.result.assignments.length,2);
  x=await call('teacher','/classes/'+c.id+'/screens/rotate','POST',{});
  assert.equal(x.status,200);
  const rotated=x.result.screenKey;
  x=await call('teacher','/screens/'+c.screenKey);assert.equal(x.status,404);
  x=await call('teacher','/screens/'+rotated);assert.equal(x.status,200);
  // A real school identity is NOT assumed: the admin explicitly maps only
  // an opaque pseudo-identifier, then a signed, matching school connector
  // may update membership without transmitting student names.
  x=await call('admin','/admin/school-links','POST',{
    login:'student01',externalSubject:'school-pseudo-7'});
  assert.equal(x.status,201);
  const event={issuer:'authorized-test-school',eventId:'roster-event-1',
    records:[{externalSubject:'school-pseudo-7',classId:c.id,status:'revoked'}]};
  const rawEvent=JSON.stringify(event),schoolTs=String(Date.now());
  const headers={'x-haiz-timestamp':schoolTs,
    'x-haiz-signature':signRelay(schoolTs,rawEvent,process.env.HAIZ_SCHOOL_ROSTER_SECRET)};
  x=await call('student','/integrations/school/roster','POST',rawEvent,
    {'x-haiz-timestamp':schoolTs,'x-haiz-signature':'wrong'});
  assert.equal(x.status,401);
  x=await call('admin','/integrations/school/roster','POST',rawEvent,headers);
  assert.equal(x.status,200);assert.equal(x.result.revoked,1);
  x=await call('student','/classes/'+c.id+'/assignments');assert.equal(x.status,403);
  x=await call('admin','/integrations/school/roster','POST',rawEvent,headers);
  assert.equal(x.result.duplicate,true);
  const event2={issuer:'authorized-test-school',eventId:'roster-event-2',
    records:[{externalSubject:'school-pseudo-7',classId:c.id,status:'active'}]};
  const raw2=JSON.stringify(event2),ts2=String(Date.now());
  x=await call('admin','/integrations/school/roster','POST',raw2,
    {'x-haiz-timestamp':ts2,
    'x-haiz-signature':signRelay(ts2,raw2,process.env.HAIZ_SCHOOL_ROSTER_SECRET)});
  assert.equal(x.result.activated,1);
  x=await call('student','/my/assignments');assert.equal(x.result.assignments.length,2);

  const classes=(await call('teacher','/classes')).result.classes;
  x=await call('teacher','/screens/'+classes[0].screenKey);assert.equal(x.status,200);
  assert.equal(x.result.assignments.length,2);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  db.close();rmSync(tmp,{recursive:true,force:true});
 }
});
