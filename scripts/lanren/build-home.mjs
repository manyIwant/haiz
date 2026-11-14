// Generates index.html from lanren/js/chapters.js so the static page, the
// scroll stops and the 3D viewpoints always describe the same sections.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { CHAPTERS, STAGES } = await import(pathToFileURL(path.join(root, 'lanren/js/chapters.js')).href);
const ROOTS = await import(pathToFileURL(path.join(root, 'lanren/roots/history.js')).href);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const N = CHAPTERS.length - 1;
const lines = (en) => en.map((l) => `<span class="line"><span>${esc(l)}</span></span>`).join('');
const two = (n) => String(n).padStart(2, '0');
const entry = (e, k) => {
  const inner = `<i>${two(k + 1)}</i><span class="t">${esc(e.title)}</span><small class="en">${esc(e.en || '')}</small><small class="n">${esc(e.note)}</small>`;
  const group = e.group ? `<li class="group" aria-hidden="true">${esc(e.group)}</li>` : '';
  return group + (e.href
    ? `<li><a href="${esc(e.href)}" data-k="${k}"${e.dark ? ' data-dark' : ''}${e.primary ? ' data-primary' : ''}>${inner}</a></li>`
    : `<li><button type="button" data-action="${e.action}" data-k="${k}"${e.primary ? ' data-primary' : ''}>${inner}</button></li>`);
};
// chapter 02 without the film: every node, its grade and its sources, as plain reading
const rootsList = () => `<ol class="roots-static" aria-label="第二幕 · 校史（按年代）">${ROOTS.NODES.map((n) => {
  const g = ROOTS.GRADES[n.grade];
  const ph = n.photo ? ROOTS.PHOTOS[n.photo] : null;
  const src = n.sources.map((k) => ROOTS.SOURCES[k]).map((s) => s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a>` : esc(s.name)).join('；');
  return `<li><p class="y">${esc(n.year)}</p><h3>${esc(n.title)}</h3>${ph ? `<img src="${esc(ph.src)}" width="${ph.w}" height="${ph.h}" alt="${esc(ph.alt)}" loading="lazy" decoding="async"><small>${esc(ph.credit)}</small>` : ''}${n.body.map((t) => `<p>${esc(t)}</p>`).join('')}<p class="g">${esc(g.label)} · ${esc(g.note)}${src ? `｜出处：${src}` : ''}</p></li>`;
}).join('')}</ol>`;
const panels = CHAPTERS.map((c, i) => `
  <section class="panel${i === 0 ? ' panel-intro' : ''}" id="p-${c.id}" data-i="${i}" data-slab="${c.ui.slab}" aria-labelledby="t-${c.id}">
    <header class="chap">
      <p class="chap-label"><b>${c.index}</b><span>${esc(c.label)}</span></p>
      <p class="lede">${esc(c.lede)}</p>
    </header>
    <div class="titling">
      ${i === 0 ? `<h1 class="display" id="t-${c.id}">${lines(c.en)}</h1>` : `<h2 class="display" id="t-${c.id}">${lines(c.en)}</h2>`}
      <p class="zh">${esc(c.zh)}</p>
      ${c.specimen ? `<p class="specimen-label"><i>${esc(c.specimen[0])}</i><span>${esc(c.specimen[1])}</span><span>${esc(c.specimen[2])}</span></p>` : ''}
      ${i === 0 ? '<p class="begin"><a href="#' + CHAPTERS[1].id + '">Scroll <i aria-hidden="true">↓</i></a><small>绕树而行：滚动、下滑或按空格键</small></p>' : ''}
    </div>
    ${c.entries.length ? `<div class="slab">
      <p class="slab-head"><b>${c.index}</b><span>${esc(c.zh)}</span></p>
      <ul class="entries">${c.entries.map(entry).join('')}</ul>
      <p class="note">${esc(c.note)}</p>
    </div>` : `<p class="note note-intro">${esc(c.note)}</p>`}${c.id === 'roots' ? rootsList() : ''}
  </section>`).join('');
const stops = CHAPTERS.map((c) => `<div class="stop${c.id === 'days' ? ' film' : ''}" id="${c.id}"></div>`).join('');
const orbit = CHAPTERS.map((c, i) => `<li><a href="#${c.id}" data-go="${i}"><b>${c.index}</b>${esc(c.zh.split(' · ')[0])}</a></li>`).join('');
const stages = STAGES.map((g, i) => `<li data-at="${g.at}"><b>${two(i + 1)}</b><span>${esc(g.label)}</span></li>`).join('');
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1210">
<title>HAIZ · 一棵榄仁树，连接一座校园</title>
<meta name="description" content="海南中学府城校区的非官方数字校园。绕着一棵会生长的榄仁树走一圈：校园漫游、档案与校史、课间工具、杂志与创作，都长在这棵树上。">
<meta property="og:title" content="HAIZ · 一棵榄仁树，连接一座校园">
<meta property="og:image" content="lanren/assets/poster.jpg">
<link rel="icon" href="assets/walk/icon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js')</script>
<link rel="preload" href="lanren/assets/poster.jpg" as="image" fetchpriority="high">
<link rel="preload" href="assets/fonts/sora-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="lanren/home.css?v=3">
<link rel="stylesheet" href="assets/css/experience.css?v=13"><script defer src="assets/js/experience.js?v=14"></script>
<script defer src="lanren/vendor/gsap/gsap.min.js"></script>
<script defer src="lanren/vendor/gsap/ScrollTrigger.min.js"></script>
<script type="importmap">
{ "imports": {
  "three": "./lanren/vendor/three/three.module.min.js",
  "three/addons/": "./lanren/vendor/three/addons/"
} }
</script>
<script type="module" src="lanren/js/home.js?v=3"></script>
</head>
<body class="home">
<div class="stage" aria-hidden="true">
  <img id="poster" class="poster" src="lanren/assets/poster.jpg" alt="" width="1600" height="900">
  <canvas id="world"></canvas>
  <svg id="leaders" class="leaders"></svg>
</div>
<div id="veil" class="veil" aria-hidden="true"></div>

<header class="bar">
  <nav class="tools" aria-label="工具">
    <button id="searchButton" class="tool">全部入口 <kbd>⌘K</kbd></button>
    <button id="ringsButton" class="tool" title="这棵树记得的每一天">年轮</button>
    <button id="bookButton" class="tool">书页 <b id="bookCount">0</b></button>
    <button id="soundButton" class="tool" aria-pressed="false"><i class="dot" aria-hidden="true"></i><span>声音</span></button>
  </nav>
  <a class="brand" href="index.html" aria-label="HAIZ 主页"><b>HAIZ</b><small>Digital Campus · 海南中学府城</small></a>
</header>

<div class="panels">${panels}
</div>

<nav id="orbit" class="orbit" aria-label="绕树导航：每个板块是镜头路径上的一站">
  <svg viewBox="-60 -60 120 120" aria-hidden="true"><path id="orbitPath" class="path"/><path id="orbitDone" class="done"/><g id="orbitDots"></g><circle class="core" r="5.5"/><circle id="orbitEye" class="eye" r="3.2"/></svg>
  <ol>${orbit}</ol>
  <p class="where"><b id="whereIdx">01</b><span>/ ${two(CHAPTERS.length)}</span><em id="whereName">一棵树</em></p>
</nav>

<div class="rail" aria-hidden="true"><i id="railDot"></i></div>

<div id="growth" class="growth" aria-hidden="true"><svg viewBox="0 0 300 40" preserveAspectRatio="none"><path class="base" d="M0,36 L300,36"/><path id="growthCurve" class="curve" d="M0,36 C90,35 150,30 200,18 S270,4 300,2"/><circle id="growthDot" r="3"/></svg><ol>${stages}</ol></div>

<main id="track" class="track">${stops}</main>

<dialog id="specimen" class="specimen" aria-labelledby="specTitle">
  <div class="paper">
    <canvas id="specCanvas" width="900" height="1200" aria-label="这片叶子的标本图"></canvas>
    <div class="spec-text">
      <p class="eyebrow" id="specFrom">接住了一片叶子</p>
      <h2 id="specTitle">—</h2>
      <dl id="specFacts"></dl>
      <label class="note-in"><span>在叶旁写一句（只存在这台设备上）</span><input id="specNote" maxlength="40" placeholder="比如：那天下午有风"></label>
      <div class="spec-actions"><button id="specKeep" class="solid">夹进书里</button><button id="specLet" class="ghost">让它落下</button></div>
    </div>
  </div>
</dialog>

<dialog id="book" class="book" aria-labelledby="bookTitle">
  <div class="book-page">
    <header><h2 id="bookTitle">书页</h2><p>在这棵树下接住的叶子。只保存在这台设备的浏览器里，不会上传。</p><button class="close" data-close aria-label="合上书页">合上</button></header>
    <div id="bookGrid" class="book-grid"></div>
    <footer><button id="bookExport" class="solid">把这一页存成图片</button><button id="bookClear" class="ghost">清空书页</button></footer>
  </div>
</dialog>

<footer class="colophon"><p>HAIZ 是海南中学府城校区的非官方数字校园，由 manyIwant 创作。榄仁树为依物种特征创作的概念模型（Blender 程序化生成），不是对校园那棵树的测绘；校史文字注明出处。<a href="contact.html">来源与隐私</a> · <a href="journal.html">文字版首页</a></p></footer>
<noscript><style>.panels .panel{opacity:1!important;position:relative!important;visibility:visible!important}.track,.orbit,.growth{display:none}</style></noscript>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html ←', CHAPTERS.length, 'stops');
