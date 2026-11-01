#!/usr/bin/env node
/**
 * Full browser smoke test (Chromium, not iPhone Safari).
 * Host app/build/web at /pocket/ and run the actual Tesseract WASM worker.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.env.HAIZ_OCR_SMOKE_URL || 'http://127.0.0.1:8877/pocket/';
const chrome = process.env.HAIZ_TEST_CHROME;
if (!chrome) throw new Error('HAIZ_TEST_CHROME must name the installed Chrome executable');

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
const requests = [];
const errors = [];
page.on('request', req => requests.push({url:req.url(),method:req.method()}));
page.on('pageerror', err => errors.push(err.message));

try {
  const response = await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>typeof window.HAIZ_OCR?.recognize==='function',
    null,{timeout:40000});
  const requestStart = requests.length;
  const started = Date.now();
  const text = await page.evaluate(async ()=>{
    const canvas=document.createElement('canvas');
    canvas.width=1200;
    canvas.height=240;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';
    ctx.fillRect(0,0,1200,240);
    ctx.fillStyle='black';
    ctx.font='bold 80px sans-serif';
    ctx.fillText('Homework 36',50,145);
    const blob=await new Promise((resolve,reject)=>
      canvas.toBlob(file=>file?resolve(file):reject(new Error('PNG render failed')), 'image/png'));
    const bytes=new Uint8Array(await blob.arrayBuffer());
    return await Promise.race([
      window.HAIZ_OCR.recognize(bytes),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('OCR timed out after 120 seconds')),120000))
    ]);
  });
  assert.match(text,/homework/i,'OCR did not recognize the test English word: '+text);
  assert.match(text,/36/,'OCR did not recognize the test number: '+text);
  const during = requests.slice(requestStart);
  const offOrigin = during.filter(req => req.url.startsWith('http') &&
    new URL(req.url).origin !== new URL(url).origin);
  assert.deepEqual(offOrigin,[],'Local OCR must not contact third-party origins');
  const uploads = during.filter(req => !['GET','HEAD','OPTIONS'].includes(req.method));
  assert.deepEqual(uploads,[],'No image upload is permitted during OCR');
  const ocrRequests = during.filter(req=>req.url.includes('/pocket/ocr/'));
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/vendor/tesseract.min.js')),
    'The OCR engine must load from HAIZ');
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/lang/chi_sim.traineddata.gz')),
    'Chinese language model must be self-hosted');
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/lang/eng.traineddata.gz')),
    'English language model must be self-hosted');
  console.log(JSON.stringify({
    status:'PASS',engine:'Tesseract.js 7 local',
    result:text.trim(),elapsedMs:Date.now()-started,
    ocrRequests:ocrRequests.length,uploads:uploads.length,
    offOrigin:offOrigin.length,errors:errors.slice(0,4)
  },null,2));
}finally{
  await browser.close();
}
