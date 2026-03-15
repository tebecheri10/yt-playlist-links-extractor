import { I18N } from './i18n.js';
import { store, loadLang, saveLang } from './storage.js';
import { isPlaylistUrl, normalizeUrl, cleanPlaylistUrl } from './url.js';
import { extractFromTab, pollForResult } from './messaging.js';

// ── DOM elements ──────────────────────────────────────────────────────────────
const btnHelp           = document.getElementById('btn-help');
const tutorialPanel     = document.getElementById('tutorial-panel');
const tutorialList      = document.getElementById('tutorial-list');
const langOpts          = document.querySelectorAll('.lang-opt');
const playlistPreview   = document.getElementById('playlist-preview');
const playlistTitleText = document.getElementById('playlist-title-text');
const urlInput          = document.getElementById('url-input');
const urlLabel          = document.getElementById('url-label');
const orLabel           = document.getElementById('or-label');
const statusMsg         = document.getElementById('status-msg');
const btnExtract        = document.getElementById('btn-extract');
const btnLabel          = document.getElementById('btn-label');
const spinner           = document.getElementById('spinner');
const resultsSection    = document.getElementById('results-section');
const countLabel        = document.getElementById('count-label');
const output            = document.getElementById('output');
const fmtFull           = document.getElementById('fmt-full');
const fmtBtns           = document.querySelectorAll('.fmt-btn');
const btnCopyFull       = document.getElementById('btn-copy-full');
const btnCopyNlm        = document.getElementById('btn-copy-nlm');
const copyFullLabel     = document.getElementById('copy-full-label');
const copyNlmLabel      = document.getElementById('copy-nlm-label');
const btnReset          = document.getElementById('btn-reset');
const resetLabel        = document.getElementById('reset-label');

// ── State ─────────────────────────────────────────────────────────────────────
let videosData = [];
let currentFmt = 'full';
let t          = I18N.en;
let onPlaylist = false;

// ── Language ──────────────────────────────────────────────────────────────────
function applyLang(lang) {
  t = I18N[lang];
  document.documentElement.lang = lang;
  langOpts.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));

  btnHelp.title             = t.helpTitle;
  urlInput.placeholder      = t.urlPlaceholder;
  btnLabel.textContent      = t.btnExtract;
  fmtFull.textContent       = t.fmtFull;
  copyFullLabel.textContent = t.copyFull;
  copyNlmLabel.textContent  = t.copyNlm;
  resetLabel.textContent    = t.btnReset;
  tutorialList.innerHTML    = t.tutorial.map(s => `<li>${s}</li>`).join('');

  updateUrlAreaLabels();

  if (videosData.length) {
    countLabel.textContent = videosData.length === 1 ? t.countOne : t.countMany(videosData.length);
  }
}

function updateUrlAreaLabels() {
  if (onPlaylist && urlInput.value) {
    urlLabel.textContent  = t.urlLabelDetected;
    orLabel.textContent   = t.urlLabelOr;
    orLabel.style.display = 'block';
  } else {
    urlLabel.textContent  = t.urlLabelEmpty;
    orLabel.style.display = 'none';
  }
}

// ── Playlist title ────────────────────────────────────────────────────────────
function showPlaylistTitle(title) {
  playlistTitleText.textContent = title || t.titleUnknown;
  playlistPreview.style.display = 'flex';
}

function hidePlaylistTitle() {
  playlistPreview.style.display = 'none';
  playlistTitleText.textContent = '';
}

async function fetchPlaylistTitle(url) {
  try {
    // credentials:'include' sends user cookies so YouTube returns the real page
    const res  = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const html = await res.text();
    const m    = html.match(/<title>([^<]+)<\/title>/i);
    if (!m) return null;
    const title = m[1].replace(/ - YouTube$/i, '').trim();
    return title && title.toLowerCase() !== 'youtube' ? title : null;
  } catch { return null; }
}

