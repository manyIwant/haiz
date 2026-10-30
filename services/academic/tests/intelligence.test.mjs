import test from 'node:test';
import assert from 'node:assert/strict';
import {safeNoticeText, checkExtraction, semanticExtract} from '../intelligence.mjs';
import {fixture} from './helpers.mjs';

const env = {
  HAIZ_AI_ENABLE:'1',
  HAIZ_AI_BASE_URL:'https://trusted-model.example/v1',
  HAIZ_AI_MODEL:'test-semantic-model',
  HAIZ_AI_API_KEY:'synthetic-not-a-real-token',
};
const capturedAt=()=>new Date().toISOString();

test('AI output: multiple tasks with real quote evidence, uncertain deadlines and rejected hallucinations', async () => {
  let seen;
  const result=await semanticExtract({
    message:'数学练习册第12页明天交。英语准备Unit 4，什么时候检查另行通知。',
    capturedAt:capturedAt(),env,
    fetchImpl:async (url,request)=>{
      seen={url:url.toString(),request};
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
        items:[
          {subject:'数学',title:'完成练习册第12页',due:'2026-10-30',
            evidence:'数学练习册第12页明天交',confidence:0.93,ambiguous:false},
          {subject:'英语',title:'准备Unit 4',due:null,
            evidence:'英语准备Unit 4，什么时候检查另行通知',confidence:0.75,
            ambiguous:true,uncertainty:'检查日期尚未通知'},
          {subject:'化学',title:'想象出来的化学作业',due:null,
            evidence:'不存在的原文',confidence:1},
        ],
      })}}]})};
    }
  });
  assert.equal(result.length,2);
  assert.equal(result[0].subject,'数学');
  assert.equal(result[1].ambiguous,true);
  assert.equal(result[1].due,null);
  assert.equal(seen.url,'https://trusted-model.example/v1/chat/completions');
  assert.equal(seen.request.headers.Authorization,'Bearer synthetic-not-a-real-token');
  assert.equal(JSON.stringify(seen.request).includes('test-semantic-model'),true);
});

test('AI extractor strips contact details and URLs before contacting model', async () => {
  let transmitted='';
  const input='语文明天交阅读报告，手机号13812345678，联系abc@school.example，参考 https://example.org/path?secret=value';
  const sanitized=safeNoticeText(input);
  assert.ok(!sanitized.includes('13812345678'));
  assert.ok(!sanitized.includes('abc@school.example'));
  assert.ok(!sanitized.includes('secret=value'));
  const result=await semanticExtract({
    message:input,capturedAt:capturedAt(),env,
    fetchImpl:async (_url,options)=>{
      transmitted=options.body;
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
        items:[{subject:'语文',title:'阅读报告',due:null,
          evidence:'语文明天交阅读报告',confidence:0.9,ambiguous:false}],
      })}}]})};
    }
  });
  assert.equal(result.length,1);
  assert.ok(!transmitted.includes('13812345678'));
  assert.ok(!transmitted.includes('abc@school.example'));
  assert.ok(!transmitted.includes('secret=value'));
});

test('invalid hallucinated deadlines are never accepted without uncertainty', () => {
  const input='明天交数学作业';
  const values=checkExtraction({items:[{
    subject:'数学',title:'交数学作业',due:'2026-02-30',
    evidence:input,confidence:0.99,ambiguous:false
  }]},input);
  assert.equal(values.length,1);
  assert.equal(values[0].due,null);
  assert.equal(values[0].ambiguous,true);
  assert.deepEqual(checkExtraction({items:[{
    subject:'数学',title:'完成课本',due:null,evidence:'unrelated source',confidence:1,
  }]},input),[]);
  assert.throws(()=>checkExtraction({items:Array.from({length:9},()=>({}))},input));
});

test('AI unavailable by default, no unauthorized/student-unapproved extraction and no raw log', async t => {
  const {anonymous,b,enroll,teacher,classroom}=await fixture(t);
  const route='/api/ai/extract';
  const p={message:'语文明天交读书摘录',capturedAt:capturedAt(),consent:true};
  assert.equal((await anonymous.call(route,'POST',p)).status,401);
  const pending=await enroll('new_ai',false);
  assert.equal((await pending.call(route,'POST',p)).status,403);
  assert.equal((await b.call(route,'POST',{...p,consent:false})).status,400);
  const disabled=await b.call(route,'POST',p);
  assert.equal(disabled.status,503);
  assert.equal((await teacher.call(route,'POST',p)).status,403);
  assert.equal((await b.call(route,'POST',{...p,sender:'private'})).status,400);
  const feed=await b.call('/api/my/assignments');
  assert.equal(feed.body.assignments.length,0);
  const teacherInbox=await teacher.call('/api/classes/'+classroom.id+'/mobile-suggestions');
  assert.equal(teacherInbox.body.suggestions.length,0);
});
