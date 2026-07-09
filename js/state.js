import { WU_CAP, KARMA_PENALTY, PROLOGUE_ID, DEFAULT_MODE } from './config.js';

export const AXES = ['honesty', 'speech', 'filial', 'mercy'];
export const AXIS_LABELS = { honesty: '誠實', speech: '口業', filial: '孝道', mercy: '慈悲' };

const SAVE_KEY = 'hellTourSave.v3';
const V2_SAVE_KEY = 'hellTourSave.v2'; // v2 可遷移：wu 併入單一桶、choices 依 scene 前綴補 screen
const LEGACY_SAVE_KEYS = ['hellTourSave.v1']; // v1 無選擇紀錄，孽鏡反照無從回放，直接淘汰

export function createState(mode = DEFAULT_MODE) {
  return {
    mode,
    wuMax: 0, // 該模式滿分，流程層依畫面清單推算（每次啟動重算，不信任舊存檔）
    wuByScreen: {},
    choices: [],
    progress: { screen: PROLOGUE_ID },
  };
}

// 分殿記分：重玩／跳殿時整殿重置再重算，杜絕重複灌分
export function creditWu(state, screenId, pts) {
  state.wuByScreen[screenId] = (state.wuByScreen[screenId] ?? 0) + pts;
  return state.wuByScreen[screenId];
}

export function resetScreen(state, screenId) {
  delete state.wuByScreen[screenId];
  state.choices = state.choices.filter((c) => c.screen !== screenId);
}

export function rawWu(state) {
  return Object.values(state.wuByScreen).reduce((s, v) => s + v, 0);
}

export function recordChoice(state, { screen, scene, label = null, text, axis, delta, weight = 1 }) {
  if (!AXES.includes(axis)) throw new Error(`未知的心性軸：${axis}`);
  state.choices.push({ screen, scene, label, text, axis, delta, weight });
}

export function karmaByAxis(state) {
  const karma = { honesty: 0, speech: 0, filial: 0, mercy: 0 };
  for (const c of state.choices) karma[c.axis] += c.delta * c.weight;
  return karma;
}

export function karmaSum(state) {
  return state.choices.reduce((s, c) => s + c.delta * c.weight, 0);
}

export function karmaVerdict(state) {
  return karmaSum(state) >= 0 ? 'good' : 'bad';
}

// 心性扣分：每一筆惡選依權重扣 KARMA_PENALTY 分（序章權重 2 → 一筆扣 8）
export function karmaPenalty(state) {
  return state.choices
    .filter((c) => c.delta < 0)
    .reduce((s, c) => s + Math.abs(c.delta) * c.weight * KARMA_PENALTY, 0);
}

// 悟性值＝答題得分佔該模式滿分的百分比，再扣心性分
export function finalWu(state) {
  const raw = rawWu(state);
  const scaled = state.wuMax > 0 ? Math.round((raw / state.wuMax) * WU_CAP) : Math.min(raw, WU_CAP);
  return Math.max(0, Math.min(WU_CAP, scaled - karmaPenalty(state)));
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  const base = createState(raw.mode);
  return {
    ...base,
    ...raw,
    wuByScreen: { ...(raw.wuByScreen ?? {}) },
    choices: Array.isArray(raw.choices) ? raw.choices : [],
    progress: { ...base.progress, ...(raw.progress ?? {}) },
  };
}

// v2 → v3：wu 無法回溯分殿，整筆放進 _v2 桶；choices 依 scene id 前綴補 screen 欄位
function migrateV2(json) {
  const raw = JSON.parse(json);
  const state = createState();
  if (typeof raw.wu === 'number' && raw.wu > 0) state.wuByScreen._v2 = raw.wu;
  if (Array.isArray(raw.choices)) {
    state.choices = raw.choices.map((c) => ({
      screen: c.scene === PROLOGUE_ID ? PROLOGUE_ID : (c.scene?.match(/^hall\d+/)?.[0] ?? '_v2'),
      ...c,
    }));
  }
  state.progress = { screen: raw.progress?.screen ?? PROLOGUE_ID };
  return state;
}

export function safeStorage(storage) {
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
    if (!s) return null;
    for (const k of LEGACY_SAVE_KEYS) s.removeItem(k);
    const json = s.getItem(SAVE_KEY);
    if (json) return deserialize(json);
    const v2 = s.getItem(V2_SAVE_KEY);
    if (v2) {
      const state = migrateV2(v2);
      s.removeItem(V2_SAVE_KEY);
      save(state, s);
      return state;
    }
    return null;
  } catch {
    clearSave(storage);
    return null;
  }
}

export function clearSave(storage) {
  try {
    const s = safeStorage(storage);
    if (s) {
      s.removeItem(SAVE_KEY);
      s.removeItem(V2_SAVE_KEY);
    }
  } catch {
    /* 忽略 */
  }
}