function titleFromTab(tab) {
  // chrome.tabs already exposes tab.title — no messaging needed
  if (!tab?.title) return null;
  const title = tab.title.replace(/ - YouTube$/i, '').trim();
  return title && title.toLowerCase() !== 'youtube' ? title : null;
}

async function loadAndShowTitle(url, tab = null) {
  showPlaylistTitle(t.titleLoading);
  const title = titleFromTab(tab) || await fetchPlaylistTitle(url);
  showPlaylistTitle(title || t.titleUnknown);
}

// ── Status & loading ──────────────────────────────────────────────────────────
function setStatus(key, type = '') {
  statusMsg.textContent = t[key] ?? key;
  statusMsg.className   = type;
}

function setLoading(on) {
  btnExtract.disabled   = on;
  spinner.style.display = on ? 'block' : 'none';
  btnLabel.textContent  = on ? t.btnExtracting : t.btnExtract;
}

// ── Output builders ───────────────────────────────────────────────────────────
const buildFull       = vs => vs.map(({ title, url }) => `//${title}\n${url}`).join('\n');
const buildNotebookLM = vs => vs.map(({ url }) => url).join('\n');

function renderOutput() {
  output.value = currentFmt === 'full' ? buildFull(videosData) : buildNotebookLM(videosData);
}

function showResults(videos) {
  videosData = videos;
  countLabel.textContent = videos.length === 1 ? t.countOne : t.countMany(videos.length);
  renderOutput();
  resultsSection.style.display = 'flex';
  btnCopyFull.classList.add('visible');
  btnCopyNlm.classList.add('visible');
}

