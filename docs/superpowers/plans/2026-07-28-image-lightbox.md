# 圖片全螢幕檢視＋疊層統一關閉 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓兩個遊戲的所有圖片可點擊放大為全螢幕完整檢視，並讓三個疊層（大圖、漢堡選單、善書冊）一律能用點擊、Esc 與手機系統返回鍵關閉。

**Architecture:** 新增 `js/ui/layer.js` 集中管理「何時該關」（Esc、popstate、history 成對），不碰任何疊層 DOM；各疊層維持自己的生命週期，以 `onClose` 回呼接入。新增 `js/ui/lightbox.js` 管理單例大圖疊層，透過 `artImg()` 與 `cover-art` 兩個掛載點覆蓋全部圖片。

**Tech Stack:** 原生 ES modules、無框架、無建置步驟。測試 Vitest 4 + happy-dom 15（每檔以 `// @vitest-environment happy-dom` 指定）。

**規格文件：** `docs/superpowers/specs/2026-07-28-image-lightbox-design.md`

## Global Constraints

- **兩個 repo 都要做**：`C:\Users\yoyoc\Projects\hell-tour-game` 與 `C:\Users\yoyoc\Projects\hell-tour-family`。Task 1–4 在 game repo 完成，Task 5 移植到 family repo。
- **測試只增不減**：game 基準 162、family 基準 167（2026-07-28 實測，各 15 檔）。每個 Task 結束時 `npm test` 必須全過才 commit。
- **不動 `index.html`**：疊層一律由 JS 動態建立，避免破壞 `tests/html.test.js`。
- **不改既有對外簽名**：`createNav` 回傳物件的 `setBack` / `setMenu` / `closeMenu` / `toast` 四個方法簽名不變；`startGame` 簽名不變。
- **不新增任何圖片資產**，美術 6MB 守門不受影響。
- **大圖疊層色值一律寫死**，不使用 CSS 變數：金色 `#c9a227`、暗金 `#8a7020`、淡紙色 `#cbbc9c`、鈕底 `rgba(23, 19, 15, 0.8)`。原因：family 的 `body.theme-heaven` 會把這些變數翻成深色，而大圖底色恆為黑。
- **不做**：雙指縮放、拖曳、圖片 alt 文字、鍵盤開啟大圖、善書冊點背景關閉、分享卡（`renderShareOverlay` 是 `#app` 內的 view 不是疊層）。
- **commit 訊息**用繁體中文，結尾加 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`。
- **不要 push**，部署由使用者另行放行。

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `js/ui/layer.js` | 新增 | 疊層關閉語意：LIFO 堆疊、Esc、popstate、history 成對。不碰 DOM |
| `js/ui/lightbox.js` | 新增 | 單例大圖疊層：建立、開啟、掛載到 `<img>` |
| `js/ui/render.js` | 改 | `artImg()` 尾端呼叫 `enableLightbox` |
| `js/ui/coverView.js` | 改 | `cover-art` 建立後呼叫 `enableLightbox` |
| `js/ui/nav.js` | 改 | 選單 `open()`／`close()` 改走 layer handle |
| `js/flow.js` | 改 | `openBookletOverlay()` 改走 layer handle |
| `css/style.css` | 改 | 附加大圖疊層樣式 |
| `tests/layer.test.js` | 新增 | layer.js 的 9 個關閉語意案例（單元） |
| `tests/lightbox.test.js` | 新增 | 大圖疊層 12 案例 |
| `tests/overlays.test.js` | 新增 | 漢堡選單 4 案例＋善書冊 5 案例（整合）。**獨立成檔**：這些測試會清掉 body 內的疊層節點，與 lightbox 單例共處一檔會造成跨測試污染 |

---

### Task 1: `layer.js` — 疊層關閉語意

**Files:**
- Create: `js/ui/layer.js`
- Test: `tests/layer.test.js`

**Interfaces:**
- Consumes: 無（本模組不依賴專案內任何檔案）
- Produces:
  - `pushLayer(onClose: () => void, doc = document) → { close: () => void }`
  - `layerDepth() → number`（測試用）
  - `resetLayers() → void`（測試用，清空堆疊並解除監聽）

- [ ] **Step 1: 寫失敗測試**

建立 `tests/layer.test.js`：

```js
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
// 把共用的 pendingBacks 提前用掉而誤關疊層。先 resetLayers() 再 flush，
// 讓殘留 popstate 落在「堆疊已空」的 no-op 分支。
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
    // 必須先 pushLayer 讓監聽器實際掛上，再把堆疊清空。
    // 若直接在未綁定狀態下 dispatch，事件沒人聽，not.toThrow() 會是恆真斷言，
    // 連 onKeydown／onPopstate 的空堆疊 guard 整段刪掉都測不出來。
    const onClose = vi.fn();
    pushLayer(onClose);
    fireBack(); // 以 popstate 關掉它——此路徑不動 pendingBacks
    expect(layerDepth()).toBe(0);
    onClose.mockClear();

    expect(() => { esc(); fireBack(); }).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- tests/layer.test.js`
Expected: FAIL，`Failed to resolve import "../js/ui/layer.js"`

- [ ] **Step 3: 實作 `js/ui/layer.js`**

```js
// 疊層關閉的共用管理：Esc 與系統返回鍵，後開先關（LIFO）。
// 本模組只管「何時該關」，不碰任何疊層的 DOM——各疊層以 onClose 回呼自理。
const stack = [];
let pendingBacks = 0; // 我方呼叫 history.back() 的筆數，用來辨識 popstate 來源
let boundDoc = null;

