const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.HAIZ_PREVIEW_URL || 'http://127.0.0.1:8769';
const evidence = path.join(__dirname, 'evidence');
const lab = `${base}/character-lab/hunyuan/`;
const campus = `${base}/ruhua.html?figure=hunyuan&stage=stroll&quality=low&capture=1`;

async function waitForLab(page, tier, motion) {
  await page.waitForFunction(([tier, motion]) => {
    const stats = window.__characterLab?.stats();
    return stats?.tier === tier && (motion === undefined || stats.motion === motion) && stats.samples > 3;
  }, [tier, motion], { timeout: 25000 });
}

async function openLab(browser, mobile, report) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  try {
    await page.goto(lab, { waitUntil: 'domcontentloaded' });
    const tier = mobile ? 'mid' : 'near';
    await waitForLab(page, tier);
    const state = () => page.evaluate(() => window.__characterLab.current());
    const sample = () => page.evaluate(() => window.__characterLab.stats());
    report.gpu = await page.evaluate(() => window.__characterLab.gpu);
    report.initial = await sample();
    if (mobile) assert.equal(report.initial.modelTriangles, 22100);
    else assert.ok(report.initial.modelTriangles >= 40000 && report.initial.modelTriangles <= 80000);
    await page.screenshot({ path: path.join(evidence, mobile ? 'lab-mobile.png' : 'lab-desktop.png') });
    const before = await state();
    await page.locator('#stage').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('+');
    const after = await state();
    assert.notEqual(after.yaw, before.yaw);
    assert.ok(after.distance < before.distance);
    if (!mobile) {
      await page.keyboard.press('-');
      for (const view of ['front', 'side', 'back', 'three-quarter']) {
        await page.locator(`[data-view="${view}"]`).click();
        await page.screenshot({ path: path.join(evidence, `student-${view}.png`) });
      }
    }
    await page.locator('#motion').selectOption('Walk');
    await waitForLab(page, tier, 'Walk');
    const walkStart = (await state()).position;
    await page.waitForTimeout(240);
    assert.notEqual((await state()).position, walkStart, 'AnimationMixer should advance');
    report.walk = await sample();
    await page.locator('#motion').selectOption('Run');
    await page.locator('#light').selectOption('shade');
    await page.locator('#rig').check();
    await waitForLab(page, tier, 'Run');
    if (!mobile) await page.screenshot({ path: path.join(evidence, 'lab-run-skeleton.png') });
    await page.locator('#rig').uncheck();
    await page.locator('#ambient').uncheck();
    await page.locator('#shadows').uncheck();
    await page.locator('#lod').selectOption('far');
    await waitForLab(page, 'far', 'Run');
    report.far = await sample();
    assert.equal(report.far.modelTriangles, 7200);
    if (!mobile) {
      await page.locator('#shadows').check();
      await page.locator('#ambient').check();
      await page.locator('#lod').selectOption('near');
      await page.locator('#motion').selectOption('Rest');
      await page.locator('#compare').check();
      await page.waitForFunction(() => window.__characterLab.stats().originalTriangles === 1500000);
      report.comparison = await sample();
      await page.screenshot({ path: path.join(evidence, 'lab-comparison.png') });
    } else {
      const cdp = await context.newCDPSession(page);
      const area = await page.locator('#stage').boundingBox();
      const x = area.x + area.width * .55, y = area.y + area.height * .48;
      const old = await state();
      const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      await send('touchStart', [{ x, y }]);
      await send('touchMove', [{ x: x + 55, y: y + 11 }]);
      await send('touchEnd', []);
      assert.ok(Math.abs((await state()).yaw - old.yaw) > .3, 'Touch orbit should change camera yaw');
    }
    assert.deepEqual(failures, []);
  } finally {
    report.errors = failures;
    await context.close();
  }
}

