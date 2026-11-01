/* HAIZ Pocket browser OCR bridge.
 * Recognizes only user-selected bytes, on this device, with scripts, WASM
 * and language models hosted by the same HAIZ origin. Nothing is uploaded.
 * The OCR bundle and models are downloaded only after the user selects an
 * image, never during normal Pocket startup.
 */
(() => {
  'use strict';

  const base = new URL('./', document.baseURI);
  const localUrl = (path) => new URL(path, base).href;
  const MAX_BYTES = 12 * 1024 * 1024;
  let scriptPromise;
  let activeWorker = null;
  let inFlight = false;
  let runId = 0;
  let currentStatus = '';

  const setStatus = (value) => { currentStatus = value; };
  const cancelled = (ticket) => ticket !== runId;

  function loadLibrary() {
    if (window.Tesseract?.createWorker) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = localUrl('ocr/vendor/tesseract.min.js');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.Tesseract?.createWorker) resolve();
        else reject(new Error('本地 OCR 引擎格式无效'));
      };
      script.onerror = () => reject(new Error('本地 OCR 引擎无法加载，请联网后重试'));
      document.head.append(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
    return scriptPromise;
  }

  function validateImage(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new Error('请选择 PNG 或 JPEG 截图');
    if (bytes.byteLength < 32 || bytes.byteLength > MAX_BYTES) {
      throw new Error('截图应小于 12 MB，且不能是空文件');
    }
    const isPng = bytes[0] === 137 && bytes[1] === 80 &&
      bytes[2] === 78 && bytes[3] === 71;
    const isJpeg = bytes[0] === 255 && bytes[1] === 216 &&
      bytes[2] === 255;
    if (!isPng && !isJpeg) throw new Error('图片格式不是有效的 PNG/JPEG');
    return isPng ? 'image/png' : 'image/jpeg';
  }

  async function recognize(bytes) {
    if (inFlight) {
      throw new Error('已有截图正在识别，请先取消或完成');
    }
    const mime = validateImage(bytes);
    const ticket = ++runId;
    inFlight = true;
    setStatus('正在加载本地 OCR 引擎');
    let worker = null;
    try {
      await loadLibrary();
      if (cancelled(ticket)) throw new Error('识别已取消');
      setStatus('正在准备中文和英文识别模型');
      worker = await window.Tesseract.createWorker(
        ['chi_sim', 'eng'], 1,
        {
          workerPath: localUrl('ocr/vendor/worker.min.js'),
          corePath: localUrl('ocr/core'),
          langPath: localUrl('ocr/lang'),
          workerBlobURL: false,
          gzip: true,
          cacheMethod: 'write',
          logger: (message) => {
            if (cancelled(ticket)) return;
            if (typeof message?.progress === 'number') {
              const pct = Math.round(Math.max(0, Math.min(1, message.progress)) * 100);
              setStatus('本机文字识别：' + pct + '%');
            }
          },
        },
      );
      if (cancelled(ticket)) throw new Error('识别已取消');
      activeWorker = worker;

      // The selected screenshot never leaves the current browser context.
      const blob = new Blob([bytes], {type: mime});
      setStatus('正在本机识别文字');
      const result = await worker.recognize(blob);
      if (cancelled(ticket)) throw new Error('识别已取消');
      const text = String(result?.data?.text || '').trim();
      if (!text) throw new Error('截图没有识别到文字，请更换清晰图片或手动输入');
      return text;
    } finally {
      if (activeWorker === worker) activeWorker = null;
      if (worker) await worker.terminate().catch(() => {});
      inFlight = false;
      if (ticket === runId) setStatus('');
    }
  }

  function cancel() {
    ++runId;
    setStatus('');
    const worker = activeWorker;
    activeWorker = null;
    if (worker) void worker.terminate().catch(() => {});
  }

  window.HAIZ_OCR = Object.freeze({
    recognize,
    cancel,
    status: () => currentStatus,
  });
})();
