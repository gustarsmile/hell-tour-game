export const GAME_TITLE = '幽冥之旅：地獄遊記';
export const WU_CAP = 100;
export const WU_THRESHOLD = 70; // 悟性 ≥ 70 為「高」（設計 §3.5 四象限）
export const KARMA_PENALTY = 4; // 每一筆惡選（權重 1）扣的悟性分
export const PROLOGUE_ID = 'prologue'; // 序章畫面 id（孽鏡反照過濾用，與 flow.json 首畫面一致）
export const DEFAULT_MODE = 'full'; // 遊歷模式：full 十殿全程／lite 精簡速覽（flow.json modes）

// 部署定址：GitHub Pages（帳號 gustarsmile）。改此值後必須重跑 npm run gen-qr。
export const GAME_URL = 'https://gustarsmile.github.io/hell-tour-game/';
