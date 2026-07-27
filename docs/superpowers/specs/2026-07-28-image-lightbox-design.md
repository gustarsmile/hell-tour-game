# 圖片點擊全螢幕檢視＋疊層統一關閉 設計文件

日期：2026-07-28。狀態：使用者已於對話中逐項定案並放行設計（含追加的疊層統一關閉），待審此文件。
適用範圍：**本設計同時適用 `hell-tour-game` 與 `hell-tour-family` 兩個 repo**，兩份同名文件內容一致。

## 背景與目標

使用者需求原文：「圖片都可以點一下放大成全螢幕，再點一下就回到原來位置與大小。」追加：「順便幫漢堡選單和善書冊疊層補 Esc／返回鍵。」

現況調查（兩 repo 一致）：

- 全部遊戲內插圖（41 張）都經由單一函式 `js/ui/render.js:8 artImg()` 產生，class 分為 `art-banner`／`art-figure`／`art-portrait`／`art-mirror`／`art-watch`／`art-ending`。
- 入口封面圖 `cover-art` 在 `js/ui/coverView.js:8` 另外直接建立，帶有「載入失敗改用 `jigong-main.webp`」的 fallback。
- **所有插圖皆為 `object-fit: cover` ＋固定 `aspect-ratio`（css/style.css:226-262），畫面上看到的圖是被裁切過的。** 因此全螢幕檢視的價值不只是放大，更是首次讓使用者看到完整未裁切的美術。
- 遊戲**完全未使用瀏覽器 history API**（`engine/scene.js` 的 `history` 是遊戲內部節點堆疊），亦未監聽任何 keydown。
- 現存疊層恰為兩個，**生命週期模型不同**：
  - `#nav-overlay`（漢堡選單，z-index 30）— 常駐 DOM，以 `.open` class 開關（`nav.js:34-40`）。可點背景關、可按 ✕ 關。
  - `#booklet-overlay`（善書冊，z-index 30）— 每次開啟時新建、關閉時整個 `remove()`（`flow.js:207-215`）。**目前僅能靠「合上善書冊 ▸」按鈕關閉，點背景無效。**
- `renderShareOverlay` 雖名為 overlay，實際渲染進 `#app`（`flow.js:238`），是取代主畫面的 view 而非疊層。
- **`nav.js` 與善書冊疊層目前無任何測試覆蓋。**
- 目前不會發生疊層互疊：選單開啟善書冊前會先關閉自己（`nav.js:44`），善書冊內容不含圖片。

目標：所有圖片可點擊放大為全螢幕完整檢視；三個疊層（含新的大圖）一律可用 Esc 與系統返回鍵關閉；不改動任何既有遊戲流程。

## 已定案決策（使用者選定）

| 議題 | 決策 |
|---|---|
| 適用範圍 | **全部圖片，含入口封面** |
| 關閉方式 | 點任意處、右上 ✕ 鈕、Esc 鍵、**手機系統返回鍵**（四者皆要） |
| 放大深度 | **純檢視**：完整圖（contain）置中淡入。不做雙指縮放／拖曳，不做 FLIP 飛行動畫 |
| 既有疊層 | 漢堡選單與善書冊**一併補上** Esc 與系統返回鍵 |

## A. 共用疊層關閉管理：`js/ui/layer.js`（新檔）

三個疊層需要完全相同的「Esc ＋ 系統返回鍵」行為。history 的推入與消耗若各寫一份，極易寫錯而弄亂上一頁。故抽為單一模組集中管理。

**職責邊界**：`layer.js` 只管「何時該關」，**不碰任何疊層的 DOM**。各疊層維持自己既有的生命週期（class 切換或 remove），把「怎麼關」以回呼傳入。這使得兩種不同生命週期模型可共用同一套關閉語意。

**介面**：

```js
export function pushLayer(onClose)  // → { close() }
```

**行為規格**：

**歷程策略：全域恰好一筆，而非每層一筆。** 只要堆疊非空就持有一筆 `history` 紀錄；堆疊清空時才退掉它。模組狀態有二：`held`（目前是否持有那筆紀錄）、`consuming`（已呼叫 `back()`，正在等自己的 popstate 回音）。

- `pushLayer(onClose)` 將該層推入 LIFO 堆疊；**僅當 `held` 與 `consuming` 皆為 false 時**才 `history.pushState({ layer: true }, '')` 並設 `held = true`。首次呼叫時綁定 document 的 `keydown` 與 window 的 `popstate` 監聽（**全模組只綁一次**）。
- 回傳 handle 的 `close()`：
  - 該層已不在堆疊中 → 忽略（**冪等**）。
  - 否則**立即收尾**（自堆疊移除該層並呼叫其 `onClose()`），然後把「對帳」排入 **microtask**。
