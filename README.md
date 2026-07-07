# 幽冥之旅：地獄遊記（垂直切片）

依《地獄遊記》善書改編的教育類網頁遊戲。此為階段 1 垂直切片：
序章「陽間一日」→ 遇濟公 → 第一殿完整判案 → 因果卡 → 簡易結算。

設計文件：`g:\我的雲端硬碟\AI Cloud Database\Game\地獄遊記遊戲設計文件.md`

## 執行

- 開發預覽：`npm run dev` → http://localhost:8000
- 測試：`npm test`
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
- 存檔 key `hellTourSave.v1`（localStorage，畫面粒度）
