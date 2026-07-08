import { startGame } from './flow.js';
import { renderError } from './ui/render.js';
import { clearSave } from './state.js';

const root = document.getElementById('app');

startGame({ root }).catch((err) => {
  renderError(err, () => { clearSave(); location.reload(); }, root);
});
