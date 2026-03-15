const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrollToLoadAll() {
  const MAX_ITERATIONS = 60;
  const WAIT_MS = 900;
  let staleCount = 0;
  let lastCount = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const sentinel = document.querySelector('ytd-continuation-item-renderer');
    if (!sentinel) break;

    const current = document.querySelectorAll('ytd-playlist-video-renderer').length;

    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await wait(WAIT_MS);

    const next = document.querySelectorAll('ytd-playlist-video-renderer').length;

    if (next === lastCount) {
      staleCount++;
      if (staleCount >= 3) break;
    } else {
      staleCount = 0;
      lastCount = next;
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
      await scrollToLoadAll();
      const videos = extractVideos();
      sendResponse({ videos, title: getPlaylistTitle() });
    })();
    return true;
  }
});
