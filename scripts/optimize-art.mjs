import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';

const SRC = 'art-src', OUT = 'assets/art';
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(SRC).filter((n) => n.endsWith('.png'))) {
  const name = f.replace(/\.png$/, '');
  await sharp(`${SRC}/${f}`)
    .resize({ width: 1024, height: 1024, fit: 'inside' })
    .webp({ quality: 60 })
    .toFile(`${OUT}/${name}.webp`);
  console.log(name + '.webp');
}
// 社群分享預覽圖（og:image 用，Task 9 引用；palette PNG 壓縮避免 LINE/FB 爬蟲抓圖過重被跳過）
// quality:80 仍達 574KB，超過 500KB 守門；降至 60 並拉高壓縮層級後為 432KB，留有餘裕
await sharp(`${SRC}/hall1-scene.png`)
  .resize(1200, 630, { fit: 'cover' })
  .png({ palette: true, quality: 60, compressionLevel: 9, effort: 10 })
  .toFile('assets/og.png');
console.log('assets/og.png');
