import { I18N } from './i18n.js';
import { store, loadLang, saveLang, loadFmt, saveFmt } from './storage.js';
import { isPlaylistUrl, normalizeUrl, cleanPlaylistUrl } from './url.js';
import { extractFromTab, pollForResult, watchProgress } from './messaging.js';

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
const fmtLabel          = document.getElementById('fmt-label');
const fmtSelect         = document.getElementById('fmt-select');
const btnCopy           = document.getElementById('btn-copy');
const copyLabel         = document.getElementById('copy-label');
const btnDownload       = document.getElementById('btn-download');
const downloadLabel     = document.getElementById('download-label');
const btnReset          = document.getElementById('btn-reset');
const resetLabel        = document.getElementById('reset-label');

// ── State ─────────────────────────────────────────────────────────────────────
let videosData    = [];
let currentFmt    = 'full';
let playlistTitle = '';       // last known real title, used for the download filename
let t             = I18N.en;
let onPlaylist    = false;

// ── Language ──────────────────────────────────────────────────────────────────
function applyLang(lang) {
  t = I18N[lang];
  document.documentElement.lang = lang;
  langOpts.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));

  btnHelp.title          = t.helpTitle;
  urlInput.placeholder   = t.urlPlaceholder;
  btnLabel.textContent   = t.btnExtract;
  fmtLabel.textContent   = t.formatLabel;
  copyLabel.textContent  = t.btnCopy;
  downloadLabel.textContent = t.btnDownload;
  resetLabel.textContent = t.btnReset;
  tutorialList.innerHTML = t.tutorial.map(s => `<li>${s}</li>`).join('');

  const fmtNames = {
    full:       t.fmtFull,
    notebooklm: t.fmtNotebookLM,
    markdown:   t.fmtMarkdown,
    csv:        t.fmtCsv,
    json:       t.fmtJson,
  };
  for (const opt of fmtSelect.options) opt.textContent = fmtNames[opt.value] ?? opt.value;

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
  if (title) playlistTitle = title;
  showPlaylistTitle(title || t.titleUnknown);
}

// ── Status & loading ──────────────────────────────────────────────────────────
function setStatusText(text, type = '') {
  statusMsg.textContent = text;
  statusMsg.className   = type;
}

function setStatus(key, type = '') {
  setStatusText(t[key] ?? key, type);
}

function setLoading(on) {
  btnExtract.disabled   = on;
  spinner.style.display = on ? 'block' : 'none';
  btnLabel.textContent  = on ? t.btnExtracting : t.btnExtract;
}

// ── Output builders ───────────────────────────────────────────────────────────
const buildFull       = vs => vs.map(({ title, url }) => `//${title}\n${url}`).join('\n');
const buildNotebookLM = vs => vs.map(({ url }) => url).join('\n');
const buildMarkdown   = vs => vs.map(({ title, url }) => `- [${title}](${url})`).join('\n');
const buildJson       = vs => JSON.stringify(vs, null, 2);

// RFC 4180: quote fields containing comma, quote or newline; double up inner quotes.
const csvField = v => /[",\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const buildCsv = vs =>
  ['title,url', ...vs.map(({ title, url }) => `${csvField(title)},${csvField(url)}`)].join('\n');

const BUILDERS = {
  full:       { build: buildFull,       ext: 'txt',  mime: 'text/plain'       },
  notebooklm: { build: buildNotebookLM, ext: 'txt',  mime: 'text/plain'       },
  markdown:   { build: buildMarkdown,   ext: 'md',   mime: 'text/markdown'    },
  csv:        { build: buildCsv,        ext: 'csv',  mime: 'text/csv'         },
  json:       { build: buildJson,       ext: 'json', mime: 'application/json' },
};

const currentBuilder = () => BUILDERS[currentFmt] ?? BUILDERS.full;

function renderOutput() {
  output.value = currentBuilder().build(videosData);
}

function showResults(videos) {
  videosData = videos;
  countLabel.textContent = videos.length === 1 ? t.countOne : t.countMany(videos.length);
  renderOutput();
  resultsSection.style.display = 'flex';
  btnCopy.classList.add('visible');
  btnDownload.classList.add('visible');
}

// ── Button feedback ───────────────────────────────────────────────────────────
function flashLabel(btn, labelEl, msg) {
  const orig = labelEl.textContent;
  labelEl.textContent = msg;
  btn.classList.add('copied');
  setTimeout(() => { labelEl.textContent = orig; btn.classList.remove('copied'); }, 2000);
}

// Turn a playlist title into a safe filename; falls back to 'playlist'.
function sanitizeFilename(name) {
  const clean = (name || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  return clean || 'playlist';
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const lang = await loadLang();
  applyLang(lang);

  currentFmt      = await loadFmt();
  fmtSelect.value = currentFmt;

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

  fmtSelect.addEventListener('change', () => {
    currentFmt = fmtSelect.value;
    saveFmt(currentFmt);
    if (videosData.length) renderOutput();
  });

  btnCopy.addEventListener('click', async () => {
    const text = currentBuilder().build(videosData);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    flashLabel(btnCopy, copyLabel, t.copied);
  });

  btnDownload.addEventListener('click', () => {
    if (!videosData.length) return;
    const { build, ext, mime } = currentBuilder();
    const text = build(videosData);
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a   = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(playlistTitle)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flashLabel(btnDownload, downloadLabel, t.downloaded);
  });

  btnReset.addEventListener('click', async () => {
    videosData = [];
    output.value = '';
    resultsSection.style.display = 'none';
    btnCopy.classList.remove('visible');
    btnDownload.classList.remove('visible');
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
        const stopProgress = watchProgress(p => setStatusText(t.statusScrolling(p.loaded, p.total)));
        try {
          const state  = await pollForResult();
          const videos = state.videos || [];
          videos.length === 0
            ? setStatus('statusEmpty', 'error')
            : (setStatus('statusDone', 'success'), showResults(videos));
        } catch {
          setStatus('statusPrevFailed', 'error');
          await store.remove('extractState');
        } finally {
          stopProgress();
          setLoading(false);
          btnExtract.disabled = !isPlaylistUrl(normalizeUrl(urlInput.value));
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
    btnCopy.classList.remove('visible');
    btnDownload.classList.remove('visible');

    const stopProgress = watchProgress(p => setStatusText(t.statusScrolling(p.loaded, p.total)));

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

      if (titleFromResponse) { playlistTitle = titleFromResponse; showPlaylistTitle(titleFromResponse); }

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
      stopProgress();
      setLoading(false);
      btnExtract.disabled = !isPlaylistUrl(normalizeUrl(urlInput.value));
    }
  });
}

init().catch(() => { btnExtract.disabled = false; });
