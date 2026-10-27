import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { normalizeMention,relayMention } from './bot.mjs';

test('Official QQ mention normalization ignores unmentioned groups and DMs',()=>{
 const base={kind:'group',rawEventType:'GROUP_AT_MESSAGE_CREATE',
  senderIsBot:false,messageId:'m1',groupOpenid:'gid',content:'数学周五交作业'};
 assert.equal(normalizeMention({...base,rawEventType:'GROUP_MESSAGE_CREATE'}),null);
 assert.equal(normalizeMention({...base,kind:'private'}),null);
 assert.equal(normalizeMention({...base,senderIsBot:true}),null);
 assert.equal(normalizeMention(base).content,'数学周五交作业');
});
test('QQ official adapter only forwards signed, minimal user content to review queue',async()=>{
 const fake={kind:'group',rawEventType:'GROUP_AT_MESSAGE_CREATE',
  senderIsBot:false,messageId:'messageID',groupOpenid:'group1',content:'周五交物理'};
 const secret='12345678901234567890123456789012';
 let called=0;
 const send=async(url,config)=>{
  called++;
  assert.equal(url,'http://127.0.0.1:8780/api/integrations/qq/event');
  const body=JSON.parse(config.body);
  assert.deepEqual(Object.keys(body).sort(),['content','eventType','groupOpenid','mentioned','messageId'].sort());
  assert.equal(body.content,'周五交物理');
  assert.equal(config.headers['x-haiz-signature'],
   createHmac('sha256',secret).update('1234.'+config.body).digest('hex'));
  return {ok:true,json:async()=>({accepted:true,reviewRequired:true})};
 };
 const a=await relayMention(fake,{baseUrl:'http://127.0.0.1:8780',secret,send,now:()=>1234});
 assert.equal(a.reviewRequired,true);
 assert.equal(called,1);
 const b=await relayMention({...fake,rawEventType:'GROUP_MESSAGE_CREATE'},
  {baseUrl:'http://127.0.0.1:8780',secret,send});
 assert.equal(b.ignored,true);
 assert.equal(called,1);
 await assert.rejects(()=>relayMention(fake,{baseUrl:'http://10.0.0.7:8780',secret,send}),/HTTPS/);
});
