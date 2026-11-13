// HAIZ 实验册 · 第三代 · 可以拖动的数
// 公式里的数不是印死的：按住一个数左右拖，它就变，整个模型跟着变（键盘 ← → 也可以）。
// 公式、装置、图像是同一个系统的三种样子，改哪一个都一样。
export function scrubbable(el, o) {
  const { get, set, min, max, step = 0.01, px = 3, signal } = o;
  el.classList.add('scrub'); el.tabIndex = 0; el.setAttribute('role', 'slider');
  if (o.label) el.setAttribute('aria-label', o.label);
  const snap = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const refresh = () => { el.setAttribute('aria-valuenow', String(get())); el.setAttribute('aria-valuemin', String(min)); el.setAttribute('aria-valuemax', String(max)); };
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    drag = { x: e.clientX, v: get() }; el.classList.add('on');
    try { el.setPointerCapture(e.pointerId); } catch {}
  }, { signal });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const v = snap(drag.v + ((e.clientX - drag.x) / px) * step);
    if (v !== get()) { set(v); refresh(); }
  }, { signal });
  const up = () => { drag = null; el.classList.remove('on'); };
  el.addEventListener('pointerup', up, { signal }); el.addEventListener('pointercancel', up, { signal });
  el.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    set(snap(get() + d * step)); refresh();
  }, { signal });
  refresh();
  return { refresh };
}
