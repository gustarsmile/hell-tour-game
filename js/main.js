import { startGame } from './flow.js';
import { renderError, el } from './ui/render.js';
import { clearSave } from './state.js';
import { createAudio } from './audio.js';

const root = document.getElementById('app');
const audio = createAudio();

document.addEventListener('pointerdown', function once() {
  document.removeEventListener('pointerdown', once);
  audio.startAmbient(); // 首次手勢後才允許出聲（瀏覽器 autoplay 政策）
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .testimony-line.clickable')) audio.tick();
});

const mute = el('button', null, audio.isEnabled() ? '音' : '靜');
mute.id = 'audio-toggle';
mute.setAttribute('aria-label', '音效開關');
mute.addEventListener('click', () => { mute.textContent = audio.toggle() ? '音' : '靜'; });
document.body.appendChild(mute);

startGame({ root, audio }).catch((err) => {
  renderError(err, () => { clearSave(); location.reload(); }, root);
});
