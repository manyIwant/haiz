import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUUpLeft, BookBookmark, Check, CheckCircle, DotsThree, PencilSimple, Play, Plus, Pause, ArrowBendDownRight, Trash, Notebook } from '@phosphor-icons/react';
import { SUBJECTS, createTask, today, toggleTask, updateTask } from './model.js';
import { startFocus, resumeFocus, pauseFocus, focusLeft, recoverFocus, clockInterrupted } from '../../public/haiz/world/focus-core.js';
import { dateLabel, Field, InlineError, Subject } from './ui.jsx';

export function Student({ tasks, update, all, navigate }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('其他');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const input = useRef(null);
  const last = [...tasks].filter(task => !task.completed && (task.relay?.draft || task.relay?.step || task.relay?.next)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const visible = tasks.filter(task => (all || task.date <= today()) && (task.title + task.subject).includes(search));
  const pending = visible.filter(task => !task.completed);
  const completed = visible.filter(task => task.completed);
  function add(event) {
    event.preventDefault();
    try {
      const task = createTask({ title, subject, date });
      update(current => [...current, task]);
      setTitle('');
      setError('');
      input.current?.focus();
    } catch (err) { setError(err.message); }
  }
  function saveEdit(event) {
    event.preventDefault();
    try {
      update(current => current.map(task => task.id === editing.id ? updateTask(task, editing) : task));
      setEditing(null);
      setError('');
    } catch (err) { setError(err.message); }
  }
  function row(task) {
    return <div className="task-wrap" key={task.id}>
      <div className={'task-row ' + (task.completed ? 'completed' : '')}>
        <button className="task-check" aria-label={(task.completed ? '撤回完成：' : '完成任务：') + task.title} aria-pressed={task.completed} onClick={() => update(current => current.map(t => t.id === task.id ? toggleTask(t) : t))}>{task.completed && <Check size={16} weight="bold"/>}</button>
        <button className="task-content" onClick={() => navigate('study/' + task.id)}><span className="task-title" style={{ viewTransitionName: 'task-' + task.id }}>{task.title}</span><span className="task-meta"><Subject>{task.subject}</Subject><span className={!task.completed && task.date < today() ? 'overdue' : ''}>{task.date === today() ? '今天' : dateLabel(task.date)}</span>{task.relay?.next && <span className="next-preview">下一步：{task.relay.next}</span>}</span></button>
        <button className="icon-btn task-edit" aria-label={'编辑任务：' + task.title} aria-expanded={editing?.id === task.id} onClick={() => { setEditing(editing?.id === task.id ? null : { id: task.id, title: task.title, subject: task.subject, date: task.date }); setDeleteId(null); setError(''); }}><PencilSimple size={19}/></button>
        <button className="icon-btn task-open" aria-label={'继续学习：' + task.title} onClick={() => navigate('study/' + task.id)}><ArrowRight size={19}/></button>
      </div>
      {editing?.id === task.id && <form className="task-edit-form" onSubmit={saveEdit}><Field label="任务名称"><input autoFocus value={editing.title} maxLength={400} required onChange={e => setEditing({ ...editing, title: e.target.value })}/></Field><div className="form-grid"><Field label="学科"><select value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="计划日期"><input type="date" required value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })}/></Field></div><div className="form-actions"><button className="primary" type="submit">保存修改</button><button className="secondary" type="button" onClick={() => setEditing(null)}>取消</button><button type="button" className="text-button danger-text push-right" onClick={() => setDeleteId(task.id)}><Trash size={17}/>删除</button></div>{deleteId === task.id && <div className="inline-confirm"><p>删除此任务及其私人学习线索？此操作不能撤回。</p><button className="danger-button" type="button" onClick={() => { update(current => current.filter(t => t.id !== task.id)); setEditing(null); setDeleteId(null); }}>确认删除</button><button type="button" onClick={() => setDeleteId(null)}>保留任务</button></div>}</form>}
    </div>;
  }
  return <><div className="page-heading"><div><p className="date-line">{all ? '每一件事，都有自己的节奏' : dateLabel(today())}</p><h1>{all ? '全部任务' : '今天，从这里继续。'}</h1><p>{all ? '整理计划，也保留每次停下的思路。' : '不用重新开始，把注意力留给眼前这一件事。'}</p></div><button className="secondary desktop-only" onClick={() => input.current?.focus()}><Plus size={19}/>添加任务</button></div>
    {!all && <section className="relay-banner"><div className="relay-symbol" aria-hidden="true"><BookBookmark size={64} weight="thin"/><span/></div><div><p className="section-kicker">学习接力</p><h2>{last ? last.title : '把下一步，留给下一次。'}</h2><p>{last ? last.relay.next || last.relay.step || '你的草稿已保留，可以从这里接着学。' : '打开任务，记下停在哪、下一步做什么。下次回来，思路还在。'}</p></div><button className="primary" onClick={() => last ? navigate('study/' + last.id) : pending[0] ? navigate('study/' + pending[0].id) : input.current?.focus()}>{last ? '继续这段学习' : pending[0] ? '开始一段学习' : '写下第一件事'}<ArrowRight size={18}/></button></section>}
    <div className="student-layout"><section className="task-section"><div className="section-heading"><h2>{all ? '任务清单' : '今日清单'}<span>{pending.length} 项待办</span></h2>{all && <input className="list-search" aria-label="搜索任务" placeholder="搜索任务或学科" value={search} onChange={e => setSearch(e.target.value)}/>}</div>
      <form className="quick-add" onSubmit={add}><div className="quick-title"><Plus size={20}/><input ref={input} aria-label="新任务名称" placeholder="写下一件要做的事…" maxLength={400} value={title} onChange={e => setTitle(e.target.value)} required/></div><div className="quick-fields"><select aria-label="新任务学科" value={subject} onChange={e => setSubject(e.target.value)}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select><input type="date" aria-label="新任务计划日期" value={date} onChange={e => setDate(e.target.value)} required/><button className="primary" type="submit" aria-label="添加到任务清单">添加 <ArrowBendDownRight size={18}/></button></div></form>
      <InlineError>{error}</InlineError>
      <div className="task-list">{pending.length ? pending.map(row) : <div className="empty-state"><CheckCircle size={40} weight="thin"/><h3>{search ? '没有匹配的任务' : visible.length ? '今天的任务都完成了' : '给今天一个小小的起点'}</h3><p>{search ? '换个关键词，或者添加一件新的事。' : '从上方添加任务。私人任务无需老师加入，也能独立使用。'}</p></div>}</div>
      {!!completed.length && <details className="completed-list"><summary>已完成 <span>{completed.length}</span><small>可随时撤回</small></summary>{completed.map(row)}</details>}
      {!all && tasks.some(t => t.date > today() && !t.completed) && <button className="text-button later-link" onClick={() => navigate('tasks')}>查看之后的计划 <ArrowRight size={17}/></button>}
    </section><aside className="study-aside"><div className="aside-heading"><Notebook size={23} weight="light"/><h2>让学习不断线</h2></div><ol className="relay-guide"><li><span>留下位置</span><p>具体到一道题、一段阅读，或一个还没想清楚的问题。</p></li><li><span>写给下一次</span><p>比起“继续学习”，“先画出受力图”更容易重新出发。</p></li><li><span>安心停下来</span><p>草稿只留在当前浏览器，不会出现在教师或公开作业里。</p></li></ol><div className="aside-footnote"><span className="local-dot"/>本机优先，不需要注册</div></aside></div>
  </>;
}

