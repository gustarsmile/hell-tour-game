import { describe, it, expect, vi } from 'vitest';
import {
  createVisit, visitPhases, nextVisitPhase, answerQuiz, chooseMercy, takeBranch, visitScore,
} from '../js/engine/visit.js';

const base = {
  id: 'v-demo', hall: 2, type: 'visit', king: '楚江王',
  intro: [{ speaker: '旁白', text: 'x' }],
  watch: { title: '某獄', panels: [{ caption: '其一' }] },
  closing: '走吧。',
  karmaCard: { sin: 's', result: 'r', lesson: 'l', source: { chapter: null, url: 'https://x' } },
};
const quizVisit = { ...base, quiz: { question: 'Q', options: ['甲', '乙', '丙'], answer: 1, hint: 'H', reveal: 'R' } };
const mercyVisit = {
  ...base,
  mercy: {
    prompt: 'P',
    choices: [
      { text: '善', karma: { axis: 'mercy', delta: 1 }, reply: 'r1' },
      { text: '中', reply: 'r2' },
      { text: '惡', karma: { axis: 'mercy', delta: -1 }, reply: 'r3' },
    ],
  },
};
const branchVisit = {
  ...base,
  branch: {
    prompt: 'B?', acceptText: '去', declineText: '不去', declineLine: 'D', rewardWu: 10,
    scene: { id: 'b', start: 'n1', nodes: [{ id: 'n1', type: 'line', text: 'x', next: 'fin' }, { id: 'fin', type: 'end' }] },
  },
};

describe('visitPhases', () => {
  it('考題殿：watch→ask→closing→done', () => {
    expect(visitPhases(quizVisit)).toEqual(['watch', 'ask', 'closing', 'done']);
  });
  it('慈悲抉擇殿相同；支線殿無 ask 有 branch', () => {
    expect(visitPhases(mercyVisit)).toEqual(['watch', 'ask', 'closing', 'done']);
    expect(visitPhases(branchVisit)).toEqual(['watch', 'branch', 'closing', 'done']);
  });
  it('nextVisitPhase 依序前進、到底停住', () => {
    const v = createVisit(quizVisit);
    expect(v.phase).toBe('watch');
    ['ask', 'closing', 'done'].forEach((p) => expect(nextVisitPhase(v)).toBe(p));
    expect(nextVisitPhase(v)).toBe('done');
  });
});

describe('answerQuiz', () => {
  it('首答對 +5', () => {
    const v = createVisit(quizVisit);
    nextVisitPhase(v);
    expect(answerQuiz(v, 1)).toEqual({ correct: true, points: 5 });
    expect(visitScore(v)).toBe(5);
  });
  it('答錯後重答 0 分', () => {
    const v = createVisit(quizVisit);
    nextVisitPhase(v);
    expect(answerQuiz(v, 0).correct).toBe(false);
    expect(answerQuiz(v, 1)).toEqual({ correct: true, points: 0 });
  });
  it('已答對後再呼叫回傳原結果；非 ask 階段擲錯', () => {
    const v = createVisit(quizVisit);
    expect(() => answerQuiz(v, 1)).toThrow();
    nextVisitPhase(v);
    answerQuiz(v, 1);
    expect(answerQuiz(v, 0)).toEqual({ correct: true, points: 5 });
  });
});

describe('chooseMercy', () => {
  it('套用 karma（權重1）並回傳 reply；只作用一次', () => {
    const onKarma = vi.fn();
    const v = createVisit(mercyVisit, { onKarma });
    nextVisitPhase(v);
    expect(chooseMercy(v, 0)).toEqual({ reply: 'r1' });
    expect(onKarma).toHaveBeenCalledWith('mercy', 1, 1);
    expect(chooseMercy(v, 2)).toEqual({ reply: 'r1' });
    expect(onKarma).toHaveBeenCalledTimes(1);
  });
  it('無 karma 選項不觸發 hook；選項不存在擲錯', () => {
    const onKarma = vi.fn();
    const v = createVisit(mercyVisit, { onKarma });
    nextVisitPhase(v);
    expect(() => chooseMercy(v, 9)).toThrow();
    chooseMercy(v, 1);
    expect(onKarma).not.toHaveBeenCalled();
  });
});

describe('takeBranch 與 visitScore', () => {
  it('branch 階段記錄接受／婉拒；非 branch 階段擲錯', () => {
    const v = createVisit(branchVisit);
    expect(() => takeBranch(v, true)).toThrow();
    nextVisitPhase(v); // → branch
    takeBranch(v, false);
    expect(v.branchTaken).toBe(false);
  });
  it('無考題殿 visitScore 為 0', () => {
    expect(visitScore(createVisit(mercyVisit))).toBe(0);
  });
});
