// HAIZ Campus Toybox — Standalone Character Art Gallery Page Controller
import '../styles/gallery.css';
import { GalleryScene, ENVIRONMENTS } from './GalleryScene.js';
import { TOY_REGISTRY, TOY_BY_ID, ASSET_SPEC } from '../toys/registry.js';
import { CLIP_LIBRARY } from '../toys/kit/behavior.js';

const app = document.getElementById('gallery-app');
app.innerHTML = `
  <div class="gal-layout">
    <header class="gal-topbar">
      <div class="gal-title">
        <h1>HAIZ · Campus Toybox 角色艺术验收馆</h1>
        <span>ORIGINAL CHARACTER ATELIER · v${ASSET_SPEC.registryVersion}</span>
      </div>
      <a class="gal-back" href="./index.html">← 返回抓娃娃真人验证</a>
    </header>

    <section class="gal-stage" data-role="stage" data-env="afternoon">
      <div class="gal-canvas-host" data-role="canvas"></div>
      <div class="gal-hint">拖动旋转 · 滚轮/双指缩放 · 右键平移</div>
      <nav class="gal-roster" data-role="roster" aria-label="角色列表"></nav>
    </section>

    <aside class="gal-dossier">
      <div>
        <div class="gal-id-row">
          <span data-role="qid">haiz.toy.lanren</span>
          <span data-role="ver">v1.0.0 · GLB READY</span>
        </div>
        <h2 class="gal-char-name" data-role="name">仁仁 · Lanren</h2>
        <p class="gal-char-sub" data-role="title"></p>
        <p class="gal-story" data-role="story"></p>
      </div>

      <div class="gal-meta-box">
        <div><strong>创作母题：</strong><span data-role="motif"></span></div>
        <div><strong>性格与动效：</strong><span data-role="personality"></span></div>
        <div><strong>材质语言：</strong><span data-role="material"></span></div>
        <div><strong>独立模型路径：</strong><code data-role="model-path"></code></div>
      </div>

      <div>
        <div class="gal-section-label">角色动画检视</div>
        <div class="gal-chips" data-role="clips"></div>
      </div>

      <div>
        <div class="gal-section-label">灯光与轮廓环境</div>
        <div class="gal-chips" data-role="envs"></div>
      </div>

      <div>
        <div class="gal-section-label">可扩展主题外观</div>
        <div class="gal-chips" data-role="variants"></div>
      </div>
    </aside>
  </div>
`;

const q = (r) => app.querySelector(`[data-role="${r}"]`);
const scene = new GalleryScene(q('canvas'));

let activeId = new URLSearchParams(window.location.search).get('id') || TOY_REGISTRY[0].id;
if (!TOY_BY_ID[activeId]) activeId = TOY_REGISTRY[0].id;
let activeVariant = 'classic';
let activeEnv = 'afternoon';

// Render character roster bar
const roster = q('roster');
for (const entry of TOY_REGISTRY) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gal-roster-btn';
  btn.dataset.id = entry.id;
  btn.innerHTML = `<span class="dot" style="background:${entry.badgeColor}"></span>${entry.name}`;
  btn.addEventListener('click', () => selectCharacter(entry.id));
  roster.appendChild(btn);
}

// Render animation clip chips
const clipsWrap = q('clips');
for (const [key, def] of Object.entries(CLIP_LIBRARY)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gal-chip';
  btn.dataset.clip = key;
  btn.textContent = def.label;
  btn.addEventListener('click', () => {
    scene.playClip(key);
    clipsWrap.querySelectorAll('.gal-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
  clipsWrap.appendChild(btn);
}

// Render lighting/silhouette environment chips
const envsWrap = q('envs');
for (const [key, env] of Object.entries(ENVIRONMENTS)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gal-chip';
  btn.textContent = env.label;
  btn.setAttribute('aria-pressed', String(key === activeEnv));
  btn.addEventListener('click', () => {
    activeEnv = key;
    q('stage').dataset.env = key;
    scene.setEnvironment(key);
    envsWrap.querySelectorAll('.gal-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
  envsWrap.appendChild(btn);
}

function selectCharacter(id, variant = 'classic') {
  activeId = id;
  activeVariant = variant;
  const entry = scene.loadCharacter(id, variant);

  roster.querySelectorAll('.gal-roster-btn').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.id === id));
  });

  q('qid').textContent = entry.qualifiedId;
  q('ver').textContent = `v${entry.version} · ${Math.round(entry.meta.height * 100)} cm`;
  q('name').textContent = `${entry.name} · ${entry.enName}`;
  q('title').textContent = entry.title;
  q('story').textContent = entry.story;
  q('motif').textContent = entry.motif;
  q('personality').textContent = entry.personality;
  q('material').textContent = entry.materialSummary;
  q('model-path').textContent = entry.modelPath;

  // Update signature clip label
  const sigBtn = clipsWrap.querySelector('[data-clip="signature"]');
  if (sigBtn) sigBtn.textContent = `招牌：${entry.signatureLabel}`;
  clipsWrap.querySelectorAll('.gal-chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.clip === 'idle'));
  });

  // Render variant chips
  const varWrap = q('variants');
  varWrap.innerHTML = '';
  for (const [vKey, vDef] of Object.entries(entry.variants || {})) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gal-chip';
    btn.textContent = vDef.label;
    btn.setAttribute('aria-pressed', String(vKey === activeVariant));
    btn.addEventListener('click', () => selectCharacter(id, vKey));
    varWrap.appendChild(btn);
  }
}

selectCharacter(activeId);
window.__HAIZ_GALLERY__ = { scene, selectCharacter };
