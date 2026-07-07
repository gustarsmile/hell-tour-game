import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTrial, nextPhase, lieIndexes, spotLie, judge, react, persuade, trialScore,
} from '../js/engine/trial.js';

const caseData = {
  id: 'demo-case',
  testimony: [
    { text: '實話一', lie: false },
    { text: '謊話一', lie: true },
    { text: '謊話二', lie: true },
    { text: '實話二', lie: false },
  ],
  judgement: { question: 'Q', options: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], answer: 1 },
  persuasion: {
    prompt: 'P',
    options: [
      { text: '最佳', score: 10, reaction: '痛哭懺悔' },
      { text: '次佳', score: 5, reaction: '默然' },
      { text: '最差', score: 0, reaction: '惱怒' },
    ],
  },
};

function toPhase(trial, phase) {
  while (trial.phase !== phase) nextPhase(trial);
}

let trial;
beforeEach(() => { trial = createTrial(caseData); });

describe('階段推進', () => {
  it('依序 testimony→mirror→spot→judge→persuade→done，到底不再前進', () => {
    expect(trial.phase).toBe('testimony');
    ['mirror', 'spot', 'judge', 'persuade', 'done'].forEach((p) => expect(nextPhase(trial)).toBe(p));
    expect(nextPhase(trial)).toBe('done');
  });
  it('不在對應階段呼叫互動函式擲錯', () => {
    expect(() => spotLie(trial, 1)).toThrow();
    expect(() => judge(trial, 0)).toThrow();
    expect(() => persuade(trial, 0)).toThrow();
  });
});

describe('點破綻', () => {
  beforeEach(() => toPhase(trial, 'spot'));
  it('lieIndexes 回傳謊言索引', () => {
    expect(lieIndexes(caseData)).toEqual([1, 2]);
  });
  it('全對且無點錯 → +10', () => {
    expect(spotLie(trial, 1)).toEqual({ hit: true, allFound: false });
    expect(spotLie(trial, 2)).toEqual({ hit: true, allFound: true });
    expect(trial.spotPoints).toBe(10);
  });
  it('曾點錯 → 完成後 0 分', () => {
    spotLie(trial, 0); // 點錯
    spotLie(trial, 1); spotLie(trial, 2);
    expect(trial.spotPoints).toBe(0);
  });
  it('重複點同一句謊言不重複計數', () => {
    spotLie(trial, 1); spotLie(trial, 1);
    expect(trial.foundLies.size).toBe(1);
  });
  it('步驟完成後再點擊不影響已得分數', () => {
    spotLie(trial, 1); spotLie(trial, 2);
    const r = spotLie(trial, 0);
    expect(r).toEqual({ hit: true, allFound: true });
    expect(trial.spotPoints).toBe(10);
  });
});

describe('斷因果', () => {
  beforeEach(() => toPhase(trial, 'judge'));
  it('一次答對 +10', () => {
    expect(judge(trial, 1)).toEqual({ correct: true, points: 10 });
  });
  it('答錯後重答 0 分', () => {
    expect(judge(trial, 0).correct).toBe(false);
    expect(judge(trial, 1)).toEqual({ correct: true, points: 0 });
  });
  it('答對後再答錯不改變已得分數', () => {
    judge(trial, 1);
    const r = judge(trial, 0);
    expect(r).toEqual({ correct: true, points: 10 });
    expect(trial.judgePoints).toBe(10);
  });
});

describe('勸化與總分', () => {
  it('選項分數與反應正確回傳', () => {
    toPhase(trial, 'persuade');
    expect(persuade(trial, 0)).toEqual({ score: 10, reaction: '痛哭懺悔' });
  });
  it('完美一輪 30 分', () => {
    toPhase(trial, 'spot');
    spotLie(trial, 1); spotLie(trial, 2);
    nextPhase(trial);
    judge(trial, 1);
    nextPhase(trial);
    persuade(trial, 0);
    expect(trialScore(trial)).toBe(30);
  });
  it('勸化以第一次選擇為準，重複呼叫不改變結果', () => {
    toPhase(trial, 'persuade');
    persuade(trial, 0);
    expect(persuade(trial, 2)).toEqual({ score: 10, reaction: '痛哭懺悔' });
    expect(trial.persuadePoints).toBe(10);
  });
  it('勸化越界索引擲錯', () => {
    toPhase(trial, 'persuade');
    expect(() => persuade(trial, 9)).toThrow('勸化選項不存在');
  });
});

describe('react 階段與 karma hook', () => {
  const reactCase = {
    ...caseData,
    react: {
      prompt: '罪魂哀求…',
      choices: [
        { text: '垂憐', karma: { axis: 'mercy', delta: 1 }, reply: '罪魂拭淚' },
        { text: '冷漠', reply: '罪魂垂首' },
        { text: '譏笑', karma: { axis: 'mercy', delta: -1 }, reply: '罪魂憤然' },
      ],
    },
  };

  it('有 react 區塊時，階段順序含 react（judge 之後、persuade 之前）', () => {
    const t = createTrial(reactCase);
    expect(t.phases).toEqual(['testimony', 'mirror', 'spot', 'judge', 'react', 'persuade', 'done']);
  });
  it('無 react 區塊時，階段順序與階段1相同', () => {
    const t = createTrial(caseData);
    expect(t.phases).toEqual(['testimony', 'mirror', 'spot', 'judge', 'persuade', 'done']);
  });
  it('react 套用 karma（權重1）並回傳 reply', () => {
    const onKarma = vi.fn();
    const t = createTrial(reactCase, { onKarma });
    toPhase(t, 'react');
    expect(react(t, 0)).toEqual({ reply: '罪魂拭淚' });
    expect(onKarma).toHaveBeenCalledWith('mercy', 1, 1);
  });
  it('無 karma 的 react 選項不觸發 hook', () => {
    const onKarma = vi.fn();
    const t = createTrial(reactCase, { onKarma });
    toPhase(t, 'react');
    react(t, 1);
    expect(onKarma).not.toHaveBeenCalled();
  });
  it('react 只作用一次：重複呼叫回傳原 reply、不重複記 karma', () => {
    const onKarma = vi.fn();
    const t = createTrial(reactCase, { onKarma });
    toPhase(t, 'react');
    react(t, 2);
    expect(react(t, 0)).toEqual({ reply: '罪魂憤然' });
    expect(onKarma).toHaveBeenCalledTimes(1);
  });
  it('不在 react 階段呼叫 react、或選項不存在，擲錯', () => {
    const t = createTrial(reactCase);
    expect(() => react(t, 0)).toThrow();
    toPhase(t, 'react');
    expect(() => react(t, 9)).toThrow();
  });
  it('persuade 選項帶 karma 時觸發 hook', () => {
    const onKarma = vi.fn();
    const withKarma = {
      ...caseData,
      persuasion: {
        prompt: 'P',
        options: [
          { text: '最佳', score: 10, reaction: 'r', karma: { axis: 'speech', delta: 1 } },
          { text: '次佳', score: 5, reaction: 'r' },
          { text: '最差', score: 0, reaction: 'r' },
        ],
      },
    };
    const t = createTrial(withKarma, { onKarma });
    toPhase(t, 'persuade');
    persuade(t, 0);
    expect(onKarma).toHaveBeenCalledWith('speech', 1, 1);
  });
});