// ── Copy handler ──────────────────────────────────────────────────────────────
function makeCopyHandler(btn, labelEl, getText) {
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    const orig = labelEl.textContent;
    labelEl.textContent = t.copied;
    btn.classList.add('copied');
    setTimeout(() => { labelEl.textContent = orig; btn.classList.remove('copied'); }, 2000);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const lang = await loadLang();
  applyLang(lang);

  btnExtract.disabled = true;
  setStatus('statusDefault');

  langOpts.forEach(btn => btn.addEventListener('click', () => {
    applyLang(btn.dataset.lang);
    saveLang(btn.dataset.lang);
  }));

  btnHelp.addEventListener('click', () => {
    const open = tutorialPanel.classList.toggle('open');
    btnHelp.classList.toggle('active', open);
  });

  fmtBtns.forEach(btn => btn.addEventListener('click', () => {
    fmtBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFmt = btn.dataset.fmt;
    if (videosData.length) renderOutput();
  }));

  makeCopyHandler(btnCopyFull, copyFullLabel, () => buildFull(videosData));
  makeCopyHandler(btnCopyNlm,  copyNlmLabel,  () => buildNotebookLM(videosData));

  btnReset.addEventListener('click', async () => {
    videosData = [];
    output.value = '';
    resultsSection.style.display = 'none';
    btnCopyFull.classList.remove('visible');
    btnCopyNlm.classList.remove('visible');
    await store.remove('extractState');

    const val = normalizeUrl(urlInput.value);
    if (isPlaylistUrl(val)) {
      setStatus('statusValidUrl', 'success');
    } else if (onPlaylist) {
      setStatus('statusDetected', 'success');
    } else {
      setStatus('statusDefault');
    }
  });

  // ── Detect current tab ────────────────────────────────────────────────────
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab  = tab || null;
    onPlaylist = isPlaylistUrl(activeTab?.url || '');
  } catch {}

  if (onPlaylist) {
    const clean = cleanPlaylistUrl(activeTab.url);
    urlInput.value      = clean;
    btnExtract.disabled = false;
    setStatus('statusDetected', 'success');
    updateUrlAreaLabels();
    loadAndShowTitle(clean, activeTab);
  } else {
    updateUrlAreaLabels();
    setStatus('statusDefault');
  }

  // ── Resume in-progress or recent extraction from storage ──────────────────
  try {
    const { extractState } = await store.get('extractState');

    if (extractState?.status === 'done' && extractState.videos?.length > 0) {
      const age = Date.now() - (extractState.timestamp || 0);
      if (age < 5 * 60 * 1000) {
        setStatus('statusPrevResult', 'success');
        showResults(extractState.videos);
      }
    } else if (extractState?.status === 'loading') {
      const age = Date.now() - (extractState.startedAt || 0);
      if (age < 3 * 60 * 1000) {
        setStatus('statusWaiting');
        setLoading(true);
        try {
          const state  = await pollForResult();
          const videos = state.videos || [];
          setLoading(false);
          btnExtract.disabled = !isPlaylistUrl(normalizeUrl(urlInput.value));
          videos.length === 0
            ? setStatus('statusEmpty', 'error')
            : (setStatus('statusDone', 'success'), showResults(videos));
        } catch {
          setLoading(false);
          btnExtract.disabled = !isPlaylistUrl(normalizeUrl(urlInput.value));
          setStatus('statusPrevFailed', 'error');
          await store.remove('extractState');
        }
      } else {
        await store.remove('extractState');
      }
    }
  } catch {}

  // ── URL input ─────────────────────────────────────────────────────────────
  let titleDebounce = null;

  urlInput.addEventListener('input', () => {
    const val   = normalizeUrl(urlInput.value);
    const valid = isPlaylistUrl(val);
    btnExtract.disabled = !valid;

    if (urlInput.value.length === 0) {
      hidePlaylistTitle();
      setStatus(onPlaylist ? 'statusDetected' : 'statusDefault', onPlaylist ? 'success' : '');
      if (onPlaylist) {
        urlInput.value      = cleanPlaylistUrl(activeTab.url);
        btnExtract.disabled = false;
        loadAndShowTitle(urlInput.value, activeTab);
      }
    } else if (valid) {
      setStatus('statusValidUrl', 'success');
      clearTimeout(titleDebounce);
      titleDebounce = setTimeout(() => loadAndShowTitle(val), 600);
    } else {
      hidePlaylistTitle();
      setStatus('statusInvalidUrl', 'error');
    }
  });

  // ── Extract button ────────────────────────────────────────────────────────
  btnExtract.addEventListener('click', async () => {
    const targetUrl = normalizeUrl(urlInput.value.trim());
    if (!isPlaylistUrl(targetUrl)) { setStatus('statusNoTarget', 'error'); return; }

    let clickTab = activeTab;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      clickTab = tab || activeTab;
    } catch {}

    const sameTab = cleanPlaylistUrl(clickTab?.url || '') === targetUrl && isPlaylistUrl(targetUrl);

    setLoading(true);
    resultsSection.style.display = 'none';
    btnCopyFull.classList.remove('visible');
    btnCopyNlm.classList.remove('visible');

    try {
      let videos, titleFromResponse;

      if (sameTab && clickTab) {
        setStatus('statusExtracting');
        const res         = await extractFromTab(clickTab.id);
        videos            = res.videos;
        titleFromResponse = res.title;
      } else {
        await store.set({ extractState: { status: 'loading', startedAt: Date.now() } });
        chrome.runtime.sendMessage({ action: 'openAndExtract', url: targetUrl, originalTabId: clickTab?.id });
        setStatus('statusOpening');
        try {
          const state = await pollForResult();
          videos      = state.videos || [];
        } catch {
          setStatus('statusWaiting');
          return;
        }
      }

      if (titleFromResponse) showPlaylistTitle(titleFromResponse);

      videos.length === 0
        ? setStatus('statusEmpty', 'error')
        : (setStatus('statusDone', 'success'), showResults(videos));

    } catch (err) {
      const msg = err?.message || '';
      setStatus(
        msg.includes('Could not establish connection') || msg.includes('Receiving end does not exist')
          ? 'statusReload'
          : msg,
        'error'
      );
    } finally {
      setLoading(false);
      btnExtract.disabled = !isPlaylistUrl(normalizeUrl(urlInput.value));
    }
  });
}

init().catch(() => { btnExtract.disabled = false; });
