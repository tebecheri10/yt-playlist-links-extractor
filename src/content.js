// Guard against double injection: the manifest may have already run this
// script on page load, and we also inject it on demand (see messaging.js /
// background.js) when YouTube's SPA navigation skips that initial injection.
// Without this, extractLinks would get two listeners answering one message.
if (!window.__ytPlaylistExtractorLoaded) {
window.__ytPlaylistExtractorLoaded = true;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// YouTube redesigned the /playlist page around a "Lockup" component
// (yt-lockup-view-model), replacing the old ytd-playlist-video-renderer.
// Both selectors are kept since YouTube rolls out redesigns gradually and
// some accounts may still see the old markup.
const ITEM_SELECTOR = 'yt-lockup-view-model, ytd-playlist-video-renderer';

const countVideos = () => document.querySelectorAll(ITEM_SELECTOR).length;

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
  const INITIAL_WAIT_MS = 6000; // give the first batch a chance to render

  // Extraction can be triggered right after navigation, before YouTube has
  // rendered anything at all — without this, a slow-loading page would look
  // like an empty playlist and bail out immediately.
  let initElapsed = 0;
  while (countVideos() === 0 && initElapsed < INITIAL_WAIT_MS) {
    await wait(STEP_MS);
    initElapsed += STEP_MS;
  }

  const total = getPlaylistTotal();
  let staleCount = 0;
  let lastCount = countVideos();

  reportProgress(lastCount, total);

  // Stopping is driven entirely by "count stopped growing" rather than
  // looking for a specific "loading more" sentinel element — YouTube has
  // renamed/restructured that element before, and this way scrolling isn't
  // tied to knowing its current tag name.
  for (let i = 0; i < MAX_ITERATIONS; i++) {
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

// Reads one playlist item, trying the current "Lockup" markup first
// (yt-lockup-view-model, title on h3[title] + a.ytLockupMetadataViewModelTitle)
// and falling back to the older ytd-playlist-video-renderer markup
// (title on a#video-title itself).
function extractOne(renderer) {
  let anchor = renderer.querySelector('a.ytLockupMetadataViewModelTitle');
  let title  = renderer.querySelector('h3[title]')?.getAttribute('title');

  if (!anchor) {
    anchor = renderer.querySelector('a#video-title');
    title  = title || anchor?.getAttribute('title');
  }
  if (!anchor) return null;

  title = (title || anchor.textContent || '').trim();

  const href  = anchor.getAttribute('href') || '';
  const match = href.match(/[?&]v=([^&]+)/);
  if (!match) return null;

  return { title, url: `https://www.youtube.com/watch?v=${match[1]}` };
}

function extractVideos() {
  const renderers = document.querySelectorAll(ITEM_SELECTOR);
  const seen = new Set();
  const videos = [];

  for (const renderer of renderers) {
    const item = extractOne(renderer);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    videos.push(item);
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

}
