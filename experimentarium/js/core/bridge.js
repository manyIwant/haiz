// HAIZ · EXPERIMENTARIUM — 与 HAIZ 兄弟项目（假设剥离器、双向公式操纵、凤栖堂、走进去的知识、World Engine）预留集成协议
export function parseLaunchQuery(search = location.search) {
  const qs = new URLSearchParams(search);
  return {
    exp: qs.get('exp') || null,
    mode: qs.get('mode') || 'spread', // spread | gatefold | workbench
    embed: qs.get('embed') === '1',
    quality: qs.has('q') ? Number(qs.get('q')) : null,
    fixed: qs.has('fixed'),
    still: qs.has('still'),
  };
}

export function registerBridge(api) {
  window.HAIZExperimentarium = {
    version: '3.0.0',
    schema: 'haiz-experimentarium-bridge/1',
    openExperiment: (id, opts) => api.openById(id, opts),
    setSpatialMode: (mode) => api.setSpatialMode(mode),
    getCurriculumMatrix: () => api.getMatrix(),
    exportJournalContract: () => api.exportJournal(),
    getCurrentState: () => api.getState(),
  };
  // 支持父窗口安全只读查询（例如 World Engine 科学站嵌入预览）
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || typeof d !== 'object' || d.ns !== 'haiz-experimentarium') return;
    if (d.action === 'open' && d.expId) api.openById(d.expId, { mode: d.mode });
    if (d.action === 'setMode' && d.mode) api.setSpatialMode(d.mode);
  });
}
