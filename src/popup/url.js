export function isPlaylistUrl(url) {
  try { const u = new URL(url); return u.hostname.includes('youtube.com') && u.searchParams.has('list'); }
  catch { return false; }
}

// True only for an actual /playlist page — not a /watch page that merely has
// a playlist sidebar (list= param). Video pages never get our content script
// injected via the manifest, and YouTube's SPA can leave stale DOM elements
// from a previously visited playlist behind, so we must not extract in-place
// from a /watch tab — the caller should open the real /playlist page instead.
export function isPlaylistPage(url) {
  try { const u = new URL(url); return u.hostname.includes('youtube.com') && u.pathname === '/playlist' && u.searchParams.has('list'); }
  catch { return false; }
}

export function normalizeUrl(raw) {
  const s = raw.trim();
  if (/^(PL|RD|FL|UU|LL|WL)/.test(s)) return `https://www.youtube.com/playlist?list=${s}`;
  return s;
}

export function cleanPlaylistUrl(url) {
  try { const u = new URL(url); return `https://www.youtube.com/playlist?list=${u.searchParams.get('list')}`; }
  catch { return url; }
}