- 對帳（microtask 內執行）：堆疊仍非空 → 什麼都不做，保留那筆紀錄；堆疊已空且 `held` → 設 `held = false`、`consuming = true`、呼叫 `history.back()`。
- `popstate` 觸發：
  - `consuming` 為 true → 設回 false（這是自己 `back()` 的回音）；**若回音期間又開了新層且未持有紀錄，補推一筆**，確保返回鍵仍能關閉它。
  - 否則設 `held = false`（瀏覽器已替我們退掉那筆），堆疊非空則關閉最上層。
- Esc `keydown` → 堆疊非空時關閉最上層。

**為何是「全域一筆 + microtask 對帳」（2026-07-28 真實瀏覽器實測後的修正）**：`nav.js:44` 的 `menuAction` 為 `close(); fn();` 同步連續執行 — 關閉選單與開啟善書冊發生在同一輪。原設計（每層各推一筆、關閉即呼叫 `back()`、以 `pendingBacks` 計數器辨識回音）在 happy-dom 的單元測試下全過，但**在真實瀏覽器會壞**：`back()` 尚未落地時 `fn()` 已呼叫 `pushState`，而瀏覽器的 `back()` 解析為「回到呼叫當下的那一筆」之絕對位置而非「相對當前退一步」，導致歷程位置比內部帳目少一格。後續關閉善書冊再 `back()` 一次就多退一步，**整個離開遊戲跳到 about:blank**；Esc、返回鍵、「合上善書冊 ▸」三條關閉路徑皆中，100% 重現。

microtask 對帳從根本消除交錯：同一輪內關舊層又開新層時，對帳執行時堆疊已非空，**根本不會呼叫 `back()`**，`pushState` 與 `back()` 永不同時在途。`pendingBacks` 計數器因此廢除。

**收尾採立即執行、對帳才延後**：畫面即時反應不受影響，延後的只有歷程調整。

**測試環境限制（已實測）**：happy-dom v15 的 `history.back()` **不會**觸發 `popstate`（`pushState`、手動 dispatch `PopStateEvent`、`keydown` 皆正常）。測試中以 `vi.spyOn(window.history, 'back')` 取代，於下一個 macrotask dispatch `PopStateEvent`；此 stub 同時作為 `history.back()` 呼叫次數的斷言依據。

**單元測試無法取代真實瀏覽器驗收（本專案的實證教訓）**：happy-dom 沒有真正的歷程索引，`back()` 是我們自己 mock 的，因此**任何與歷程位置相關的錯誤在單元測試中結構上不可見**。上述 about:blank 缺陷在 192 個單元測試全過的情況下存在，是靠 Playwright 實機驗收才發現。凡動到 `layer.js` 的歷程策略，**一律必須在真實瀏覽器複驗**「選單→翻閱善書冊→以三種方式關閉」與「關閉所有疊層後按返回鍵應正常離開頁面」兩條路徑。

**已知限制（可接受）**：非最上層的疊層以自身按鈕關閉時仍會呼叫 `history.back()`，順序上可能消耗到他層的歷程。此情形僅在疊層互疊時發生，而本 app 目前不存在互疊（見背景調查），故不額外處理。測試中以「單層不變式」斷言此前提。

**測試用匯出**：`layerDepth()` 回傳目前堆疊深度、`resetLayers()` 清空堆疊與監聽狀態。兩者僅供測試使用（模組狀態在同一測試檔內跨案例殘留），正式流程不呼叫。

## B. 大圖檢視：`js/ui/lightbox.js`（新檔）

模組內維護**單一**疊層實例，於第一次點圖時才建立並 append 到 `document.body`（lazy）。`index.html` 不新增任何節點，既有 `tests/html.test.js` 不受影響。

對外介面單一：

```js
export function enableLightbox(img)
```

行為：為傳入的 `<img>` 加上 `zoomable` class，並掛上 click 監聽。

掛載點僅兩處：

| 檔案 | 位置 | 涵蓋 |
|---|---|---|
| `js/ui/render.js` | `artImg()` 回傳前 | 場景主圖、內嵌立繪、審判立繪、孽鏡圖、探視圖、結局圖（全部 41 張） |
| `js/ui/coverView.js` | `cover-art` 建立後 | 入口封面 |

