// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { GAME_TITLE } from '../js/config.js';
import { CARD_W, CARD_H, wrapText, drawShareCard, buildShareCard } from '../js/share.js';

function fakeCtx() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    set font(v) { calls.push(['font', v]); },
    set textAlign(v) { calls.push(['textAlign', v]); },
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillText: rec('fillText'),
    beginPath: rec('beginPath'),
    arc: rec('arc'),
    fill: rec('fill'),
    drawImage: rec('drawImage'),
  };
}
const texts = (ctx) => ctx.calls.filter(([n]) => n === 'fillText').map(([, t]) => t);

describe('wrapText', () => {
  it('依定寬切行；空字串回一行', () => {
    expect(wrapText('一二三四五', 2)).toEqual(['一二', '三四', '五']);
    expect(wrapText('短', 18)).toEqual(['短']);
    expect(wrapText('', 18)).toEqual(['']);
  });
});

describe('drawShareCard', () => {
  const payload = { title: '滿腹經綸·知易行難', wu: 88, motto: '知之非艱，行之惟艱。' };
  it('繪出遊戲名、稱號兩段、悟性值與戒語', () => {
    const ctx = fakeCtx();
    drawShareCard(ctx, payload, null);
    const t = texts(ctx);
    expect(t).toContain(GAME_TITLE);
    expect(t).toContain('滿腹經綸');
    expect(t).toContain('知易行難');
    expect(t).toContain('悟性值 88／100');
    expect(t.some((x) => x.includes('知之非艱'))).toBe(true);
  });
  it('有 qrImg 才 drawImage；無「·」稱號單行繪出', () => {
    const withQr = fakeCtx();
    drawShareCard(withQr, payload, {});
    expect(withQr.calls.some(([n]) => n === 'drawImage')).toBe(true);
    const noQr = fakeCtx();
    drawShareCard(noQr, payload, null);
    expect(noQr.calls.some(([n]) => n === 'drawImage')).toBe(false);
    const single = fakeCtx();
    drawShareCard(single, { ...payload, title: '見習判官' }, null);
    expect(texts(single)).toContain('見習判官');
  });
  it('buildShareCard：無 2D context 回 null；尺寸正確', () => {
    const doc = {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    };
    expect(buildShareCard(doc, payload, null)).toBeNull();
    expect(CARD_W).toBe(1080);
    expect(CARD_H).toBe(1440);
  });
});
