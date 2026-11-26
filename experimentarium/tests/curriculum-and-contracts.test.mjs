// HAIZ · EXPERIMENTARIUM — 课程矩阵、实验包契约与隔离性自动化验收测试
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(import.meta.dirname, '../..');
const MATRIX_PATH = path.join(REPO, 'experimentarium/data/curriculum-matrix.json');
const DOMAINS_DIR = path.join(REPO, 'experimentarium/js/domains');
const THREE_URL = pathToFileURL(path.join(REPO, 'lanren/vendor/three/three.module.min.js')).href;

// 映射裸标识符 'three'，供 Node 直接冷导入所有领域包
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { shortCircuit: true, url: THREE_URL };
    return nextResolve(specifier, context);
  },
});

const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
const completedItems = matrix.items.filter((x) => x.implementation?.status === 'completed');

test('1. 分支隔离性守卫：origin/main 原有文件零修改零删除', () => {
  const dirtyExisting = execSync('git diff origin/main --diff-filter=MD --name-only', { cwd: REPO, encoding: 'utf8' }).trim();
  assert.equal(dirtyExisting, '', `禁止修改或删除 origin/main 已有文件，却发现: ${dirtyExisting}`);
});

test('2. 课程覆盖矩阵统计自洽且无伪造校本版次', () => {
  assert.equal(matrix.items.length, 101);
  assert.equal(matrix.stats.totalItems, matrix.items.length);
  assert.equal(completedItems.length, 63);
  assert.equal(matrix.stats.completedItems, completedItems.length);
  assert.equal(matrix.stats.plannedOrReferenceItems, matrix.items.length - completedItems.length);

  for (const item of matrix.items) {
    assert.ok(item.id && item.title && item.subject, `缺失基础字段: ${JSON.stringify(item)}`);
    if (['chn', 'his', 'pol'].includes(item.subject)) {
      assert.equal(item.curriculum.editionVerificationStatus, 'confirmed-national-unified');
    } else {
      assert.equal(item.curriculum.editionVerificationStatus, 'provincial-mainstream-pending-school-booklist');
    }
  }
});

test('3. 全部 63 项已完成实验在 8 个领域包中 1:1 对齐且契约完备', async () => {
  const packs = new Map();
  for (const file of fs.readdirSync(DOMAINS_DIR).filter((f) => f.endsWith('.js'))) {
    const packName = file.replace(/\.js$/, '');
    const mod = await import(pathToFileURL(path.join(DOMAINS_DIR, file)).href);
    const list = mod.default;
    assert.ok(Array.isArray(list) && list.length > 0, `${file} 必须导出非空 default 数组`);
    packs.set(packName, list);
  }

  assert.equal(packs.size, 8, '应当恰好存在 8 个领域实验包');
  const seenIds = new Set();
  for (const [packName, list] of packs) {
    for (const exp of list) {
      assert.ok(exp.id && !seenIds.has(exp.id), `重复或缺失实验 id: ${exp.id} in ${packName}`);
      seenIds.add(exp.id);
    }
  }

  for (const meta of completedItems) {
    const packName = meta.implementation.domainPack;
    const list = packs.get(packName);
    assert.ok(list, `${meta.id} 声明了未知领域包 ${packName}`);
    const exp = list.find((e) => e.id === meta.id);
    assert.ok(exp, `领域包 ${packName}.js 中缺失矩阵已标记完成的实验: ${meta.id}`);

    assert.equal(exp.subject, meta.subject, `${meta.id} 学科代码与矩阵不符`);
    assert.ok(exp.title && exp.en, `${meta.id} 缺失中英文标题`);
    assert.ok(Array.isArray(exp.lede) && exp.lede.length >= 1, `${meta.id} 缺失引导语 lede`);
    assert.ok(typeof exp.formula === 'string' && exp.formula.length > 0, `${meta.id} 缺失核心公式/关系`);
    assert.ok(exp.predict && Array.isArray(exp.predict.options) && exp.predict.options.length >= 2, `${meta.id} 缺失预测选择题`);
    assert.ok(Number.isInteger(exp.predict.answer) && exp.predict.answer >= 0 && exp.predict.answer < exp.predict.options.length, `${meta.id} 预测答案索引越界`);
    assert.ok(typeof exp.predict.why === 'string' && exp.predict.why.length > 5, `${meta.id} 缺失预测科学解释`);
    assert.ok(exp.teach && exp.teach.where && Array.isArray(exp.teach.ask) && exp.teach.simplify, `${meta.id} 缺失教学备注三要素`);
    assert.ok(meta.governance?.safetyBoundary, `${meta.id} 缺失安全与伦理边界声明`);
    assert.ok(Array.isArray(exp.controls) && exp.controls.length >= 1, `${meta.id} 至少需要 1 项可交互控件`);
    assert.ok(exp.record || exp.inquiry, `${meta.id} 必须声明 record 测量记录或 inquiry 人文探究流程`);
    assert.equal(typeof exp.build, 'function', `${meta.id} 缺失 build(k) 工厂函数`);
    assert.equal(typeof exp.buildWorkbench, 'function', `${meta.id} 缺失 buildWorkbench(wb, sp) 展开工作台函数`);
  }
});
