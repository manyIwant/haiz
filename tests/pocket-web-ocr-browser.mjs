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
  const chinese = await page.evaluate(async () => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0,0,1200,270);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 106px "Noto Sans CJK SC", sans-serif';
    ctx.fillText('数学作业',50,175);
    const blob = await new Promise((resolve,reject) =>
      canvas.toBlob(file => file ? resolve(file) : reject(new Error('Chinese PNG failed')), 'image/png'));
    return await window.HAIZ_OCR.recognize(new Uint8Array(await blob.arrayBuffer()));
  });
  assert.match(chinese,/数学|作业/,
    'Chinese OCR did not recognize either target word: '+chinese);
  const during = requests.slice(requestStart);
  // Flutter may asynchronously fetch public Google fonts for its UI. That is
  // separate from screenshot OCR. Audit every image upload and every OCR
  // dependency independently instead of misclassifying unrelated font GETs.
  const offOrigin = during.filter(req => req.url.startsWith('http') &&
    new URL(req.url).origin !== new URL(url).origin);
  const fontRequests = offOrigin.filter(req =>
    new URL(req.url).hostname === 'fonts.gstatic.com' && req.method === 'GET');
  const otherExternal = offOrigin.filter(req => !fontRequests.includes(req));
  assert.deepEqual(otherExternal,[],
    'Only pre-existing public Flutter UI font GETs may leave the origin');
  const uploads = during.filter(req => !['GET','HEAD','OPTIONS'].includes(req.method));
  assert.deepEqual(uploads,[],'No image upload is permitted during OCR');
  const ocrRequests = during.filter(req=>req.url.includes('/pocket/ocr/'));
  assert.ok(ocrRequests.every(req => new URL(req.url).origin === new URL(url).origin),
    'All OCR scripts, WASM and models must remain same-origin');
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/vendor/tesseract.min.js')),
    'The OCR engine must load from HAIZ');
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/lang/chi_sim.traineddata.gz')),
    'Chinese language model must be self-hosted');
  assert.ok(ocrRequests.some(req=>req.url.includes('/ocr/lang/eng.traineddata.gz')),
    'English language model must be self-hosted');
  console.log(JSON.stringify({
    status:'PASS',engine:'Tesseract.js 7 local',
    result:text.trim(),chineseResult:chinese.trim(),elapsedMs:Date.now()-started,
    ocrRequests:ocrRequests.length,uploads:uploads.length,
    externalUiFonts:fontRequests.length,otherExternal:otherExternal.length,
    errors:errors.slice(0,4)
  },null,2));
}finally{
  await browser.close();
}
