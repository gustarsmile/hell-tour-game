import { describe, it, expect } from 'vitest';
import { AXES } from '../js/state.js';
import prologue from '../js/data/prologue.json';
import interlude from '../js/data/interlude.json';

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
