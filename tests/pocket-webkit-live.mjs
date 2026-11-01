import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {webkit} from 'playwright';

// Real macOS WebKit. NOT Safari.app remote automation or an iPhone.
const url='https://haiz.space/pocket/?fromLamp=1';
const profile=await mkdtemp(join(tmpdir(),'haiz-webkit-live-'));
const report={engine:'Playwright WebKit / macOS (not iPhone)',checks:[],started:new Date().toISOString()};
let context=null;
const note=(name,details)=>{report.checks.push({name,...details});console.log(name,JSON.stringify(details));};
async function readSyntheticImage(page,language,text) {
 const start=Date.now();
 const result=await page.evaluate(async ({language,text})=>{
  const canvas=document.createElement('canvas');
  canvas.width=1150;canvas.height=250;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,1150,250);
  ctx.fillStyle='black';
  ctx.font=language==='zh'?'bold 104px "PingFang SC", sans-serif':'bold 82px Arial';
  ctx.fillText(text,45,172);
  const blob=await new Promise((resolve,reject)=>
    canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG failed')),'image/png'));
  return await Promise.race([
    window.HAIZ_OCR.recognize(new Uint8Array(await blob.arrayBuffer())),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('OCR timeout')),90000))
  ]);
 },{language,text});
 return {recognized:String(result).trim(),durationMs:Date.now()-start};
}
try{
 context=await webkit.launchPersistentContext(profile,{
  headless:true,viewport:{width:390,height:844},serviceWorkers:'allow',acceptDownloads:true
 });
 let page=context.pages()[0]||await context.newPage();
 const requests=[];
 page.on('request',req=>requests.push({method:req.method(),url:req.url()}));
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('flutter-view',{timeout:30000});
 await page.waitForFunction(()=>typeof window.HAIZ_OCR?.recognize==='function',null,{timeout:15000});
 assert.equal(response.status(),200);
 note('Flutter WebKit boot',{pass:true,http:response.status()});
 await page.evaluate(()=>localStorage.setItem('haiz-qa-only','hello'));
 await page.reload({waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('flutter-view',{timeout:30000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('haiz-qa-only')),'hello');
 note('Page reload storage',{pass:true});
 const start=requests.length;
 const english=await readSyntheticImage(page,'en','Homework 36');
 assert.match(english.recognized,/homework/i);
 assert.match(english.recognized,/36/);
 note('English WASM OCR',{pass:true,...english});
 const chinese=await readSyntheticImage(page,'zh','数学作业');
 assert.match(chinese.recognized,/[\u3400-\u9fff]/);
 note('Chinese WASM OCR (not accuracy certification)',{pass:true,...chinese});
 const reqs=requests.slice(start);
 const uploads=reqs.filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method));
 const ocr=reqs.filter(r=>r.url.includes('/pocket/ocr/'));
 const external=ocr.filter(r=>new URL(r.url).origin!=='https://haiz.space');
 assert.equal(uploads.length,0,'No screenshot upload allowed');
 assert.equal(external.length,0,'OCR resources must be same-origin');
 assert.ok(ocr.some(r=>r.url.includes('chi_sim.traineddata.gz')));
 note('OCR privacy',{pass:true,uploads:0,external:0,assetRequests:ocr.length});
 const filePage=await context.newPage();
 await filePage.goto('https://haiz.space/pocket/install.html',
  {waitUntil:'domcontentloaded',timeout:18000});
 const [download]=await Promise.all([
  filePage.waitForEvent('download',{timeout:15000}),
  filePage.evaluate(()=>{
    const a=document.createElement('a');
    a.download='haiz-synthetic-test.json';
    a.href=URL.createObjectURL(new Blob(['{"test":true}'],
      {type:'application/json'}));
    document.body.append(a);a.click();
  })
 ]);
 assert.equal(download.suggestedFilename(),'haiz-synthetic-test.json');
 note('Synthetic JSON download (not HAIZ backup UI)',{pass:true});
 await filePage.close();
 await context.close();context=null;
 context=await webkit.launchPersistentContext(profile,{
  headless:true,viewport:{width:390,height:844},serviceWorkers:'allow'
 });
 page=context.pages()[0]||await context.newPage();
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('flutter-view',{timeout:30000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('haiz-qa-only')),'hello');
 await page.evaluate(()=>localStorage.removeItem('haiz-qa-only'));
 note('Process restart storage',{pass:true});
 report.result='PASS';
}catch(e){
 report.result='FAIL';report.error=String(e).slice(0,1100);
 note('Failure',{pass:false,error:report.error});process.exitCode=1;
}finally{
 if(context)await context.close().catch(()=>{});
 await rm(profile,{recursive:true,force:true});
 await mkdir(resolve('webkit-acceptance'),{recursive:true});
 report.completed=new Date().toISOString();
 await writeFile(resolve('webkit-acceptance/report.json'),
  JSON.stringify(report,null,2)+'\n');
 console.log('Mac WebKit result:',report.result,'-- does not certify iPhone Safari');
}
