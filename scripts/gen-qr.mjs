// 開發機執行：npm run gen-qr（部署網址變更時重跑）
import { writeFile, mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';
import { GAME_URL } from '../js/config.js';

const buf = await QRCode.toBuffer(GAME_URL, {
  width: 420,
  margin: 1,
  color: { dark: '#17130f', light: '#efe3c8' },
});
await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
await writeFile(new URL('../assets/qr.png', import.meta.url), buf);
console.log(`assets/qr.png 已產生（${GAME_URL}）`);
