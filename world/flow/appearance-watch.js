/* Propagate display theme without copying Flow's session, roles or private data. */
(() => {
 const KEY='haiz.lucent.preferences.v1';
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
 const body=document.body;let restoring=false;
 const apply=()=>{
   const current=read(),base=body.dataset.theme;
   if(base==='contrast'){body.removeAttribute('data-haiz-lucent');return;}
   let t=current.theme;
   if(t==='system')t=matchMedia('(prefers-color-scheme:dark)').matches?'obsidian':'porcelain';
   if(!['porcelain','obsidian','ocean'].includes(t))t=base==='dark'?'obsidian':'porcelain';
   body.dataset.haizLucent=t;
 };
 const observe=()=>{
   if(restoring)return;
   const mode=body.dataset.theme;
   if(!['light','dark'].includes(mode)){apply();return;}
   const old=read();
   const theme=mode==='light'?'porcelain':old.theme==='ocean'?'ocean':'obsidian';
   try {
     localStorage.setItem(KEY,JSON.stringify({...old,theme}));
   }catch{}
   apply();
 };
 new MutationObserver(observe).observe(body,{attributes:true,attributeFilter:['data-theme']});
 window.addEventListener('storage',e=>{
   if(e.key!==KEY)return;
   const theme=read().theme;
   if(!['porcelain','obsidian','ocean','system'].includes(theme))return;
   if(body.dataset.theme==='contrast')return;
   restoring=true;
   body.dataset.theme=theme==='porcelain'?'light':'dark';
   try{localStorage.setItem('haiz.flow.theme',body.dataset.theme)}catch{}
   restoring=false;
   apply();
 });
 apply();
})();
