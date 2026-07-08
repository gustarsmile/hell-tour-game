// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { el, renderNode, hallLabel, renderError } from '../js/ui/render.js';
import { renderTrialPhase, renderKarmaCard } from '../js/ui/trialView.js';
import { renderResults } from '../js/ui/results.js';
import { renderVisitPhase } from '../js/ui/visitView.js';
import { createTrial, nextPhase } from '../js/engine/trial.js';
import { createVisit, nextVisitPhase } from '../js/engine/visit.js';
import { createState, recordKarma } from '../js/state.js';
import hall1 from '../js/data/hall1.json';

describe('render.js', () => {
  it('el 建立元素', () => {
    const n = el('p', 'text', '你好');
    expect(n.tagName).toBe('P');
    expect(n.className).toBe('text');
    expect(n.textContent).toBe('你好');
  });
  it('line 節點渲染繼續按鈕並觸發 onAdvance', () => {
    const root = document.createElement('div');
    const onAdvance = vi.fn();
    renderNode({ type: 'line', speaker: '旁白', text: '一句話', next: 'x' }, { onAdvance }, root);
    expect(root.textContent).toContain('一句話');
    root.querySelector('button').click();
    expect(onAdvance).toHaveBeenCalled();
  });
  it('choice 節點渲染全部選項並以索引回呼', () => {
    const root = document.createElement('div');
    const onChoose = vi.fn();
    renderNode({
      type: 'choice', text: '選吧',
      choices: [{ text: '甲', next: 'x' }, { text: '乙', next: 'x' }],
    }, { onChoose }, root);
    const btns = root.querySelectorAll('.btn-choice');
    expect(btns.length).toBe(2);
    btns[1].click();
    expect(onChoose).toHaveBeenCalledWith(1);
  });
});

describe('trialView.js', () => {
  it('spot 階段渲染全部供詞為可點擊，點擊回傳索引', () => {
    const root = document.createElement('div');
    const trial = createTrial(hall1);
    nextPhase(trial); nextPhase(trial); // → spot
    const onSpot = vi.fn();
    renderTrialPhase(trial, { onSpot }, root);
    const lines = root.querySelectorAll('.testimony-line');
    expect(lines.length).toBe(hall1.testimony.length);
    lines[2].click();
    expect(onSpot).toHaveBeenCalledWith(2);
  });
  it('因果卡：chapter 為 null 時不顯示出處列', () => {
    const root = document.createElement('div');
    renderKarmaCard(hall1.karmaCard, vi.fn(), root);
    expect(root.querySelector('.card-source')).toBeNull();
    expect(root.textContent).toContain(hall1.karmaCard.lesson);
  });
  it('因果卡：有 chapter 時顯示出處連結', () => {
    const root = document.createElement('div');
    const card = { ...hall1.karmaCard, source: { chapter: 12, url: 'https://example.com' } };
    renderKarmaCard(card, vi.fn(), root);
    expect(root.querySelector('.card-source').textContent).toContain('第12回');
  });
});

describe('小修整（階段2 Task1）', () => {
  it('hallLabel 支援一到十殿，超出以數字 fallback', () => {
    expect(hallLabel(1)).toBe('第一殿');
    expect(hallLabel(7)).toBe('第七殿');
    expect(hallLabel(10)).toBe('第十殿');
    expect(hallLabel(11)).toBe('第11殿');
  });
  it('spot 階段已找到的供詞行為 disabled', () => {
    const root = document.createElement('div');
    const trial = createTrial(hall1);
    nextPhase(trial); nextPhase(trial); // → spot
    trial.foundLies.add(1);
    renderTrialPhase(trial, { onSpot: vi.fn() }, root);
    const lines = root.querySelectorAll('.testimony-line');
    expect(lines[1].disabled).toBe(true);
    expect(lines[0].disabled).toBe(false);
  });
  it('結算負數軸顯示全形負號', () => {
    const root = document.createElement('div');
    const s = createState();
    recordKarma(s, 'speech', -1);
    renderResults(s, vi.fn(), root);
    expect(root.textContent).toContain('口業　－1');
    expect(root.textContent).not.toContain('-1');
  });
});

