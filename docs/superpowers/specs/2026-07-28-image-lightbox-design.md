# 圖片點擊全螢幕檢視（lightbox）設計文件

日期：2026-07-28。狀態：使用者已於對話中逐項定案並口頭放行設計，待審此文件。
適用範圍：**本設計同時適用 `hell-tour-game` 與 `hell-tour-family` 兩個 repo**，兩份同名文件內容一致。

## 背景與目標

使用者需求原文：「圖片都可以點一下放大成全螢幕，再點一下就回到原來位置與大小。」

現況調查（兩 repo 一致）：

- 全部遊戲內插圖（41 張）都經由單一函式 `js/ui/render.js:8 artImg()` 產生，class 分為 `art-banner`／`art-figure`／`art-portrait`／`art-mirror`／`art-watch`／`art-ending`。
- 入口封面圖 `cover-art` 在 `js/ui/coverView.js:8` 另外直接建立，帶有「載入失敗改用 `jigong-main.webp`」的 fallback。
- **所有插圖皆為 `object-fit: cover` ＋固定 `aspect-ratio`（css/style.css:226-262），畫面上看到的圖是被裁切過的。** 因此全螢幕檢視的價值不只是放大，更是首次讓使用者看到完整未裁切的美術。
- 遊戲**完全未使用瀏覽器 history API**（`engine/scene.js` 的 `history` 是遊戲內部節點堆疊），亦未監聽任何 keydown。
- 既有疊層樣式可循：`#nav-overlay`（z-index 30）、`#booklet-overlay`（z-index 30）、`#nav-toast`（z-index 40）。兩者皆僅靠點擊關閉。

目標：所有圖片可點擊放大為全螢幕完整檢視，再點一下還原，且不改動任何既有遊戲流程。

## 已定案決策（使用者選定）

| 議題 | 決策 |
|---|---|
| 適用範圍 | **全部圖片，含入口封面** |
| 關閉方式 | 點任意處、右上 ✕ 鈕、Esc 鍵、**手機系統返回鍵**（四者皆要） |
| 放大深度 | **純檢視**：完整圖（contain）置中淡入。不做雙指縮放／拖曳，不做 FLIP 飛行動畫 |

## A. 架構

新增 `js/ui/lightbox.js`，模組內維護**單一**疊層實例，於第一次點圖時才建立並 append 到 `document.body`（lazy）。`index.html` 不新增任何節點，既有 `tests/html.test.js` 不受影響。

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

## B. 疊層外觀與版面

- 元素 id `lightbox`，`position: fixed; inset: 0; z-index: 35`（夾在漢堡選單／善書冊的 30 與提示浮層的 40 之間）。
- 底色 `rgba(0, 0, 0, 0.92)`，兩個 repo 主題（地府暗色／天堂白）通用。
- 大圖 `max-width: 100%; max-height: 100%; object-fit: contain`，**完整顯示不裁切**，四周留 16px padding。
- 右上角 44×44 ✕ 關閉鈕，沿用 `.nav-btn` 的金框圓鈕語彙，`aria-label="關閉大圖"`。
- 底部置中一行小字提示「點任意處關閉」（常駐，非首次限定）。
- 淡入淡出 0.18s：以 `opacity` ＋ `visibility` 過渡（不可用 `display`，否則無法過渡）。
- 游標：圖片上 `zoom-in`，疊層上 `zoom-out`。
- 開啟時鎖背景捲動：記錄 `document.body.style.overflow` 原值，關閉時還原原值（不硬設空字串）。

## C. 開關與 history 整合

**開啟**：設定大圖 src → 加 `open` class → 鎖捲動 → `pushState`。

**四條關閉路徑收斂到同一出口**：

| 觸發 | 路徑 |
|---|---|
| 點疊層任一處（**含大圖本身**） | `close()` |
| ✕ 鈕 | `close()` |
| Esc 鍵 | `close()`（keydown 掛 document，僅在疊層開啟時作用） |
| 系統返回鍵／iOS 左緣右滑 | `popstate` → 直接收尾 |

