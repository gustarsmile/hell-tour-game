// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pushLayer, layerDepth, resetLayers } from '../js/ui/layer.js';

// happy-dom 的 history.back() 不會觸發 popstate（實測），以 stub 模擬瀏覽器：
// back() 於下一個 macrotask 送出 popstate。
let backSpy;
function fireBack() {
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetLayers();
  backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(fireBack, 0);
  });
  vi.spyOn(window.history, 'pushState');
});

afterEach(async () => {
  resetLayers();
  await flush();
  vi.restoreAllMocks();
});

function esc() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('layer.js', () => {
  it('Esc 關閉最上層並觸發 onClose', () => {
    const onClose = vi.fn();
    pushLayer(onClose);
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(layerDepth()).toBe(0);
  });

  it('popstate 關閉最上層', () => {
    const onClose = vi.fn();
    pushLayer(onClose);
    fireBack();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(layerDepth()).toBe(0);
  });

  it('handle 的 close() 觸發 onClose', () => {
    const onClose = vi.fn();
    pushLayer(onClose).close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close() 冪等：重複呼叫只觸發一次 onClose', () => {
    const onClose = vi.fn();
    const layer = pushLayer(onClose);
    layer.close();
    layer.close();
    layer.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('開關一輪歷程成對：pushState 與 back 各一次', () => {
    pushLayer(() => {}).close();
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('堆疊為空時 Esc 與 popstate 皆為 no-op', () => {
    expect(() => { esc(); fireBack(); }).not.toThrow();
    expect(layerDepth()).toBe(0);
  });

  it('pushState 拋錯（file:// 情境）時仍可關閉且不呼叫 back', () => {
    window.history.pushState.mockImplementation(() => { throw new Error('SecurityError'); });
    const onClose = vi.fn();
    pushLayer(onClose).close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('多次開關不重複綁定監聽器', () => {
    pushLayer(() => {}).close();
    pushLayer(() => {}).close();
    const onClose = vi.fn();
    pushLayer(onClose);
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('關閉一層後同步開啟另一層，前者的 back 回音不得關閉後者', async () => {
    const first = vi.fn();
    const second = vi.fn();
    pushLayer(first).close();   // 觸發 back()，popstate 稍後才到
    pushLayer(second);          // 立刻開下一層（menuAction 的 close(); fn(); 情境）
    await flush();
    await flush();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(layerDepth()).toBe(1);
  });
});
