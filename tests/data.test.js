import { describe, it, expect } from 'vitest';
import { AXES } from '../js/state.js';
import prologue from '../js/data/prologue.json';
import interlude from '../js/data/interlude.json';
import hall1 from '../js/data/hall1.json';

function validateScene(scene) {
  const ids = new Set(scene.nodes.map((n) => n.id));
  expect(ids.size).toBe(scene.nodes.length); // id 不得重複
  expect(ids.has(scene.start)).toBe(true);
  for (const node of scene.nodes) {
    if (node.type === 'line') expect(ids.has(node.next)).toBe(true);
    if (node.type === 'choice') {
      expect(node.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of node.choices) {
        expect(ids.has(c.next)).toBe(true);
        if (c.karma) {
          expect(AXES).toContain(c.karma.axis);
          expect([-1, 0, 1]).toContain(c.karma.delta);
        }
      }
    }
  }
  expect(scene.nodes.some((n) => n.type === 'end')).toBe(true);
}

describe('場景資料驗證', () => {
  it('prologue.json 結構正確', () => validateScene(prologue));
  it('interlude.json 結構正確', () => validateScene(interlude));
  it('序章權重為 2，且四軸各有一題', () => {
    expect(prologue.karmaWeight).toBe(2);
    const axesUsed = prologue.nodes
      .filter((n) => n.type === 'choice')
      .map((n) => n.choices.find((c) => c.karma)?.karma.axis);
    expect(new Set(axesUsed)).toEqual(new Set(AXES));
  });
});

describe('案例資料驗證', () => {
  it('hall1：謊言句數為 1–2 句', () => {
    const lies = hall1.testimony.filter((s) => s.lie);
    expect(lies.length).toBeGreaterThanOrEqual(1);
    expect(lies.length).toBeLessThanOrEqual(2);
  });
  it('hall1：孽鏡為三格', () => {
    expect(hall1.mirror.length).toBe(3);
  });
  it('hall1：判獄答案索引有效', () => {
    expect(hall1.judgement.answer).toBeGreaterThanOrEqual(0);
    expect(hall1.judgement.answer).toBeLessThan(hall1.judgement.options.length);
  });
  it('hall1：勸化三選項分數為 10/5/0', () => {
    const scores = hall1.persuasion.options.map((o) => o.score).sort((a, b) => b - a);
    expect(scores).toEqual([10, 5, 0]);
    for (const o of hall1.persuasion.options) expect(o.reaction.length).toBeGreaterThan(0);
  });
  it('hall1：因果卡欄位齊全', () => {
    for (const key of ['sin', 'result', 'lesson', 'source']) expect(hall1.karmaCard[key]).toBeTruthy();
    expect(hall1.karmaCard.source.url).toMatch(/^https?:\/\//);
  });
  it('hall1：axis 為合法四軸', () => {
    expect(AXES).toContain(hall1.axis);
  });
});
