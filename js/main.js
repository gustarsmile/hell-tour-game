import { startGame } from './flow.js';
import { el } from './ui/render.js';
import { clearSave } from './state.js';

const root = document.getElementById('app');

startGame({ root }).catch((err) => {
  root.innerHTML = '';
  const box = el('div', 'scene-box');
  box.appendChild(el('div', 'speaker', '系統'));
  box.appendChild(el('p', 'text', '劇情資料載入失敗。請透過網頁伺服器開啟本遊戲（不要直接雙擊 index.html），或重新整理再試一次。'));
  box.appendChild(el('p', 'hint', String(err)));
  const btn = el('button', 'btn btn-next', '重新開始');
  btn.addEventListener('click', () => { clearSave(); location.reload(); });
  box.appendChild(btn);
  root.appendChild(box);
});
