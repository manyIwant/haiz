#!/usr/bin/env node
/**
 * HAIZ Academic localhost-only sample data. NEVER deploy this entrypoint.
 * Credentials manyiwant/admin are intentionally weak and limited to loopback demo.
 */
import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

if (process.env.HAIZ_PUBLIC_HTTPS === '1' || (process.env.HAIZ_HOST && !['127.0.0.1','localhost','::1'].includes(process.env.HAIZ_HOST))) {
  throw Error('Local demo must never be served publicly.');
}
const dir = process.env.HAIZ_DEMO_DATA_DIR || join(homedir(),'.local','share','haiz-academic-demo');
mkdirSync(dir,{recursive:true,mode:0o700});
chmodSync(dir,0o700);
const database = join(dir,'demo.sqlite');
const config = join(dir,'demo-admin-password');
if (!existsSync(config)) {
  writeFileSync(config,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
}
const password = (await import('node:fs')).readFileSync(config,'utf8');
process.env.HAIZ_HOST='127.0.0.1';
process.env.HAIZ_PORT=process.env.HAIZ_DEMO_PORT||'8782';
process.env.HAIZ_DB_PATH=database;
process.env.HAIZ_ADMIN_LOGIN='haizdemoowner';
process.env.HAIZ_ADMIN_PASSWORD=password;
const { server, db } = await import('../services/academic/server.mjs');
const token =()=>randomBytes(24).toString('hex');
const addUser=(login,label,role,pass)=>{
  const id=randomUUID(),salt=token(),hash=pbkdf2Sync(pass,salt,200000,32,'sha256').toString('hex');
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id,login,label,role,salt,hash);
  return id;
};
const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
const demoLogin = 'manyiwant';
let student=db.prepare('SELECT id,role FROM users WHERE login=?').get(demoLogin);
if (!student) {
  student={id:addUser(demoLogin,'HAIZ 演示学生','student','admin'),role:'student'};
  console.log('[HAIZ Demo] Created localhost-only student user manyiwant.');
}
if(student.role!=='student')throw Error('Existing manyiwant user has a different role; refusing to alter.');
const mark='HAIZ 本地演示班级（虚构数据）';
let classroom=db.prepare('SELECT id,screen_key FROM classes WHERE title=? AND teacher_id=?').get(mark,admin.id);
if(!classroom){
 const id=randomUUID(),screenKey=token()+token();
 db.prepare('INSERT INTO classes VALUES (?,?,?,?,?)').run(id,mark,admin.id,token().slice(0,12),screenKey);
 db.prepare("INSERT INTO memberships VALUES (?,?,?)").run(id,student.id,'active');
 db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,'演示','欢迎使用 HAIZ Academic（测试作业）',null,'仅用于本机连接测试',null,admin.id,new Date().toISOString());
 classroom={id,screen_key:screenKey};
}
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(process.env.HAIZ_PORT),process.env.HAIZ_HOST,resolve)});
console.log('[HAIZ Demo] Browser: http://127.0.0.1:'+process.env.HAIZ_PORT+'/');
console.log('[HAIZ Demo] Account: manyiwant / admin (LOCAL DEMO ONLY)');
console.log('[HAIZ Demo] ClassIsland screen endpoint requires the local screen key, never publish it.');
console.log('[HAIZ Demo] Data dir: '+dir);
