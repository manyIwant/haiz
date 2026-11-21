const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.HAIZ_PREVIEW_URL || 'http://127.0.0.1:8769';
const output = path.join(__dirname, 'evidence', 'student-motion.mp4');

async function record(page, selector, duration, choreography) {
  const recording = page.evaluate(async ({ selector, duration }) => {
    const stream = document.querySelector(selector).captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6400000 });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const data = new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = reject;
    });
    recorder.start();
    setTimeout(() => recorder.stop(), duration);
    try {
      return await data;
    } finally {
      for (const track of stream.getTracks()) track.stop();
    }
  }, { selector, duration });
  await choreography();
  return Buffer.from(await recording, 'base64');
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'haiz-student-demo-'));
  const labFile = path.join(directory, 'lab.webm');
  const campusFile = path.join(directory, 'campus.webm');
  const browser = await chromium.launch({
    ...(process.env.HAIZ_CHROMIUM ? { executablePath: process.env.HAIZ_CHROMIUM } : {}),
    args: ['--enable-unsafe-swiftshader', ...(process.env.HAIZ_SWIFTSHADER ? ['--use-angle=swiftshader'] : process.platform === 'darwin' ? ['--use-angle=metal'] : [])],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
    await page.route('https://api.open-meteo.com/**', route => route.abort());
    await page.goto(`${base}/character-lab/hunyuan/`);
    await page.waitForFunction(() => window.__characterLab?.stats().tier === 'near');
    await fs.writeFile(labFile, await record(page, '#stage', 8600, async () => {
      await page.waitForTimeout(1900);
      await page.locator('[data-view=side]').click();
      await page.locator('#motion').selectOption('Walk');
      await page.waitForTimeout(2080);
      await page.locator('[data-view=three-quarter]').click();
      await page.locator('#motion').selectOption('Run');
      await page.waitForTimeout(2050);
      await page.locator('[data-view=back]').click();
      await page.locator('#motion').selectOption('Idle');
      await page.waitForTimeout(950);
      await page.locator('#motion').selectOption('Turn Left');
    }));
    await page.goto(`${base}/ruhua.html?figure=hunyuan&stage=stroll&quality=medium&capture=1`);
    await page.waitForFunction(() => window.__ruhua?.stage === 'stroll' && window.__ruhua.student.root.userData.asset === 'hunyuan', null, { timeout: 90000 });
    await page.evaluate(() => window.__ruhua.weather.setFree('cloudy', 13.25));
    await page.waitForTimeout(2400);
    await fs.writeFile(campusFile, await record(page, '#rh-canvas', 7400, async () => {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(2200);
      await page.keyboard.down('Shift');
      await page.waitForTimeout(1650);
      await page.keyboard.up('Shift');
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(960);
      await page.keyboard.up('KeyD');
    }));
  } finally {
    await browser.close();
  }

  const prep = 'fps=30,scale=1152:720:force_original_aspect_ratio=decrease,pad=1152:720:(ow-iw)/2:(oh-ih)/2:color=0x242e29,setsar=1';
  const graph = `[0:v]${prep}[a];[1:v]${prep}[b];[a][b]concat=n=2:v=1:a=0[v]`;
  const encoded = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', labFile, '-i', campusFile,
    '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', output],
  { stdio: 'inherit' });
  if (encoded.status !== 0) throw new Error('FFmpeg did not encode the motion review');
  await fs.rm(directory, { recursive: true });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
