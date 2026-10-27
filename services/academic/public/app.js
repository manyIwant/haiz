'use strict';
const $=id=>document.getElementById(id);
const element=(tag,value,cl)=>{
 const e=document.createElement(tag);
 if(value!=null)e.textContent=value;
 if(cl)e.className=cl;
 return e;
};
const button=(label,fn,cl='secondary')=>{
 const b=element('button',label,cl);b.type='button';b.addEventListener('click',fn);return b;
};
let user=null,classes=[],selected=null,noticeTimer,schoolEnabled=false;
async function api(path,method='GET',data=null){
 const opt={method,credentials:'same-origin',headers:{'Accept':'application/json'}};
 if(data!==null){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data);}
 const response=await fetch('/api'+path,opt);
 let value={};
 try{value=await response.json();}catch{throw Error('服务器返回格式错误');}
 if(!response.ok)throw Error(value.error||'服务器暂时无法处理请求');
 return value;
}
function alertUser(message){
 const host=$('notice');host.textContent=message;host.classList.add('show');
 clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>host.classList.remove('show'),4200);
}
async function attempt(action){
 try{await action();}catch(error){alertUser(error.message);}
}
const value=form=>Object.fromEntries(new FormData(form).entries());
function createForm(labels,submit,onSubmit){
 const form=element('form',null,'tight');
 for(const field of labels){
  const label=element('label',field.label);
  const input=element(field.long?'textarea':'input');
  input.name=field.key;input.required=field.required!==false;
  if(!field.long)input.type=field.type||'text';
  if(field.max)input.maxLength=field.max;
  if(field.hint)input.placeholder=field.hint;
  if(field.type==='date')input.required=false;
  label.append(input);form.append(label);
 }
 const btn=element('button',submit,'primary');form.append(btn);
 form.addEventListener('submit',e=>{
  e.preventDefault();attempt(async()=>{
    btn.disabled=true;
    try{await onSubmit(value(form));form.reset();}
    finally{btn.disabled=false;}
  });
 });
 return form;
}
function section(title){
 const box=element('section',null,'section');
 const h=element('h2',title);box.append(h);
 return box;
}
function row(title,subtitle){
 const wrapper=element('div',null,'entry');
 const body=element('div',null,'entrymain');
 body.append(element('strong',title));
 if(subtitle)body.append(element('p',subtitle));
 wrapper.append(body);
 return {wrapper,body};
}
function showAuth(){
 $('welcome').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;
 $('identity').textContent='独立校园协作';
}
function showWorkspace(){
 $('welcome').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
 $('identity').textContent=user.label+' · '+({admin:'管理员',teacher:'教师',student:'学生'}[user.role]||user.role);
 $('hello').textContent=user.role==='student'?'只呈现你已获准加入班级的任务。':'一次发布，班级成员接收，教室屏同步显示。';
 $('new-class-wrap').hidden=user.role==='student';
 $('join-wrap').hidden=user.role!=='student';
 $('admin-tools').hidden=user.role!=='admin';
 $('school-tools').hidden=user.role!=='admin'||!schoolEnabled;
}
async function refreshClasses(){
 const data=await api('/classes');classes=data.classes;
 if(selected&&!classes.some(x=>x.id===selected.id))selected=null;
 if(!selected&&classes.length)selected=classes[0];
 const root=$('class-list');root.replaceChildren();
 if(!classes.length)root.append(element('p','还没有班级。','micro'));
 for(const c of classes){
  const b=button(c.title+' · '+(c.status==='pending'?'待核准':'已加入'),
  ()=>attempt(async()=>{selected=c;await refreshClasses();}),'class-button');
  if(selected?.id===c.id)b.classList.add('selected');
  root.append(b);
 }
 await displayClass();
}
async function displayClass(){
 const host=$('class-content');host.replaceChildren();
 if(!selected){host.append(element('div','请先创建或加入一个班级。','empty'));return;}
 const c=selected;
 const info=section(c.title);
 const intro=element('p',c.status==='pending'?'申请已提交，等待任课教师核准。':'任务发布与成员权限分离，所有消息先由教师确认。','muted');
 info.append(intro);host.append(info);
 if(c.status!=='active')return;
 if(user.role!=='student'){
  const meta=element('div',null,'details');
  const invite=element('div',null,'value');
  invite.append(element('strong','邀请码'));
  invite.append(element('p',c.joinCode));
  invite.append(element('p','仅发送给需要加入的学生。加入后仍需要教师审核。','micro'));
  meta.append(invite);
  const screen=element('div',null,'value');
  screen.append(element('strong','教室展示凭据'));
  const link=location.origin+'/api/screens/'+c.screenKey;
  const small=element('p','教室屏只会显示已发布任务，不包含学生账户信息。','micro');
  screen.append(small);
  screen.append(button('复制教室展示链接',()=>navigator.clipboard.writeText(link).then(()=>alertUser('已复制只读链接')).catch(()=>alertUser('请手动复制链接'))));
  screen.append(button('轮换展示凭据',()=>attempt(async()=>{
   if(!confirm('旧教室屏链接将立即失效，确定轮换？'))return;
   const x=await api('/classes/'+c.id+'/screens/rotate','POST',{});
   c.screenKey=x.screenKey;alertUser('已轮换，请重新配置 ClassIsland');await displayClass();
  }),'quiet'));
  meta.append(screen);
  info.append(meta);
 }
 if(user.role==='student')await showStudent(c,host);
 else await showTeacher(c,host);
}
async function showStudent(c,host){
 const sec=section('已发布任务');
 const data=await api('/my/assignments');
 const entries=data.assignments.filter(a=>a.classId===c.id);
 if(!entries.length)sec.append(element('p','老师尚未向这个班级发布任务。','muted'));
 for(const a of entries){
  const label=a.subject+' · '+a.title;
  const r=row(label,'截止：'+(a.due||'待确认')+(a.viewed?' · 已查看（不代表已交作业）':' · 未标记查看'));
  r.wrapper.append(button(a.viewed?'已查看':'标记我已查看',()=>attempt(async()=>{
   await api('/assignments/'+a.id+'/acknowledge','POST',{});
   alertUser('已记录查看，不等于完成或提交');await displayClass();
  }),'secondary'));sec.append(r.wrapper);
 }
 host.append(sec);
}
async function showTeacher(c,host){
 const newTask=section('发布新作业');
 newTask.append(createForm([
  {label:'科目',key:'subject',max:32,hint:'例如：物理'},
  {label:'任务内容',key:'title',max:240,hint:'例如：完成必修一实验报告'},
  {label:'截止日期（可选）',key:'due',type:'date',required:false},
  {label:'补充说明（可选）',key:'details',long:true,required:false},
 ],'确认发布到班级',async p=>{
   if(!confirm('将这项任务正式发布到班级？'))return;
   await api('/classes/'+c.id+'/assignments','POST',p);
   alertUser('已发布到班级');await displayClass();
 }));
 host.append(newTask);
 const data=await api('/classes/'+c.id+'/assignments');
 const assigned=section('已发布 · '+data.assignments.length+' 项');
 for(const a of data.assignments){
  const r=row(a.subject+' · '+a.title,'截止：'+(a.due||'待定')+(a.details?' · '+a.details:''));
  assigned.append(r.wrapper);
 }
 if(!data.assignments.length)assigned.append(element('p','暂无任务。','muted'));
 host.append(assigned);
 const enrolled=await api('/classes/'+c.id+'/members');
 const roster=section('学生申请与班级成员');
 for(const m of enrolled.members){
  const r=row(m.label+' · '+m.login,m.status==='pending'?'等待审核':m.status==='active'?'已核准':'已拒绝');
  if(m.status==='pending'){
   r.wrapper.append(button('核准',()=>attempt(async()=>{
    await api('/classes/'+c.id+'/members/'+m.id+'/approve','POST',{});
    alertUser('学生已获班级访问权限');await displayClass();
   })));
   r.wrapper.append(button('拒绝',()=>attempt(async()=>{
    await api('/classes/'+c.id+'/members/'+m.id+'/reject','POST',{});
    await displayClass();
   }),'quiet'));
  }
  roster.append(r.wrapper);
 }
 if(!enrolled.members.length)roster.append(element('p','暂无学生申请。','muted'));
 host.append(roster);
 const source=section('QQ 机器人接入 · 等待教师确认');
 source.append(element('p','只有经过授权的 QQ 官方机器人 @消息、经过可信中继签名、绑定此班之后，才会出现在这里。','muted'));
 source.append(createForm([
  {label:'官方机器人群组 group_openid',key:'groupOpenid',hint:'从官方机器人事件获得'},
 ],'绑定群事件来源',async p=>{
  await api('/classes/'+c.id+'/qq/mapping','POST',p);
  alertUser('群组事件映射已保存');
 }));
 const waiting=await api('/classes/'+c.id+'/inbox');
 for(const item of waiting.inbox){
  const r=row('收到一条群通知 · 尚未发布',item.content);
  r.wrapper.append(button('人工核对发布',()=>attempt(async()=>{
   const subject=prompt('核对科目（必填）','其他');
   if(subject===null)return;
   const title=prompt('核对任务（必填）',item.content.slice(0,140));
   if(title===null)return;
   const due=prompt('截止日期 YYYY-MM-DD（不确定则留空）','');
   if(due===null)return;
   if(!confirm('确认发布到本班？'))return;
   await api('/classes/'+c.id+'/inbox/'+item.id+'/publish','POST',{subject,title,due});
   alertUser('已审核并发布');await displayClass();
  })));
  r.wrapper.append(button('忽略',()=>attempt(async()=>{
   await api('/classes/'+c.id+'/inbox/'+item.id+'/dismiss','POST',{});
   await displayClass();
  }),'quiet'));
  source.append(r.wrapper);
 }
 if(!waiting.inbox.length)source.append(element('p','当前没有待审核的 QQ 机器人消息。','muted'));
 host.append(source);
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const login=b.dataset.tab==='login';
 $('login-form').hidden=!login;$('register-form').hidden=login;
 document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('selected',t===b));
}));
$('login-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  const result=await api('/auth/login','POST',value(e.target));
  user=result.user;showWorkspace();await refreshClasses();e.target.reset();
 });
});
$('register-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  await api('/auth/register','POST',value(e.target));
  const me=await api('/me');user=me.user;showWorkspace();await refreshClasses();
  alertUser('注册成功，需等待班级教师核准');
 });
});
$('logout').addEventListener('click',()=>attempt(async()=>{await api('/auth/logout','POST',{});user=null;selected=null;showAuth();}));
$('refresh').addEventListener('click',()=>attempt(refreshClasses));
$('new-class-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  const c=await api('/classes','POST',value(e.target));
  selected=c;await refreshClasses();e.target.reset();alertUser('班级已创建');
 });
});
$('join-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  await api('/classes/join','POST',value(e.target));await refreshClasses();alertUser('已提交申请');
 });
});
$('school-link-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  if(!confirm('确认已根据校方授权核实账号与匿名标识？'))return;
  await api('/admin/school-links','POST',value(e.target));
  alertUser('匿名身份映射建立成功');e.target.reset();
 });
});
$('teacher-form').addEventListener('submit',e=>{
 e.preventDefault();attempt(async()=>{
  await api('/admin/teachers','POST',value(e.target));
  alertUser('教师账号已创建，请通过可信渠道传达凭据');e.target.reset();
 });
});
attempt(async()=>{
 try{const health=await api('/health');schoolEnabled=health.schoolRosterConfigured===true;
  const me=await api('/me');user=me.user;showWorkspace();await refreshClasses();}
 catch(error){if(error.message==='请先登录'){showAuth();return;}throw error;}
});