function dismiss(layer) {
  const i = stack.indexOf(layer);
  if (i === -1) return false; // 已關閉，冪等
  stack.splice(i, 1);
  layer.onClose();
  return true;
}

function onKeydown(e) {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].close();
}

// popstate 有兩種來源：使用者按返回鍵，或我方 close() 呼叫 back() 的回音。
// 後者必須忽略——否則「關選單、同一輪立刻開善書冊」會把善書冊關掉。
function onPopstate() {
  if (pendingBacks > 0) {
    pendingBacks -= 1;
    return;
  }
  if (stack.length) dismiss(stack[stack.length - 1]);
}

function unbind() {
  if (!boundDoc) return;
  boundDoc.removeEventListener('keydown', onKeydown);
  boundDoc.defaultView.removeEventListener('popstate', onPopstate);
  boundDoc = null;
}

function ensureBound(doc) {
  if (boundDoc === doc) return;
  unbind();
  boundDoc = doc;
  doc.addEventListener('keydown', onKeydown);
  doc.defaultView.addEventListener('popstate', onPopstate);
}

export function pushLayer(onClose, doc = document) {
  ensureBound(doc);
  const layer = { onClose, pushed: false };
  layer.close = () => {
    if (!dismiss(layer)) return; // 已關閉則不重複消耗歷程
    if (!layer.pushed) return;
    pendingBacks += 1;
    doc.defaultView.history.back();
  };
  try {
    doc.defaultView.history.pushState({ layer: true }, '');
    layer.pushed = true;
  } catch {
    layer.pushed = false; // file:// 直開時 pushState 會丟 SecurityError，降級為僅點擊／Esc 可關
  }
  stack.push(layer);
  return layer;
}

// 以下兩者僅供測試使用（模組狀態在同一測試檔內跨案例殘留），正式流程不呼叫。
export function layerDepth() {
  return stack.length;
}

