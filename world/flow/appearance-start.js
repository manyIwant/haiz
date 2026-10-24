/* Shared appearance only. Real identity still comes from /api/flow/me. */
(() => {
  try {
    const pref=JSON.parse(localStorage.getItem('haiz.lucent.preferences.v1')||'{}');
    if(localStorage.getItem('haiz.flow.theme')==='contrast') return;
    let t=pref.theme;
    if(t==='system') t=matchMedia('(prefers-color-scheme: dark)').matches?'obsidian':'porcelain';
    if(['porcelain','obsidian','ocean'].includes(t)) localStorage.setItem('haiz.flow.theme',t==='porcelain'?'light':'dark');
  } catch {}
})();
