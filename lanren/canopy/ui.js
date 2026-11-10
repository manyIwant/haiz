// Chapter 03's interface: quiet while exploring, calm and stable while reading or writing.
// Plain DOM; every control is a real button or link, reachable by keyboard.
import { DIRECTIONS, byId } from './directions.js';
import { LENSES, KIND_WORDS, RELATION_WORDS } from './model.js';
import { parse } from './address.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (n) => String(n).padStart(2, '0');

/** "摄影 · 01": the leaf's number on its limb (slot + 1). Stable: it is the address. */
export function leafLabel(w) {
  const a = parse(w.address);
  return a ? `${byId(a.direction).short} · ${two(a.slot + 1)}` : '—';
}
export const authors = (w) => (w.contributors || []).map((c) => c.name).join('、');

export function buildDom() {
  const root = document.createElement('div');
  root.className = 'cnp';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
  <div class="cnp-marks" aria-label="作品叶片"></div>
  <div class="cnp-dirlabels" aria-hidden="true"></div>
  <header class="cnp-head">
    <button type="button" class="cnp-exit" data-act="exit"><i aria-hidden="true">↩</i><span>回到新叶</span><kbd>Esc</kbd></button>
    <p class="cnp-where"><b>03</b><span class="cnp-crumb">作品树冠</span><span class="cnp-dirname"></span></p>
    <p class="cnp-mood"></p>
  </header>
  <div class="cnp-actions">
    <button type="button" data-act="find" class="cnp-pill">找到我的叶子</button>
    <button type="button" data-act="index" class="cnp-pill" aria-expanded="false">目录</button>
    <button type="button" data-act="create" class="cnp-pill cnp-pill-solid">种下一片新叶</button>
  </div>
  <nav class="cnp-dirs" aria-label="创作方向">
    <button type="button" data-dir="" class="cnp-dir"><span>全部方向</span><small>整棵树冠</small></button>
    ${DIRECTIONS.map((d) => `<button type="button" data-dir="${d.id}" class="cnp-dir"><span>${esc(d.zh)}</span><small data-count="${d.id}"></small></button>`).join('')}
  </nav>
  <div class="cnp-lenses" role="group" aria-label="怎样发现作品">
    ${LENSES.map((l) => `<button type="button" data-lens="${l.id}" aria-pressed="${l.id === 'all'}" title="${esc(l.note || '')}">${esc(l.zh)}</button>`).join('')}
  </div>
  <p class="cnp-notice" role="note"></p>
  <aside class="cnp-index" hidden aria-label="作品目录"><header><h2>目录</h2><button type="button" data-act="index-close" aria-label="合上目录">合上</button></header><ol></ol><p class="cnp-index-empty" hidden></p></aside>
  <section class="cnp-read" hidden role="dialog" aria-modal="false" aria-labelledby="cnpTitle">
    <div class="cnp-read-bar">
      <button type="button" data-act="close" class="cnp-close">合上 <kbd>Esc</kbd></button>
      <button type="button" data-act="quiet" class="cnp-quiet" aria-pressed="false">安静阅读</button>
    </div>
    <article class="cnp-paper" tabindex="-1"></article>
  </section>
  <p class="cnp-live" aria-live="polite"></p>`;
  // the sheets live outside the overlay: they can open from the V4 panel while the overlay is hidden
  const sheets = document.createElement('div');
  sheets.className = 'cnp-sheets';
  sheets.innerHTML = `<dialog class="cnp-sheet cnp-find" aria-labelledby="cnpFindTitle"><form method="dialog"></form></dialog>
  <dialog class="cnp-sheet cnp-create" aria-labelledby="cnpCreateTitle"><form method="dialog"></form></dialog>`;
  document.body.append(root, sheets);
  return { root, sheets, $: (q) => root.querySelector(q) || sheets.querySelector(q), $$: (q) => [...root.querySelectorAll(q), ...sheets.querySelectorAll(q)] };
}

function media(m) {
  if (m.type === 'image') {
    // original proportions, never cropped; the caption keeps authorship and provenance
    return `<figure class="cnp-fig"><img src="${esc(m.src)}" alt="${esc(m.alt)}" width="${m.width}" height="${m.height}" loading="lazy" decoding="async"><figcaption>${esc(m.caption || '')}</figcaption></figure>`;
  }
  if (m.type === 'audio') {
    return `<figure class="cnp-audio"><audio controls preload="none" src="${esc(m.src)}"></audio><figcaption>${esc(m.caption || '')}${m.duration ? ` · ${m.duration} 秒` : ''}</figcaption></figure>`;
  }
  if (m.type === 'video') {
    return `<figure class="cnp-fig"><video controls preload="none" src="${esc(m.src)}" ${m.poster ? `poster="${esc(m.poster)}"` : ''}></video><figcaption>${esc(m.caption || '')}</figcaption></figure>`;
  }
  if (m.type === 'text') return `<div class="cnp-text">${String(m.body || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;
  return '';
}

/** The reading sheet for one work. */
export function renderWork(w, { rel = [], issue = 0, share = '' } = {}) {
  const d = byId(w.direction);
  const pick = (w.picks || []).slice().sort((a, b) => b.issue - a.issue);
  const relHtml = rel.length ? `<section class="cnp-rel"><h3>枝叶相连</h3><ul>${rel.map((r) => {
    const words = RELATION_WORDS[r.type] || ['相关', '相关'];
    return `<li><button type="button" data-work="${esc(r.work.id)}" data-rel="1"><small>${esc(r.dir === 'from' ? words[0] : words[1])}</small><b>${esc(r.work.title)}</b><span>${esc(authors(r.work))} · ${esc(leafLabel(r.work))}</span></button>${r.note ? `<p>${esc(r.note)}</p>` : ''}</li>`;
  }).join('')}</ul><button type="button" class="cnp-link" data-act="chain">沿着这条接力看下去 →</button></section>` : '';
  const proj = w.kind === 'project' && w.project ? `<section class="cnp-proj"><h3>进行中</h3><dl><dt>阶段</dt><dd>${esc(w.project.stage)}</dd><dt>正在寻找</dt><dd>${(w.project.seeking || []).map(esc).join('、')}</dd>${w.project.until ? `<dt>计划到</dt><dd>${esc(w.project.until)}</dd>` : ''}</dl>${w.project.note ? `<p class="cnp-small">${esc(w.project.note)}</p>` : ''}<button type="button" class="cnp-ghost" data-act="join" disabled aria-describedby="cnpJoinWhy">申请参与</button><p class="cnp-small" id="cnpJoinWhy">合作邀请需要账号与共创服务，将在下一阶段开放；现在不会发出任何请求。</p></section>` : '';
  const honors = pick.length ? `<section class="cnp-honor"><h3>向阳</h3><ul>${pick.map((p) => `<li><b>${esc(p.title)}</b>${p.issue === issue ? '<em>本期</em>' : '<em>往期</em>'}${p.note ? `<p>${esc(p.note)}</p>` : ''}</li>`).join('')}</ul></section>` : '';
  const recs = (w.recommendations || []).length ? `<section class="cnp-recs"><h3>同学推荐</h3><ul>${w.recommendations.map((r) => `<li><p>“${esc(r.reason)}”</p><small>${esc(r.by)}${r.at ? ' · ' + esc(r.at) : ''}</small></li>`).join('')}</ul></section>` : '';
  return `
    ${w.demo ? '<p class="cnp-demo-tag">开发演示 · 虚构作品，不是真实学生创作</p>' : ''}
    <p class="cnp-eyebrow"><span>${esc(d?.zh || '')}</span><span>${esc(KIND_WORDS[w.kind] || '')}</span><span>${esc(leafLabel(w))}</span></p>
    <h2 id="cnpTitle">${esc(w.title)}</h2>
    <p class="cnp-by">${(w.contributors || []).map((c) => `<span>${esc(c.name)}<small>${esc(c.role || '')}</small></span>`).join('')}</p>
    ${w.summary ? `<p class="cnp-sum">${esc(w.summary)}</p>` : ''}
    <div class="cnp-media">${(w.media || []).map(media).join('')}</div>
    ${w.statement ? `<blockquote class="cnp-stmt"><p>${esc(w.statement)}</p><small>作者自述</small></blockquote>` : ''}
    ${proj}${relHtml}${honors}${recs}
    <section class="cnp-meta"><h3>这片叶子</h3><dl>
      <dt>公开于</dt><dd>${esc(w.published || '—')}</dd>
      <dt>树上的位置</dt><dd>${esc(leafLabel(w))} <small class="cnp-addr">${esc(w.address)}</small></dd>
      <dt>授权</dt><dd>${esc(w.license?.derive || '未说明，默认不允许改编')}${w.license?.note ? `<br><small>${esc(w.license.note)}</small>` : ''}</dd>
    </dl>
    <div class="cnp-share"><input readonly value="${esc(share)}" aria-label="这片叶子的链接"><button type="button" class="cnp-ghost" data-act="copy">复制叶子链接</button></div>
    <p class="cnp-small">公开与否由作者决定：作者撤回后，这个链接会显示“目前不公开”，叶片的位置为作者保留。<button type="button" class="cnp-link" data-act="report">报告问题</button></p>
    </section>`;
}

export function renderUnavailable(id) {
  return `<p class="cnp-eyebrow"><span>找不到这片叶子</span></p><h2 id="cnpTitle">这件作品目前不公开</h2>
  <p class="cnp-sum">可能是作者撤回了公开，或者链接不完整。作者可以随时决定作品是否公开；撤回后，它在树上的位置会为作者保留。</p>
  <p class="cnp-small">链接中的编号：<code>${esc(id)}</code></p>`;
}

export function renderFind(works, { status, me }) {
  const people = [...new Set(works.flatMap((w) => (w.contributors || []).map((c) => c.name)))];
  return `<header><h2 id="cnpFindTitle">找到我的叶子</h2><button value="cancel" class="cnp-close" aria-label="关闭">关闭</button></header>
  <p class="cnp-small">每一件作者自愿公开、并通过审核的作品，都在树上有一个固定的位置，不需要推荐或排名。</p>
  <section><h3>我的作品</h3>${me?.signedIn
    ? '<p class="cnp-small">已登录 HAIZ 账号。公开作品服务尚未上线，所以你还没有公开的作品；你的私人草稿在「种下一片新叶」里。</p>'
    : '<p class="cnp-small">登录 HAIZ 账号后，这里会列出你所有公开的作品。<a href="login/index.html">登录</a></p>'}</section>
  ${status === 'demo' ? `<section><h3>演示：以作者身份查看</h3><p class="cnp-small">开发预览没有真实账号与投稿。选择一位虚构的演示作者，体验“找到自己的叶子”。</p><div class="cnp-people">${people.map((p) => `<button type="button" data-person="${esc(p)}">${esc(p)}</button>`).join('')}</div><ol class="cnp-mine"></ol></section>` : ''}
  <section><h3>用链接或编号找</h3><label class="cnp-field"><span>叶子链接或作品编号</span><input name="q" autocomplete="off" placeholder="例如 …#leaves/w/作品编号"></label><button type="button" class="cnp-ghost" data-act="find-go">去树上看看</button><p class="cnp-small cnp-find-msg" aria-live="polite"></p></section>`;
}

export function renderMine(list) {
  return list.map((w) => `<li><button type="button" data-work="${esc(w.id)}" data-mine="1"><b>${esc(w.title)}</b><span>${esc(leafLabel(w))} · ${esc(KIND_WORDS[w.kind])}</span></button></li>`).join('') || '<li class="cnp-small">这位作者还没有公开的作品。</li>';
}

export function renderCreate({ where, list }) {
  return `<header><h2 id="cnpCreateTitle">种下一片新叶</h2><button value="cancel" class="cnp-close" aria-label="关闭">关闭</button></header>
  <p class="cnp-small">先写成私人草稿：只有你自己能看到。准备好以后申请审核；审核通过后，由你决定是否公开。</p>
  <div class="cnp-steps" aria-label="发布步骤"><span class="on">私人草稿</span><span>申请审核</span><span>通过</span><span>你决定公开</span><span>树上的叶子</span></div>
  <fieldset class="cnp-kind"><legend>这是</legend>
    <label><input type="radio" name="kind" value="work" checked> 一件完成的作品</label>
    <label><input type="radio" name="kind" value="project"> 一个想找伙伴的共创项目</label></fieldset>
  <label class="cnp-field"><span>方向</span><select name="direction">${DIRECTIONS.map((d) => `<option value="${d.id}">${esc(d.zh)}</option>`).join('')}</select></label>
  <label class="cnp-field"><span>标题</span><input name="title" maxlength="80" required></label>
  <label class="cnp-field"><span>正文、说明或计划</span><textarea name="body" rows="7" maxlength="12000"></textarea></label>
  <p class="cnp-small">照片、声音和视频的上传会和投稿服务一起开放。现在可以先用已有的工具创作：
    <a href="darkroom.html">共感暗房</a>（照片显影、声景）· <a href="journal.html">校园杂志</a> · <a href="clubs.html">社团提案</a> · <a href="life.html">课间电台</a></p>
  <div class="cnp-row"><button type="button" class="cnp-solid" data-act="save">保存为私人草稿</button>
    <button type="button" class="cnp-ghost" data-act="submit" disabled aria-describedby="cnpSubmitWhy">申请审核</button></div>
  <p class="cnp-small" id="cnpSubmitWhy">投稿与审核服务还没有上线（下一阶段）。这里不会假装已经提交。</p>
  <p class="cnp-small cnp-save-msg" aria-live="polite">${where === 'account' ? '草稿会保存到你的 HAIZ 账号（仅你可见，可在多台设备查看）。' : '未登录 HAIZ 账号：草稿只保存在这台设备的浏览器里。<a href="login/index.html">登录</a>后可保存到账号。'}</p>
  <section class="cnp-drafts"><h3>我的草稿</h3><ol>${renderDrafts(list)}</ol></section>`;
}

export function renderDrafts(list) {
  return (list || []).map((d) => `<li><b>${esc(d.title)}</b><span>${esc(byId(d.direction)?.zh || '')} · ${esc(KIND_WORDS[d.kind] || '')} · ${d.where === 'account' ? '账号' : '本机'} · 仅自己可见</span><button type="button" class="cnp-link" data-draft-del="${esc(d.id)}">删除</button></li>`).join('') || '<li class="cnp-small">还没有草稿。</li>';
}
