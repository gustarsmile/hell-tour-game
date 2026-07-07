import { WU_CAP } from './config.js';

export const AXES = ['honesty', 'speech', 'filial', 'mercy'];
export const AXIS_LABELS = { honesty: '誠實', speech: '口業', filial: '孝道', mercy: '慈悲' };

const SAVE_KEY = 'hellTourSave.v1';

export function createState() {
  return {
    wu: 0,
    karma: { honesty: 0, speech: 0, filial: 0, mercy: 0 },
    progress: { screen: 'prologue' },
  };
}

export function addWu(state, pts) {
  state.wu = Math.max(0, Math.min(WU_CAP, state.wu + pts));
  return state.wu;
}

export function recordKarma(state, axis, delta, weight = 1) {
  if (!AXES.includes(axis)) throw new Error(`未知的心性軸：${axis}`);
  state.karma[axis] += delta * weight;
}

export function karmaSum(state) {
  return AXES.reduce((sum, a) => sum + state.karma[a], 0);
}

export function karmaVerdict(state) {
  return karmaSum(state) >= 0 ? 'good' : 'bad';
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  const base = createState();
  return {
    ...base,
    ...raw,
    karma: { ...base.karma, ...(raw.karma ?? {}) },
    progress: { ...base.progress, ...(raw.progress ?? {}) },
  };
}

function safeStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function save(state, storage) {
  try {
    const s = safeStorage(storage);
    if (s) s.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* 存檔失敗不影響遊玩 */
  }
}

export function load(storage) {
  try {
    const s = safeStorage(storage);
    const json = s ? s.getItem(SAVE_KEY) : null;
    return json ? deserialize(json) : null;
  } catch {
    clearSave(storage);
    return null;
  }
}

export function clearSave(storage) {
  try {
    const s = safeStorage(storage);
    if (s) s.removeItem(SAVE_KEY);
  } catch {
    /* 忽略 */
  }
}
