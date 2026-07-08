import { el, hallLabel } from './render.js';
import { endingKey, prologueReplay, journeyTally, endingQuote } from '../engine/finale.js';

function appendNext(box, label, onClick) {
  const btn = el('button', 'btn btn-next', label);
  btn.addEventListener('click', onClick);
  box.appendChild(btn);
}

function appendLines(box, lines) {
  for (const l of lines) {
    if (l.speaker) box.appendChild(el('div', 'speaker', l.speaker));
    box.appendChild(el('p', 'text', l.text));
  }
}

export function renderFinalePhase(finale, handlers, root) {
  root.innerHTML = '';
  const d = finale.data;
  const s = finale.state;
  const box = el('div', 'scene-box finale-box');
  box.appendChild(el('div', 'hall-title', `${hallLabel(d.hall)}・${d.king}`));

  if (finale.phase === 'mengpo') {
    appendLines(box, d.mengpo.lines);
    if (finale.drank === null) {
      box.appendChild(el('p', 'text', d.mengpo.prompt));
      const list = el('div', 'choices');
      d.mengpo.choices.forEach((c, i) => {
        const btn = el('button', 'btn btn-choice', c.text);
        btn.addEventListener('click', () => handlers.onMengpo(i));
        list.appendChild(btn);
      });
      box.appendChild(list);
    } else {
      box.appendChild(el('p', 'text', finale.mengpoReply));
      appendNext(box, '入殿覆命 ▸', handlers.onNextPhase);
    }
  } else if (finale.phase === 'wu') {
    appendLines(box, d.wuReveal.lines);
    box.appendChild(el('p', 'wu-score', `悟性值 ${s.wu} ／ 100`));
    box.appendChild(el('p', 'hint', d.wuReveal.note));
    appendNext(box, '領判 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'mirror') {
    appendLines(box, d.mirror.lines);
    const list = el('div', 'mirror-echoes');
    for (const c of prologueReplay(s)) {
      const tone = c.delta > 0 ? 'echo-good' : c.delta < 0 ? 'echo-evil' : 'echo-plain';
      const item = el('div', `mirror-echo ${tone}`);
      item.appendChild(el('div', 'echo-label', c.label ?? ''));
      item.appendChild(el('p', 'echo-text', `你的選擇——「${c.text}」`));
      list.appendChild(item);
    }
    box.appendChild(list);
    const t = journeyTally(s);
    box.appendChild(el('p', 'text',
      d.mirror.journey.replaceAll('{good}', String(t.good)).replaceAll('{evil}', String(t.evil))));
    appendNext(box, '聽判 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'ending') {
    const e = d.endings[endingKey(s)];
    box.appendChild(el('div', 'card-title', '判 詞'));
    box.appendChild(el('p', 'ending-title', e.title));
    appendLines(box, e.comment);
    const quote = endingQuote(e, s);
    if (quote) box.appendChild(el('p', 'ending-quote', quote));
    appendNext(box, '領受 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'mission') {
    appendLines(box, finale.drank ? d.mission.drank : d.mission.kept);
    appendNext(box, '還陽 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'done') {
    box.classList.add('finale-end');
    const e = d.endings[endingKey(s)];
    box.appendChild(el('div', 'card-title', '此 行 判 詞'));
    box.appendChild(el('p', 'ending-title', e.title));
    box.appendChild(el('p', 'wu-score', `悟性值 ${s.wu} ／ 100`));
    box.appendChild(el('p', 'card-lesson', `「${e.motto}」`));
    if (d.source) {
      const a = el('a', 'card-source', `結算取材：《地獄遊記》第${d.source.chapters}回`);
      a.href = d.source.url;
      a.target = '_blank';
      a.rel = 'noopener';
      box.appendChild(a);
    }
    const share = el('button', 'btn btn-choice', '生成稱號分享卡');
    share.addEventListener('click', handlers.onShare);
    const bk = el('button', 'btn btn-choice', '翻閱善書冊');
    bk.addEventListener('click', handlers.onBooklet);
    const re = el('button', 'btn btn-choice', '重新開始');
    re.addEventListener('click', handlers.onRestart);
    box.appendChild(share);
    box.appendChild(bk);
    box.appendChild(re);
  }
  root.appendChild(box);
}

export function renderShareOverlay(canvas, onBack, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box share-box');
  box.appendChild(el('div', 'card-title', '稱 號 分 享 卡'));
  if (!canvas) {
    box.appendChild(el('p', 'text', '此瀏覽器不支援圖片合成，無法生成分享卡。'));
  } else {
    canvas.className = 'share-canvas';
    box.appendChild(canvas);
    let href = null;
    try {
      href = canvas.toDataURL('image/png');
    } catch {
      /* 匯出不支援時退而求其次 */
    }
    if (href) {
      const a = el('a', 'btn btn-next', '下載分享卡 PNG');
      a.href = href;
      a.download = '幽冥之旅-稱號卡.png';
      box.appendChild(a);
    } else {
      box.appendChild(el('p', 'hint', '長按圖片即可儲存分享。'));
    }
  }
  const back = el('button', 'btn btn-choice', '返回 ▸');
  back.addEventListener('click', onBack);
  box.appendChild(back);
  root.appendChild(box);
}
