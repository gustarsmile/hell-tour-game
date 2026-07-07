# 幽冥之旅：地獄遊記（垂直切片）

依《地獄遊記》善書改編的教育類網頁遊戲。此為階段 1 垂直切片：
序章「陽間一日」→ 遇濟公 → 第一殿完整判案 → 因果卡 → 簡易結算。

設計文件：`g:\我的雲端硬碟\AI Cloud Database\Game\地獄遊記遊戲設計文件.md`

## 執行

- 開發預覽：`npm run dev` → http://localhost:8000
- 測試：`npm test`
- 部署：整個資料夾為純靜態網站，上傳 GitHub Pages / Firebase Hosting 即可

## 如何新增案例

1. 依 `js/data/hall1.json` 的格式新增 `js/data/hallN.json`
   （testimony 謊言 1–2 句、mirror 三格、judgement 三選一、persuasion 10/5/0）
2. 在 `tests/data.test.js` 加入該檔的驗證（照 hall1 區塊複製改名）
3. 在 `js/main.js` 的 `screens` 中串接新畫面
4. `npm test` 全綠即可

## 規格要點

- 悟性值上限 100；答錯經提示重答不得分
- 心性四軸 honesty/speech/filial/mercy；序章權重 ×2；總和 ≥0 判善
- 存檔 key `hellTourSave.v1`（localStorage，畫面粒度）