export function resetLayers() {
  stack.length = 0;
  pendingBacks = 0;
  unbind();
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- tests/layer.test.js`
Expected: PASS，9 passed

- [ ] **Step 5: 執行全套測試確認無回歸**

Run: `npm test`
Expected: 171 passed（162 + 9）

- [ ] **Step 6: Commit**

```bash
git add js/ui/layer.js tests/layer.test.js
git commit -m "feat: 新增 layer.js 疊層關閉共用模組（Esc／返回鍵／歷程成對）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `lightbox.js` ＋樣式＋兩個掛載點

**Files:**
- Create: `js/ui/lightbox.js`
- Modify: `js/ui/render.js`（`artImg()`，第 8–16 行）
- Modify: `js/ui/coverView.js`（`cover-art`，第 8–13 行）
- Modify: `css/style.css`（檔尾附加）
- Test: `tests/lightbox.test.js`

**Interfaces:**
- Consumes: `pushLayer(onClose, doc)` from `js/ui/layer.js`（Task 1）。**不 import `render.js`**（避免循環相依，見 Step 3）
- Produces:
  - `enableLightbox(img: HTMLImageElement, doc = document) → void`
  - `openLightbox(src: string, doc = document) → void`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/lightbox.test.js`：

```js
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enableLightbox, openLightbox } from '../js/ui/lightbox.js';
import { artImg } from '../js/ui/render.js';
import { renderCover } from '../js/ui/coverView.js';
import { resetLayers, layerDepth } from '../js/ui/layer.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
});

afterEach(async () => {
  document.querySelector('#lightbox')?.classList.remove('open');
  resetLayers();
  await flush();
  vi.restoreAllMocks();
});

