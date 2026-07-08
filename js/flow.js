import { GAME_TITLE } from './config.js';
import { createState, recordKarma, recordChoice, addWu, save, load, clearSave } from './state.js';
import { loadBooklet, addCard } from './booklet.js';
import { createPlayer } from './engine/scene.js';
import { createTrial, nextPhase, spotLie, judge, react, persuade, trialScore } from './engine/trial.js';
import { createVisit, nextVisitPhase, answerQuiz, chooseMercy, takeBranch, visitScore } from './engine/visit.js';
import { createFinale, nextFinalePhase, chooseMengpo } from './engine/finale.js';
import { renderNode, el } from './ui/render.js';
import { renderTrialPhase, renderKarmaCard } from './ui/trialView.js';
import { renderVisitPhase } from './ui/visitView.js';
import { renderFinalePhase } from './ui/finaleView.js';
import { renderBooklet } from './ui/bookletView.js';

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`載入失敗：${path}`);
  return res.json();
}

// intro 行陣列 → 純 line 場景（取代階段1的 runIntroLines，消除步進邏輯重複）
function linesToScene(lines) {
  return {
    id: 'lines',
    start: 'l0',
    nodes: [
      ...lines.map((l, i) => ({
        id: `l${i}`, type: 'line', ...l,
        next: i + 1 < lines.length ? `l${i + 1}` : 'fin',
      })),
      { id: 'fin', type: 'end' },
    ],
  };
}

export async function startGame({ root, loadJSON = fetchJSON, storage }) {
  document.title = GAME_TITLE;

  const flow = await loadJSON('js/data/flow.json');
  const resources = {};
  await Promise.all(
    flow.screens.filter((s) => s.src).map(async (s) => {
      resources[s.id] = await loadJSON(`js/data/${s.src}`);
    }),
  );

  let state = createState();
  const onKarma = (axis, delta, weight) => recordKarma(state, axis, delta, weight);
  const onChoice = (rec) => recordChoice(state, rec);

  function runScene(sceneData, onEnd) {
    const player = createPlayer(sceneData, { onKarma, onChoice });
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

  function runTrial(caseData, onEnd) {
    const trial = createTrial(caseData, { onKarma, onChoice });
    let message = '';
    const step = () => renderTrialPhase(trial, handlers, root, message);
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
      onFinish: () => {
        addWu(state, trialScore(trial));
        if (caseData.postScene) runScene(caseData.postScene, onEnd);
        else onEnd();
      },
    };
    step();
  }

  function runVisit(data, onEnd) {
    const visit = createVisit(data, { onKarma, onChoice });
    let message = '';
    const step = () => renderVisitPhase(visit, handlers, root, message);
    const handlers = {
      onNextPhase: () => { message = ''; nextVisitPhase(visit); step(); },
      onQuiz: (i) => {
        const r = answerQuiz(visit, i);
        message = r.correct ? '' : data.quiz.hint;
        step();
      },
      onMercy: (i) => { chooseMercy(visit, i); step(); },
      onBranchAccept: () => {
        takeBranch(visit, true);
        runScene(data.branch.scene, () => {
          addWu(state, data.branch.rewardWu ?? 0); // 隱藏功德，不顯示訊息
          nextVisitPhase(visit);
          step();
        });
      },
      onBranchDecline: () => { takeBranch(visit, false); step(); },
      onFinish: () => { addWu(state, visitScore(visit)); onEnd(); },
    };
    step();
  }

  function bookletEntries() {
    const owned = loadBooklet(storage);
    return flow.screens
      .filter((scr) => resources[scr.id] && resources[scr.id].karmaCard)
      .map((scr) => ({
        id: scr.id,
        hall: resources[scr.id].hall,
        card: resources[scr.id].karmaCard,
        owned: owned.includes(scr.id),
      }));
  }

  function runFinale(data) {
    const finale = createFinale(data, state);
    const step = () => renderFinalePhase(finale, handlers, root);
    const handlers = {
      onNextPhase: () => { nextFinalePhase(finale); step(); },
      onMengpo: (i) => { chooseMengpo(finale, i); step(); },
      onShare: () => step(), // Task 7 接真實作（分享卡）
      onBooklet: () => renderBooklet(bookletEntries(), step, root),
      onRestart: restart,
    };
    step();
  }

  const screens = {};
  flow.screens.forEach((scr, idx) => {
    const nextScr = flow.screens[idx + 1];
    const goNext = nextScr ? () => screens[nextScr.id]() : () => {};
    const collectCard = () => { addCard(scr.id, storage); goNext(); };
    screens[scr.id] = () => {
      state.progress.screen = scr.id;
      save(state, storage);
      const data = resources[scr.id];
      if (scr.type === 'scene') {
        runScene(data, goNext);
      } else if (scr.type === 'trial') {
        runScene(linesToScene(data.intro), () =>
          runTrial(data, () => renderKarmaCard(data.karmaCard, collectCard, root)));
      } else if (scr.type === 'visit') {
        runScene(linesToScene(data.intro), () =>
          runVisit(data, () => renderKarmaCard(data.karmaCard, collectCard, root)));
      } else if (scr.type === 'finale') {
        runScene(linesToScene(data.intro), () => runFinale(data));
      } else {
        throw new Error(`未知的畫面類型：${scr.type}`);
      }
    };
  });

  function restart() {
    clearSave(storage);
    state = createState();
    screens[flow.screens[0].id]();
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

  const saved = load(storage);
  const firstId = flow.screens[0].id;
  if (saved && saved.progress.screen !== firstId && screens[saved.progress.screen]) {
    renderContinuePrompt(saved);
  } else {
    screens[firstId]();
  }
}
