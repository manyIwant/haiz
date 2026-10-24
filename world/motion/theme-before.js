/* Read the shared native/Web palette before Fieldnotes' own inline state initializes.
   Only a public appearance preference is shared; no role, credential or draft is copied. */
(() => {
  try {
    const prefs = JSON.parse(localStorage.getItem('haiz.lucent.preferences.v1') || '{}');
    let theme = prefs.theme;
    if (theme === 'system') theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'obsidian' : 'porcelain';
    if (['porcelain','obsidian','ocean'].includes(theme)) localStorage.setItem('haiz-editorial-theme', theme);
  } catch {}
})();
