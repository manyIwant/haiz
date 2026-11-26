/* HAIZ · NIANLUN · 一卷 V4 — Local Same-Origin OCR Bridge (reuses HAIZ Pocket's pocket-ocr.js)
 * Automatically detects local `./ocr/` (standalone preview) OR `../../pocket/ocr/` (inside main repo).
 * Zero external uploads: all recognition happens strictly on the user's device.
 */
(() => {
  'use strict';

  const MAX_BYTES = 12 * 1024 * 1024;
  let ocrBase = null;
  let scriptPromise = null;
  let activeWorker = null;
  let inFlight = false;
  let runId = 0;
  let currentStatus = '';

  async function detectOcrBase() {
    if (ocrBase) return ocrBase;
    const candidates = ['./ocr/', '../../pocket/ocr/'];
    for (const rel of candidates) {
      try {
        const url = new URL(`${rel}vendor/tesseract.min.js`, document.baseURI).href;
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          ocrBase = new URL(rel, document.baseURI).href;
          return ocrBase;
        }
      } catch {
        // try next
      }
    }
    throw new Error('未检测到本地 Tesseract OCR 资源包，可先手动粘贴群消息文字。');
  }

  function loadLibrary(base) {
    if (window.Tesseract?.createWorker) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}vendor/tesseract.min.js`;
      s.async = true;
      s.onload = () => (window.Tesseract?.createWorker ? resolve() : reject(new Error('本地 OCR 引擎无效')));
      s.onerror = () => reject(new Error('无法加载本地 OCR 引擎'));
      document.head.appendChild(s);
    }).catch((err) => {
      scriptPromise = null;
      throw err;
    });
    return scriptPromise;
  }

  function validateImage(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 32 || bytes.byteLength > MAX_BYTES) {
      throw new Error('请选择小于 12 MB 的 PNG 或 JPEG 截图');
    }
    const isPng = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!isPng && !isJpeg) throw new Error('仅支持有效的 PNG / JPEG 图片');
    return isPng ? 'image/png' : 'image/jpeg';
  }

  async function recognize(bytes) {
    if (inFlight) throw new Error('已有截图正在识别，请先取消或等待完成');
    const mime = validateImage(bytes);
    const ticket = ++runId;
    inFlight = true;
    currentStatus = '正在检测同源本地 OCR 引擎…';
    let worker = null;
    try {
      const base = await detectOcrBase();
      await loadLibrary(base);
      if (ticket !== runId) throw new Error('已取消识别');
      currentStatus = '正在加载本机中英文识别模型…';
      worker = await window.Tesseract.createWorker(['chi_sim', 'eng'], 1, {
        workerPath: `${base}vendor/worker.min.js`,
        corePath: `${base}core`,
        langPath: `${base}lang`,
        workerBlobURL: false,
        gzip: true,
        cacheMethod: 'write',
        logger: (m) => {
          if (ticket === runId && typeof m?.progress === 'number') {
            currentStatus = `本机识别进度：${Math.round(Math.max(0, Math.min(1, m.progress)) * 100)}%`;
          }
        },
      });
      if (ticket !== runId) throw new Error('已取消识别');
      activeWorker = worker;
      const result = await worker.recognize(new Blob([bytes], { type: mime }));
      if (ticket !== runId) throw new Error('已取消识别');
      const text = String(result?.data?.text || '').trim();
      if (!text) throw new Error('未识别到清晰文字，可手动输入或换一张截图');
      return text;
    } finally {
      if (activeWorker === worker) activeWorker = null;
      if (worker) await worker.terminate().catch(() => {});
      inFlight = false;
      if (ticket === runId) currentStatus = '';
    }
  }

  function cancel() {
    ++runId;
    currentStatus = '';
    const w = activeWorker;
    activeWorker = null;
    if (w) w.terminate().catch(() => {});
  }

  window.HAIZ_OCR = Object.freeze({
    recognize,
    cancel,
    status: () => currentStatus,
  });
})();
