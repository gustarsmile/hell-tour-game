import { el } from './render.js';

// 入口封面：選「完整遊歷」或「精簡速覽」，有存檔時可續玩
export function renderCover({ resumable, modes }, handlers, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box cover-box');

  const art = el('img', 'cover-art');
  art.alt = '';
  art.decoding = 'async';
  art.src = 'assets/art/cover.webp';
  art.addEventListener('error', () => { art.src = 'assets/art/jigong-main.webp'; }, { once: true });
  box.appendChild(art);

  const body = el('div', 'cover-body');
  body.appendChild(el('div', 'cover-title', '幽冥之旅'));
  body.appendChild(el('div', 'cover-subtitle', '地 獄 遊 記'));
  body.appendChild(el('p', 'cover-tagline', '聽供詞・照孽鏡・斷因果・勸亡魂——最後，照照你自己。'));

  if (resumable) {
    const cont = el('button', 'btn btn-next cover-btn', '繼續旅程');
    cont.addEventListener('click', handlers.onResume);
    body.appendChild(cont);
  }

  const full = el('button', `btn ${resumable ? 'btn-choice' : 'btn-next'} cover-btn`);
  full.appendChild(el('strong', 'opt-name', modes.full.label));
  full.appendChild(el('span', 'opt-desc', modes.full.desc));
  full.addEventListener('click', () => handlers.onStart('full'));
  body.appendChild(full);

  const lite = el('button', 'btn btn-choice cover-btn');
  lite.appendChild(el('strong', 'opt-name', modes.lite.label));
  lite.appendChild(el('span', 'opt-desc', modes.lite.desc));
  lite.addEventListener('click', () => handlers.onStart('lite'));
  body.appendChild(lite);

  body.appendChild(el('p', 'hint cover-hint', '進度自動儲存於此瀏覽器，左上「☰」可直達各殿。'));
  box.appendChild(body);
  root.appendChild(box);
}
