// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { GAME_TITLE } from '../js/config.js';
import { CARD_W, CARD_H, wrapText, drawShareCard, buildShareCard, loadArtImage } from '../js/share.js';

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
  it('有底圖時先畫滿版底圖再壓暗色罩（等比裁切覆蓋，不拉伸變形）', () => {
    const ctx = fakeCtx();
    const bg = { width: 683, height: 1024 }; // share-bg.webp 實際尺寸，長寬比與畫布不同
    drawShareCard(ctx, payload, null, bg);
    const drawImageCalls = ctx.calls.filter(([n]) => n === 'drawImage');
    // 9 參數裁切繪製：來源裁切矩形依比例計算，目的地矩形固定滿版 0,0,CARD_W,CARD_H
    const bgCall = drawImageCalls[0];
    expect(bgCall[0]).toBe('drawImage');
    expect(bgCall[1]).toBe(bg);
    expect(bgCall.slice(-4)).toEqual([0, 0, CARD_W, CARD_H]);
    // 壓暗色罩緊接在底圖之後：找到底圖呼叫的 index，其後應有 rgba 暗色 fillStyle + 滿版 fillRect
    const bgIdx = ctx.calls.indexOf(bgCall);
    const after = ctx.calls.slice(bgIdx + 1);
    const overlayStyleIdx = after.findIndex(([n, v]) => n === 'fillStyle' && v === 'rgba(23, 19, 15, 0.45)');
    expect(overlayStyleIdx).toBeGreaterThanOrEqual(0);
    expect(after[overlayStyleIdx + 1]).toEqual(['fillRect', 0, 0, CARD_W, CARD_H]);
  });
  it('無底圖時維持原 ink-2 內底，不畫暗色罩', () => {
    const ctx = fakeCtx();
    drawShareCard(ctx, payload, null, null);
    expect(ctx.calls.some(([n]) => n === 'drawImage')).toBe(false);
    expect(ctx.calls.some(([n, v]) => n === 'fillStyle' && v === 'rgba(23, 19, 15, 0.45)')).toBe(false);
    expect(ctx.calls.some(([n, ...a]) => n === 'fillRect' && a[0] === 48 && a[1] === 48)).toBe(true);
  });
  it('QR 移至 y=1100（避開內框底 1368）', () => {
    const ctx = fakeCtx();
    drawShareCard(ctx, payload, {});
    const qrCall = ctx.calls.find(([n]) => n === 'drawImage');
    expect(qrCall).toEqual(['drawImage', {}, CARD_W / 2 - 105, 1100, 210, 210]);
  });
  it('底部標語基線不侵入內框（y ≤ 1360）', () => {
    const ctx = fakeCtx();
    drawShareCard(ctx, payload, null, null);
    const caption = texts(ctx).length ? ctx.calls.filter(([n]) => n === 'fillText').at(-1) : null;
    expect(caption[0]).toBe('fillText');
    expect(caption[1]).toBe('掃碼同遊幽冥・善書勸世');
    expect(caption[3]).toBeLessThanOrEqual(1360);
  });
});

describe('loadArtImage', () => {
  function fakeDoc(behavior) {
    return {
      createElement: () => {
        const img = { set src(v) { this._src = v; queueMicrotask(() => behavior(img)); } };
        return img;
      },
    };
  }
  it('載入成功回傳 img，src 指向 assets/art/<file>', async () => {
    let capturedSrc;
    const doc = fakeDoc((img) => {
      capturedSrc = img._src;
      img.onload();
    });
    const img = await loadArtImage(doc, 'share-bg.webp');
    expect(capturedSrc).toBe('assets/art/share-bg.webp');
    expect(img).toBeTruthy();
  });
  it('載入失敗回傳 null', async () => {
    const doc = fakeDoc((img) => img.onerror());
    const img = await loadArtImage(doc, 'share-bg.webp');
    expect(img).toBeNull();
  });
});
