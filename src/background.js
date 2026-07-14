// background.js — service worker (persists when popup closes)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'openAndExtract') {
    handleOpenAndExtract(message.url);
    sendResponse({ started: true });
  }
});

async function handleOpenAndExtract(playlistUrl) {
  // Clear any previous result and mark as in-progress
  await chrome.storage.local.set({ extractState: { status: 'loading', startedAt: Date.now() } });

  let windowId = null;

  try {
    const opened = await openInBackgroundWindow(playlistUrl);
    windowId = opened.windowId;

    // Wait for YouTube web components to render (content script needs time too)
    await wait(1500);

    let videos = await extractFromTab(opened.tabId);

    // 0 videos here is suspicious rather than conclusive — force one reload
    // and retry before trusting it, same safety net as the same-tab path.
    if (videos.length === 0) {
      await reloadAndWait(opened.tabId);
      videos = await extractFromTab(opened.tabId);
    }

    await chrome.storage.local.set({
      extractState: {
        status: videos.length > 0 ? 'done' : 'empty',
        videos,
        timestamp: Date.now(),
      }
    });
  } catch (err) {
    await chrome.storage.local.set({
      extractState: { status: 'error', message: err.message }
    });
  } finally {
    // A tab made active:false in the *same* window is still document.hidden
    // to the page, and YouTube skips rendering playlist items on hidden tabs
    // — that's why extraction returned 0 videos. A separate, unfocused
    // window keeps its own active tab "visible" (Page Visibility only cares
    // about being the foreground tab of a non-minimized window, not OS
    // focus), so YouTube renders normally, while focused: false means the
    // user's current window — and the popup anchored to it — never loses
    // focus. Positioned off-screen so it never flashes into view, and
    // closed once extraction finishes since it's not a tab the user opened.
    if (windowId) {
      try { await chrome.windows.remove(windowId); } catch (_) {}
    }
  }
}

function openInBackgroundWindow(url) {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ url, focused: false, width: 1280, height: 900 }, async (win) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!win) return reject(new Error('Could not open playlist window.'));

      // The created Window should include its initial tab, but fall back to
      // querying it explicitly in case it isn't populated.
      let tab = win.tabs && win.tabs[0];
      if (!tab) {
        try {
          const tabs = await chrome.tabs.query({ windowId: win.id });
          tab = tabs[0];
        } catch (_) { /* handled by the !tab check below */ }
      }
      if (!tab) return reject(new Error('Could not find the playlist tab after opening it.'));

      const onUpdated = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve({ tabId: tab.id, windowId: win.id });
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

function sendExtractMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractLinks' }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response || !Array.isArray(response.videos)) {
        return reject(new Error('Unexpected response from content script.'));
      }
      resolve(response.videos);
    });
  });
}

// Defensive fallback: if the manifest's content_scripts injection didn't run
// (e.g. the new tab settled on a client-side redirect instead of a full
// load), inject src/content.js on demand and retry once.
async function extractFromTab(tabId) {
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

function reloadAndWait(tabId, timeoutMs = 20000) {
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
