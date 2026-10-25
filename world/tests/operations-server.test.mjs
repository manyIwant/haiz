import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {createDemoServer} from '../scripts/classroom-server.mjs';
import {SCOPES} from '../round2-core.js';
import {schoolDate,upsertAssignment} from '../homework-core.js';
test('lost-response retry survives restart and never creates or resurrects a second assignment',async()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),'haiz-ops-'));let d=createDemoServer({directory});const keys=d.credentials;
 const listen=async()=>{await new Promise(r=>d.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+d.server.address().port};let base=await listen();
 const req=async(role,route,body,key)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[role],...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}};
 const input={scope:SCOPES[0],subject:'数学',studyDate:schoolDate(),content:'虚构：练习第1题'};
 try{
  const first=await req('teacher-a','/api/assignments',input,'retry-key-123');assert.equal(first.status,200);
  const replay=await req('teacher-a','/api/assignments',input,'retry-key-123');assert.equal(replay.body.id,first.body.id);assert.equal(replay.body.replayed,true);
  assert.equal((await req('teacher-a','/api/assignments',{...input,content:'不同内容'},'retry-key-123')).status,409);
  assert.equal((await req('teacher-b','/api/assignments',input,'retry-key-123')).status,403);
  assert.equal((await req('display-a','/api/assignments',input,'retry-key-123')).status,403);
  await d.close();d=createDemoServer({directory,tokens:keys});base=await listen();
  assert.equal((await req('teacher-a','/api/assignments',input,'retry-key-123')).body.id,first.body.id);
  await req('teacher-a','/api/assignment-action',{id:first.body.id,version:1,operation:'withdraw'});
  await req('teacher-a','/api/assignments',input,'retry-key-123');
  const snap=await req('teacher-a','/api/snapshot');assert.equal(snap.body.assignments.length,1);assert.equal(snap.body.assignments[0].status,'withdrawn');
  assert.equal(snap.body.audit.length,2,'Retries must not create duplicate audit entries');
  // A failed disk commit cannot be acknowledged on the next retry.
  const db=path.join(directory,'public-state.json');mkdirSync(db+'.tmp');
  const failed=await req('teacher-a','/api/assignments',{...input,content:'磁盘故障测试'},'disk-fail-123');assert.notEqual(failed.status,200);
  assert.equal((await req('teacher-a','/api/snapshot')).body.assignments.length,1);
  rmSync(db+'.tmp',{recursive:true});assert.equal((await req('teacher-a','/api/assignments',{...input,content:'磁盘故障测试'},'disk-fail-123')).status,200);
 }finally{await d.close();rmSync(directory,{recursive:true,force:true})}
});
test('full demo assignment store rejects additions rather than silently losing older work',()=>{
 const list=Array.from({length:500},(_,i)=>({id:'old-'+i,actor:'teacher-a',scope:SCOPES[0],version:1}));
 assert.throws(()=>upsertAssignment(list,{scope:SCOPES[0],subject:'数学',studyDate:schoolDate(),content:'新作业'},{scope:SCOPES[0],actor:'teacher-a'}),/容量/);
 assert.equal(list.length,500);assert.equal(list[499].id,'old-499');
});
