# 幽冥之旅：地獄遊記

依《地獄遊記》善書改編的教育類網頁遊戲。此為完整一輪遊（v1.1）：
入口封面（完整遊歷／精簡速覽）→ 序章「陽間一日」四抉擇 → 十殿見習（四完整判案殿＋五見聞殿＋枉死城支線＋望鄉臺） → 第十殿結算關（孟婆亭、悟性公布、孽鏡反照、四象限結局、還陽善書使命） → 善書冊與稱號分享卡。

一輪時長：完整版實測估算 26–51 分鐘（`node scripts/estimate-length.mjs`）；精簡版走 `flow.json` 的 `modes.lite` 精選六站，約 12–20 分鐘。

## v1.1 介面與計分（2026-07）

- **入口封面**：`cover.webp`＋完整／精簡兩種模式，有存檔顯示「繼續旅程」。模式清單在 `flow.json` 的 `modes`。
- **固定導覽**：左上「◂ 返回上一頁」（對話回上一句／階段回上一步／殿間回上一殿；不可跨選擇改選）與「☰ 遊歷選單」（各殿直達＋一句簡介 `tagline`、善書冊疊層、儲存進度、回封面）。
- **圖片預載**：開場後在背景把全部插圖逐張拉進快取（`js/preload.js`），CSS `aspect-ratio` 先保留版位，換頁不再「文字先出、圖片後跳」。
- **寬幕雙欄**：≥900px 時場景框左圖右文（`sceneFrame` 的 `.scene-art`／`.scene-body`）。
- **分享卡**：優先 Web Share API（手機系統分享面板可傳圖），其次 blob 下載連結，最後長按儲存提示。
- **悟性新制**：分殿計分（`wuByScreen`，重玩／跳殿整殿重計）；最終悟性＝原始分／該模式滿分×100，再按惡選扣分（每筆 `KARMA_PENALTY`×權重）。滿分需全對又全善，不再因總分超過上限而寬鬆。

設計文件：`g:\我的雲端硬碟\AI Cloud Database\Game\地獄遊記遊戲設計文件.md`

## 執行

- 開發預覽：`npm run dev` → http://localhost:8000
- 測試：`npx vitest run`
- 部署：整個資料夾為純靜態網站，上傳 GitHub Pages / Firebase Hosting 即可

## 部署（GitHub Pages）

正式網址：`https://gustarsmile.github.io/hell-tour-game/`（`js/config.js` 的 `GAME_URL`）。

1. GitHub repo（帳號 `gustarsmile`）啟用 Settings → Pages，來源選根目錄（本專案無建置步驟，純靜態檔案直接發佈）。
2. Push 到預設分支後，GitHub Pages 會自動部署上述網址。

### 改網址三步驟

若日後更換部署網址（例如換帳號、換自訂網域），依序：

1. 改 `js/config.js` 的 `GAME_URL`
2. 重跑 `npm run gen-qr`（重產 `assets/qr.png`）
3. 跑 `npx vitest run tests/qr.test.js` 守門——`assets/qr.png` 解碼結果必須恆等於 `GAME_URL`，測試綠燈才算改完

### 現場 QR 列印

`assets/qr.png` 是可直接列印的成品圖（420×420，米黃底／墨色碼），廟方可直接取用列印張貼，不需另外產生。

### 社群分享（og 標籤）

`index.html` 內建 Open Graph 標籤（`og:title`／`og:description`／`og:url`／`og:image`），連結貼到 LINE／Facebook 等社群通訊軟體時會顯示標題、簡介與 `assets/og.png` 封面圖。網址變更時記得同步更新 `og:url`／`og:image` 兩個標籤（`tests/html.test.js` 會守門其內容須與 `GAME_URL` 一致）。

## 擴充內容（階段2起）

流程由 `js/data/flow.json` 資料驅動。新增一殿：

1. 新增 `js/data/hallN.json`
   - 完整判案殿：`type: "full"`（five-step 案例格式，可選 `react` 反應段與 `postScene` 尾場景）
   - 見聞殿：`type: "visit"`（`watch` 觀刑＋`quiz` 考題或 `mercy` 慈悲抉擇，可選 `branch` 支線）
   - 並在 JSON 附上 `art` 欄位（對應 `assets/art/` 內的 webp，見 `tests/data.test.js` 守門）
2. 在 `flow.json` 的對應位置插入一行 `{ "id": "hallN", "type": "trial"|"visit", "src": "hallN.json" }`
3. `npx vitest run`——`tests/data.test.js` 自動驗證新 JSON 結構，`tests/flow.test.js` 的 autoplay 自動通關涵蓋新殿

不需要改任何程式碼。

### 資料慣例（測試守門）

- 供詞謊言 1–2 句、孽鏡三格、勸化選項分數 10/5/0 且最佳句在第 0 位
- 凡帶 karma 的選擇列表，第 0 個選項為最善（delta ≥ 0）
- 凡帶 karma 的選擇列表，最末選項 delta ≤ 0（最惡）
- 因果卡 `source.chapter` 為原著回數（null 則 UI 不顯示出處），連結指向該回文字版
- 結算關孟婆亭 `mengpo.choices[0].drank === false`（首選為「不喝」）

## 規格要點

- 悟性值＝分殿原始分／該模式滿分 ×100，再扣心性分（`finalWu`；判案殿滿分 30、考題 5、支線 rewardWu）；答錯經提示重答不得分
- 心性四軸 honesty/speech/filial/mercy，由 `choices` 推導；序章權重 ×2；總和 ≥0 判善；每筆惡選另扣悟性 `KARMA_PENALTY`×權重
- 存檔：
  - `hellTourSave.v3`：進行中旅程（localStorage，畫面粒度，含 mode 與分殿得分），重新開始即清除；偵測到 v2 舊檔自動遷移
  - `hellTourBooklet.v1`：善書冊紀錄（localStorage），跨輪保留
- 四象限結局表（悟性 ≥ 70 × 心性善惡）：`highGood`（大覺大悟·代天宣化）、`highBad`（滿腹經綸·知易行難）、`lowGood`（不識一字·菩薩心腸）、`lowBad`（執迷不悟·輪迴重修）
- QR 碼生成：`npm run gen-qr`——部署網址（`js/config.js` 的 `GAME_URL`）變更時重新產生 `assets/qr.png`