async function inspectContact(page) {
  return page.evaluate(async () => {
    const root = window.__ruhua;
    const { Vector3, Matrix4 } = await import('/lanren/vendor/three/three.module.min.js');
    const { skinned, model } = root.student;
    const position = skinned.geometry.attributes.position;
    model.updateWorldMatrix(true, true);
    const meshToModel = new Matrix4().copy(model.matrixWorld).invert().multiply(skinned.matrixWorld);
    const sole = {};
    for (const side of ['L', 'R']) {
      const foot = skinned.skeleton.bones.find(bone => bone.userData.wk === 'foot.' + side);
      const ankle = model.worldToLocal(foot.getWorldPosition(new Vector3()));
      const point = new Vector3();
      let score = Infinity;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(meshToModel);
        if (Math.sign(point.x) !== (side === 'L' ? 1 : -1) || point.y > .016) continue;
        const cost = Math.abs(point.x - ankle.x) + .35 * Math.abs(point.z - ankle.z) + 12 * point.y;
        if (cost < score) { score = cost; sole[side] = i; }
      }
    }
    const event = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    const summarized = (data) => {
      const sorted = data.sort((a, b) => a - b);
      return { count: sorted.length, p95: sorted[Math.floor((sorted.length - 1) * .95)], max: sorted.at(-1) };
    };
    const out = {};
    try {
      for (const [kind, run] of [['walk', false], ['run', true]]) {
        event('KeyW', true);
        if (run) event('ShiftLeft', true);
        const gaps = [], slides = [];
        const last = {}, anchors = {};
        for (let i = 0; i < 125; i++) {
          root.tick(1/60, 60);
          if (i < 36) continue;
          skinned.updateWorldMatrix(true, false);
          skinned.updateMatrixWorld(true);
          for (const side of ['L', 'R']) {
            const foot = root.student.G.feet[side];
            if (foot.swing || Math.abs(foot.roll) > .025 || root.player.state.airborne) {
              last[side] = anchors[side] = null;
              continue;
            }
            const p = skinned.localToWorld(skinned.getVertexPosition(sole[side], new Vector3()));
            const floor = root.world.heightAt(p.x, p.z);
            gaps.push(Math.abs(p.y - floor) * 100);
            if (anchors[side]?.equals(foot.at) && last[side]) {
              slides.push(Math.hypot(p.x - last[side].x, p.z - last[side].z) * 100);
            }
            anchors[side] = foot.at.clone();
            last[side] = p;
          }
        }
        out[kind] = { flatSoleGap_cm: summarized(gaps), flatSoleMotionPerFrame_cm: summarized(slides) };
      }
    } finally {
      event('ShiftLeft', false);
      event('KeyW', false);
      root.resume();
    }
    return out;
  });
}

async function inspectCampusCollision(page) {
  return page.evaluate(async () => {
    const { nearest } = await import('/lanren/world/collide.js');
    const r = window.__ruhua;
    const col = r.world.colliders;
    const start = r.player.state.pos.clone();
    const heading = r.player.state.yaw;
    let trial;
    for (const rect of col.rects) {
      if (rect.hw < 2 || rect.hd < 1 || rect.tall === false) continue;
      const x = rect.cx + (rect.hw + .92) * rect.c;
      const z = rect.cz - (rect.hw + .92) * rect.s;
      const point = nearest(col, x, z);
      if (point.id === rect.id && Math.abs(point.d - .92) < .03) {
        trial = { rect, x, z, yaw: Math.atan2(rect.c, -rect.s) };
        break;
      }
    }
    if (!trial) throw new Error('No open test position outside a campus wall');
    const { x, z, yaw, rect } = trial;
    const event = (down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code:'KeyW' }));
    try {
      r.player.place(x, z, yaw + Math.PI);
      event(true);
      for (let i = 0; i < 86; i++) r.tick(1/60, 60);
      event(false);
      const position = r.player.state.pos;
      const distance = nearest(col, position.x, position.z);
      const approach = Math.hypot(position.x - x, position.z - z);
      r.player.place(x, z, yaw);
      for (let i = 0; i < 80; i++) r.tick(1/60, 60);
      return { wall: rect.id, moved_m: approach, clearance_m: distance.d, cameraBoom_m: r.player.cam.boom.v,
        desiredBoom_m: r.player.cam.dist.v };
    } finally {
      event(false);
      r.player.place(start.x, start.z, heading);
      r.resume();
    }
  });
}

async function openCampus(browser, mobile, report) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(String(error)));
  page.on('console', msg => {
    if (msg.type() === 'warning' && msg.text().includes('walker unavailable')) failures.push(msg.text());
  });
  await context.route('https://api.open-meteo.com/**', route => route.abort());
  try {
    await page.goto(campus, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ruhua?.stage === 'stroll', null, { timeout: 90000 });
    const read = () => page.evaluate(() => {
      const r = window.__ruhua;
      const pos = r.player.state.pos;
      const footScreenY = r.student.skinned.skeleton.bones.filter(bone => bone.userData.wk?.startsWith('foot.')).map(bone => {
        const point = bone.getWorldPosition(pos.clone());
        point.y -= .09;
        return point.project(r.camera).y;
      });
      return { lowestSoleNdcY: Math.min(...footScreenY), avatar: r.student.root.userData.asset, detail: r.student.root.userData.detail,
        skin: r.student.skinned.isSkinnedMesh, pbr: r.student.skinned.material.isMeshStandardMaterial,
        speed: r.player.state.speed, run: r.student.G.run, x: pos.x, y: pos.y, z: pos.z,
        elevation: r.world.heightAt(pos.x, pos.z), camera: r.camera.position.toArray(), ...r.info() };
    });
    const at = await read();
    assert.equal(at.avatar, 'hunyuan');
    assert.ok(at.pbr && at.skin);
    assert.ok(Math.abs(at.y - at.elevation) < .04);
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      await send('touchStart', [{ x: 78, y: 685 }]);
      await send('touchMove', [{ x: 80, y: 649 }]);
      await page.waitForTimeout(1250);
      report.walk = await read();
      await send('touchEnd', []);
      await send('touchStart', [{ x: 310, y: 560 }]);
      await send('touchMove', [{ x: 258, y: 540 }]);
      await send('touchEnd', []);
    } else {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1350);
      report.walk = await read();
      await page.keyboard.down('Shift');
      await page.waitForTimeout(1200);
      report.run = await read();
      assert.ok(report.run.lowestSoleNdcY > -.98, 'The running character should remain in the frame');
      await page.screenshot({ path: path.join(evidence, 'campus-run.png') });
      await page.keyboard.up('Shift');
      await page.keyboard.up('KeyW');
      assert.ok(report.run.run > report.walk.run, 'Run and walk should produce different gait');
    }
    assert.ok(Math.hypot(at.x - report.walk.x, at.z - report.walk.z) > .18, 'Movement should move the student');
    await page.waitForTimeout(900);
    report.idle = await read();
    await page.screenshot({ path: path.join(evidence, mobile ? 'campus-mobile.png' : 'campus-desktop.png') });
    if (!mobile) {
      report.contact = await inspectContact(page);
      assert.ok(report.contact.walk.flatSoleMotionPerFrame_cm.count > 10);
      assert.ok(report.contact.run.flatSoleMotionPerFrame_cm.count > 10);
      await page.evaluate(() => {
        const r = window.__ruhua;
        const p = r.player.state.pos;
        r.look([p.x+15, p.y+3.5, p.z], [p.x, p.y+1.0, p.z]);
      });
      await page.waitForFunction(() => window.__ruhua.student.root.userData.detail === 'far');
      report.farAsset = await read();
      await page.evaluate(() => window.__ruhua.look(null));
      await page.waitForFunction(() => window.__ruhua.student.root.userData.detail !== 'far');
      report.recoveredAsset = (await read()).detail;
      report.collision = await inspectCampusCollision(page);
      assert.ok(report.collision.moved_m > .25 && report.collision.clearance_m >= .298);
      assert.ok(report.collision.cameraBoom_m < report.collision.desiredBoom_m - .5);
    }
    assert.deepEqual(failures, []);
  } finally {
    report.errors = failures;
    await context.close();
  }
}

