// background.js — service worker (persists when popup closes)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'openAndExtract') {
    handleOpenAndExtract(message.url, message.originalTabId);
    sendResponse({ started: true });
  }
});

async function handleOpenAndExtract(playlistUrl, originalTabId) {
  // Clear any previous result and mark as in-progress
  await chrome.storage.local.set({ extractState: { status: 'loading', startedAt: Date.now() } });

  let newTabId = null;

  try {
    newTabId = await openTab(playlistUrl);

    // Wait for YouTube web components to render (content script needs time too)
    await wait(1500);

    const videos = await extractFromTab(newTabId);

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
    // Leave the playlist tab open — user may want to browse it
    if (originalTabId) {
      try { await chrome.tabs.update(originalTabId, { active: true }); } catch (_) {}
    }
  }
}

function openTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }

      const onUpdated = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(tab.id);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

function extractFromTab(tabId) {
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
