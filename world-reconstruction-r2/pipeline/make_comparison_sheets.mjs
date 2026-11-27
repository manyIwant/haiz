/**
 * HAIZ · World Reconstruction Round 2 — Visual Comparison Sheet Compositor
 * Uses Playwright + Chromium 2D canvas to produce crystal-clear labeled comparison sheets:
 *   1. Internal 4-way inspection sheets in scratch: [Real Campus Photo | Legacy HAIZ | PR #118 | Round 2]
 *   2. Public PR comparison plates in world-reconstruction-r2/renders/comparisons/:
 *      [Legacy HAIZ Model | PR #118 Model | Round 2 Iter v1 | Round 2 Final]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');

const REPO = '/Users/a11/manyiwant/haiz-world-reconstruction-r2';
const SCRATCH = '/Users/a11/.gemini/antigravity/brain/0213b5cb-0365-4869-be17-edd2d36559fd/scratch/r2_audit';
const PUBLIC_COMP = path.join(REPO, 'world-reconstruction-r2/renders/comparisons');
fs.mkdirSync(PUBLIC_COMP, { recursive: true });

function b64(p) {
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).toLowerCase() === '.png' ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}`;
}

async function composeQuad(page, title, subtitle, panels, outPath) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe4;font-family:-apple-system,PingFang SC,sans-serif;color:#1e2620;">
    <div style="width:1600px;padding:24px 28px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #25362c;padding-bottom:10px;margin-bottom:16px;">
        <div style="font-family:Songti SC,Georgia,serif;font-size:24px;font-weight:700;">${title}</div>
        <div style="font-size:13px;color:#526158;">${subtitle}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${panels.map((p) => `
          <div style="background:#fffdf8;border:1px solid #cbc3b2;border-radius:8px;overflow:hidden;">
            <div style="padding:8px 12px;font-size:13.5px;font-weight:600;background:#22352c;color:#f6f1e7;display:flex;justify-content:space-between;">
              <span>${p.label}</span>
              <span style="font-weight:400;opacity:0.8;font-size:12px;">${p.note || ''}</span>
            </div>
            <div style="width:100%;height:460px;background:#1a1e1c;display:flex;align-items:center;justify-content:center;overflow:hidden;">
              ${p.src ? `<img src="${p.src}" style="width:100%;height:100%;object-fit:cover;"/>` : `<span style="color:#aaa;">Missing: ${p.path || ''}</span>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </body></html>`;
  await page.setViewportSize({ width: 1600, height: 1120 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
  console.log('Composed ->', outPath);
}

async function main() {
  const mode = process.argv[2] || 'audit';
  const iter = process.argv[3] || 'v1';

  const specs = [
    {
      id: 'beimen',
      title: '北门牌坊 · 同一标定机位四方对照 (hero-2560 Calibrated Camera)',
      subtitle: '对比真实实景、HAIZ Phase-1、PR #118 与 Round 2 真实感迭代',
      photo: path.join(REPO, 'assets/images/web/hero-2560.jpg'),
      photoNote: 'assets/images/web/hero-2560.jpg',
      cam: 'beimen_calib',
    },
    {
      id: 'library',
      title: '图书馆与天文台 · 同一机位四方对照 (SW Grand Staircase & Dome)',
      subtitle: '真实大台阶、倒角遮阳外廊、弧形蓝绿幕墙与20肋银灰穹顶还原',
      photo: path.join(REPO, 'assets/images/campus/campus_library.jpg'),
      photoNote: 'assets/images/campus/campus_library.jpg',
      cam: 'library_calib',
    },
    {
      id: 'fengqitang',
      title: '凤栖堂与春风化雨铜像 · 同一机位四方对照',
      subtitle: '孔雀绿琉璃筒瓦与瓦当、金色木柱础与红木门窗、铜像与石台基还原',
      photo: path.join(REPO, 'assets/images/campus/campus_fengqitang.jpg'),
      photoNote: 'assets/images/campus/campus_fengqitang.jpg',
      cam: 'fengqitang_calib',
    },
    {
      id: 'yanlinting',
      title: '衍林亭 · 同一机位四方对照 (Emerald Curved Pavilion & Meirenkao)',
      subtitle: '四角攒尖孔雀绿琉璃宝顶、朱红翘角飞椽、楹联与美人靠坐凳还原',
      photo: path.join(REPO, 'assets/images/campus/campus_yanlintang.jpg'),
      photoNote: 'assets/images/campus/campus_yanlintang.jpg',
      cam: 'yanlinting_calib',
    },
    {
      id: 'keji',
      title: '科技楼 · 同一机位四方对照 (Science & Tech Plaza Diagonal)',
      subtitle: '棕色横百叶裙墙、香槟色壁柱、双层青铜玻璃大堂与错格广场还原',
      photo: path.join(REPO, 'assets/images/campus/campus_keji.jpg'),
      photoNote: 'assets/images/campus/campus_keji.jpg',
      cam: 'keji_calib',
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const s of specs) {
    const leg = path.join(SCRATCH, 'baselines', `${s.cam}_legacy.jpg`);
    const pr = path.join(SCRATCH, 'baselines', `${s.cam}_pr118.jpg`);
    const cur = path.join(SCRATCH, iter, `${s.cam}.jpg`);

    if (mode === 'audit') {
      await composeQuad(
        page,
        `${s.title} [${iter}]`,
        s.subtitle,
        [
          { label: '1 · 真实校园参考实景', note: s.photoNote, src: b64(s.photo), path: s.photo },
          { label: '2 · HAIZ 原有模型 (Phase 1)', note: '同机位渲染', src: b64(leg), path: leg },
          { label: '3 · PR #118 新建模型', note: '同机位渲染（均质简化）', src: b64(pr), path: pr },
          { label: `4 · Round 2 迭代 (${iter})`, note: 'Blender PBR 精雕模型', src: b64(cur), path: cur },
        ],
        path.join(SCRATCH, `compare_${s.id}_${iter}.jpg`),
      );
    } else if (mode === 'public') {
      const v1 = path.join(SCRATCH, 'v1', `${s.cam}.jpg`);
      const v3 = path.join(SCRATCH, 'v3', `${s.cam}.jpg`);
      await composeQuad(
        page,
        s.title.replace('四方对照', '三维模型演进对照'),
        `对照基准实景：${s.photoNote}（实景图保留在主仓原目录，本版仅对比纯三维模型演进）`,
        [
          { label: '1 · HAIZ 原有模型 (Phase 1)', note: '基础几何 / 灰盒体量', src: b64(leg), path: leg },
          { label: '2 · PR #118 模型', note: '参数化快建（特征趋同）', src: b64(pr), path: pr },
          { label: '3 · Round 2 初稿 (v1)', note: '首轮实景特征建立', src: b64(v1), path: v1 },
          { label: '4 · Round 2 终版 (v3 Cycles)', note: '三轮视觉对照精雕定稿', src: b64(v3), path: v3 },
        ],
        path.join(PUBLIC_COMP, `comp_${s.id}.jpg`),
      );
    }
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