export function Study({ task, update, navigate }) {
  const [remaining, setRemaining] = useState(() => focusLeft(task?.relay?.focus));
  const [minutes, setMinutes] = useState(25);
  const latest = useRef(task);
  const save = useRef(update);
  latest.current = task;
  save.current = update;
  function relay(patch) {
    update(tasks => tasks.map(t => t.id === task.id ? updateTask(t, { relay: { ...t.relay, ...patch } }) : t));
  }
  useEffect(() => {
    if (!task) return;
    const id = task.id;
    const changeFocus = focus => save.current(tasks => tasks.map(t => t.id === id ? updateTask(t, { relay: { ...t.relay, focus } }) : t));
    const recovered = recoverFocus(latest.current.relay.focus);
    if (recovered !== latest.current.relay.focus) changeFocus(recovered);
    let previousWall = Date.now(), previousMono = performance.now(), ticks = 0;
    const tick = () => {
      const focus = latest.current?.relay.focus;
      const now = Date.now(), mono = performance.now();
      if (focus?.status === 'running' && clockInterrupted(now - previousWall, mono - previousMono)) changeFocus(recoverFocus(focus));
      else if (focus) {
        setRemaining(focusLeft(focus, now));
        if (focus.status === 'running' && (focusLeft(focus, now) === 0 || ++ticks % 5 === 0)) {
          const paused = pauseFocus(focus, now);
          changeFocus(paused.status === 'paused' ? resumeFocus(paused, now) : paused);
        }
      }
      previousWall = now; previousMono = mono;
    };
    const pause = () => {
      save.current(tasks => {
        const active = tasks.find(t => t.id === id);
        if (active?.relay.focus?.status !== 'running') return tasks;
        return tasks.map(t => t.id === id ? updateTask(t, { relay: { ...t.relay, focus: pauseFocus(t.relay.focus) } }) : t);
      });
    };
    const visibility = () => { if (document.hidden) pause(); };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pause);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pause); pause(); };
  }, [task?.id]);
  useEffect(() => setRemaining(focusLeft(task?.relay.focus)), [task?.relay.focus]);
  if (!task) return <div className="empty-state"><h1>这条任务不在本机清单中</h1><p>任务可能已被删除，其他记录仍保留。</p><button className="primary" onClick={() => navigate('today')}>返回今日任务</button></div>;
  const focus = task.relay.focus;
  function toggleFocus() {
    if (focus?.status === 'running') relay({ focus: pauseFocus(focus) });
    else if (focus?.status === 'paused' && focus.remaining > 0) relay({ focus: resumeFocus(focus) });
    else relay({ focus: resumeFocus(startFocus({ id: task.id, title: task.title, next: task.relay.next }, minutes)) });
  }
  return <section className="study-workspace"><button className="back-link" onClick={() => navigate('today')}><ArrowLeft size={18}/>返回任务清单</button><div className="study-heading"><Subject>{task.subject}</Subject><span>{dateLabel(task.date)}</span><span className="quiet-tag">私人学习记录</span></div><h1 style={{ viewTransitionName: 'task-' + task.id }}>{task.title}</h1><div className="focus-layout"><div className="study-paper"><Field label="上次停在这里" hint="留一个具体位置，比重新找回思路更轻松。"><input aria-label="当前学习步骤" placeholder="例如：第 4 题，递推式的第二步" maxLength={500} value={task.relay.step} onChange={e => relay({ step: e.target.value })}/></Field><Field label="思路与草稿"><textarea className="study-draft" aria-label="私人学习草稿" placeholder="把思路写在这里。不必整理成答案，也可以留下一个没想清楚的问题。" maxLength={30000} value={task.relay.draft} onChange={e => relay({ draft: e.target.value })}/></Field><div className="next-action"><ArrowBendDownRight size={23}/><Field label="留给下一次的第一步"><textarea rows={2} aria-label="下一步行动" placeholder="例如：先代入 n = 2，检查通项是否成立" maxLength={1000} value={task.relay.next} onChange={e => relay({ next: e.target.value })}/></Field></div></div><aside className="focus-panel"><span className="section-kicker">只做眼前这一件</span><div className="focus-time" aria-label="专注剩余时间">{String(Math.floor((focus ? remaining : minutes * 60000) / 60000)).padStart(2, '0')}<span>:</span>{String(Math.floor((focus ? remaining : minutes * 60000) % 60000 / 1000)).padStart(2, '0')}</div>{!focus || ['ready', 'done'].includes(focus.status) ? <select aria-label="专注时长" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[5, 15, 25, 45].map(m => <option key={m} value={m}>{m} 分钟</option>)}</select> : <p className="focus-state">{focus.status === 'running' ? '计时中，随时可以停下来' : '计时已暂停，思路还在'}</p>}<button className="primary" onClick={toggleFocus}>{focus?.status === 'running' ? <Pause size={19}/> : <Play size={19}/>} {focus?.status === 'running' ? '暂停专注' : focus?.status === 'paused' ? '继续专注' : focus?.status === 'ready' ? '再开始一段' : '开始专注'}</button><p className="focus-note">离开页面或切换到后台时暂停。这里不记录考勤，也不评价学习表现。</p><div className="focus-divider"/><button className="secondary" onClick={() => navigate('today')}><ArrowUUpLeft size={18}/>保存线索并返回</button><button className="text-button" onClick={() => update(tasks => tasks.map(t => t.id === task.id ? toggleTask(t) : t))}>{task.completed ? <ArrowUUpLeft size={18}/> : <CheckCircle size={18}/>} {task.completed ? '撤回任务完成' : '标记任务完成'}</button><small>输入会尝试立即保存；保存失败时顶部会提示。</small></aside></div></section>;
}
