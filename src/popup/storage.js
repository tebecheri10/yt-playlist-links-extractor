export const store = {
  async get(key)    { if (!chrome?.storage?.local) return {}; try { return await chrome.storage.local.get(key); } catch { return {}; } },
  async set(data)   { if (!chrome?.storage?.local) return;    try { await chrome.storage.local.set(data); }          catch {} },
  async remove(key) { if (!chrome?.storage?.local) return;    try { await chrome.storage.local.remove(key); }        catch {} },
};

export function detectSystemLang() {
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export async function loadLang()     { const { lang } = await store.get('lang'); return lang || detectSystemLang(); }
export async function saveLang(lang) { await store.set({ lang }); }

export async function loadFmt()    { const { fmt } = await store.get('fmt'); return fmt || 'full'; }
export async function saveFmt(fmt) { await store.set({ fmt }); }

export async function loadJsonIncludeId()        { const { jsonIncludeId } = await store.get('jsonIncludeId'); return !!jsonIncludeId; }
export async function saveJsonIncludeId(include) { await store.set({ jsonIncludeId: include }); }
