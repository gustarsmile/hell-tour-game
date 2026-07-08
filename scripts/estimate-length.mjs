import { readFileSync, readdirSync } from 'node:fs';

let chars = 0, interactions = 0, images = 0;
const walk = (v) => {
  if (typeof v === 'string') {
    chars += (v.match(/[一-鿿]/g) || []).length;
    if (v.endsWith('.webp')) images++;
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') {
    if (v.type === 'choice' || v.options || v.choices) interactions++;
    Object.values(v).forEach(walk);
  }
};
for (const f of readdirSync('js/data').filter((n) => n.endsWith('.json'))) {
  walk(JSON.parse(readFileSync(`js/data/${f}`, 'utf8')));
}
// 快讀 420 字/分＋每互動 8 秒＋每圖 4 秒；慢讀 220 字/分＋20 秒＋8 秒
const lo = Math.round(chars / 420 + (interactions * 8 + images * 4) / 60);
const hi = Math.round(chars / 220 + (interactions * 20 + images * 8) / 60);
console.log(JSON.stringify({ chars, interactions, images, estimate: `${lo}–${hi} 分鐘` }));
