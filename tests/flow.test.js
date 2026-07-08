// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { startGame } from '../js/flow.js';
import { createState, save, load } from '../js/state.js';
import { loadBooklet } from '../js/booklet.js';
import { GAME_TITLE } from '../js/config.js';

const modules = import.meta.glob('../js/data/*.json', { eager: true });
const FILES = {};
for (const [path, mod] of Object.entries(modules)) {
  FILES[path.replace('../js/', 'js/')] = mod.default;
}
const flowData = FILES['js/data/flow.json'];

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

// 由資料推導完美通關的期望悟性值：判案殿 30、考題殿 5、支線 rewardWu
// evil 模式：判案殿勸化選最末（0 分），故判案殿每殿 20（spot 10 + judge 10）
function expectedWu({ acceptBranch, evil = false }) {
  let wu = 0;
  for (const scr of flowData.screens) {
    const data = resourceOf(scr.id);
    if (!data) continue;
    if (scr.type === 'trial') wu += evil ? 20 : 30;
    if (scr.type === 'visit' && data.quiz) wu += 5;
    if (scr.type === 'visit' && data.branch && acceptBranch) wu += data.branch.rewardWu;
  }
  return Math.min(100, wu);
}

function autoplay(root, storage, { acceptBranch = true, evil = false } = {}) {
  for (let i = 0; i < 2000; i++) {
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
    if (next) { next.click(); continue; }

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
  it('通關後存檔含序章四筆選擇紀錄（label、權重×2）', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true });
    const pro = load(storage).choices.filter((c) => c.scene === 'prologue');
    expect(pro.length).toBe(4);
    for (const c of pro) {
      expect(c.weight).toBe(2);
      expect(c.delta).toBe(1); // autoplay 全選最善
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('完美通關（接受支線）：走到結算，悟性值與心性正確，重新開始可回序章', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    expect(document.title).toBe(GAME_TITLE);
    autoplay(root, storage, { acceptBranch: true });
    expect(root.textContent).toContain(`悟性值 ${expectedWu({ acceptBranch: true })}`);
    expect(root.textContent).toContain('大覺大悟·代天宣化'); // 悟性100＋全善 → highGood
    // 重新開始 → 回到序章第一句、存檔清空
    [...root.querySelectorAll('button')].find((b) => b.textContent === '重新開始').click();
    expect(root.textContent).toContain(FILES['js/data/prologue.json'].nodes[0].text);
  });

  it('婉拒支線：同樣走得到結算', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: false });
    expect(root.textContent).toContain(`悟性值 ${expectedWu({ acceptBranch: false })}`);
  });

  it('有存檔時顯示續玩提示，繼續從該畫面開始', async () => {
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

  it('續玩提示點「重新開始」→ 回序章且存檔清空', async () => {
    const storage = fakeStorage();
    const s = createState();
    s.progress.screen = 'hall3';
    save(s, storage);
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    [...root.querySelectorAll('button')].find((b) => b.textContent === '重新開始').click();
    expect(root.textContent).toContain(FILES['js/data/prologue.json'].nodes[0].text);
    expect(load(storage).progress.screen).toBe('prologue');
  });

  it('存檔畫面 id 不在流程清單（舊版存檔）→ 從頭開始', async () => {
    const storage = fakeStorage();
    const s = createState();
    s.progress.screen = 'card'; // 階段1的畫面 id，已不存在
    save(s, storage);
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    expect(root.textContent).not.toContain('繼續旅程');
    expect(root.textContent).toContain(FILES['js/data/prologue.json'].nodes[0].text);
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

  it('惡向通關：悟性仍高、心性惡 → 知易行難結局，並引用序章惡選', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON, storage });
    autoplay(root, storage, { acceptBranch: true, evil: true });
    expect(root.textContent).toContain(`悟性值 ${expectedWu({ acceptBranch: true, evil: true })}`);
    expect(root.textContent).toContain('滿腹經綸·知易行難');
    const s = load(storage);
    const pro = s.choices.filter((c) => c.scene === 'prologue');
    expect(pro.length).toBe(4);
    for (const c of pro) expect(c.delta).toBe(-1);
    // 惡向孟婆亭選最末＝喝下
    // 稱號已斷言 highBad；序章惡選存在 → endingQuote 於 ending 階段引用（單元已測）
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

  it('接受並完成支線 → 隱藏功德 +10', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON: miniLoad, storage });
    autoplay(root, storage, { acceptBranch: true });
    expect(root.textContent).toContain('悟性值 10');
    expect(root.textContent).toContain('不識一字·菩薩心腸');
  });
  it('婉拒支線 → 0 分', async () => {
    const storage = fakeStorage();
    const root = document.createElement('div');
    await startGame({ root, loadJSON: miniLoad, storage });
    autoplay(root, storage, { acceptBranch: false });
    expect(root.textContent).toContain('悟性值 0');
  });
});
