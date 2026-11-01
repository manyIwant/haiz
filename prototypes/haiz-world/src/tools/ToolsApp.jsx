import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, BookBookmark, Books, CalendarBlank, Check, ChalkboardTeacher, CloudSlash, DownloadSimple, FileArrowUp, GearSix, GraduationCap, Leaf, List, ListChecks, LockSimple, Plus, ShieldCheck, WarningCircle, X } from '@phosphor-icons/react';
import { Student, Study } from './Student.jsx';
import { Teacher, EMPTY_TEACHER } from './Teacher.jsx';
import { KEYS } from './storage.js';
import { createTask, importPublicBundle } from './model.js';
import { useRecord } from './useRecord.js';
import { useOffline } from './offline.js';
import { download, Field, InlineError, Publication } from './ui.jsx';

const EMPTY_TASKS = [], EMPTY_PUBLIC = [];
const DEFAULT_PREFS = { theme: 'porcelain', motion: 'system' };
const THEMES = [{ id: 'porcelain', label: '瓷白' }, { id: 'obsidian', label: '黑曜' }, { id: 'ocean', label: '深海' }];
const ROUTES = { today: '今日任务', tasks: '全部任务', public: '公开作业', teacher: '教师工作区', settings: '外观与数据', privacy: '隐私说明', terms: '使用边界' };
const routeFromHash = () => {
  try { return decodeURIComponent(location.hash.slice(1) || 'today'); }
  catch { return 'not-found'; }
};