async function verifyLegacy(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
  try {
    await page.route('https://api.open-meteo.com/**', route => route.abort());
    const url = new URL(campus);
    url.searchParams.delete('figure');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ruhua?.stage === 'stroll', null, { timeout: 90000 });
    const asset = await page.evaluate(() => {
      const { student } = window.__ruhua;
      return { skinned: student.skinned.isSkinnedMesh, originalShader: Boolean(student.skinned.material.userData.celOpts),
        originalOutline: Boolean(student.outline), isHunyuan: student.root.userData.asset === 'hunyuan' };
    });
    assert.deepEqual(asset, { skinned: true, originalShader: true, originalOutline: true, isHunyuan: false });
    return asset;
  } finally {
    await page.close();
  }
}

async function verifyTransition(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 720 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  try {
    const url = new URL(campus);
    url.searchParams.delete('stage');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ruhua?.stage === 'hold', null, { timeout: 90000 });
    await page.locator('[data-act=paint]').click();
    await page.waitForFunction(() => window.__ruhua?.stage === 'paint', null, { timeout: 90000 });
    const entered = await page.evaluate(() => {
      const r = window.__ruhua;
      r.paintAll();
      r.depart();
      r.still(6.4, 30);
      return { stage: r.stage, visible: r.student.root.visible, pbr: r.student.skinned.material.isMeshStandardMaterial };
    });
    assert.deepEqual(entered, { stage: 'enter', visible: true, pbr: true });
    await page.screenshot({ path: path.join(evidence, 'campus-transition.png') });
    const result = await page.evaluate(() => {
      const r = window.__ruhua;
      r.still(4, 30);
      const stage = r.stage;
      r.weather.setFree('drizzle', 13);
      r.still(6, 30);
      const hasRainUmbrella = r.student.G.umb > .1;
      return { stage, hasRainUmbrella, asset: r.student.root.userData.asset };
    });
    assert.deepEqual(result, { stage: 'stroll', hasRainUmbrella: true, asset: 'hunyuan' });
    assert.deepEqual(errors, []);
    return { entered, result, errors };
  } finally {
    await page.close();
  }
}

async function main() {
  const transitionOnly = process.argv.includes('--transition-only');
  const report = transitionOnly ? {} : { desktop: {}, mobileEmulation: {}, campus: {}, campusTouchEmulation: {} };
  const browser = await chromium.launch({
    ...(process.env.HAIZ_CHROMIUM ? { executablePath: process.env.HAIZ_CHROMIUM } : {}),
    args: ['--enable-unsafe-swiftshader', ...(process.env.HAIZ_SWIFTSHADER ? ['--use-angle=swiftshader'] : process.platform === 'darwin' ? ['--use-angle=metal'] : [])],
  });
  report.browser = browser.version();
  try {
    if (transitionOnly) {
      report.transition = await verifyTransition(browser);
      return;
    }
    await openLab(browser, false, report.desktop);
    await openLab(browser, true, report.mobileEmulation);
    if (!process.argv.includes('--lab-only')) {
      await openCampus(browser, false, report.campus);
      await openCampus(browser, true, report.campusTouchEmulation);
      report.legacy = await verifyLegacy(browser);
    }
  } finally {
    await browser.close();
    await fs.writeFile(path.join(evidence, transitionOnly ? 'transition-results.json' : 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
