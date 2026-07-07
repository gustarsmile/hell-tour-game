import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTrial, nextPhase, lieIndexes, spotLie, judge, persuade, trialScore,
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