**history 成對規則**：開啟時 `history.pushState({ lightbox: 1 }, '')` 並設 `pushed = true`。前三種關法**一律先呼叫 `history.back()`**，由 `popstate` 統一執行 DOM 收尾並將 `pushed` 設回 false。如此不論從哪一條路關閉，推入的那筆歷程必被消耗，不累積髒歷程、不影響遊戲既有流程。

`pushed` 為 false 時（見降級）關閉直接執行 DOM 收尾。

## D. 降級與邊界

- **`file://` 直開**：`pushState` 在 `file://` 下會丟 `SecurityError`。以 try/catch 包覆，失敗則 `pushed` 保持 false，關閉走直接收尾路徑，功能完全正常，只是返回鍵不參與。
- **圖片載入失敗**：`artImg` 既有 error→remove 降級不變；元素已移除即無從點擊。封面則已有 fallback 換圖。
- **重複點擊**：疊層為單例，連點不會產生第二層；已開啟時再次開啟僅換 src。
- **既有互動衝突**：現有插圖皆無點擊行為，「繼續／選項」都是 `<button>`，無衝突。

## E. 無障礙取捨（明確決策）

圖片維持 `alt=''` 的裝飾性語意，**不加 `tabindex`、不改為 button 角色**。

理由：41 張圖全數進入 Tab 順序，對以手機觸控為主的目標使用者無益，反而使鍵盤使用者需按數十次 Tab 才走完一頁。

代價：**開啟大圖需要滑鼠或觸控**。但疊層一旦開啟即為鍵盤可操作 — ✕ 鈕可 focus、Esc 可關。此為刻意取捨，非疏漏。

## F. 兩個 repo 的套用方式

- `js/ui/render.js` 與 `js/ui/coverView.js` 兩 repo 目前**逐字相同**；無共用套件機制，同一份改動各套一次。
- `js/ui/lightbox.js` 為新檔，兩 repo 各放一份相同內容。
- `css/style.css` 兩 repo 已分歧（family 多天堂主題），新樣式各自附加於疊層區塊之後；疊層底色為中性黑，兩主題通用。
- `tests/lightbox.test.js` 為新檔，兩 repo 各放一份相同內容。

## G. 測試策略

新增 `tests/lightbox.test.js`（`// @vitest-environment happy-dom`，與既有測試一致），涵蓋：

1. `artImg()` 產出的圖帶有 `zoomable` class
2. 點圖後 body 出現 `#lightbox.open`，其中大圖 src 與原圖相同
3. 點疊層背景可關閉
4. 點大圖本身可關閉
5. Esc 可關閉
6. `popstate` 可關閉
7. 關閉後再開不會產生第二個疊層
8. `cover-art` 亦可放大（含 fallback 換圖後 src 正確）

既有測試相容性已查核：`tests/ui.test.js:135-137` 僅斷言 `src` 屬性，新增 class 與監聽不影響；`tests/html.test.js` 因不動 `index.html` 而不受影響。

守門不放寬：兩 repo `npm test` 全數通過（2026-07-28 實測基準：game 162、family 167，各 15 個測試檔，只增不減）。無新增圖片資產，僅增約 2KB JS/CSS，美術 6MB 守門不受影響。

完成後由控制者以 Playwright 390×844 目視驗收：場景主圖、直式立繪、孽鏡圖、結局圖、入口封面各點開一次並關閉；另確認 ≥900px 桌機「左圖右文」版位下正常。

## H. 範圍外（本設計不含）

- 雙指縮放、拖曳平移、多圖左右滑動切換。
- 圖片 alt 文字撰寫、鍵盤開啟大圖。
- 為漢堡選單與善書冊疊層補 Esc／返回鍵支援（既有行為不動，避免擴大範圍）。
- 部署上線 — 實作與測試完成後另行請使用者放行。
