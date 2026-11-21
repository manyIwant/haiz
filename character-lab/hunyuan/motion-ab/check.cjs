const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const base = process.env.HAIZ_PREVIEW_URL || 'http://127.0.0.1:8769';
const url = `${base}/character-lab/hunyuan/motion-ab/`;
const args = ['--enable-unsafe-swiftshader'];
if (process.env.HAIZ_SWIFTSHADER) args.push('--use-angle=swiftshader');
else if (process.platform === 'darwin') args.push('--use-angle=metal');

async function record(page) {
  const video = await page.evaluate(async () => {
    window.__motionAB.seek(0);
    const canvas = document.querySelector('#stage');
    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height + 48;
    const ctx = composite.getContext('2d');
    const stream = composite.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6200000});
    const chunks = [];
    const fps = setInterval(()=>{
      ctx.fillStyle = '#26352e';
      ctx.fillRect(0,0,composite.width,48);
      ctx.fillStyle = '#f6f4ed';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('A · 程序化步态',canvas.width*.25,21);
      ctx.fillText('B · Quaternius + 脚底 IK',canvas.width*.75,21);
      ctx.font = '11px system-ui';
      ctx.fillText(document.querySelector('#status').textContent,canvas.width/2,38);
      ctx.drawImage(canvas,0,48);
    },1000/30);
    recorder.ondataavailable = event=>chunks.push(event.data);
    const done = new Promise((resolve,reject)=>{
      recorder.onerror=reject;
      recorder.onstop=()=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.onerror=reject;
        reader.readAsDataURL(new Blob(chunks,{type:mimeType}));
      };
    });
    recorder.start();
    document.querySelector('#play').click();
    setTimeout(()=>recorder.stop(),13800);
    try {return await done;}
    finally {
      clearInterval(fps);
      for(const track of stream.getTracks()) track.stop();
    }
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'haiz-ab-'));
  const input = path.join(dir,'comparison.webm');
  try {
    await fs.writeFile(input,Buffer.from(video,'base64'));
    const output = path.join(__dirname,'..','evidence','motion-ab.mp4');
    execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',input,
      '-vf','fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2','-an','-c:v','libx264','-crf','20',
      '-pix_fmt','yuv420p','-movflags','+faststart',output], {stdio:'inherit'});
  } finally {
    await fs.rm(dir,{recursive:true});
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.HAIZ_CHROMIUM, args });
  try {
    const page = await browser.newPage({ viewport: { width: 1260, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    if (process.argv.includes('--build')) {
      await page.goto(url + 'prepare.html');
      await page.waitForFunction(() => typeof window.build === 'function');
      const result = await page.evaluate(() => window.build());
      assert.equal(Object.keys(result.clips).length, 8);
      await fs.writeFile(path.join(__dirname, 'clips.json'), JSON.stringify(result) + '\n');
      console.log(result.templateMatches, result.report);
      assert.deepEqual(errors, []);
      return;
    }
    await page.goto(url);
    await page.waitForFunction(() => window.__motionAB?.ready, null, { timeout: 20000 });
    const report = await page.evaluate(() => window.__motionAB.measure());
    assert.equal(report.maximumPathDifference_m,0);
    assert.equal(report.template.verifiedClips,8);
    assert.ok(['idle','walk','run','start','stop','left','right'].every(name=>report.stateFrames[name]>0));
    for (const stage of Object.values(report.stages)) {
      assert.ok(stage.slideA.samples > 10);
      assert.ok(stage.slideB.p95_cm < stage.slideA.p95_cm + .35);
      assert.ok(stage.gapB.p95_cm < stage.gapA.p95_cm + .35);
    }
    for (const [stage, time] of Object.entries({ start: 1.8, walk: 3.6, run: 5.95, turn: 7.1, stop: 11.38 })) {
      await page.evaluate(time => window.__motionAB.seek(time), time);
      await page.screenshot({ path: path.join(__dirname, '..', 'evidence', 'motion-ab-' + stage + '.png') });
    }
    if (process.argv.includes('--record')) await record(page);
    const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    try {
      await mobile.goto(url);
      await mobile.waitForFunction(() => window.__motionAB?.ready);
      await mobile.locator('#play').tap();
      await mobile.locator('[data-angle="1.57"]').tap();
      assert.equal(await mobile.locator('[data-angle="1.57"]').getAttribute('aria-pressed'),'true');
      report.mobileViewport = await mobile.evaluate(() => ({
        width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
      }));
      assert.equal(report.mobileViewport.overflow,false);
    } finally {
      await mobile.close();
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(__dirname, '..', 'evidence', 'motion-ab.json'), JSON.stringify({ browser: browser.version(), ...report }, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