const lb = () => document.querySelector('#lightbox');
const isOpen = () => !!lb()?.classList.contains('open');
function esc() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('lightbox.js', () => {
  it('artImg 產出的圖帶有 zoomable class', () => {
    expect(artImg('hall1-scene.webp').className).toContain('zoomable');
  });

  it('點圖開啟疊層，大圖 src 與原圖相同', () => {
    const img = artImg('hall1-scene.webp');
    img.click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
    lb().click(); // 收尾關閉，避免 body.style.overflow 殘留污染後續案例
  });

  it('已開啟時再次開啟只換圖，不重複推疊層', () => {
    document.body.style.overflow = 'scroll';
    artImg('hall1-scene.webp').click();
    const second = artImg('hall2-scene.webp');
    openLightbox(second.src);
    expect(layerDepth()).toBe(1); // 沒有殘層
    expect(lb().querySelector('.lightbox-img').src).toBe(second.src);
    lb().click();
    expect(document.body.style.overflow).toBe('scroll'); // 原始值未被 'hidden' 覆蓋
    document.body.style.overflow = '';
  });

  it('點疊層背景可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().click();
    expect(isOpen()).toBe(false);
  });

  it('點大圖本身可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().querySelector('.lightbox-img').click();
    expect(isOpen()).toBe(false);
  });

  it('✕ 鈕可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().querySelector('.lightbox-close').click();
    expect(isOpen()).toBe(false);
  });

  it('Esc 可關閉', () => {
    artImg('hall1-scene.webp').click();
    esc();
    expect(isOpen()).toBe(false);
  });

  it('popstate 可關閉', () => {
    artImg('hall1-scene.webp').click();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(isOpen()).toBe(false);
  });

  it('關閉後再開不會產生第二個疊層', async () => {
    artImg('hall1-scene.webp').click();
    lb().click();
    await flush();
    artImg('hall2-scene.webp').click();
    expect(document.querySelectorAll('#lightbox').length).toBe(1);
    expect(isOpen()).toBe(true);
  });

  it('開啟鎖背景捲動、關閉還原原值', () => {
    document.body.style.overflow = 'scroll';
    const img = artImg('hall1-scene.webp');
    img.click();
    expect(document.body.style.overflow).toBe('hidden');
    lb().click();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('封面圖可放大', () => {
    const root = document.createElement('div');
    renderCover(
      { resumable: false, modes: { full: { label: 'a', desc: 'b' }, lite: { label: 'c', desc: 'd' } } },
      { onStart: () => {}, onResume: () => {} },
      root,
    );
    const cover = root.querySelector('.cover-art');
    expect(cover.className).toContain('zoomable');
    cover.click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toBe(cover.src);
  });

  it('enableLightbox 於點擊當下讀取 src（fallback 換圖後仍正確）', () => {
    const img = document.createElement('img');
    img.src = 'assets/art/a.webp';
    enableLightbox(img);
    img.src = 'assets/art/b.webp'; // 模擬 error fallback 換圖
    img.click();
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- tests/lightbox.test.js`
Expected: FAIL，`Failed to resolve import "../js/ui/lightbox.js"`

- [ ] **Step 3: 實作 `js/ui/lightbox.js`**

**注意：本檔刻意不 import `render.js` 的 `el()`。** `render.js` 需要 import 本檔的 `enableLightbox`，若本檔反向 import `el` 就形成循環相依。實務上因 `el` 是 hoisted 的函式宣告而不會出錯，但沒必要製造這個耦合——本檔只建四個元素，直接用 `doc.createElement`。

```js
import { pushLayer } from './layer.js';

// 全螢幕看圖：點圖放大、再點一下還原。全站共用單一疊層，第一次點圖時才建立。
let overlay = null;
let bigImg = null;
let layer = null;

function ensureOverlay(doc) {
  if (overlay) return;
  overlay = doc.createElement('div');
  overlay.id = 'lightbox';

  bigImg = doc.createElement('img');
  bigImg.className = 'lightbox-img';
  bigImg.alt = '';
  bigImg.decoding = 'async';
  overlay.appendChild(bigImg);

  const closeBtn = doc.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', '關閉大圖');
  overlay.appendChild(closeBtn);

  const hint = doc.createElement('p');
  hint.className = 'lightbox-hint';
  hint.textContent = '點任意處關閉';
  overlay.appendChild(hint);

  // 不檢查 e.target：點背景、點大圖、點 ✕ 都冒泡到這裡，一律關閉
  overlay.addEventListener('click', () => layer?.close());

  doc.body.appendChild(overlay);
}

export function openLightbox(src, doc = document) {
  ensureOverlay(doc);
  bigImg.src = src;
  // 已開啟時只換圖：重複推疊層會讓原始捲動狀態被 'hidden' 覆蓋而永久遺失，
  // 且會在 layer.js 堆疊裡留下無人消耗的殘層，破壞單層不變式
  if (layer) return;
  overlay.classList.add('open');
  // 以區域變數捕獲，讓 closure 持有屬於這一次開啟的值，不受後續開啟影響
  const prevOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  layer = pushLayer(() => {
    overlay.classList.remove('open');
    doc.body.style.overflow = prevOverflow;
    layer = null;
  }, doc);
}

export function enableLightbox(img, doc = document) {
  img.classList.add('zoomable');
  // 於點擊當下取 src，封面 error fallback 換圖後仍指向正確來源
  img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, doc));
}
```

- [ ] **Step 4: 掛載到 `js/ui/render.js`**

在檔首 import 區加入：

```js
import { enableLightbox } from './lightbox.js';
```

將 `artImg()` 的 `return img;` 前一行改為：

```js
  img.addEventListener('error', () => img.remove()); // 資產缺失時優雅降級
  enableLightbox(img);
  return img;
```

- [ ] **Step 5: 掛載到 `js/ui/coverView.js`**

在檔首 import 改為：

```js
import { el } from './render.js';
import { enableLightbox } from './lightbox.js';
```

在 `box.appendChild(art);` 之前加入一行：

```js
  art.addEventListener('error', () => { art.src = 'assets/art/jigong-main.webp'; }, { once: true });
  enableLightbox(art);
  box.appendChild(art);
```

- [ ] **Step 6: 附加樣式到 `css/style.css` 檔尾**

```css
/* ===== 大圖檢視（點圖放大，js/ui/lightbox.js） =====
   底色恆為黑，故色值一律寫死不用 CSS 變數——family 的 theme-heaven
   會把 --gold／--paper-dim 翻成深色，沿用變數會變成深色字壓黑底。 */
img.zoomable { cursor: zoom-in; }

#lightbox {
  position: fixed;
  inset: 0;
  z-index: 35; /* 高於選單／善書冊的 30，低於提示浮層的 40 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.92);
  cursor: zoom-out;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s ease, visibility 0.18s;
}
#lightbox.open {
  opacity: 1;
  visibility: visible;
}
.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* 完整圖不裁切——版面上的圖是 cover 裁過的 */
  border-radius: 4px;
}
.lightbox-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid #8a7020;
  background: rgba(23, 19, 15, 0.8);
  color: #c9a227;
  font: inherit;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.lightbox-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px;
  margin: 0;
  text-align: center;
  color: #cbbc9c;
  font-size: 0.8rem;
}
```

- [ ] **Step 7: 執行測試確認通過**

Run: `npm test -- tests/lightbox.test.js`
Expected: PASS，12 passed

- [ ] **Step 8: 執行全套測試確認無回歸**

Run: `npm test`
Expected: 183 passed（171 + 12）。特別確認 `tests/ui.test.js` 與 `tests/html.test.js` 仍全過。

- [ ] **Step 9: Commit**

```bash
git add js/ui/lightbox.js js/ui/render.js js/ui/coverView.js css/style.css tests/lightbox.test.js
git commit -m "feat: 圖片點擊放大為全螢幕完整檢視（含入口封面）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 漢堡選單與善書冊接入 layer.js