export function App() {
  const student = useRecord(KEYS.student, EMPTY_TASKS);
  const teacher = useRecord(KEYS.teacher, EMPTY_TEACHER);
  const publications = useRecord(KEYS.publications, EMPTY_PUBLIC, false);
  const preferences = useRecord(KEYS.preferences, DEFAULT_PREFS);
  const [route, setRoute] = useState(routeFromHash);
  const [menu, setMenu] = useState(false);
  const [reducedSystem, setReducedSystem] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [message, setMessage] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInput = useRef(null);
  const main = useRef(null);
  const transition = useRef(null);
  const offline = useOffline();
  const prefs = preferences.value;
  const theme = THEMES.some(t => t.id === prefs.theme) ? prefs.theme : 'porcelain';
  const reduced = prefs.motion === 'reduce' || prefs.motion === 'system' && reducedSystem;
  const studyId = route.startsWith('study/') ? route.slice(6) : null;
  const isTeacher = route === 'teacher';
  const records = [['学生私人记录', student], ['教师草稿', teacher], ['公开作业', publications], ['偏好设置', preferences]];
  const storageErrors = records.filter(([, record]) => record.error);
  const navigate = useCallback(next => {
    const apply = () => {
      flushSync(() => { setRoute(next); setMenu(false); setMessage(''); });
      history.pushState(null, '', '#' + next);
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    transition.current?.skipTransition();
    if (document.startViewTransition && !reduced) {
      transition.current = document.startViewTransition(apply);
      transition.current.ready.catch(() => {});
      transition.current.finished.catch(() => {});
    } else apply();
  }, [reduced]);
  const move = useCallback(callback => {
    transition.current?.skipTransition();
    if (document.startViewTransition && !reduced) {
      transition.current = document.startViewTransition(() => flushSync(callback));
      transition.current.ready.catch(() => {});
      transition.current.finished.catch(() => {});
    } else callback();
  }, [reduced]);
  useEffect(() => {
    const change = () => { transition.current?.skipTransition(); setRoute(routeFromHash()); setMenu(false); };
    addEventListener('popstate', change);
    addEventListener('hashchange', change);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = e => setReducedSystem(e.matches);
    media.addEventListener('change', update);
    return () => { removeEventListener('popstate', change); removeEventListener('hashchange', change); media.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.reduced = String(reduced);
    document.title = 'HAIZ Tools · ' + (studyId ? '学习接力' : ROUTES[route] || '页面未找到');
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'HAIZ Tools：面向学生和教师的本地优先学习工作台，恢复学习线索，一次录入多种公开输出。');
  }, [theme, reduced, route, studyId]);
  useEffect(() => {
    const key = event => {
      if (event.key === 'Escape' && menu) setMenu(false);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [menu]);
  function backup() {
    const storedRecords = {};
    for (const key of Object.values(KEYS)) {
      try { storedRecords[key] = localStorage.getItem(key); }
      catch { storedRecords[key] = '浏览器未允许读取原始存储'; }
    }
    download({ format: 'haiz-tools-private-backup', version: 1, createdAt: new Date().toISOString(), student: student.value, teacher: teacher.value, publications: publications.value, preferences: preferences.value, storedRecords }, 'haiz-private-backup.json');
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('公开任务包不能超过 2 MB。');
      const raw = JSON.parse(await file.text());
      if (publications.update(current => importPublicBundle(raw, current))) { setMessage('公开任务包已导入。私人记录未被修改。'); setFileError(''); }
    } catch (err) { setFileError(err instanceof SyntaxError ? '文件不是有效 JSON，请选择 HAIZ 导出的公开任务包。' : err.message); }
  }
  function addPublic(item, publication) {
    try {
      const sourceId = publication.id.length + ':' + publication.id + item.id;
      if (student.value.some(task => task.sourceId === sourceId)) { setMessage('这项作业已在你的清单中。修订内容不会自动覆盖你的私人记录。'); return; }
      const task = createTask({ title: item.content, subject: item.subject, date: item.studyDate, sourceId, sourceVersion: publication.version });
      if (student.update(tasks => [...tasks, task])) setMessage('已加入我的任务。个人完成状态只对本机私人清单有效。');
    } catch (err) { setFileError(err.message); }
  }
  const nav = [{ id: 'today', label: '今天', icon: CalendarBlank }, { id: 'tasks', label: '全部任务', icon: ListChecks }, { id: 'public', label: '公开作业', icon: Books }];
  const hasKnownRoute = Boolean(ROUTES[route] || studyId);
  return <div className={'tools-app ' + (studyId ? 'is-focusing' : '')} data-reduced={reduced}>
    <a className="skip-link" href="#tools-main" onClick={e => { e.preventDefault(); main.current?.focus(); }}>跳到主要内容</a>
    <aside className={'tools-sidebar ' + (menu ? 'is-open' : '')} aria-label="Tools 导航"><a className="tools-wordmark" href="/tools/" aria-label="HAIZ Tools 首页"><span className="brand-symbol" aria-hidden="true"><i/><i/><i/></span><span>HAIZ<span className="wordmark-product">Tools</span></span></a><button className="icon-btn mobile-close" aria-label="关闭导航" onClick={() => setMenu(false)}><X size={22}/></button><div className="sidebar-context"><span className="local-dot"/>你的本地工作台</div><nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={route === id || id === 'today' && studyId ? 'selected' : ''} aria-current={route === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={22} weight="light"/><span>{label}</span>{id === 'today' && student.value.some(t => !t.completed) && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-teacher"><button className={isTeacher ? 'selected' : ''} aria-current={isTeacher ? 'page' : undefined} onClick={() => navigate('teacher')}><ChalkboardTeacher size={22} weight="light"/><span>教师工作区</span><ArrowUpRight size={16}/></button></div><div className="sidebar-bottom"><div className="sidebar-note"><Leaf size={24} weight="thin"/><p>学习不断线，<br/>工作不重复。</p></div><a className="campus-link" href="/"><span>探索 HAIZ World</span><ArrowUpRight size={17}/></a><button className={'settings-link ' + (route === 'settings' ? 'selected' : '')} onClick={() => navigate('settings')}><GearSix size={20} weight="light"/>外观与数据</button><p className="project-label">独立非官方项目</p></div></aside>
    {menu && <button className="nav-scrim" aria-label="关闭导航" onClick={() => setMenu(false)}/>}
    <div className="tools-body"><header className="tools-topbar"><div className="topbar-location"><button className="icon-btn mobile-menu-button" aria-label="打开导航" onClick={() => setMenu(true)}><List size={23}/></button><span>学习与教学</span><span className="breadcrumb-slash">/</span><strong>{studyId ? '学习接力' : ROUTES[route] || '页面未找到'}</strong></div><div className="topbar-controls"><span className={'save-indicator ' + (storageErrors.length ? 'save-error' : '')}><span className="local-dot"/>{storageErrors.length ? '有记录未保存' : '本机保存'}</span><div className="role-switch" role="group" aria-label="工作区"><button className={!isTeacher ? 'active' : ''} aria-pressed={!isTeacher} onClick={() => navigate('today')}>学生</button><button className={isTeacher ? 'active' : ''} aria-pressed={isTeacher} onClick={() => navigate('teacher')}>教师</button></div><button className="profile-button" aria-label="查看本机数据与隐私" onClick={() => navigate('settings')}><GraduationCap size={21} weight="light"/></button></div></header>
    <main ref={main} tabIndex={-1} id="tools-main" className="tools-main">{!!storageErrors.length && <section className="storage-warning" role="alert"><WarningCircle size={22}/><div><h2>这些内容还没有安全保存</h2>{storageErrors.map(([label, record]) => <div className="storage-error-row" key={label}><p>{label}：{record.error}</p><button onClick={() => record.retry()}>重试保存</button><button onClick={() => record.reload()}>读取已存版本</button></div>)}<p>读取已存版本会替换当前内存内容。先下载备份，不要直接关闭页面。</p><button className="secondary" onClick={backup}><DownloadSimple size={18}/>下载当前内容备份（含私人记录）</button></div></section>}
    {message && <div className="notice" role="status"><Check size={18}/>{message}<button className="icon-btn" aria-label="关闭提示" onClick={() => setMessage('')}><X size={17}/></button></div>}<InlineError>{fileError}</InlineError>
    {(route === 'today' || route === 'tasks') && <Student tasks={student.value} update={student.update} all={route === 'tasks'} navigate={navigate}/>}
    {studyId && <Study task={student.value.find(t => t.id === studyId)} update={student.update} navigate={navigate}/>}
    {isTeacher && <Teacher record={teacher} published={publications} navigate={navigate} motion={move}/>}
    {route === 'public' && <PublicView publications={publications.value} onAdd={addPublic} onImport={() => fileInput.current?.click()}/>}
    {route === 'settings' && <><div className="page-heading"><div><p className="date-line">让工作台适合你</p><h1>外观与本机数据</h1><p>数据留在当前浏览器。清理浏览器数据前，请先备份。</p></div></div><section className="settings-section"><h2>外观主题</h2><div className="theme-options">{THEMES.map(t => <button key={t.id} className={theme === t.id ? 'selected' : ''} aria-pressed={theme === t.id} onClick={() => preferences.update(p => ({ ...p, theme: t.id }))}><span className={'theme-preview ' + t.id}><i/><i/><i/></span><span>{t.label}{theme === t.id && <Check size={16}/>}</span></button>)}</div><Field label="动态效果"><select aria-label="Tools 动态效果" value={prefs.motion} onChange={e => preferences.update(p => ({ ...p, motion: e.target.value }))}><option value="system">跟随系统</option><option value="reduce">减少动态效果 / 低耗电</option><option value="full">完整连续过渡</option></select></Field><p className="setting-description">{reduced ? '已取消空间位移，所有操作仍可直接完成。' : '仅在导航和展开时使用短过渡，不等待片头或影片。'}</p></section><section className="settings-section"><h2>离线与保存</h2><p className="offline-status"><span className="local-dot"/>{offline.status}</p><p>本机记录不需要网络。首次联网并完成离线准备后，才能断网重新打开 Tools。离线缓存只覆盖工具，不包含三维校园。</p><div className="settings-actions"><button className="secondary" onClick={backup}><DownloadSimple size={18}/>下载完整本机备份</button><button className="secondary" onClick={() => fileInput.current?.click()}><FileArrowUp size={18}/>导入公开任务包</button></div><div className="privacy-note"><LockSimple size={21}/><p>完整备份包含私人学习草稿和未发布教师原文，请妥善保存，不要作为公开作业转发。当前支持公开任务包导入，完整备份用于保全与人工恢复，不提供自动恢复。</p></div></section><section className="settings-section"><h2>本机边界</h2><p>学生、教师工作区不是账号。任何使用同一浏览器的人都可能切换角色或读取本机数据。此版本不适合在公用电脑记录敏感信息。</p><p>教师输出和个人任务相互独立：学生的完成只代表自我记录，不代表老师验收；本机发布不代表学校正式发布。</p><button className="text-button" onClick={() => navigate('privacy')}>阅读隐私说明 <ArrowUpRight size={17}/></button></section></>}
    {(route === 'privacy' || route === 'terms') && <section className="legal-page"><button className="back-link" onClick={() => navigate('settings')}>返回外观与数据</button><h1>{route === 'privacy' ? '隐私说明' : '使用边界'}</h1>{route === 'privacy' ? <><h2>没有上传私人学习记录</h2><p>任务、草稿、学习步骤和偏好存放于当前浏览器的本地存储。此 Tools 版本没有账户、云同步、行为追踪或私有内容上传接口。</p><h2>公开输出由你确认</h2><p>只有经过教师确认的作业字段进入公开清单、群消息、打印和公开任务包。粘贴原文与学生私人草稿不在这些输出中。下载完整备份则包含私人数据。</p><h2>同一浏览器不是权限边界</h2><p>角色切换只是界面切换，无法防止同机其他人查看本地记录。请勿保存姓名、成绩、学生照片或学校身份凭据。清除站点数据、无痕窗口关闭、存储容量限制可能导致记录无法保留。</p></> : <><h2>非官方、未接入学校系统</h2><p>HAIZ 是独立项目，不代表学校授权或正式通知。请以教师和学校正式渠道为准。本版本没有微信自动发送、真实 ClassIsland 接入或多设备自动同步。</p><h2>任务与记录的含义</h2><p>完成任务是个人标记，不等于教师批改；本机公开作业不等于他人已经阅读。修改或撤回无法自动影响此前复制、打印或导出的副本。</p><h2>试用而非正式服务承诺</h2><p>此版本尚需真实学生、教师和设备测试。建议保存备份，不将它作为唯一的作业或学习记录来源。</p></>}</section>}
    {!hasKnownRoute && <div className="empty-state"><BookBookmark size={48} weight="thin"/><h1>这个页面还没写进工作台</h1><p>你的本机任务仍在，可以回到今天继续。</p><button className="primary" onClick={() => navigate('today')}>回到今日任务</button></div>}
    <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" aria-label="导入公开任务文件" onChange={importFile}/>
    </main><footer className="tools-footer"><span><ShieldCheck size={15}/>本地优先 · 非官方项目</span><span>{!offline.online && <><CloudSlash size={15}/>当前离线</>}<button onClick={() => navigate('privacy')}>隐私说明</button><button onClick={() => navigate('terms')}>使用边界</button></span></footer></div>
  </div>;
}

function PublicView({ publications, onAdd, onImport }) {
  const [scope, setScope] = useState('');
  const active = publications.filter(p => p.status === 'published');
  const scopes = [...new Set(active.map(p => p.scope))];
  const shown = active.filter(p => !scope || p.scope === scope);
  return <><div className="page-heading"><div><p className="date-line">来自同一份公开内容</p><h1>公开作业</h1><p>把作业带进自己的计划，学习进度只留给自己。</p></div><button className="secondary" onClick={onImport}><FileArrowUp size={18}/>导入公开任务包</button></div><div className="local-notice"><Books size={20}/><p>这里展示本机已发布或导入的作业，不自动连接其他人的设备。复制或打印的内容请核对版本。</p></div>{scopes.length > 0 && <Field label="按班级筛选" className="public-scope"><select aria-label="公开作业班级筛选" value={scope} onChange={e => setScope(e.target.value)}><option value="">全部班级</option>{scopes.map(s => <option key={s}>{s}</option>)}</select></Field>}<div className="publications-list">{shown.length ? shown.map(p => <Publication key={p.id + p.version} publication={p} onAdd={onAdd}/>) : <div className="empty-state"><Books size={44} weight="thin"/><h2>这里还没有公开作业</h2><p>从教师工作区确认发布，或导入一份公开任务包。你仍可独立添加私人任务。</p><button className="secondary" onClick={onImport}>选择公开任务包</button></div>}</div></>;
}
