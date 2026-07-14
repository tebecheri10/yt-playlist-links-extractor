const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const countVideos = () =>
  document.querySelectorAll('ytd-playlist-video-renderer').length;

// Best-effort total from the playlist stats sidebar (e.g. "300 videos").
// Returns null if it can't be parsed — callers must tolerate an unknown total.
function getPlaylistTotal() {
  const nodes = document.querySelectorAll(
    'ytd-playlist-sidebar-primary-info-renderer #stats yt-formatted-string, ' +
    'ytd-playlist-header-renderer yt-formatted-string'
  );
  for (const node of nodes) {
    const m = (node.textContent || '').replace(/[.,]/g, '').match(/(\d+)\s*(videos?|vídeos?)/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function reportProgress(loaded, total) {
  try {
    chrome.storage.local.set({ extractProgress: { loaded, total, ts: Date.now() } });
  } catch (_) { /* storage may be unavailable; progress is best-effort */ }
}

function clearProgress() {
  try { chrome.storage.local.remove('extractProgress'); } catch (_) {}
}

async function scrollToLoadAll() {
  const MAX_ITERATIONS = 100;
  const STEP_MS = 300;        // how often we re-check the count while waiting
  const MAX_WAIT_MS = 3000;   // max time to wait for new items in one iteration
  const MAX_STALE = 3;        // stop after this many iterations with no growth

  const total = getPlaylistTotal();
  let staleCount = 0;
  let lastCount = countVideos();

  reportProgress(lastCount, total);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!document.querySelector('ytd-continuation-item-renderer')) break;

    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });

    // Adaptive wait: proceed as soon as the count grows, up to MAX_WAIT_MS.
    let elapsed = 0;
    let current = lastCount;
    while (elapsed < MAX_WAIT_MS) {
      await wait(STEP_MS);
      elapsed += STEP_MS;
      current = countVideos();
      if (current > lastCount) break;
    }

    reportProgress(current, total);

    if (current > lastCount) {
      lastCount = current;
      staleCount = 0;
    } else if (++staleCount >= MAX_STALE) {
      break;
    }
  }
}

function extractVideos() {
  const renderers = document.querySelectorAll('ytd-playlist-video-renderer');
  const seen = new Set();
  const videos = [];

  for (const renderer of renderers) {
    const anchor = renderer.querySelector('a#video-title');
    if (!anchor) continue;

    const title = anchor.getAttribute('title') || anchor.textContent.trim();
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/[?&]v=([^&]+)/);
    if (!match) continue;

    const url = `https://www.youtube.com/watch?v=${match[1]}`;
    if (seen.has(url)) continue;
    seen.add(url);

    videos.push({ title: title.trim(), url });
  }

  return videos;
}

function getPlaylistTitle() {
  // document.title is the most reliable source — YouTube always sets it
  const fromDocTitle = document.title.replace(/ - YouTube$/i, '').trim();
  if (fromDocTitle && fromDocTitle.toLowerCase() !== 'youtube') return fromDocTitle;
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getPlaylistTitle') {
    sendResponse({ title: getPlaylistTitle() });
    return false;
  }

  if (message.action === 'extractLinks') {
    (async () => {
      try {
        await scrollToLoadAll();
        const videos = extractVideos();
        sendResponse({ videos, title: getPlaylistTitle() });
      } finally {
        clearProgress();
      }
    })();
    return true;
  }
});
