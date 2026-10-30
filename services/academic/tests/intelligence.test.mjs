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


const cloudflare = {
  HAIZ_AI_ENABLE: '1',
  HAIZ_AI_PROVIDER: 'cloudflare',
  HAIZ_CF_ACCOUNT_ID: 'a'.repeat(32),
  HAIZ_CF_API_TOKEN: 'synthetic_workers_ai_token_for_tests_123',
};

test('Cloudflare free Qwen provider requires no paid API model or Mac runtime', async () => {
  let call;
  const result=await semanticExtract({
    env: {...cloudflare, HAIZ_AI_MODEL:'paid/provider', HAIZ_AI_BASE_URL:'https://invalid.example'},
    message:'数学明天交练习册第12页，英语明天背 Unit 4 单词。',
    capturedAt:capturedAt(),
    fetchImpl:async (url,request)=>{
      call={url:url.toString(),request};
      return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
        items:[
          {title:'完成练习册第12页',subject:'数学',due:null,
            evidence:'数学明天交练习册第12页',ambiguous:true,confidence:0.85},
          {title:'背 Unit 4 单词',subject:'英语',due:null,
            evidence:'英语明天背 Unit 4 单词',ambiguous:true,confidence:0.85},
        ],
      })}}]})};
    }
  });
  assert.equal(result.length,2);
  assert.equal(call.url,'https://api.cloudflare.com/client/v4/accounts/' +
    'a'.repeat(32) + '/ai/v1/chat/completions');
  assert.equal(call.request.headers.Authorization,
    'Bearer synthetic_workers_ai_token_for_tests_123');
  const body=JSON.parse(call.request.body);
  assert.equal(body.model,'@cf/qwen/qwen3-30b-a3b-fp8');
  assert.equal(body.response_format.type,'json_object');
  assert.equal(call.request.redirect,'error');
  assert.equal(JSON.stringify(body).includes('synthetic_workers_ai_token'),false);
});

test('Cloudflare API token and Account ID must both exist, with no unsafe URL overrides', async () => {
  for(const config of [
    {...cloudflare,HAIZ_CF_API_TOKEN:''},
    {...cloudflare,HAIZ_CF_ACCOUNT_ID:'not-an-account'},
    {...cloudflare,HAIZ_CF_API_TOKEN:'token with whitespace 12345678'},
    {...cloudflare,HAIZ_AI_PROVIDER:'unknown'},
  ]) {
    await assert.rejects(semanticExtract({
      env:config,message:'数学明天交作业',capturedAt:capturedAt(),
      fetchImpl:async()=>{throw Error('should not send request');},
    }),{status:503});
  }
});

test('Ollama local open-weight Qwen requires no API token and never calls remote hosts', async () => {
  let call;
  const items=await semanticExtract({
    env:{HAIZ_AI_ENABLE:'1',HAIZ_AI_PROVIDER:'ollama',HAIZ_OLLAMA_URL:'http://127.0.0.1:11434'},
    message:'物理明天交实验报告',capturedAt:capturedAt(),
    fetchImpl:async (url,request)=>{
      call={url:url.toString(),request};
      return {ok:true,json:async()=>({message:{content:JSON.stringify({items:[{
        title:'完成实验报告',subject:'物理',due:null,
        evidence:'物理明天交实验报告',ambiguous:true,confidence:0.95,
      }]})}})};
    },
  });
  assert.equal(items.length,1);
  assert.equal(call.url,'http://127.0.0.1:11434/api/chat');
  assert.equal(call.request.headers.Authorization,undefined);
  const body=JSON.parse(call.request.body);
  assert.equal(body.model,'qwen3.5:2b');
  assert.equal(body.format,'json');
  assert.equal(body.stream,false);
  assert.equal(body.think,false);
  for(const url of ['http://8.8.8.8:11434','https://ollama.example','http://localhost:11434/secret',
    'http://user:pass@localhost:11434','http://localhost:11434/?x=y']) {
    await assert.rejects(semanticExtract({
      env:{HAIZ_AI_ENABLE:'1',HAIZ_AI_PROVIDER:'ollama',HAIZ_OLLAMA_URL:url},
      message:'物理明天交实验报告',capturedAt:capturedAt(),
      fetchImpl:async()=>{throw Error('unsafe fetch');},
    }),{status:503});
  }
});

test('free quota exhaustion does not publish, persist or return upstream account data', async () => {
  await assert.rejects(semanticExtract({
    env:cloudflare,message:'语文明天交作文',capturedAt:capturedAt(),
    fetchImpl:async()=>({ok:false,status:429,text:async()=>'{SECRET_USER_INFORMATION}'}),
  }),error=>error.code==='AI_FREE_QUOTA_EXCEEDED' &&
    !error.message.includes('SECRET_USER_INFORMATION'));
});
