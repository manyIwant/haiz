import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle, ClipboardText, FileText, Plus, Trash, WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import { SUBJECTS, today, publishDraft, withdrawPublication } from './model.js';
import { parseCapture } from './capture.js';
import { dateLabel, Field, InlineError, Publication } from './ui.jsx';

export const EMPTY_TEACHER = { scope: '', source: '', items: [], stage: 'capture', publicationId: null };
const SAMPLE = '明天交数学 P32–35，第 1 至 5 题。\n周五交英语 Unit 4 词汇练习，整理 5 个易错词。\n语文：阅读《荷塘月色》，写一段批注。';

export function Teacher({ record, published, navigate, motion }) {
  const draft = record.value;
  const publications = published.value;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reparse, setReparse] = useState(false);
  const [removed, setRemoved] = useState(null);
  const [selected, setSelected] = useState(null);
  const [historyVersion, setHistoryVersion] = useState('current');
  const [replaceDraft, setReplaceDraft] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const stage = draft.stage || 'capture';
  const chosen = publications.find(p => p.id === selected) || publications[0];
  const historic = chosen?.history?.find(p => String(p.version) === historyVersion);
  const prospective = useMemo(() => {
    if (stage !== 'preview') return null;
    try { return { list: publishDraft(draft, publications, true) }; }
    catch (err) { return { error: err.message }; }
  }, [draft, publications, stage]);
  const previewPublication = prospective?.list?.find(p => draft.publicationId ? p.id === draft.publicationId : !publications.some(old => old.id === p.id));
  function change(patch) {
    record.update(current => ({ ...current, ...patch }));
    setConfirmed(false);
    setNotice('');
    setError('');
  }
  function goStage(next) {
    motion(() => change({ stage: next }));
  }
  function parse(force = false) {
    if (draft.items.length && !force) { setReparse(true); return; }
    try {
      if (!draft.source.trim()) throw Error('先粘贴一段作业文字，再整理成条目。');
      const result = parseCapture(draft.source, today());
      change({ items: result.items, stage: 'edit' });
      setReparse(false);
      setNotice('已生成可编辑条目。日期和科目只是建议，请逐项核对。');
    } catch (err) { setError(err.message); }
  }
  function changeItem(id, patch) {
    change({ items: draft.items.map(item => item.id === id ? { ...item, ...patch } : item) });
  }
  function preview() {
    try {
      publishDraft(draft, publications, true);
      goStage('preview');
    } catch (err) { setError(err.message); }
  }
  function publish() {
    if (!confirmed || !prospective?.list || !previewPublication || record.error || published.error) return;
    if (published.update(prospective.list)) {
      setSelected(previewPublication.id);
      record.update({ ...EMPTY_TEACHER, scope: draft.scope });
      setConfirmed(false);
      setNotice('已发布到当前浏览器。可以复制、打印或导出公开任务包。');
      setHistoryVersion('current');
    } else setError('发布未能保存。草稿仍在，请处理顶部的保存错误后重试。');
  }
  function revise(publication, force = false) {
    if ((draft.source || draft.items.length) && !force) { setReplaceDraft(publication); return; }
    record.update({ scope: publication.scope, source: '', items: publication.items.map(item => ({ ...item, warnings: [] })), stage: 'edit', publicationId: publication.id });
    setReplaceDraft(null);
    setConfirmed(false);
    setError('');
    setNotice('已建立修订草稿。确认发布前，公开内容仍是原版本。');
    document.getElementById('teacher-editor')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  return <><div className="page-heading"><div><p className="date-line">教师工作区</p><h1>只写一次，各处可用。</h1><p>把已经写好的作业带过来，核对后再发布。</p></div><button className="secondary" onClick={() => navigate('public')}><FileText size={18}/>查看学生公开清单</button></div><div className="local-notice"><span className="local-dot"/><p>当前为本机试用。角色切换不等于身份认证，发布不等于上传互联网。请勿录入姓名、成绩等敏感信息。</p></div>
    <section className="teacher-editor" id="teacher-editor"><div className="editor-header"><div className="editor-title"><ClipboardText size={24} weight="light"/><h2>{draft.publicationId ? '修订作业' : '一次发布'}</h2><span className="quiet-tag">草稿仅在本机</span></div><nav className="step-nav" aria-label="作业发布步骤">{[['capture', '粘贴原文'], ['edit', '核对条目'], ['preview', '确认发布']].map(([id, label], i) => <button key={id} className={stage === id ? 'active' : ''} aria-current={stage === id ? 'step' : undefined} disabled={id !== 'capture' && !draft.items.length} onClick={() => id === 'preview' ? preview() : goStage(id)}><span>{i + 1}</span>{label}</button>)}</nav></div>
      <div className="editor-body" key={stage}><div className="scope-row"><Field label="发布班级" hint="按班级组织公开清单，不建立真实班级成员或权限。"><input aria-label="发布班级" placeholder="例如：高一（3）班" value={draft.scope} maxLength={60} onChange={e => change({ scope: e.target.value })}/></Field></div>
      {stage === 'capture' && <><Field label="粘贴已有的作业文字" hint="支持纯文本拆分，不使用 AI 或 OCR。保留原文，所有解析结果都需人工核对。"><textarea className="capture-input" aria-label="作业原文" value={draft.source} maxLength={30000} onChange={e => change({ source: e.target.value })} placeholder={'数学：P32–35，第 1 至 5 题，明天交。\n英语：Unit 4 词汇练习，周五交。'}/></Field><div className="capture-actions"><button className="text-button" disabled={Boolean(draft.source)} onClick={() => change({ source: SAMPLE })}>填入练习示例</button><small>示例只填入草稿，不会自动发布。</small><button className="primary push-right" onClick={() => parse()}>整理成作业条目 <ArrowRight size={18}/></button></div>{reparse && <div className="inline-confirm"><p>重新解析会替换已编辑的条目，原文仍保留。</p><button className="secondary" onClick={() => parse(true)}>重新解析并替换</button><button className="text-button" onClick={() => setReparse(false)}>保留当前条目</button></div>}</>}
      {stage === 'edit' && <><div className="review-hint"><WarningCircle size={20}/><p>逐项检查科目、内容和计划日期。自动建议不代表教师已确认。</p></div><div className="capture-items">{draft.items.map((item, index) => <section className="capture-item" key={item.id}><div className="item-heading"><h3>作业 {index + 1}</h3><button className="icon-btn" aria-label={'移除作业 ' + (index + 1)} onClick={() => { setRemoved({ item, index }); change({ items: draft.items.filter(row => row.id !== item.id) }); }}><Trash size={18}/></button></div><div className="form-grid"><Field label="学科"><select aria-label={'作业 ' + (index + 1) + ' 学科'} value={item.subject} onChange={e => changeItem(item.id, { subject: e.target.value })}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="计划日期"><input type="date" aria-label={'作业 ' + (index + 1) + ' 日期'} required value={item.studyDate} onChange={e => changeItem(item.id, { studyDate: e.target.value })}/></Field></div><Field label="公开作业内容"><textarea aria-label={'作业 ' + (index + 1) + ' 内容'} rows={3} maxLength={30000} value={item.content} onChange={e => changeItem(item.id, { content: e.target.value })}/><small className={item.content.length > 400 ? 'danger-text' : ''}>{item.content.length} / 400 字，超出时请拆分，系统不会截断原文。</small></Field><div className="form-grid"><Field label="截止说明（可选）"><input aria-label={'作业 ' + (index + 1) + ' 截止说明'} value={item.due || ''} maxLength={100} placeholder="例如：早读前交" onChange={e => changeItem(item.id, { due: e.target.value })}/></Field><Field label="材料说明（可选）"><input aria-label={'作业 ' + (index + 1) + ' 材料说明'} value={item.materials || ''} maxLength={100} placeholder="例如：练习册" onChange={e => changeItem(item.id, { materials: e.target.value })}/></Field></div>{!!item.warnings?.length && <p className="parse-warning"><WarningCircle size={16}/>{item.warnings.join('；')}</p>}</section>)}</div>{removed && <div className="restore-item"><span>已移除一项作业</span><button className="text-button" onClick={() => { const items = [...draft.items]; items.splice(removed.index, 0, removed.item); change({ items }); setRemoved(null); }}>撤销移除</button></div>}<button className="add-item" onClick={() => change({ items: [...draft.items, { id: crypto.randomUUID(), subject: '其他', content: '', studyDate: today(), due: '', materials: '', warnings: ['手动新增，请核对全部字段'] }] })}><Plus size={18}/>手动添加条目</button><div className="form-actions"><button className="secondary" onClick={() => goStage('capture')}><ArrowLeft size={17}/>返回原文</button><button className="primary push-right" disabled={!draft.items.length} onClick={preview}>预览公开内容 <ArrowRight size={18}/></button></div></>}
      {stage === 'preview' && <><div className="preview-note"><FileText size={22}/><div><h3>这是学生会看到的全部内容</h3><p>原文、私人草稿和学习进度不在公开输出中。发布后仍可修订并追溯版本。</p></div></div>{previewPublication && <Publication publication={previewPublication} preview/>}<InlineError>{prospective?.error}</InlineError><label className="confirm-publish"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>我已核对班级、学科、作业内容和日期，确认公开这些条目。</span></label><div className="form-actions"><button className="secondary" onClick={() => goStage('edit')}><ArrowLeft size={17}/>返回修改</button><button className="primary push-right" disabled={!confirmed || !previewPublication || Boolean(record.error || published.error)} onClick={publish}><Check size={18}/>确认发布到本机</button></div></>}
      <InlineError>{error}</InlineError><p className="editor-status" role="status">{notice}</p></div></section>
    <section className="publication-section"><div className="section-heading"><h2>已发布内容<span>{publications.length} 份</span></h2><p>同一份数据，用于复制、打印和公开任务包。</p></div>{publications.length ? <><div className="publication-filters"><Field label="选择班级与发布"><select aria-label="选择已发布作业" value={chosen?.id} onChange={e => { setSelected(e.target.value); setHistoryVersion('current'); }}>{publications.map(p => <option key={p.id} value={p.id}>{p.scope} · 第 {p.version} 版{p.status === 'withdrawn' ? ' · 已撤回' : ''}</option>)}</select></Field><Field label="版本记录"><select aria-label="版本记录" value={historyVersion} onChange={e => setHistoryVersion(e.target.value)}><option value="current">当前版本 v{chosen.version}</option>{chosen.history?.map(p => <option key={p.version} value={String(p.version)}>历史版本 v{p.version}</option>)}</select></Field></div><Publication key={chosen.id + historyVersion + chosen.version} publication={historic ? { ...historic, history: chosen.history.filter(p => p.version < historic.version) } : chosen} history={Boolean(historic)} onRevise={!historic ? () => revise(chosen) : undefined} onWithdraw={!historic && chosen.status !== 'withdrawn' ? () => setWithdrawing(chosen.id) : undefined}/>{replaceDraft && <div className="inline-confirm"><p>修订此发布会替换当前未发布草稿。请先从设置下载本机备份，或保留当前草稿。</p><button className="secondary" onClick={() => revise(replaceDraft, true)}>用此发布建立修订草稿</button><button className="text-button" onClick={() => setReplaceDraft(null)}>保留当前草稿</button></div>}{withdrawing && <div className="inline-confirm"><p>撤回后，本机学生公开清单将不再展示此作业。已转发或导出的副本不会自动撤回。</p><button className="danger-button" onClick={() => { try { published.update(current => withdrawPublication(current, withdrawing)); setWithdrawing(null); } catch (err) { setError(err.message); } }}>确认撤回</button><button className="text-button" onClick={() => setWithdrawing(null)}>取消</button></div>}</> : <div className="empty-state publication-empty"><FileText size={36} weight="thin"/><h3>还没有公开作业</h3><p>核对并确认发布后，这里会保留可复用的公开版本。</p></div>}</section>
  </>;
}