**Files:**
- Modify: `js/ui/nav.js`（第 33–40 行的 `close()`／`open()`）
- Modify: `js/flow.js`（`openBookletOverlay()`，第 207–215 行）
- Test: `tests/overlays.test.js`（新檔）

**Interfaces:**
- Consumes: `pushLayer(onClose, doc)` from `js/ui/layer.js`（Task 1）
- Produces: 無新的對外介面。`createNav` 回傳物件的四個方法簽名不變，`startGame` 簽名不變。

- [ ] **Step 1: 寫失敗測試**

建立 `tests/overlays.test.js`。資料載入與 `fakeStorage` 沿用 `tests/flow.test.js` 既有寫法。

```js
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNav } from '../js/ui/nav.js';
import { startGame } from '../js/flow.js';
import { layerDepth, resetLayers } from '../js/ui/layer.js';

const modules = import.meta.glob('../js/data/*.json', { eager: true });
const FILES = {};
for (const [path, mod] of Object.entries(modules)) {
  FILES[path.replace('../js/', 'js/')] = mod.default;
}
const loadJSON = async (p) => structuredClone(FILES[p]);

function fakeStorage() {
  const data = {};
  return {
    setItem: (k, v) => { data[k] = String(v); },
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => { delete data[k]; },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// happy-dom 的 history.back() 不會觸發 popstate（實測），以 stub 模擬瀏覽器
beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
});

afterEach(async () => {
  resetLayers();
  await flush();
  vi.restoreAllMocks();
  cleanupStage();
});

// 只清掉本檔製造的節點，不用 body.innerHTML = ''
function cleanupStage() {
  document.querySelectorAll('#nav-bar, #nav-overlay, #booklet-overlay, .test-root')
    .forEach((n) => n.remove());
}

function esc() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

const menuOpen = () => !!document.querySelector('#nav-overlay')?.classList.contains('open');
const bookletOpen = () => !!document.querySelector('#booklet-overlay');

function mountNav(menuCfg = {}) {
  // 只清 nav，不動 .test-root——端到端案例需要 bootFlow 建立的遊戲狀態仍在
  document.querySelectorAll('#nav-bar, #nav-overlay').forEach((n) => n.remove());
  const nav = createNav(document);
  nav.setMenu({ modeLabel: '完整遊歷', entries: [], onJump: () => {}, ...menuCfg });
  document.querySelectorAll('.nav-btn')[1].click(); // ☰ 開啟選單
  return nav;
}

// 以假 nav 攔下 setMenu 設定，取得 onBooklet，無須深度驅動遊戲。
// startGame 已在內部載完所有資料，故點擊後的畫面切換為同步（見 tests/flow.test.js 的 autoplay）
async function bootFlow() {
  cleanupStage();
  const root = document.createElement('div');
  root.className = 'test-root';
  document.body.appendChild(root);
  let cfg = null;
  const nav = { setBack() {}, closeMenu() {}, toast() {}, setMenu(c) { if (c) cfg = c; } };
  await startGame({ root, loadJSON, storage: fakeStorage(), nav });
  root.querySelector('.btn-next').click(); // 封面「完整遊歷」
  expect(cfg).toBeTruthy();
  return cfg;
}

describe('漢堡選單接入 layer', () => {
  it('Esc 可關閉選單', () => {
    mountNav();
    expect(menuOpen()).toBe(true);
    esc();
    expect(menuOpen()).toBe(false);
  });

  it('popstate 可關閉選單', () => {
    mountNav();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(menuOpen()).toBe(false);
  });

  it('點背景仍可關閉選單（不回歸）', () => {
    mountNav();
    document.querySelector('#nav-overlay').click();
    expect(menuOpen()).toBe(false);
  });

  it('再按一次 ☰ 仍可關閉（不回歸）', () => {
    mountNav();
    document.querySelectorAll('.nav-btn')[1].click();
    expect(menuOpen()).toBe(false);
  });
});

describe('善書冊接入 layer', () => {
  it('Esc 可關閉善書冊', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    expect(bookletOpen()).toBe(true);
    esc();
    expect(bookletOpen()).toBe(false);
  });

  it('popstate 可關閉善書冊', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(bookletOpen()).toBe(false);
  });

  it('「合上善書冊 ▸」仍可關閉（不回歸）', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    const btns = [...document.querySelectorAll('#booklet-overlay button')];
    btns[btns.length - 1].click();
    expect(bookletOpen()).toBe(false);
  });

  it('經選單開啟善書冊後仍在畫面上（pendingBacks 端到端）', async () => {
    const cfg = await bootFlow();
    // 重現 nav.js 的 menuAction：close(); fn(); ——關選單與開善書冊在同一輪同步發生
    mountNav({ onBooklet: cfg.onBooklet });
    const action = [...document.querySelectorAll('#nav-menu .menu-action')]
      .find((b) => b.textContent.includes('善書冊'));
    action.click();
    expect(bookletOpen()).toBe(true);
    await flush();
    await flush();
    expect(bookletOpen()).toBe(true); // 關選單那次 back() 的回音不得關掉善書冊
  });

  it('單層不變式：堆疊深度不超過 1', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    expect(layerDepth()).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- tests/overlays.test.js`
