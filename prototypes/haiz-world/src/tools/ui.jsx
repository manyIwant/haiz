import { ArrowUpRight, Check, Copy, DownloadSimple, Printer } from '@phosphor-icons/react';
import { useState } from 'react';
import { exportPublicBundle, publicationText } from './model.js';

export function dateLabel(value) {
  if (!value) return '未设日期';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value + 'T12:00:00+08:00'));
}
export function Field({ label, children, hint, className = '' }) {
  return <label className={'field ' + className}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function InlineError({ children }) {
  return children ? <p className="inline-error" role="alert">{children}</p> : null;
}
export function Subject({ children }) {
  return <span className="subject" data-subject={children}>{children}</span>;
}
export function download(data, filename) {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Publication({ publication, onAdd, onRevise, onWithdraw, preview = false, history = false }) {
  const [copyState, setCopyState] = useState('');
  const [manual, setManual] = useState(false);
  const [exportError, setExportError] = useState('');
  const text = publicationText(publication);
  function exportBundle() {
    try {
      download(exportPublicBundle([publication]), 'haiz-public-v' + publication.version + '.json');
      setExportError('');
    } catch (err) { setExportError(err.message); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('已复制公开作业文本');
      setManual(false);
    } catch {
      setCopyState('浏览器未允许复制，请选中下方文本手动复制。');
      setManual(true);
    }
  }
  return <article className={'publication ' + (preview ? 'is-preview' : '')}>
    <header className="publication-heading"><div><h3>{publication.scope}</h3><p>{preview ? '待确认发布' : publication.status === 'withdrawn' ? '已撤回' : '本机公开作业'}<span>第 {publication.version} 版{history ? ' · 历史快照' : ''}</span></p></div>{!preview && <span className="quiet-tag">{new Date(publication.publishedAt).toLocaleDateString('zh-CN')}</span>}</header>
    <div className="published-items">{publication.items.map((item, index) => <section key={item.id || index} className="published-item"><Subject>{item.subject}</Subject><div><p>{item.content}</p><small>{dateLabel(item.studyDate)}{item.due ? ' · ' + item.due : ''}{item.materials ? ' · ' + item.materials : ''}</small></div>{onAdd && <button className="small-button" onClick={() => onAdd(item, publication)} aria-label={'加入我的任务：' + item.content}>加入任务 <ArrowUpRight size={16}/></button>}</section>)}</div>
    {!preview && <><div className="publication-actions"><button onClick={copy}><Copy size={18}/>复制群消息</button><button onClick={() => { document.querySelector('.print-sheet')?.remove(); const sheet = document.createElement('div'); sheet.className = 'print-sheet'; const title = document.createElement('h1'); title.textContent = 'HAIZ · 公开作业'; const body = document.createElement('pre'); body.textContent = text; sheet.append(title, body); document.body.append(sheet); window.print(); }}><Printer size={18}/>打印纸条 / 摘要</button><button onClick={exportBundle}><DownloadSimple size={18}/>导出公开任务</button>{onRevise && <button onClick={onRevise}>修订此版</button>}{onWithdraw && <button className="danger-text" onClick={onWithdraw}>撤回发布</button>}</div><p className="action-status" role="status">{copyState && <><Check size={15}/>{copyState}</>}</p>{exportError && <InlineError>{exportError}</InlineError>}{manual && <textarea className="copy-fallback" aria-label="手动复制公开作业" readOnly value={text} onFocus={e => e.target.select()}/>}</>}
  </article>;
}
