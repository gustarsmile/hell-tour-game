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

// 必須是 async 且 await flush()：測試中 close() 觸發的 mock back() 會排入 setTimeout，
// 同步的 afterEach 不會讓它有機會執行，殘留計時器會累積到後面某個 await 一次湧入，
// 在錯誤的時機送出 popstate。先 resetLayers() 再 flush，
// 讓殘留 popstate 落在「堆疊已空、監聽已解除」的 no-op 分支。
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

  it('開關一輪歷程成對：pushState 與 back 各一次', async () => {
    pushLayer(() => {}).close();
    await flush(); // 對帳在 microtask，back() 不是同步發生
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('堆疊為空時 Esc 與 popstate 皆為 no-op', () => {
    // 必須先 pushLayer 讓監聽器實際掛上，再把堆疊清空。
    // 若直接在未綁定狀態下 dispatch，事件沒人聽，not.toThrow() 會是恆真斷言，
    // 連 onKeydown／onPopstate 的空堆疊 guard 整段刪掉都測不出來。
    const onClose = vi.fn();
    pushLayer(onClose);
    fireBack(); // 以 popstate 關掉它——此路徑不呼叫 back()，不會有回音
    expect(layerDepth()).toBe(0);
    onClose.mockClear();

    expect(() => { esc(); fireBack(); }).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
    expect(layerDepth()).toBe(0);
  });

  it('pushState 拋錯（file:// 情境）時仍可關閉且不呼叫 back', async () => {
    window.history.pushState.mockImplementation(() => { throw new Error('SecurityError'); });
    const onClose = vi.fn();
    pushLayer(onClose).close();
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('多次開關不重複綁定監聽器', () => {
    // 直接數 addEventListener 的呼叫次數。只用「onClose 被叫幾次」測不出重複綁定：
    // 第一個 handler 的 dismiss 會把該層移出堆疊，第二個 handler 見到空堆疊即 return，
    // 正確與重複綁定兩種情形的結果無法區分。
    const docSpy = vi.spyOn(document, 'addEventListener');
    const winSpy = vi.spyOn(window, 'addEventListener');
    pushLayer(() => {}).close();
    pushLayer(() => {}).close();
    pushLayer(() => {}).close();
    expect(docSpy.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    expect(winSpy.mock.calls.filter(([type]) => type === 'popstate')).toHaveLength(1);

    const onClose = vi.fn();
    pushLayer(onClose);
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 這是全套最關鍵的測試：它守的正是真實瀏覽器上會把使用者踢出遊戲的那個缺陷。
  // 舊設計在此情境會 back() 一次又 pushState 一次，兩者在途交錯使歷程位置與帳目失步；
  // 新設計在對帳時看到堆疊非空，根本不呼叫 back()，全程只持有最初那一筆紀錄。
  it('關閉一層後同步開啟另一層：不得呼叫 back，且沿用同一筆歷程', async () => {
    const first = vi.fn();
    const second = vi.fn();
    pushLayer(first).close();   // menuAction 的 close(); fn(); 情境
    pushLayer(second);          // 同一輪內立刻開下一層
    await flush();
    await flush();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(layerDepth()).toBe(1);
    expect(backSpy).not.toHaveBeenCalled();                    // 關鍵：完全沒有 back()
    expect(window.history.pushState).toHaveBeenCalledTimes(1); // 關鍵：只推了一筆
  });

  it('巢狀時返回鍵逐層關閉：關掉頂層後為下層補推歷程', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    pushLayer(outer);
    pushLayer(inner);
    expect(window.history.pushState).toHaveBeenCalledTimes(1); // 兩層只持有一筆
    fireBack();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(layerDepth()).toBe(1);
    expect(window.history.pushState).toHaveBeenCalledTimes(2); // 為下層補推
    fireBack();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(layerDepth()).toBe(0);
    expect(window.history.pushState).toHaveBeenCalledTimes(2); // 堆疊已空，不得再補推孤兒紀錄
  });

  // 帳目守恆：走完「開 A → 同輪關 A 開 B → 關 B」後，pushState 與 back 次數必須相等，
  // 且系統要回到乾淨狀態（held／consuming 都已重置）——以「再開一層會讓 pushState +1」證明。
  // 這條同時守住 onPopstate 的 held = false 與 consuming = false 兩行；
  // 少了它，那兩行被刪掉都不會有任何測試變紅。
  it('帳目守恆：一輪互動後 pushState 與 back 次數相等且狀態歸零', async () => {
    const a = pushLayer(() => {});
    a.close();
    const b = pushLayer(() => {});
    b.close();
    await flush();
    await flush();
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(layerDepth()).toBe(0);

    pushLayer(() => {}); // 狀態已歸零的證明：能再推一筆
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
  });

  it('back 回音在途期間開新層，回音抵達時補推歷程', async () => {
    pushLayer(() => {}).close();
    await Promise.resolve(); // 讓對帳的 microtask 跑完，此時 back() 已呼叫、popstate 尚未到
    const second = vi.fn();
    pushLayer(second);
    // 守住 pushLayer 的 !consuming 條件——那是「不在 back() 在途時 pushState」的唯一防線，
    // 也就是造成 about:blank 的交錯本身。少了這行斷言，拿掉 !consuming 測試照樣全綠。
    expect(window.history.pushState).toHaveBeenCalledTimes(1); // 回音在途期間不得推
    await flush();
    expect(second).not.toHaveBeenCalled();                     // 回音不得關掉新層
    expect(window.history.pushState).toHaveBeenCalledTimes(2); // 補推了一筆給新層用
    expect(layerDepth()).toBe(1);
  });
});
