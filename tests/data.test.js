import { describe, it, expect } from 'vitest';
import { AXES } from '../js/state.js';
import prologue from '../js/data/prologue.json';

const modules = import.meta.glob('../js/data/*.json', { eager: true });
const FILES = {};
for (const [path, mod] of Object.entries(modules)) {
  FILES[path.split('/').pop()] = mod.default;
}
const flow = FILES['flow.json'];

// ---------- 通用驗證器 ----------

function expectKarma(karma) {
  expect(AXES).toContain(karma.axis);
  expect([-1, 0, 1]).toContain(karma.delta);
}

function validateScene(scene) {
  const ids = new Set(scene.nodes.map((n) => n.id));
  expect(ids.size).toBe(scene.nodes.length);
  expect(ids.has(scene.start)).toBe(true);
  for (const node of scene.nodes) {
    if (node.type === 'line') expect(ids.has(node.next)).toBe(true);
    if (node.type === 'choice') {
      expect(node.choices.length).toBeGreaterThanOrEqual(2);
      // autoplay 慣例：choices[0] 必為最善（無 karma 或 delta ≥ 0）
      if (node.choices[0].karma) expect(node.choices[0].karma.delta).toBeGreaterThanOrEqual(0);
      // autoplay 慣例：凡帶 karma 的選擇列表，最末選項必為最惡（delta ≤ 0）
      if (node.choices.some((c) => c.karma)) {
        expect(node.choices.at(-1).karma?.delta ?? 0).toBeLessThanOrEqual(0);
      }
      for (const c of node.choices) {
        expect(ids.has(c.next)).toBe(true);
        if (c.karma) expectKarma(c.karma);
      }
    }
  }
  expect(scene.nodes.some((n) => n.type === 'end')).toBe(true);
}

