import { describe, it, expect, vi } from 'vitest';
import { createPlayer } from '../js/engine/scene.js';

const scene = {
  id: 'demo',
  start: 'n1',
  karmaWeight: 2,
  nodes: [
    { id: 'n1', type: 'line', speaker: '旁白', text: '第一句', next: 'n2' },
    {
      id: 'n2', type: 'choice', text: '怎麼辦？',
      choices: [
        { text: '善舉', karma: { axis: 'honesty', delta: 1 }, next: 'n3' },
        { text: '不理會', next: 'n3' },
      ],
    },
    { id: 'n3', type: 'line', text: '結尾前一句', next: 'fin' },
    { id: 'fin', type: 'end' },
  ],
};

describe('scene player', () => {
  it('從 start 開始，advance 走到下一節點', () => {
    const p = createPlayer(scene);
    expect(p.current().id).toBe('n1');
    expect(p.advance().id).toBe('n2');
  });
  it('choose 套用 karma（含場景權重）並前進', () => {
    const onKarma = vi.fn();
    const p = createPlayer(scene, { onKarma });
    p.advance();
    const next = p.choose(0);
    expect(onKarma).toHaveBeenCalledWith('honesty', 1, 2);
    expect(next.id).toBe('n3');
  });
  it('無 karma 的選項不呼叫 onKarma', () => {
    const onKarma = vi.fn();
    const p = createPlayer(scene, { onKarma });
    p.advance();
    p.choose(1);
    expect(onKarma).not.toHaveBeenCalled();
  });
  it('走到 end 節點 isEnded 為真', () => {
    const p = createPlayer(scene);
    p.advance(); p.choose(0); p.advance();
    expect(p.isEnded()).toBe(true);
  });
  it('line 節點呼叫 choose、choice 節點呼叫 advance 都擲錯', () => {
    const p = createPlayer(scene);
    expect(() => p.choose(0)).toThrow();
    p.advance();
    expect(() => p.advance()).toThrow();
  });
  it('start 或 next 指向不存在的節點擲錯', () => {
    expect(() => createPlayer({ ...scene, start: 'nope' })).toThrow();
    const broken = {
      id: 'b', start: 'x',
      nodes: [{ id: 'x', type: 'line', text: 'x', next: 'ghost' }],
    };
    const p = createPlayer(broken);
    expect(() => p.advance()).toThrow();
  });
});

describe('onChoice 紀錄（階段3）', () => {
  const scene = {
    id: 'sc', karmaWeight: 2, start: 'c1',
    nodes: [
      {
        id: 'c1', type: 'choice', label: '試題', text: '選？',
        choices: [
          { text: '善行', karma: { axis: 'mercy', delta: 1 }, next: 'fin' },
          { text: '無關', next: 'fin' },
        ],
      },
      { id: 'fin', type: 'end' },
    ],
  };
  it('帶 karma 的選擇觸發 onChoice，record 齊備', () => {
    const onChoice = vi.fn();
    createPlayer(scene, { onChoice }).choose(0);
    expect(onChoice).toHaveBeenCalledWith({
      scene: 'sc', label: '試題', text: '善行', axis: 'mercy', delta: 1, weight: 2,
    });
  });
  it('無 karma 的選擇不觸發 onChoice；節點無 label 時傳 null', () => {
    const onChoice = vi.fn();
    createPlayer(scene, { onChoice }).choose(1);
    expect(onChoice).not.toHaveBeenCalled();
    const noLabel = structuredClone(scene);
    delete noLabel.nodes[0].label;
    createPlayer(noLabel, { onChoice }).choose(0);
    expect(onChoice).toHaveBeenCalledWith(expect.objectContaining({ label: null }));
  });
});