點擊時取 `img.currentSrc || img.src`（**於點擊當下讀取**，而非掛載時），使封面的 fallback 換圖後仍指向正確來源。

開啟時透過 `pushLayer()` 註冊，關閉一律經由該 handle 的 `close()`。

## C. 大圖疊層的外觀與版面

- 元素 id `lightbox`，`position: fixed; inset: 0; z-index: 35`（高於既有兩疊層的 30，低於提示浮層的 40）。
- 底色 `rgba(0, 0, 0, 0.92)`，兩個 repo 主題（地府暗色／天堂白）通用。
- **疊層自身的 ✕ 鈕與提示文字一律使用寫死的暗色主題色值，不使用 CSS 變數**：`--gold` `#c9a227`、`--gold-dim` `#8a7020`、`--paper-dim` `#cbbc9c`。原因：family repo 的 `body.theme-heaven` 會把這些變數翻成深色（`--paper-dim` → `#8a795e`、`--gold` → `#a9832a`），而大圖底色恆為黑，沿用變數會在天堂主題下變成深色字壓黑底。
- 大圖 `max-width: 100%; max-height: 100%; object-fit: contain`，**完整顯示不裁切**，四周留 16px padding。
- 右上角 44×44 ✕ 關閉鈕，沿用 `.nav-btn` 的金框圓鈕語彙，`aria-label="關閉大圖"`。
- 底部置中一行小字提示「點任意處關閉」（常駐，非首次限定）。
- 淡入淡出 0.18s：以 `opacity` ＋ `visibility` 過渡（不可用 `display`，否則無法過渡）。
- 游標：圖片上 `zoom-in`，疊層上 `zoom-out`。
- 開啟時鎖背景捲動：記錄 `document.body.style.overflow` 原值，關閉時還原原值（不硬設空字串）。**此項僅大圖疊層採用**，既有兩疊層的捲動行為維持原狀。

## D. 三個疊層的接入

| 疊層 | 註冊時機 | `onClose` 回呼 | 既有關閉入口改為 |
|---|---|---|---|
| 大圖 `#lightbox` | 開啟時 | 移除 `.open`、還原捲動 | 點疊層任一處（含大圖本身）、✕ 鈕 → `close()` |
| 漢堡選單 `#nav-overlay` | `nav.js` 的 `open()` | `overlay.classList.remove('open')` | 點背景、✕ 鈕、選單項目、`menuBtn` 再按一次 → `close()` |
| 善書冊 `#booklet-overlay` | `flow.js` 的 `openBookletOverlay()` | `overlay.remove()` | 「合上善書冊 ▸」→ `close()` |

改動極薄：`nav.js` 的 `close()`／`open()` 內部改走 handle，對外的 `closeMenu` 等既有介面與呼叫端**簽名完全不變**；`flow.js` 僅將 `renderBooklet` 的 `onBack` 回呼由 `() => overlay.remove()` 改為 handle 的 `close()`。

## E. 降級與邊界

- **`file://` 直開**：`pushState` 在 `file://` 下會丟 `SecurityError`。以 try/catch 包覆，失敗則該層標記為未推入歷程，關閉走直接收尾路徑，Esc 與點擊關閉完全正常，僅返回鍵不參與。
- **圖片載入失敗**：`artImg` 既有 error→remove 降級不變；元素已移除即無從點擊。封面則已有 fallback 換圖。
- **重複點擊**：大圖疊層為單例，連點不會產生第二層；已開啟時再次開啟僅換 src。
- **重複關閉**：`close()` 冪等，選單「點背景」與「✕」等多重入口不會重複消耗歷程。
- **既有互動衝突**：現有插圖皆無點擊行為，「繼續／選項」都是 `<button>`，無衝突。

## F. 無障礙取捨（明確決策）

圖片維持 `alt=''` 的裝飾性語意，**不加 `tabindex`、不改為 button 角色**。

理由：41 張圖全數進入 Tab 順序，對以手機觸控為主的目標使用者無益，反而使鍵盤使用者需按數十次 Tab 才走完一頁。

代價：**開啟大圖需要滑鼠或觸控**。但疊層一旦開啟即為鍵盤可操作 — ✕ 鈕可 focus、Esc 可關。此為刻意取捨，非疏漏。

## G. 兩個 repo 的套用方式

