/* HAIZ Academic / GitHub Pages client.
 * GD and HAIZ share Supabase Auth, NOT game data tables.
 * No service_role credentials or user passwords are stored by this script.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { client: null, user: null, role: null, classes: [], selected: null, busy: false };
  function message(id, value) { $(id).textContent = value || ''; }
  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value); // never render DB content as HTML
    return node;
  }
  function errorText(error) {
    const text = String(error?.message || error || '连接失败');
    if (/Invalid login credentials|invalid_credentials/i.test(text)) return '账号或密码不正确。';
    if (/Email not confirmed/i.test(text)) return '此账号尚未完成邮箱验证。';
    if (/Failed to fetch|NetworkError/i.test(text)) return '网络连接失败，请检查后端地址和网络。';
    return '操作失败，请检查账号权限、后端设置或网络连接。';
  }
  async function run(action, target = 'user-status') {
    if (state.busy) return;
    state.busy = true;
    message(target, '');
    try { await action(); } catch (error) { console.error('HAIZ Academic request:',error?.code || error?.name || 'error'); message(target, errorText(error)); }
    finally { state.busy = false; }
  }
  function requireData(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  function loginEmail(raw) {
    const value = raw.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]{2,47}$/.test(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error('INVALID_ACCOUNT');
    }
    // Existing GD convention. Auth accounts are still checked by Supabase.
    return value.includes('@') ? value : value + '@miaoda.com';
  }
  async function authenticate() {
    const { data: { session }, error } = await state.client.auth.getSession();
    if (error) throw error;
    if (!session) {
      state.user = null; state.role = null; state.classes = []; state.selected = null;
      $('auth-view').hidden = false; $('user-view').hidden = true; $('workspace').hidden = true;
      return;
    }
    const { data: { user }, error: whoError } = await state.client.auth.getUser();
    if (whoError || !user) throw whoError || new Error('NO_USER');
    state.user = user;
    state.role = requireData(await state.client.rpc('haiz_ensure_student'));
    $('auth-view').hidden = true; $('user-view').hidden = false; $('workspace').hidden = false;
    $('user-name').textContent = user.email?.split('@')[0] || 'HAIZ 用户';
    $('user-role').textContent = ({student:'学生',teacher:'教师',admin:'管理员'})[state.role] || '班级成员';
    $('join-panel').hidden = state.role !== 'student';
    $('create-class-panel').hidden = !['teacher','admin'].includes(state.role);
    await refresh();
  }
  async function refresh() {
    if (!state.user) return;
    const rows = requireData(await state.client.from('haiz_classes')
      .select('id,name,teacher_id,join_code,created_at').order('created_at',{ascending:false}));
    state.classes = rows || [];
    if (!state.classes.some(c => c.id === state.selected)) state.selected = state.classes[0]?.id || null;
    renderClasses();
    await renderAssignments();
  }
  function renderClasses() {
    const host = $('class-list'); host.replaceChildren();
    if (!state.classes.length) {
      host.append(el('p','muted','目前没有可访问的班级。你可以申请加入，或请教师创建班级。'));
      return;
    }
    for (const c of state.classes) {
      const b = el('button','class-choice' + (state.selected===c.id?' selected':''),c.name);
      b.type='button';
      b.addEventListener('click',() => run(async()=>{
        state.selected=c.id; renderClasses(); await renderAssignments();
      }));
      host.append(b);
    }
  }
  async function renderAssignments() {
    const c = state.classes.find(x=>x.id===state.selected);
    const host=$('assignment-list'); host.replaceChildren();
    $('class-heading').textContent = c ? c.name : '选择班级';
    $('teacher-panel').hidden = !c || c.teacher_id!==state.user.id;
    if (!c) { $('class-info').textContent='选择一个获授权的班级。'; return; }
    const teacher=c.teacher_id===state.user.id;
    const {data: membership} = await state.client.from('haiz_memberships')
      .select('status').eq('class_id',c.id).eq('user_id',state.user.id).maybeSingle();
    $('class-info').textContent = teacher ? '教师管理 · 发布任务会同步给获批准的学生。'
      : membership?.status==='pending' ? '加入申请待审核。批准后才能查看作业。'
      : '只显示已发布的班级作业。';
    const records = requireData(await state.client.from('haiz_assignments')
      .select('id,subject,title,due,status,version,created_at').eq('class_id',c.id)
      .order('created_at',{ascending:false}).limit(100));
    if (!records.length) host.append(el('p','muted','暂无可查看的任务。'));
    for(const a of records) {
      const item=el('article','assignment');
      item.append(el('strong',null,a.subject+' · '+a.title));
      item.append(el('span',null,(a.due?'截止 '+a.due:'无指定截止日期')+
        (a.status==='withdrawn'?' · 已撤回':'')));
      if(teacher && a.status==='published'){
        const b=el('button','subtle small','撤回');
        b.type='button';
        b.addEventListener('click',()=>run(async()=>{
          requireData(await state.client.from('haiz_assignments').update({status:'withdrawn'})
            .eq('id',a.id).eq('class_id',c.id));
          await renderAssignments();
        }));
        item.append(b);
      }
      host.append(item);
    }
    if(teacher) await renderMembers(c);
  }
  async function renderMembers(c) {
    const host=$('pending-members'); host.replaceChildren();
    const rows=requireData(await state.client.from('haiz_memberships')
      .select('user_id,status').eq('class_id',c.id).eq('status','pending').limit(30));
    if (!rows?.length) {host.textContent='暂无待审核的成员。';return;}
    host.append(el('p',null,'待审核成员（匿名用户标识）'));
    for(const m of rows) {
      const row=el('div','row'); row.append(el('span',null,m.user_id.slice(0,8)+'…'));
      const b=el('button','subtle small','批准加入'); b.type='button';
      b.addEventListener('click',()=>run(async()=>{
        requireData(await state.client.from('haiz_memberships').update({status:'active'})
          .eq('class_id',c.id).eq('user_id',m.user_id));
        await renderMembers(c);
      }));
      row.append(b);host.append(row);
    }
  }
  $('login-form').addEventListener('submit',(event)=>{
    event.preventDefault();
    run(async()=>{
      const login=loginEmail($('username').value);
      const password=$('password').value;
      try{
        requireData(await state.client.auth.signInWithPassword({email:login,password}));
      } finally {$('password').value='';}
      await authenticate();
    },'auth-status');
  });
  $('logout-button').addEventListener('click',()=>run(async()=>{
    requireData(await state.client.auth.signOut());
    await authenticate();
  }));
  $('refresh-button').addEventListener('click',()=>run(refresh));
  $('join-form').addEventListener('submit',(event)=>{
    event.preventDefault();run(async()=>{
      requireData(await state.client.rpc('haiz_request_join',{p_code:$('join-code').value.trim().toLowerCase()}));
      $('join-code').value='';await refresh();message('user-status','加入申请已提交，请等待教师核准。');
    });
  });
  $('create-class-form').addEventListener('submit',(event)=>{
    event.preventDefault();run(async()=>{
      requireData(await state.client.from('haiz_classes')
        .insert({name:$('class-name').value.trim(),teacher_id:state.user.id}));
      $('class-name').value='';await refresh();
    });
  });
  $('assignment-form').addEventListener('submit',(event)=>{
    event.preventDefault();run(async()=>{
      if (!state.selected) return;
      requireData(await state.client.from('haiz_assignments').insert({
        class_id:state.selected,author_id:state.user.id,subject:$('task-subject').value.trim(),
        title:$('task-title').value.trim(),due:$('task-due').value || null
      }));
      $('task-title').value='';$('task-due').value='';await renderAssignments();
      message('user-status','已发布到班级。');
    });
  });
  $('rotate-button').addEventListener('click',()=>run(async()=>{
    if (!state.selected) return;
    const token=requireData(await state.client.rpc('haiz_rotate_screen_key',{p_class_id:state.selected}));
    if(typeof token!=='string'||token.length!==96)throw new Error('INVALID_SCREEN_TOKEN');
    try {
      await navigator.clipboard.writeText(token);
      message('screen-status','只读屏幕密钥已更新并复制。请立即在教师设备上粘贴到 ClassIsland 配置中；旧密钥已失效。');
    } catch {
      message('screen-status','屏幕密钥已更新。浏览器拒绝剪贴板写入，请使用支持 HTTPS 的浏览器重新生成并复制。');
    }
  },'screen-status'));
  (async()=>{
    const config=window.HAIZ_CLOUD || {};
    const url=String(config.url||'').trim();
    const key=String(config.publishableKey||'').trim();
    if(!/^https:\/\/[a-z0-9.-]+$/i.test(url)||!key||!window.supabase?.createClient){
      $('setup-notice').hidden=false;
      $('login-button').disabled=true;
      message('auth-status','云端后端尚未配置或认证库无法加载。');
      return;
    }
    state.client=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    try { await authenticate(); }
    catch(error) {message('auth-status',errorText(error));}
  })();
})();
