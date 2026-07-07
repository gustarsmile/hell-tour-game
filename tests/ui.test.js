// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { el, renderNode } from '../js/ui/render.js';
import { renderTrialPhase, renderKarmaCard } from '../js/ui/trialView.js';
import { createTrial, nextPhase } from '../js/engine/trial.js';
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
