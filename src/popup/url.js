export function isPlaylistUrl(url) {
  try { const u = new URL(url); return u.hostname.includes('youtube.com') && u.searchParams.has('list'); }
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
