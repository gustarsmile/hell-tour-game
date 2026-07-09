// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { startGame } from '../js/flow.js';
import { createState, save, load, finalWu, rawWu } from '../js/state.js';
import { endingKey } from '../js/engine/finale.js';
import { loadBooklet } from '../js/booklet.js';
import { GAME_TITLE } from '../js/config.js';

const modules = import.meta.glob('../js/data/*.json', { eager: true });
const FILES = {};
for (const [path, mod] of Object.entries(modules)) {
  FILES[path.replace('../js/', 'js/')] = mod.default;
}
const flowData = FILES['js/data/flow.json'];
const hall10 = FILES['js/data/hall10.json'];

const loadJSON = async (p) => {
  if (!(p in FILES)) throw new Error(`missing ${p}`);
  return structuredClone(FILES[p]);
};

function fakeStorage() {
  const data = {};
  return {
    setItem: (k, v) => { data[k] = String(v); },
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => { delete data[k]; },
  };
}

function resourceOf(screenId) {
  const scr = flowData.screens.find((s) => s.id === screenId);
  return scr?.src ? FILES[`js/data/${scr.src}`] : null;
}

// 由資料推導完美通關的期望原始分與滿分：判案殿 30、考題殿 5、支線 rewardWu
// evil 模式：判案殿勸化選最末（0 分），故判案殿每殿 20（spot 10 + judge 10）
function expectedRaw(screens, { acceptBranch, evil = false }) {
  let raw = 0, max = 0;
  for (const scr of screens) {
    const data = resourceOf(scr.id);
    if (!data) continue;
    if (scr.type === 'trial') { max += 30; raw += evil ? 20 : 30; }
    if (scr.type === 'visit' && data.quiz) { max += 5; raw += 5; }
    if (scr.type === 'visit' && data.branch) {
      max += data.branch.rewardWu;
      if (acceptBranch) raw += data.branch.rewardWu;
    }
  }
  return { raw, max };
}

function autoplay(root, storage, { acceptBranch = true, evil = false } = {}) {
  for (let i = 0; i < 3000; i++) {
    if (root.querySelector('.finale-end')) return;
    const saved = load(storage);
    const data = saved ? resourceOf(saved.progress.screen) : null;

    const accept = root.querySelector('.btn-accept');
    if (accept) {
      (acceptBranch ? accept : root.querySelector('.btn-decline')).click();
      continue;
    }
    const spotLines = root.querySelectorAll('.testimony-line.clickable');
    if (spotLines.length) {
      const idx = data.testimony
        .map((s, j) => (s.lie ? j : -1)).filter((j) => j >= 0)
        .find((j) => !spotLines[j].classList.contains('found'));
      spotLines[idx].click();
      continue;
    }
    const next = root.querySelector('.btn-next');
    if (next) { next.click(); continue; } // 封面「完整遊歷」亦為 btn-next，自動走完整版

    const choices = root.querySelectorAll('.btn-choice');
    if (choices.length) {
      let idx = 0;
      if (root.querySelector('.opt-name')) idx = data.judgement.answer;
      else if (root.querySelector('.visit-box') && data.quiz) idx = data.quiz.answer;
      else if (evil) idx = choices.length - 1; // 道德選擇全選最惡（末選項慣例）
      choices[idx].click();
      continue;
    }
    throw new Error(`autoplay 卡住於第 ${i} 步（screen=${saved?.progress.screen}）`);
  }
  throw new Error('autoplay 超過步數上限');
}

