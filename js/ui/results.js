import { el } from './render.js';
import { AXES, AXIS_LABELS, karmaVerdict } from '../state.js';

export function renderResults(state, onRestart, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box results');
  box.appendChild(el('div', 'card-title', '見 習 小 結'));
  box.appendChild(el('p', 'wu-score', `悟性值 ${state.wu} ／ 100`));
  const good = karmaVerdict(state) === 'good';
  box.appendChild(el('p', 'verdict', good
    ? '心性總評：善。此行心存善念，難能可貴。'
    : '心性總評：惡。所見所聞，當引以為戒。'));
  const list = el('div', 'axis-list');
  AXES.forEach((a) => {
    const v = state.karma[a];
    const sign = v > 0 ? `＋${v}` : v < 0 ? `－${-v}` : '0';
    list.appendChild(el('p', 'axis-row', `${AXIS_LABELS[a]}　${sign}`));
  });
  box.appendChild(list);
  box.appendChild(el('p', 'text', '——十殿見習至此。孟婆亭、孽鏡反照與四象限結局，將於下一程開啟。'));
  const btn = el('button', 'btn btn-next', '重新開始');
  btn.addEventListener('click', onRestart);
  box.appendChild(btn);
  root.appendChild(box);
}