- 檔案分歧情形已逐一 diff 查核（2026-07-28）：`js/ui/render.js` 與 `js/ui/nav.js` 兩 repo **逐字相同**；`js/ui/coverView.js` 僅封面標題／副標／tagline 三行文字不同，**`cover-art` 建立段落相同**；`js/flow.js` 整體已分歧（family 多序章換景與回天看樹），但 `openBookletOverlay` 一段相同。無共用套件機制，同一份改動各套一次。
- `js/ui/layer.js`、`js/ui/lightbox.js` 為新檔，兩 repo 各放一份相同內容。
- `css/style.css` 兩 repo 已分歧（family 多天堂主題），新樣式各自附加於疊層區塊之後；疊層底色為中性黑，兩主題通用。
- `tests/layer.test.js`、`tests/lightbox.test.js`、`tests/overlays.test.js` 為新檔，兩 repo 各放一份相同內容。既有疊層的測試獨立成 `overlays.test.js`（不併入 `lightbox.test.js`）：這些測試需清除 body 內的疊層節點，與大圖疊層的模組單例共處一檔會造成跨測試污染。

## H. 測試策略

新增測試檔（`// @vitest-environment happy-dom`，與既有測試一致）：

**`tests/layer.test.js`** — 關閉語意的核心，優先以 TDD 撰寫：

1. Esc 關閉最上層並觸發其 `onClose`
2. `popstate` 關閉最上層
3. handle 的 `close()` 觸發 `onClose`
4. `close()` 冪等：重複呼叫只觸發一次 `onClose`
5. 開關一輪後歷程成對：`pushState` 與 `back` 呼叫次數相等
6. 堆疊為空時 Esc 與 `popstate` 皆為 no-op
7. `pushState` 拋錯（模擬 `file://`）時仍可正常關閉，且不呼叫 `history.back()`
8. 多次開關不重複綁定 document 監聽器
9. **關鍵回歸**：關閉一層後同步開啟另一層，前者 `back()` 引發的 popstate **不得**關閉後者（`menuAction` 的 `close(); fn();` 情境）

**`tests/lightbox.test.js`**：

1. `artImg()` 產出的圖帶有 `zoomable` class
2. 點圖後 body 出現 `#lightbox.open`，其中大圖 src 與原圖相同
3. 點疊層背景可關閉
4. 點大圖本身可關閉
5. Esc 可關閉
6. `popstate` 可關閉
7. 關閉後再開不會產生第二個疊層
8. 開啟鎖背景捲動、關閉還原為原值
9. `cover-art` 亦可放大（含 fallback 換圖後 src 正確）

**既有疊層的新增覆蓋**（此二者原本無測試）：

10. 漢堡選單（測試對象 `createNav(doc)`）：開啟後 Esc 關閉、`popstate` 關閉、點背景仍可關閉（不回歸）、`menuBtn` 再按一次仍可關閉
11. 善書冊（測試路徑：`startGame` 傳入假 nav 攔下 `nav.setMenu(cfg)`，再呼叫 `cfg.onBooklet()` 開啟，無須深度驅動遊戲）：開啟後 Esc 關閉、`popstate` 關閉、「合上善書冊」仍可關閉（不回歸）
12. 「翻閱善書冊」端到端：經選單項目開啟後善書冊**仍在畫面上**（驗證 `pendingBacks` 在真實呼叫路徑上生效）
13. 單層不變式：任一時點 `layerDepth()` 不超過 1

既有測試相容性已查核：`tests/ui.test.js:135-137` 僅斷言 `src` 屬性，新增 class 與監聽不影響；`tests/html.test.js` 因不動 `index.html` 而不受影響。

守門不放寬：兩 repo `npm test` 全數通過（2026-07-28 實測基準：game 162、family 167，各 15 個測試檔，只增不減）。無新增圖片資產，僅增約 3KB JS/CSS，美術 6MB 守門不受影響。

完成後由控制者以 Playwright 390×844 目視驗收：場景主圖、直式立繪、孽鏡圖、結局圖、入口封面各點開一次並關閉；漢堡選單與善書冊各以 Esc 關閉一次；另確認 ≥900px 桌機「左圖右文」版位下正常。

## I. 範圍外（本設計不含）

- 雙指縮放、拖曳平移、多圖左右滑動切換。
- 圖片 alt 文字撰寫、鍵盤開啟大圖。
- **為善書冊疊層補「點背景關閉」** — 它現在只能按按鈕關。加了會與選單一致，但閱讀中誤觸即關閉的風險較高，且非本次所求，故不動。
- `renderShareOverlay`（分享卡）— 它是 `#app` 內的 view 而非疊層，已有自己的返回路徑。
- 部署上線 — 實作與測試完成後另行請使用者放行。
