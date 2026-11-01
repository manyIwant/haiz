import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Script,createContext} from 'node:vm';

const bridge=readFileSync(resolve(import.meta.dirname,'../app/web/pocket-ocr.js'),'utf8');
const image=new Uint8Array(64);
image.set([137,80,78,71,13,10,26,10]);

function harness({deferred=false}={}) {
  const activity={scripts:[],calls:[],recognitions:[],terminations:0,uploads:0};
  let release;
  const recognition=deferred?new Promise(resolve=>{release=resolve}):Promise.resolve({data:{text:'数学周五交练习册第36页'}});
  const worker={
    recognize:async file=>{activity.recognitions.push(file);return recognition},
    terminate:async ()=>{activity.terminations++;}
  };
  const window={
    Tesseract:null,
  };
  const document={
    baseURI:'https://haiz.space/pocket/',
    head:{
      append:(script)=>{
        activity.scripts.push(script.src);
        window.Tesseract={
          createWorker:async(langs,oem,options)=>{
            activity.calls.push({langs,oem,options});
            return worker;
          }
        };
        queueMicrotask(()=>script.onload());
      }
    },
    createElement:()=>({src:'',async:false,crossOrigin:'',onload:null,onerror:null}),
  };
  const context=createContext({window,document,Blob,Uint8Array,
    URL,queueMicrotask,fetch:()=>{activity.uploads++;throw Error('Image must never be uploaded')},
  });
  new Script(bridge).runInContext(context);
  return {bridge:window.HAIZ_OCR,activity,release,worker};
}

test('OCR is lazy and uses only same-origin engine and model paths',async()=>{
  const {bridge,activity}=harness();
  assert.equal(activity.scripts.length,0,'no engine loaded on Pocket startup');
  const text=await bridge.recognize(image);
  assert.match(text,/数学周五/);
  assert.deepEqual(activity.scripts,
    ['https://haiz.space/pocket/ocr/vendor/tesseract.min.js']);
  const options=activity.calls[0].options;
  for(const key of ['workerPath','corePath','langPath']){
    assert.ok(options[key].startsWith('https://haiz.space/pocket/ocr/'));
  }
  assert.equal(options.workerBlobURL,false);
  assert.equal(activity.calls[0].oem,1);
  assert.equal(activity.calls[0].langs.join(','),'chi_sim,eng');
  assert.equal(activity.recognitions.length,1);
  assert.equal(activity.uploads,0);
  assert.equal(activity.terminations,1);
  assert.equal(bridge.status(),'');
});

test('malformed image rejected before downloading engine or models',async()=>{
  const {bridge,activity}=harness();
  await assert.rejects(()=>bridge.recognize(new Uint8Array(64)),/PNG|JPEG/);
  await assert.rejects(()=>bridge.recognize(new Uint8Array(4)),/12 MB|空文件/);
  assert.deepEqual(activity.scripts,[]);
  assert.equal(activity.uploads,0);
});

test('cancel suppresses stale OCR output and terminates worker',async()=>{
  const {bridge,activity,release}=harness({deferred:true});
  const pending=bridge.recognize(image);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(activity.recognitions.length,1);
  bridge.cancel();
  release({data:{text:'不能写入旧任务'}});
  await assert.rejects(pending,/已取消/);
  assert.ok(activity.terminations>0);
  assert.equal(bridge.status(),'');
});
