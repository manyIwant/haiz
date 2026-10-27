/** Read-only classroom controller. Credentials live in memory after one-time handoff removal. */
import { describeDue } from './api.js';
import { consumeClassroomHandoff, loadClassroomFeed, ClassroomFeedError } from './classroom-feed.js';

const $ = id => document.getElementById(id);
let credential = '';
let activeRequest = null;
let requestGeneration = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message = '') {
  $('error').textContent = message;
  $('error').hidden = !message;
}

function showEmpty(title, message) {
  const empty = element('div', 'empty');
  empty.append(element('h2', 'empty-title', title), element('p', '', message));
  $('items').replaceChildren(empty);
}

function showLoading() {
  const skeletons = Array.from({ length: 2 }, () => {
    const card = element('div', 'loading-card');
    card.setAttribute('aria-hidden', 'true');
    card.append(element('div', 'loading-subject'), element('div', 'loading-title'), element('div', 'loading-details'));
    return card;
  });
  $('items').replaceChildren(...skeletons);
}

function render(feed) {
  $('classroom-name').textContent = feed.className;
  if (!feed.assignments.length) {
    showEmpty('目前没有已发布作业', '教师发布后，点击“刷新作业”读取最新内容。');
    return;
  }
  const cards = feed.assignments.map(assignment => {
    const card = element('article', 'card');
    const details = element('p', 'card-details', assignment.details);
    const meta = element('div', 'card-meta');
    meta.append(element('span', '', `截止：${describeDue(assignment)}`),
      element('span', 'card-version', `${assignment.status === 'revised' ? '已修订' : '已发布'} · v${assignment.version}`));
    card.append(element('p', 'card-subject', assignment.subject),
      element('h2', 'card-title', assignment.title));
    if (assignment.details) card.append(details);
    card.append(meta);
    return card;
  });
  $('items').replaceChildren(...cards);
}

function setBusy(busy) {
  $('items').setAttribute('aria-busy', String(busy));
  $('load').disabled = busy;
  $('refresh').disabled = busy || !credential;
  $('refresh').textContent = busy ? '正在读取…' : '刷新作业';
}

function forgetCredential() {
  credential = '';
  $('key-input').value = '';
  $('connection').hidden = false;
  $('change-key').hidden = true;
}

function errorMessage(error) {
  if (error?.status === 401 || error?.status === 403 || error?.code === 'SCREEN_REVOKED') {
    return '教室屏凭据无效或已被撤销。已清空展示，请填写新的凭据。';
  }
  if (error instanceof ClassroomFeedError) return error.message;
  return '无法完整读取服务器作业。已清空展示，请检查网络后重新刷新。';
}

async function load(key) {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const generation = ++requestGeneration;
  credential = key;
  $('key-input').value = '';
  showError();
  $('classroom-name').textContent = '课堂作业';
  $('stamp').textContent = '正在读取全部作业 · 手动刷新';
  showLoading();
  setBusy(true);
  try {
    const feed = await loadClassroomFeed({ key, signal: controller.signal });
    if (generation !== requestGeneration) return;
    render(feed);
    $('connection').hidden = true;
    $('change-key').hidden = false;
    const time = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date());
    $('stamp').textContent = `最近完整读取：${time} · 手动刷新`;
  } catch (error) {
    if (generation !== requestGeneration) return;
    showEmpty('展示已清空', '完整读取并通过公开数据校验后，作业才会重新显示。');
    $('stamp').textContent = '当前无已验证数据 · 手动刷新';
    showError(errorMessage(error));
    if (error instanceof ClassroomFeedError || [401, 403].includes(error?.status)
      || error?.code === 'SCREEN_REVOKED') forgetCredential();
  } finally {
    if (generation === requestGeneration) {
      activeRequest = null;
      setBusy(false);
    }
  }
}

function resetConnection() {
  activeRequest?.abort();
  activeRequest = null;
  requestGeneration += 1;
  forgetCredential();
  showError();
  setBusy(false);
  $('classroom-name').textContent = '课堂作业';
  $('stamp').textContent = '尚未连接 · 手动刷新';
  showEmpty('等待连接班级', '填写新的教室屏凭据，再载入已发布作业。');
}

function updateFullscreenButton() {
  $('fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '进入全屏';
}

async function toggleFullscreen() {
  $('display-status').hidden = true;
  try {
    if (document.fullscreenElement) {
      if (!document.exitFullscreen) throw new Error('Fullscreen unavailable');
      await document.exitFullscreen();
    } else {
      if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unavailable');
      await document.documentElement.requestFullscreen();
    }
    updateFullscreenButton();
  } catch {
    $('display-status').textContent = '浏览器未能切换全屏。可继续在当前窗口查看作业。';
    $('display-status').hidden = false;
  }
}

function init() {
  $('key-row').addEventListener('submit', event => {
    event.preventDefault();
    const key = $('key-input').value.trim();
    void load(key);
  });
  $('refresh').addEventListener('click', () => { if (credential) void load(credential); });
  $('change-key').addEventListener('click', () => {
    resetConnection();
    $('key-input').focus();
  });
  $('fullscreen').addEventListener('click', () => { void toggleFullscreen(); });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  window.addEventListener('pagehide', resetConnection);
  try {
    const key = consumeClassroomHandoff(window.sessionStorage);
    if (key) void load(key);
  } catch (error) {
    showError(errorMessage(error));
  }
}

init();