describe('全流程整合（flow manifest）', () => {
  it('入口封面：無存檔顯示完整／精簡兩版，不顯示續玩', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    expect(document.title).toBe(GAME_TITLE);
    expect(root.textContent).toContain('完整遊歷');
    expect(root.textContent).toContain('精簡速覽');
    expect(root.textContent).not.toContain('繼續旅程');
  });

  it('通關後存檔含序章四筆選擇紀錄（label、權重×2、screen 欄位）', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true });
    const pro = load(storage).choices.filter((c) => c.screen === 'prologue');
    expect(pro.length).toBe(4);
    for (const c of pro) {
      expect(c.weight).toBe(2);
      expect(c.delta).toBe(1); // autoplay 全選最善
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('完美通關（接受支線）：悟性 100，highGood；重新開始回封面再入序章', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true });
    const { raw, max } = expectedRaw(flowData.screens, { acceptBranch: true });
    const s = load(storage);
    expect(rawWu(s)).toBe(raw);
    expect(s.wuMax).toBe(max);
    expect(finalWu(s)).toBe(100); // 全對全善 → 滿分
    expect(root.textContent).toContain('悟性值 100');
    expect(root.textContent).toContain('大覺大悟·代天宣化'); // highGood
    // 重新開始 → 回封面 → 選完整遊歷 → 序章第一句
    [...root.querySelectorAll('button')].find((b) => b.textContent === '重新開始').click();
    expect(root.textContent).toContain('完整遊歷');
    [...root.querySelectorAll('button')].find((b) => b.textContent.includes('完整遊歷')).click();
    expect(root.textContent).toContain(FILES['js/data/prologue.json'].nodes[0].text);
  });

  it('婉拒支線：悟性依滿分折算', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: false });
    const { raw, max } = expectedRaw(flowData.screens, { acceptBranch: false });
    const wu = Math.round((raw / max) * 100);
    expect(root.textContent).toContain(`悟性值 ${wu}`);
  });

  it('惡向通關：答題高分仍遭心性扣分，結局與 endingKey 一致', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true, evil: true });
    const s = load(storage);
    const { raw } = expectedRaw(flowData.screens, { acceptBranch: true, evil: true });
    expect(rawWu(s)).toBe(raw);
    const wu = finalWu(s);
    expect(wu).toBeLessThan(70); // 一路作惡 → 扣到低悟性象限
    expect(root.textContent).toContain(`悟性值 ${wu}`);
    expect(root.textContent).toContain(hall10.endings[endingKey(s)].title);
    expect(root.textContent).toContain('執迷不悟·輪迴重修'); // lowBad
    const pro = s.choices.filter((c) => c.screen === 'prologue');
    expect(pro.length).toBe(4);
    for (const c of pro) expect(c.delta).toBe(-1);
  });

  it('精簡速覽：只走精選殿，悟性依精簡滿分折算', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    [...root.querySelectorAll('button')].find((b) => b.textContent.includes('精簡速覽')).click();
    autoplay(root, storage, { acceptBranch: true });
    const liteScreens = flowData.modes.lite.map((id) => flowData.screens.find((x) => x.id === id));
    const { raw, max } = expectedRaw(liteScreens, { acceptBranch: true });
    const s = load(storage);
    expect(s.mode).toBe('lite');
    expect(s.wuMax).toBe(max);
    expect(rawWu(s)).toBe(raw);
    expect(root.textContent).toContain('悟性值 100'); // 全對全善照樣滿分
  });

  it('有存檔時封面顯示續玩，繼續從該畫面開始', async () => {
    const storage = fakeStorage();
    const s = createState();
    s.progress.screen = 'hall1';
    save(s, storage);
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    expect(root.textContent).toContain('繼續旅程');
    [...root.querySelectorAll('button')].find((b) => b.textContent === '繼續旅程').click();
    expect(root.textContent).toContain(FILES['js/data/hall1.json'].intro[0].text);
  });

  it('有存檔仍可直接選「完整遊歷」重新開始 → 序章且存檔重置', async () => {
    const storage = fakeStorage();
    const s = createState();
    s.progress.screen = 'hall3';
    save(s, storage);
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    [...root.querySelectorAll('button')].find((b) => b.textContent.includes('完整遊歷')).click();
    expect(root.textContent).toContain(FILES['js/data/prologue.json'].nodes[0].text);
    expect(load(storage).progress.screen).toBe('prologue');
  });

  it('存檔畫面 id 不在流程清單（舊版存檔）→ 封面不顯示續玩', async () => {
    const storage = fakeStorage();
    const s = createState();
    s.progress.screen = 'card'; // 階段1的畫面 id，已不存在
    save(s, storage);
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    expect(root.textContent).not.toContain('繼續旅程');
    expect(root.textContent).toContain('完整遊歷');
  });

  it('通關收滿因果卡入善書冊，重新開始後冊仍保留', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true });
    const cardScreens = flowData.screens
      .filter((s) => resourceOf(s.id)?.karmaCard).map((s) => s.id);
    expect([...loadBooklet(storage)].sort()).toEqual([...cardScreens].sort());
    [...root.querySelectorAll('button')].find((b) => b.textContent === '重新開始').click();
    expect([...loadBooklet(storage)].sort()).toEqual([...cardScreens].sort());
  });
});

describe('枉死城支線功德', () => {
  const miniFlow = {
    screens: [
      { id: 'hall6', type: 'visit', src: 'hall6.json' },
      { id: 'hall10', type: 'finale', src: 'hall10.json' },
    ],
  };
  const miniLoad = async (p) =>
    p === 'js/data/flow.json' ? structuredClone(miniFlow) : loadJSON(p);

  it('接受並完成支線 → 隱藏功德入帳（迷你流程滿分即支線分）', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON: miniLoad, storage });
    autoplay(root, storage, { acceptBranch: true });
    expect(rawWu(load(storage))).toBe(10);
    expect(root.textContent).toContain('悟性值 100'); // 10／滿分10 折算
  });
  it('婉拒支線 → 0 分', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON: miniLoad, storage });
    autoplay(root, storage, { acceptBranch: false });
    expect(root.textContent).toContain('悟性值 0');
  });
});
