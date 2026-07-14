import { store } from './storage.js';

function sendExtractMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractLinks' }, res => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !Array.isArray(res.videos)) return reject(new Error('No response from content script.'));
      resolve(res);
    });
  });
}

// YouTube is a single-page app: navigating to a playlist without a full
// page load (e.g. clicking a link, using back/forward) never triggers the
// manifest's content_scripts injection, so the first message can fail with
// "Could not establish connection". Inject the script on demand and retry
// once before giving up.
export async function extractFromTab(tabId) {
  try {
    return await sendExtractMessage(tabId);
  } catch (err) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content.js'] });
    } catch (_) {
      throw err;
    }
    return await sendExtractMessage(tabId);
  }
}

// Forces a full page reload on tabId and waits for it to finish loading.
// Used as a last-resort fix for a real /playlist page that reports 0 videos:
// YouTube's SPA can leave stale/incomplete DOM behind from a previous
// in-page navigation, and only a genuine reload guarantees a clean slate
// (fresh DOM + the manifest's content_scripts re-injecting properly).
export function reloadAndWait(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      fn(arg);
    };

    const onUpdated = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') finish(resolve);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    const timer = setTimeout(() => finish(reject, new Error('Timed out reloading the page.')), timeoutMs);

    chrome.tabs.reload(tabId, {}, () => {
      if (chrome.runtime.lastError) finish(reject, new Error(chrome.runtime.lastError.message));
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
