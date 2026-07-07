import { createState, recordKarma, addWu, save, load, clearSave } from './state.js';
import { createPlayer } from './engine/scene.js';
import { createTrial, nextPhase, spotLie, judge, react, persuade, trialScore } from './engine/trial.js';
import { renderNode, el } from './ui/render.js';
import { renderTrialPhase, renderKarmaCard } from './ui/trialView.js';
import { renderResults } from './ui/results.js';
import { GAME_TITLE } from './config.js';

document.title = GAME_TITLE;
const root = document.getElementById('app');
let state = createState();

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`載入失敗：${path}`);
  return res.json();
}

function runScene(sceneData, onEnd) {
  const player = createPlayer(sceneData, {
    onKarma: (axis, delta, weight) => recordKarma(state, axis, delta, weight),
  });
  const step = () => {
    const node = player.current();
    if (node.type === 'end') { onEnd(); return; }
    renderNode(node, {
      onAdvance: () => { player.advance(); step(); },
      onChoose: (i) => { player.choose(i); step(); },
    }, root);
  };
  step();
}

function runIntroLines(lines, onEnd) {
  let i = 0;
  const step = () => {
    if (i >= lines.length) { onEnd(); return; }
    renderNode({ type: 'line', ...lines[i] }, {
      onAdvance: () => { i += 1; step(); },
    }, root);
  };
  step();
}

function runTrial(caseData, onEnd) {
  const trial = createTrial(caseData, {
    onKarma: (axis, delta, weight) => recordKarma(state, axis, delta, weight),
  });
  let message = '';
  const handlers = {
    onNextPhase: () => { message = ''; nextPhase(trial); step(); },
    onSpot: (i) => {
      const r = spotLie(trial, i);
      if (!r.hit) message = '濟公搖搖扇子：「這句倒是實話。再想想——孽鏡照見了什麼？」';
      else if (!r.allFound) message = '正是謊言！但破綻不只一處，再找找。';
      else { message = ''; nextPhase(trial); }
      step();
    },
    onJudge: (i) => {
      const r = judge(trial, i);
      if (!r.correct) message = '濟公低聲道：「再看看各獄所懲之罪——對得上他做的事嗎？」';
      else { message = ''; nextPhase(trial); }
      step();
    },
    onReact: (i) => { react(trial, i); step(); },
    onPersuade: (i) => { persuade(trial, i); nextPhase(trial); step(); },
    onFinish: () => { addWu(state, trialScore(trial)); onEnd(); },
  };
  const step = () => renderTrialPhase(trial, handlers, root, message);
  step();
}

async function main() {
  const [prologue, interlude, hall1] = await Promise.all([
    loadJSON('js/data/prologue.json'),
    loadJSON('js/data/interlude.json'),
    loadJSON('js/data/hall1.json'),
  ]);

  function setScreen(name) {
    state.progress.screen = name;
    save(state);
  }

  const screens = {
    prologue() { setScreen('prologue'); runScene(prologue, screens.interlude); },
    interlude() { setScreen('interlude'); runScene(interlude, screens.hall1); },
    hall1() {
      setScreen('hall1');
      runIntroLines(hall1.intro, () => runTrial(hall1, screens.card));
    },
    card() { setScreen('card'); renderKarmaCard(hall1.karmaCard, screens.results, root); },
    results() { setScreen('results'); renderResults(state, restart, root); },
  };

  function restart() {
    clearSave();
    state = createState();
    screens.prologue();
  }

  const saved = load();
  if (saved && saved.progress.screen !== 'prologue' && screens[saved.progress.screen]) {
    renderContinuePrompt(saved);
  } else {
    screens.prologue();
  }

  function renderContinuePrompt(savedState) {
    root.innerHTML = '';
    const box = el('div', 'scene-box');
    box.appendChild(el('div', 'speaker', '濟公'));
    box.appendChild(el('p', 'text', '「喲，回來啦。上回走到一半——要接著走，還是從頭來過？」'));
    const cont = el('button', 'btn btn-next', '繼續旅程');
    cont.addEventListener('click', () => {
      state = savedState;
      screens[savedState.progress.screen]();
    });
    const re = el('button', 'btn btn-choice', '重新開始');
    re.addEventListener('click', restart);
    box.appendChild(cont);
    box.appendChild(re);
    root.appendChild(box);
  }
}

main().catch((err) => {
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