Expected: FAIL。「Esc 可關閉選單」「popstate 可關閉選單」失敗（選單尚未接入 layer），善書冊三項同理。「點背景仍可關閉選單」與「合上善書冊」應先行通過（既有行為）。

- [ ] **Step 3: 改 `js/ui/nav.js`**

檔首 import 加入：

```js
import { el } from './render.js';
import { pushLayer } from './layer.js';
```

將第 33–40 行的 `close()` 與 `open()` 改為：

```js
  let layer = null;

  function close() {
    layer?.close();
    layer = null;
  }

  function open() {
    renderPanel();
    overlay.classList.add('open');
    layer = pushLayer(() => {
      overlay.classList.remove('open');
      layer = null;
    }, doc);
  }
```

其餘不動：`overlay` 的 click 監聽、`menuBtn` 的 toggle 判斷（`overlay.classList.contains('open')`）、`menuAction` 的 `close(); fn();`、對外回傳的 `closeMenu: close` 全部維持原狀。

- [ ] **Step 4: 改 `js/flow.js`**

檔首 import 區（第 16 行 `NOOP_NAV` 那行之後）加入：

```js
import { pushLayer } from './ui/layer.js';
```

`openBookletOverlay()` 最後兩行改為：

```js
    document.body.appendChild(overlay);
    const layer = pushLayer(() => overlay.remove());
    renderBooklet(bookletEntries(), () => layer.close(), inner);
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npm test -- tests/overlays.test.js`
Expected: PASS，9 passed（4 選單 + 5 善書冊）

