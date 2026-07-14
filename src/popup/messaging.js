import { store } from './storage.js';

export function extractFromTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractLinks' }, res => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !Array.isArray(res.videos)) return reject(new Error('No response from content script.'));
      resolve(res);
    });
  });
}

// Polls the live scroll progress written by content.js and reports it via onTick.
// Returns a stop() function to cancel; call it once the extraction promise settles.
// A tick already awaiting store.get when stop() runs is ignored, so it can't
// overwrite a final status that was set after stopping.
export function watchProgress(onTick, intervalMs = 400) {
  let stopped = false;
  const interval = setInterval(async () => {
    const { extractProgress } = await store.get('extractProgress');
    if (!stopped && extractProgress) onTick(extractProgress);
  }, intervalMs);
  return () => { stopped = true; clearInterval(interval); };
}

export function pollForResult(timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const interval = setInterval(async () => {
      const { extractState } = await store.get('extractState');
      if (!extractState || extractState.status === 'loading') {
        if (Date.now() > deadline) { clearInterval(interval); reject(new Error('Timeout.')); }
        return;
      }
      clearInterval(interval);
      extractState.status === 'error'
        ? reject(new Error(extractState.message || 'Unknown error.'))
        : resolve(extractState);
    }, 800);
  });
}
