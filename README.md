# 幽冥之旅：地獄遊記

依《地獄遊記》善書改編的教育類網頁遊戲。此為完整一輪遊（v0.3）：
序章「陽間一日」四抉擇 → 十殿見習（四完整判案殿＋五見聞殿＋枉死城支線＋望鄉臺） → 第十殿結算關（孟婆亭、悟性公布、孽鏡反照、四象限結局、還陽善書使命） → 善書冊與稱號分享卡。

設計文件：`g:\我的雲端硬碟\AI Cloud Database\Game\地獄遊記遊戲設計文件.md`

## 執行

- 開發預覽：`npm run dev` → http://localhost:8000
- 測試：`npx vitest run`
- 部署：整個資料夾為純靜態網站，上傳 GitHub Pages / Firebase Hosting 即可

## 擴充內容（階段2起）

流程由 `js/data/flow.json` 資料驅動。新增一殿：

1. 新增 `js/data/hallN.json`
   - 完整判案殿：`type: "full"`（five-step 案例格式，可選 `react` 反應段與 `postScene` 尾場景）
   - 見聞殿：`type: "visit"`（`watch` 觀刑＋`quiz` 考題或 `mercy` 慈悲抉擇，可選 `branch` 支線）
2. 在 `flow.json` 的對應位置插入一行 `{ "id": "hallN", "type": "trial"|"visit", "src": "hallN.json" }`
3. `npx vitest run`——`tests/data.test.js` 自動驗證新 JSON 結構，`tests/flow.test.js` 的 autoplay 自動通關涵蓋新殿

不需要改任何程式碼。

### 資料慣例（測試守門）

- 供詞謊言 1–2 句、孽鏡三格、勸化選項分數 10/5/0 且最佳句在第 0 位
- 凡帶 karma 的選擇列表，第 0 個選項為最善（delta ≥ 0）
- 因果卡 `source.chapter` 為原著回數（null 則 UI 不顯示出處），連結指向該回文字版

## 規格要點

- 悟性值上限 100；答錯經提示重答不得分
- 心性四軸 honesty/speech/filial/mercy；序章權重 ×2；總和 ≥0 判善
- 存檔：
  - `hellTourSave.v2`：進行中旅程（localStorage，畫面粒度），重新開始即清除
  - `hellTourBooklet.v1`：善書冊紀錄（localStorage），跨輪保留
- 四象限結局表（悟性 ≥ 70 × 心性善惡）：`highGood`（大覺大悟·代天宣化）、`highBad`（滿腹經綸·知易行難）、`lowGood`（不識一字·菩薩心腸）、`lowBad`（執迷不悟·輪迴重修）
- QR 碼生成：`npm run gen-qr`——部署網址（`js/config.js` 的 `GAME_URL`）變更時重新產生 `assets/qr.png`