- [ ] **Step 6: 執行全套測試確認無回歸**

Run: `npm test`
Expected: 192 passed（183 + 9），18 個測試檔。特別確認 `tests/flow.test.js` 全過。

- [ ] **Step 7: Commit**

```bash
git add js/ui/nav.js js/flow.js tests/overlays.test.js
git commit -m "feat: 漢堡選單與善書冊疊層支援 Esc 與系統返回鍵關閉

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 本機目視驗收（game repo）

**Files:** 無異動

**Interfaces:**
- Consumes: Task 1–3 的成果
- Produces: 驗收結論；發現問題則回到對應 Task 修正

- [ ] **Step 1: 啟動本機伺服器**

```bash
npm run dev
```

在 `http://localhost:8000` 開啟。**必須用伺服器，不可直接雙擊 `index.html`** — `file://` 下 `pushState` 會被擋，返回鍵那條路測不到。

- [ ] **Step 2: 以 390×844（手機尺寸）逐項確認**

| 項目 | 預期 |
|---|---|
| 入口封面圖點一下 | 全螢幕、完整不裁切、淡入 |
| 大圖上點任一處 | 關閉，回到原畫面原捲動位置 |
| 進第一殿，場景主圖點一下 | 全螢幕，看得到版面上被裁掉的部分 |
| 直式立繪（審判階段）點一下 | 全螢幕完整顯示，不再被裁成 683:1024 |
| 孽鏡圖（1:1 裁切）點一下 | 全螢幕顯示完整原始比例 |
| 大圖右上 ✕ | 關閉 |
| 大圖開啟時按瀏覽器返回 | 關閉大圖，**不離開遊戲** |
| 漢堡選單開啟後按 Esc | 關閉選單 |
| 漢堡選單開啟後按返回鍵 | 關閉選單，不離開遊戲 |
| 選單→「翻閱善書冊」 | 善書冊正常開啟並**停留在畫面上** |
| 善書冊按 Esc／返回鍵 | 關閉善書冊 |
| 善書冊按「合上善書冊 ▸」 | 關閉善書冊 |
| 關閉所有疊層後按返回鍵 | 正常離開頁面（歷程無殘留） |

- [ ] **Step 3: 桌機寬版確認**

視窗拉到 ≥900px，確認「左圖右文」版位下場景主圖仍可點擊放大，大圖不被 `#app` 的 `max-width: 960px` 限制（應為滿版）。

- [ ] **Step 4: 記錄結果**

有問題回報並回到對應 Task 修正；全過則進入 Task 5。

---

### Task 5: 移植到 `hell-tour-family`

**Files（在 `C:\Users\yoyoc\Projects\hell-tour-family`）:**
- Create: `js/ui/layer.js`、`js/ui/lightbox.js`、`tests/layer.test.js`、`tests/lightbox.test.js`、`tests/overlays.test.js`
- Modify: `js/ui/render.js`、`js/ui/coverView.js`、`js/ui/nav.js`、`js/flow.js`、`css/style.css`

**Interfaces:**
- Consumes: game repo 已完成並驗收的實作
- Produces: family repo 同等功能

**分歧提醒（2026-07-28 diff 查核）：** `js/ui/render.js` 與 `js/ui/nav.js` 兩 repo 逐字相同，可直接複製整檔。`js/ui/coverView.js` 封面標題三行文字不同（family 為「地獄遊記」／「親 子 共 讀 版」／「乘蓮台・遊天堂・訪地府——回來，看看你的花樹。」），**不可整檔複製**，只手動加 import 與 `enableLightbox(art);` 一行。`js/flow.js` 整體分歧（family 多序章換景與回天看樹），`openBookletOverlay` 一段相同，**只手動改那一段**。`css/style.css` 分歧，樣式附加到檔尾。

