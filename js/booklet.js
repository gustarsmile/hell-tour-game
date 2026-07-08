import { safeStorage } from './state.js';

const BOOKLET_KEY = 'hellTourBooklet.v1'; // 跨輪保留：重新開始不清除，重玩可補完

export function loadBooklet(storage) {
  try {
    const s = safeStorage(storage);
    const json = s ? s.getItem(BOOKLET_KEY) : null;
    const arr = json ? JSON.parse(json) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function addCard(id, storage) {
  const owned = loadBooklet(storage);
  if (!owned.includes(id)) {
    owned.push(id);
    try {
      const s = safeStorage(storage);
      if (s) s.setItem(BOOKLET_KEY, JSON.stringify(owned));
    } catch {
      /* 寫入失敗不影響遊玩 */
    }
  }
  return owned;
}