describe('小修整（階段3 Task1）', () => {
  it('判案殿標題含殿主名', () => {
    const root = document.createElement('div');
    const trial = createTrial(hall1);
    renderTrialPhase(trial, { onNextPhase: vi.fn() }, root);
    expect(root.querySelector('.hall-title').textContent).toBe('第一殿・秦廣王');
  });
  it('spot 階段傳入訊息時顯示 feedback', () => {
    const root = document.createElement('div');
    const trial = createTrial(hall1);
    nextPhase(trial); nextPhase(trial); // → spot
    renderTrialPhase(trial, { onSpot: vi.fn() }, root, '這句倒是實話。');
    expect(root.querySelector('.feedback').textContent).toBe('這句倒是實話。');
  });
  it('judge 階段傳入訊息時顯示 feedback', () => {
    const root = document.createElement('div');
    const trial = createTrial(hall1);
    trial.phase = 'judge';
    renderTrialPhase(trial, { onJudge: vi.fn() }, root, '再看看各獄所懲之罪。');
    expect(root.querySelector('.feedback').textContent).toBe('再看看各獄所懲之罪。');
  });
  it('見聞殿考題答錯訊息顯示 feedback', () => {
    const root = document.createElement('div');
    const v = createVisit(quizVisit);
    nextVisitPhase(v);
    renderVisitPhase(v, { onQuiz: vi.fn() }, root, 'H');
    expect(root.querySelector('.feedback').textContent).toBe('H');
  });
  it('renderError 顯示錯誤與重新開始鈕', () => {
    const root = document.createElement('div');
    const onRetry = vi.fn();
    renderError(new Error('boom'), onRetry, root);
    expect(root.textContent).toContain('劇情資料載入失敗');
    expect(root.textContent).toContain('boom');
    [...root.querySelectorAll('button')].find((b) => b.textContent === '重新開始').click();
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('trialView react 階段', () => {
  const reactCase = {
    ...hall1,
    react: {
      prompt: '罪魂哀求…',
      choices: [
        { text: '垂憐', karma: { axis: 'mercy', delta: 1 }, reply: '罪魂拭淚' },
        { text: '冷漠', reply: '罪魂垂首' },
      ],
    },
  };
  it('未選擇時渲染 prompt 與選項，點擊以索引回呼', () => {
    const root = document.createElement('div');
    const trial = createTrial(reactCase);
    trial.phase = 'react';
    const onReact = vi.fn();
    renderTrialPhase(trial, { onReact }, root);
    expect(root.textContent).toContain('罪魂哀求…');
    const btns = root.querySelectorAll('.btn-choice');
    expect(btns.length).toBe(2);
    btns[0].click();
    expect(onReact).toHaveBeenCalledWith(0);
  });
  it('已選擇後顯示 reply 與繼續按鈕', () => {
    const root = document.createElement('div');
    const trial = createTrial(reactCase);
    trial.phase = 'react';
    trial.reactReply = '罪魂拭淚';
    const onNextPhase = vi.fn();
    renderTrialPhase(trial, { onNextPhase }, root);
    expect(root.textContent).toContain('罪魂拭淚');
    root.querySelector('.btn-next').click();
    expect(onNextPhase).toHaveBeenCalled();
  });
});

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

describe('visitView', () => {
  it('watch 階段渲染殿名、獄名與觀刑格', () => {
    const root = document.createElement('div');
    const v = createVisit(quizVisit);
    renderVisitPhase(v, { onNextPhase: vi.fn() }, root);
    expect(root.textContent).toContain('第二殿');
    expect(root.textContent).toContain('某獄');
    expect(root.querySelectorAll('.watch-panel').length).toBe(1);
  });
  it('quiz 未答時渲染選項並以索引回呼；答對後顯示 reveal 與繼續鈕', () => {
    const root = document.createElement('div');
    const v = createVisit(quizVisit);
    nextVisitPhase(v);
    const onQuiz = vi.fn();
    renderVisitPhase(v, { onQuiz }, root);
    const btns = root.querySelectorAll('.btn-choice');
    expect(btns.length).toBe(3);
    btns[2].click();
    expect(onQuiz).toHaveBeenCalledWith(2);
    v.quizPoints = 5;
    const onNextPhase = vi.fn();
    renderVisitPhase(v, { onNextPhase }, root);
    expect(root.textContent).toContain('R');
    root.querySelector('.btn-next').click();
    expect(onNextPhase).toHaveBeenCalled();
  });
  it('mercy 已選後顯示 reply 與繼續鈕', () => {
    const root = document.createElement('div');
    const v = createVisit(mercyVisit);
    nextVisitPhase(v);
    v.mercyReply = 'r1';
    renderVisitPhase(v, { onNextPhase: vi.fn() }, root);
    expect(root.textContent).toContain('r1');
    expect(root.querySelector('.btn-next')).not.toBeNull();
  });
  it('branch 未決時渲染接受／婉拒鈕；婉拒後顯示 declineLine', () => {
    const root = document.createElement('div');
    const v = createVisit(branchVisit);
    nextVisitPhase(v);
    const onBranchAccept = vi.fn();
    const onBranchDecline = vi.fn();
    renderVisitPhase(v, { onBranchAccept, onBranchDecline }, root);
    root.querySelector('.btn-accept').click();
    expect(onBranchAccept).toHaveBeenCalled();
    root.querySelector('.btn-decline').click();
    expect(onBranchDecline).toHaveBeenCalled();
    v.branchTaken = false;
    renderVisitPhase(v, { onNextPhase: vi.fn() }, root);
    expect(root.textContent).toContain('D');
    expect(root.querySelector('.btn-next')).not.toBeNull();
  });
  it('closing 階段顯示結語與收下因果卡鈕', () => {
    const root = document.createElement('div');
    const v = createVisit(quizVisit);
    v.phase = 'closing';
    const onFinish = vi.fn();
    renderVisitPhase(v, { onFinish }, root);
    expect(root.textContent).toContain('走吧。');
    root.querySelector('.btn-next').click();
    expect(onFinish).toHaveBeenCalled();
  });
});