- [ ] **Step 1: 複製可整檔複製的四個檔案**

```bash
cd "C:/Users/yoyoc/Projects/hell-tour-family"
cp ../hell-tour-game/js/ui/layer.js js/ui/layer.js
cp ../hell-tour-game/js/ui/lightbox.js js/ui/lightbox.js
cp ../hell-tour-game/js/ui/render.js js/ui/render.js
cp ../hell-tour-game/js/ui/nav.js js/ui/nav.js
cp ../hell-tour-game/tests/layer.test.js tests/layer.test.js
cp ../hell-tour-game/tests/lightbox.test.js tests/lightbox.test.js
cp ../hell-tour-game/tests/overlays.test.js tests/overlays.test.js
```

- [ ] **Step 2: 確認 render.js 與 nav.js 複製後無誤**

```bash
diff ../hell-tour-game/js/ui/render.js js/ui/render.js
diff ../hell-tour-game/js/ui/nav.js js/ui/nav.js
```

Expected: 兩者皆無輸出（完全相同）

- [ ] **Step 3: 手動改 `js/ui/coverView.js`**

檔首 import 改為：

```js
import { el } from './render.js';
import { enableLightbox } from './lightbox.js';
```

在 `box.appendChild(art);` 之前加一行 `enableLightbox(art);`。**封面標題三行文字不要動。**

- [ ] **Step 4: 手動改 `js/flow.js`**

檔首 import 區加入：

```js
import { pushLayer } from './ui/layer.js';
```

`openBookletOverlay()` 最後兩行改為：

```js
    document.body.appendChild(overlay);
    const layer = pushLayer(() => overlay.remove());
    renderBooklet(bookletEntries(), () => layer.close(), inner);
```

- [ ] **Step 5: 附加樣式到 `css/style.css` 檔尾**

複製 Task 2 Step 6 的整段 CSS（含註解）貼到 family 的 `css/style.css` 檔尾。**色值維持寫死，不要改成 CSS 變數** — 這正是為了 family 的 `theme-heaven`。

- [ ] **Step 6: 執行全套測試**

Run: `npm test`
Expected: 197 passed（167 + 9 + 12 + 9），18 個測試檔

**family 專屬風險**：`js/ui/coverView.js` 的封面標題文字若被 Step 1 誤複製覆蓋，`tests/html.test.js` 或既有封面測試會失敗。若出現此類失敗，先 `git diff js/ui/coverView.js` 確認三行文字是否被改成 game 版。

- [ ] **Step 7: 本機目視驗收**

```bash
npm run dev
```

以 Task 4 Step 2 的同一份表格逐項確認，**另加兩項**：

| 項目 | 預期 |
|---|---|
| 序章（天堂主題，白底）開啟大圖 | ✕ 鈕與「點任意處關閉」提示在黑底上清晰可見，非深色字壓黑底 |
| 序章開啟漢堡選單按 Esc | 關閉選單 |

- [ ] **Step 8: Commit**

```bash
git add js/ui/layer.js js/ui/lightbox.js js/ui/render.js js/ui/coverView.js js/ui/nav.js js/flow.js css/style.css tests/layer.test.js tests/lightbox.test.js tests/overlays.test.js
git commit -m "feat: 圖片點擊全螢幕檢視＋疊層 Esc／返回鍵關閉

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: 兩個 repo 最終確認**

```bash
cd "C:/Users/yoyoc/Projects/hell-tour-game" && npm test
cd "C:/Users/yoyoc/Projects/hell-tour-family" && npm test
git -C "C:/Users/yoyoc/Projects/hell-tour-game" status --short
git -C "C:/Users/yoyoc/Projects/hell-tour-family" status --short
```

Expected: 兩邊測試全過；工作區除既有未追蹤檔案外乾淨。

- [ ] **Step 10: 停下來，等使用者放行部署**

**不要 push。** 向使用者回報兩邊的測試數字與目視驗收結果，等待明示後才推上 GitHub Pages。
