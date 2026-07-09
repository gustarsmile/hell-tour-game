import { el, hallLabel, artImg, sceneFrame } from './render.js';

export function renderVisitPhase(visit, handlers, root, message = '') {
  root.innerHTML = '';
  const d = visit.data;
  const frame = sceneFrame('scene-box visit-box', d.art?.scene);
  const box = frame.body; // 內容進右欄（窄幕時在主圖下方）
  box.appendChild(el('div', 'hall-title', `${hallLabel(d.hall)}・${d.king}`));

  if (visit.phase === 'watch') {
    box.appendChild(el('div', 'speaker', d.watch.title));
    if (d.art?.watch) box.appendChild(artImg(d.art.watch, 'art-watch'));
    const panels = el('div', 'watch-panels');
    d.watch.panels.forEach((p) => {
      const pn = el('div', 'watch-panel');
      pn.appendChild(el('p', 'watch-caption', p.caption));
      panels.appendChild(pn);
    });
    box.appendChild(panels);
    appendNext(box, d.quiz || d.mercy ? '濟公有問 ▸' : '繼續前行 ▸', handlers.onNextPhase);
  } else if (visit.phase === 'ask' && d.quiz) {
    box.appendChild(el('div', 'speaker', '濟公考問'));
    box.appendChild(el('p', 'text', d.quiz.question));
    if (visit.quizPoints !== null) {
      box.appendChild(el('p', 'feedback', d.quiz.reveal));
      appendNext(box, '繼續前行 ▸', handlers.onNextPhase);
    } else {
      const list = el('div', 'choices');
      d.quiz.options.forEach((o, i) => {
        const btn = el('button', 'btn btn-choice', o);
        btn.addEventListener('click', () => handlers.onQuiz(i));
        list.appendChild(btn);
      });
      box.appendChild(list);
      if (message) box.appendChild(el('p', 'feedback', message));
    }
  } else if (visit.phase === 'ask' && d.mercy) {
    box.appendChild(el('p', 'text', d.mercy.prompt));
    if (visit.mercyReply !== null) {
      box.appendChild(el('p', 'text', visit.mercyReply));
      appendNext(box, '繼續前行 ▸', handlers.onNextPhase);
    } else {
      const list = el('div', 'choices');
      d.mercy.choices.forEach((o, i) => {
        const btn = el('button', 'btn btn-choice', o.text);
        btn.addEventListener('click', () => handlers.onMercy(i));
        list.appendChild(btn);
      });
      box.appendChild(list);
    }
  } else if (visit.phase === 'branch') {
    box.appendChild(el('p', 'text', d.branch.prompt));
    if (visit.branchTaken === null) {
      const acc = el('button', 'btn btn-next btn-accept', d.branch.acceptText);
      acc.addEventListener('click', handlers.onBranchAccept);
      const dec = el('button', 'btn btn-choice btn-decline', d.branch.declineText);
      dec.addEventListener('click', handlers.onBranchDecline);
      box.appendChild(acc);
      box.appendChild(dec);
    } else if (visit.branchTaken === false) {
      box.appendChild(el('p', 'text', d.branch.declineLine));
      appendNext(box, '繼續前行 ▸', handlers.onNextPhase);
    }
    // branchTaken === true 時支線場景由流程層執行（flow.js），結束後直接切到 closing
  } else if (visit.phase === 'closing') {
    box.appendChild(el('p', 'text', d.closing));
    appendNext(box, '收下因果卡 ▸', handlers.onFinish);
  }
  root.appendChild(frame.box);
}

function appendNext(box, label, onClick) {
  const btn = el('button', 'btn btn-next', label);
  btn.addEventListener('click', onClick);
  box.appendChild(btn);
}
