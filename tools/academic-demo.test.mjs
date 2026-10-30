import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

test('localhost demo account and ClassIsland feed share one fictional class', async () => {
  const dir=mkdtempSync(join(tmpdir(),'haiz-demo-smoke-'));
  const port=19423;
  const base='http://127.0.0.1:'+port;
  const script=join(dirname(fileURLToPath(import.meta.url)),'start-academic-demo.mjs');
  const child=spawn(process.execPath,[script],{
    env:{...process.env,HAIZ_DEMO_DATA_DIR:dir,HAIZ_DEMO_PORT:String(port)},
    stdio:['ignore','pipe','pipe']
  });
  try{
    let health;
    for(let i=0;i<50;i++){
      try{health=await fetch(base+'/api/health');if(health.status===200)break}catch{}
      if(child.exitCode!==null)throw Error('Backend exited before it could be contacted');
      await delay(100);
    }
    assert.equal(health?.status,200,'demo backend must start on loopback');
    const auth=await fetch(base+'/api/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({login:'manyiwant',password:'admin'})
    });
    assert.equal(auth.status,200);
    assert.equal((await auth.json()).user.role,'student');
    const cookie=auth.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('hsid='));
    const headers={Cookie:cookie};
    const classes=await (await fetch(base+'/api/classes',{headers})).json();
    const tasks=await (await fetch(base+'/api/my/assignments',{headers})).json();
    assert.equal(classes.classes.length,1);
    assert.equal(tasks.assignments.length,1);
    assert.equal(tasks.assignments[0].title,'欢迎使用 HAIZ Academic（测试作业）');
    const db=new DatabaseSync(join(dir,'demo.sqlite'));
    let screenKey;
    try{screenKey=db.prepare('SELECT screen_key FROM classes LIMIT 1').get().screen_key;}finally{db.close();}
    const response=await fetch(base+'/api/screens/'+screenKey);
    assert.equal(response.status,200);
    const screen=await response.json();
    assert.equal(screen.assignments[0].title,tasks.assignments[0].title);
    assert.equal(screen.containsStudentIdentity,false);
    assert.equal(screen.readOnly,true);
  }finally{
    child.kill('SIGTERM');
    await delay(350);
    rmSync(dir,{recursive:true,force:true});
  }
});
