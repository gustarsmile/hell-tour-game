import { el, NUM, hallLabel, artImg, sceneFrame } from './render.js';
import { lieIndexes } from '../engine/trial.js';

export function renderTrialPhase(trial, handlers, root, message = '') {
  root.innerHTML = '';
  const c = trial.caseData;
  const frame = sceneFrame('scene-box trial-box', c.art?.scene);
  const box = frame.body; // 內容進右欄（窄幕時在主圖下方）
  box.appendChild(el('div', 'hall-title', `${hallLabel(c.hall)}・${c.king}`));

  if (trial.phase === 'testimony') {
    box.appendChild(el('div', 'speaker', `罪魂 ${c.soul.name}（${c.soul.title}）供詞`));
    if (c.art?.soul) box.appendChild(artImg(c.art.soul, 'art-portrait'));
    const scroll = el('div', 'testimony');
    c.testimony.forEach((s) => scroll.appendChild(el('p', 'testimony-line', s.text)));
    box.appendChild(scroll);
    appendNext(box, '照孽鏡 ▸', handlers.onNextPhase);
  } else if (trial.phase === 'mirror') {
    box.appendChild(el('div', 'speaker', '孽鏡臺'));
    box.appendChild(el('p', 'text', c.mirrorIntro));
    const panels = el('div', 'mirror-panels');
    c.mirror.forEach((m, i) => {
      const p = el('div', 'mirror-panel');
      p.appendChild(el('div', 'mirror-num', `其${NUM[i]}`));
      if (c.art?.mirror?.[i]) p.appendChild(artImg(c.art.mirror[i], 'art-mirror'));
      p.appendChild(el('p', 'mirror-caption', m.caption));
      panels.appendChild(p);
    });
    box.appendChild(panels);
    appendNext(box, '指出破綻 ▸', handlers.onNextPhase);
  } else if (trial.phase === 'spot') {
    const lieCount = lieIndexes(c).length;
    box.appendChild(el('p', 'hint', `孽鏡不會說謊。點出供詞中說謊的句子（共 ${lieCount} 句）。`));
    const scroll = el('div', 'testimony');
    c.testimony.forEach((s, i) => {
      const line = el('button', 'testimony-line clickable', s.text);
      if (trial.foundLies.has(i)) {
        line.classList.add('found');
        line.disabled = true;
      }
      line.addEventListener('click', () => handlers.onSpot(i));
      scroll.appendChild(line);
    });
    box.appendChild(scroll);
    if (message) box.appendChild(el('p', 'feedback', message));
  } else if (trial.phase === 'judge') {
    box.appendChild(el('div', 'speaker', '斷因果'));
    box.appendChild(el('p', 'text', c.judgeLine));
    box.appendChild(el('p', 'hint', c.judgement.question));
    const list = el('div', 'choices');
    c.judgement.options.forEach((o, i) => {
      const btn = el('button', 'btn btn-choice');
      btn.appendChild(el('strong', 'opt-name', o.name));
      btn.appendChild(el('span', 'opt-desc', o.desc));
      btn.addEventListener('click', () => handlers.onJudge(i));
      list.appendChild(btn);
    });
    box.appendChild(list);
    if (message) box.appendChild(el('p', 'feedback', message));
  } else if (trial.phase === 'react') {
    box.appendChild(el('div', 'speaker', '殿前'));
    box.appendChild(el('p', 'text', c.react.prompt));
    if (trial.reactReply == null) {
      const list = el('div', 'choices');
      c.react.choices.forEach((o, i) => {
        const btn = el('button', 'btn btn-choice', o.text);
        btn.addEventListener('click', () => handlers.onReact(i));
        list.appendChild(btn);
      });
      box.appendChild(list);
    } else {
      box.appendChild(el('p', 'text', trial.reactReply));
      appendNext(box, '繼續 ▸', handlers.onNextPhase);
    }
  } else if (trial.phase === 'persuade') {
    box.appendChild(el('div', 'speaker', '勸化'));
    box.appendChild(el('p', 'text', c.persuasion.prompt));
    const list = el('div', 'choices');
    c.persuasion.options.forEach((o, i) => {
      const btn = el('button', 'btn btn-choice', o.text);
      btn.addEventListener('click', () => handlers.onPersuade(i));
      list.appendChild(btn);
    });
    box.appendChild(list);
  } else if (trial.phase === 'done') {
    box.appendChild(el('p', 'text', trial.persuadeReaction ?? ''));
    box.appendChild(el('p', 'text', c.closing));
    appendNext(box, '收下因果卡 ▸', handlers.onFinish);
  }
  root.appendChild(frame.box);
}

function appendNext(box, label, onClick) {
  const btn = el('button', 'btn btn-next', label);
  btn.addEventListener('click', onClick);
  box.appendChild(btn);
}

export function renderKarmaCard(card, onNext, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box karma-card');
  box.appendChild(el('div', 'card-title', '因 果 卡'));
  box.appendChild(el('p', 'card-row', `罪業：${card.sin}`));
  box.appendChild(el('p', 'card-row', `果報：${card.result}`));
  box.appendChild(el('p', 'card-lesson', `「${card.lesson}」`));
  if (card.source && card.source.chapter) {
    const a = el('a', 'card-source', `出自《地獄遊記》第${card.source.chapter}回`);
    a.href = card.source.url;
    a.target = '_blank';
    a.rel = 'noopener';
    box.appendChild(a);
  }
  const btn = el('button', 'btn btn-next', '收入善書冊 ▸');
  btn.addEventListener('click', onNext);
  box.appendChild(btn);
  root.appendChild(box);
}