function validateKarmaCard(card) {
  for (const key of ['sin', 'result', 'lesson', 'source']) expect(card[key]).toBeTruthy();
  expect(card.source.url).toMatch(/^https?:\/\//);
  if (card.source.chapter !== null) {
    expect(Number.isInteger(card.source.chapter)).toBe(true);
    expect(card.source.chapter).toBeGreaterThanOrEqual(1);
    expect(card.source.chapter).toBeLessThanOrEqual(65);
  }
}

function validateReactionChoices(choices) {
  expect(choices.length).toBeGreaterThanOrEqual(2);
  for (const c of choices) {
    expect(c.text.length).toBeGreaterThan(0);
    expect(c.reply.length).toBeGreaterThan(0);
    if (c.karma) expectKarma(c.karma);
  }
  const deltas = choices.map((c) => c.karma?.delta ?? 0);
  expect(deltas).toContain(1);   // 至少一善
  expect(deltas).toContain(-1);  // 至少一惡
  expect(deltas[0]).toBeGreaterThanOrEqual(0); // choices[0] 最善慣例
  expect(deltas.at(-1)).toBeLessThanOrEqual(0); // 最末選項最惡慣例
}

function validateFullCase(c) {
  expect(c.king.length).toBeGreaterThan(0);
  expect(AXES).toContain(c.axis);
  expect(c.intro.length).toBeGreaterThanOrEqual(1);
  const lies = c.testimony.filter((s) => s.lie);
  expect(lies.length).toBeGreaterThanOrEqual(1);
  expect(lies.length).toBeLessThanOrEqual(2);
  expect(c.mirror.length).toBe(3);
  expect(c.mirrorIntro.length).toBeGreaterThan(0);
  expect(c.judgeLine.length).toBeGreaterThan(0);
  expect(c.judgement.answer).toBeGreaterThanOrEqual(0);
  expect(c.judgement.answer).toBeLessThan(c.judgement.options.length);
  for (const o of c.judgement.options) {
    expect(o.name.length).toBeGreaterThan(0);
    expect(o.desc.length).toBeGreaterThan(0);
  }
  const scores = c.persuasion.options.map((o) => o.score);
  expect([...scores].sort((a, b) => b - a)).toEqual([10, 5, 0]);
  expect(scores[0]).toBe(10); // autoplay 慣例：最佳句在第 0 位
  expect(scores.at(-1)).toBe(0); // autoplay 慣例：末選項最惡（0 分）
  for (const o of c.persuasion.options) expect(o.reaction.length).toBeGreaterThan(0);
  if (c.react) validateReactionChoices(c.react.choices);
  if (c.postScene) validateScene(c.postScene);
  expect(c.closing.length).toBeGreaterThan(0);
  validateKarmaCard(c.karmaCard);
}

function validateVisit(v) {
  expect(v.king.length).toBeGreaterThan(0);
  expect(v.intro.length).toBeGreaterThanOrEqual(1);
  expect(v.watch.title.length).toBeGreaterThan(0);
  expect(v.watch.panels.length).toBeGreaterThanOrEqual(1);
  expect(v.watch.panels.length).toBeLessThanOrEqual(3);
  expect(v.quiz && v.mercy).toBeFalsy(); // 考題與慈悲抉擇至多擇一
  if (v.quiz) {
    expect(v.quiz.options.length).toBe(3);
    expect(v.quiz.answer).toBeGreaterThanOrEqual(0);
    expect(v.quiz.answer).toBeLessThan(v.quiz.options.length);
    expect(v.quiz.hint.length).toBeGreaterThan(0);
    expect(v.quiz.reveal.length).toBeGreaterThan(0);
  }
  if (v.mercy) validateReactionChoices(v.mercy.choices);
  if (v.branch) {
    for (const key of ['prompt', 'acceptText', 'declineText', 'declineLine']) {
      expect(v.branch[key].length).toBeGreaterThan(0);
    }
    expect(typeof v.branch.rewardWu).toBe('number');
    validateScene(v.branch.scene);
  }
  expect(v.closing.length).toBeGreaterThan(0);
  validateKarmaCard(v.karmaCard);
}

function validateFinale(f) {
  expect(f.king.length).toBeGreaterThan(0);
  expect(f.intro.length).toBeGreaterThanOrEqual(1);
  expect(f.mengpo.lines.length).toBeGreaterThanOrEqual(1);
  expect(f.mengpo.prompt.length).toBeGreaterThan(0);
  expect(f.mengpo.choices.length).toBe(2);
  expect(f.mengpo.choices[0].drank).toBe(false); // autoplay 慣例：首選為「不喝」（善向）
  for (const c of f.mengpo.choices) {
    expect(typeof c.drank).toBe('boolean');
    expect(c.text.length).toBeGreaterThan(0);
    expect(c.reply.length).toBeGreaterThan(0);
  }
  expect(f.wuReveal.lines.length).toBeGreaterThanOrEqual(1);
  expect(f.wuReveal.note.length).toBeGreaterThan(0);
  expect(f.mirror.lines.length).toBeGreaterThanOrEqual(1);
  expect(f.mirror.journey).toContain('{good}');
  expect(f.mirror.journey).toContain('{evil}');
  const keys = ['highBad', 'highGood', 'lowBad', 'lowGood'];
  expect(Object.keys(f.endings).sort()).toEqual(keys);
  for (const k of keys) {
    const e = f.endings[k];
    expect(e.title.length).toBeGreaterThan(0);
    expect(e.comment.length).toBeGreaterThanOrEqual(1);
    for (const line of e.comment) expect(line.text.length).toBeGreaterThan(0);
    expect(e.motto.length).toBeGreaterThan(0);
  }
  for (const k of ['highBad', 'lowBad']) {
    expect(f.endings[k].quote).toContain('{text}'); // 引用序章具體選擇（設計 §3.5）
    expect(f.endings[k].quoteFallback.length).toBeGreaterThan(0);
  }
  expect(f.mission.kept.length).toBeGreaterThanOrEqual(1);
  expect(f.mission.drank.length).toBeGreaterThanOrEqual(1);
  expect(f.source.url).toMatch(/^https?:\/\//);
}

// ---------- flow.json 守門 ----------

describe('flow.json 驗證', () => {
  it('id 不重複、首畫面為 prologue、末畫面為 finale、src 檔案都存在', () => {
    const ids = flow.screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(flow.screens[0].id).toBe('prologue');
    expect(flow.screens.at(-1).type).toBe('finale');
    for (const s of flow.screens) {
      expect(['scene', 'trial', 'visit', 'finale']).toContain(s.type);
      expect(FILES[s.src]).toBeDefined();
    }
  });
  it('殿的順序遞增且 type 與資料一致', () => {
    const halls = flow.screens
      .filter((s) => s.id.startsWith('hall'))
      .map((s) => ({ scr: s, data: FILES[s.src] }));
    let prev = 0;
    for (const { scr, data } of halls) {
      expect(data.hall).toBeGreaterThan(prev);
      prev = data.hall;
      expect({ trial: 'full', visit: 'visit', finale: 'finale' }[scr.type]).toBe(data.type);
    }
  });
});

// ---------- 逐檔驗證（自動掃描） ----------

describe('內容資料驗證', () => {
  for (const scr of flow.screens) {
    if (scr.type === 'scene') {
      it(`${scr.src}：場景結構正確`, () => validateScene(FILES[scr.src]));
    } else if (scr.type === 'trial') {
      it(`${scr.src}：完整判案案例結構正確`, () => validateFullCase(FILES[scr.src]));
    } else if (scr.type === 'visit') {
      it(`${scr.src}：見聞殿結構正確`, () => validateVisit(FILES[scr.src]));
    } else if (scr.type === 'finale') {
      it(`${scr.src}：結算關結構正確`, () => validateFinale(FILES[scr.src]));
    }
  }
});

// ---------- 序章專屬 ----------

describe('序章專屬驗證', () => {
  it('權重為 2，且四軸恰好各一題', () => {
    expect(prologue.karmaWeight).toBe(2);
    const axesUsed = prologue.nodes
      .filter((n) => n.type === 'choice')
      .map((n) => n.choices.find((c) => c.karma)?.karma.axis);
    expect(axesUsed.length).toBe(AXES.length);
    expect([...axesUsed].sort()).toEqual([...AXES].sort());
  });
  it('四個抉擇節點皆有 label（孽鏡反照情境標籤）', () => {
    const nodes = prologue.nodes.filter((n) => n.type === 'choice');
    expect(nodes.length).toBe(4);
    for (const n of nodes) expect(n.label.length).toBeGreaterThan(0);
  });
});

// ---------- 五殿專屬 ----------

describe('五殿專屬驗證', () => {
  it('hall5 有望鄉臺 postScene，且含 filial 抉擇', () => {
    const hall5 = FILES['hall5.json'];
    expect(hall5.postScene).toBeDefined();
    const choiceNode = hall5.postScene.nodes.find((n) => n.type === 'choice');
    expect(choiceNode.choices.some((c) => c.karma?.axis === 'filial')).toBe(true);
  });
});

// ---------- 六殿專屬 ----------

describe('六殿專屬驗證', () => {
  it('hall6 為支線型：有 branch、rewardWu 為 10、無考題與慈悲抉擇', () => {
    const hall6 = FILES['hall6.json'];
    expect(hall6.branch.rewardWu).toBe(10);
    expect(hall6.quiz).toBeUndefined();
    expect(hall6.mercy).toBeUndefined();
  });
  it('hall6 結尾含安心專線 1925', () => {
    expect(FILES['hall6.json'].closing).toContain('1925');
  });
});

// ---------- 十殿專屬驗證 ----------

describe('十殿專屬驗證', () => {
  it('四結局稱號與設計文件一致', () => {
    const e = FILES['hall10.json'].endings;
    expect(e.highGood.title).toBe('大覺大悟·代天宣化');
    expect(e.highBad.title).toBe('滿腹經綸·知易行難');
    expect(e.lowGood.title).toBe('不識一字·菩薩心腸');
    expect(e.lowBad.title).toBe('執迷不悟·輪迴重修');
  });
});
