import { el, hallLabel, artImg, sceneFrame } from './render.js';
import { endingKey, prologueReplay, journeyTally, endingQuote } from '../engine/finale.js';
import { finalWu, rawWu, karmaPenalty } from '../state.js';
import { GAME_TITLE, GAME_URL } from '../config.js';

function appendNext(box, label, onClick) {
  const btn = el('button', 'btn btn-next', label);
  btn.addEventListener('click', onClick);
  box.appendChild(btn);
}

function appendLines(box, lines) {
  for (const l of lines) {
    if (l.speaker) box.appendChild(el('div', 'speaker', l.speaker));
    box.appendChild(el('p', 'text', l.text));
    if (l.img) box.appendChild(artImg(l.img, 'art-figure'));
  }
}

export function renderFinalePhase(finale, handlers, root) {
  root.innerHTML = '';
  const d = finale.data;
  const s = finale.state;
  const frame = sceneFrame('scene-box finale-box', d.art?.scene);
  const box = frame.body; // 內容進右欄（窄幕時在主圖下方）
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
    box.appendChild(el('p', 'wu-score', `悟性值 ${finalWu(s)} ／ 100`));
    const pen = karmaPenalty(s);
    const detail = `答題修行 ${rawWu(s)}／${s.wuMax} 分${pen > 0 ? `，心性有虧扣 ${pen} 分` : '，心性無虧'}`;
    box.appendChild(el('p', 'hint wu-detail', detail));
    box.appendChild(el('p', 'hint', d.wuReveal.note));
    appendNext(box, '領判 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'mirror') {
    appendLines(box, d.mirror.lines);
    const echoes = prologueReplay(s);
    if (echoes.length === 0) {
      box.appendChild(el('p', 'text', '鏡光流轉，映出的影像卻模糊不清——那一日的記憶，已隨霧氣散去。'));
    } else {
      const list = el('div', 'mirror-echoes');
      for (const c of echoes) {
        const tone = c.delta > 0 ? 'echo-good' : c.delta < 0 ? 'echo-evil' : 'echo-plain';
        const item = el('div', `mirror-echo ${tone}`);
        item.appendChild(el('div', 'echo-label', c.label ?? ''));
        item.appendChild(el('p', 'echo-text', `你的選擇——「${c.text}」`));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    const t = journeyTally(s);
    box.appendChild(el('p', 'text',
      d.mirror.journey.replaceAll('{good}', String(t.good)).replaceAll('{evil}', String(t.evil))));
    appendNext(box, '聽判 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'ending') {
    const e = d.endings[endingKey(s)];
    box.appendChild(el('div', 'card-title', '判 詞'));
    box.appendChild(el('p', 'ending-title', e.title));
    const artFile = d.art?.endings?.[endingKey(s)];
    if (artFile) box.appendChild(artImg(artFile, 'art-ending'));
    appendLines(box, e.comment);
    const quote = endingQuote(e, s);
    if (quote) box.appendChild(el('p', 'ending-quote', quote));
    appendNext(box, '領受 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'mission') {
    appendLines(box, finale.drank ? d.mission.drank : d.mission.kept);
    appendNext(box, '還陽 ▸', handlers.onNextPhase);
  } else if (finale.phase === 'done') {
    frame.box.classList.add('finale-end');
    const e = d.endings[endingKey(s)];
    box.appendChild(el('div', 'card-title', '此 行 判 詞'));
    box.appendChild(el('p', 'ending-title', e.title));
    box.appendChild(el('p', 'wu-score', `悟性值 ${finalWu(s)} ／ 100`));
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
  root.appendChild(frame.box);
}

// 分享卡輸出：優先走系統分享面板（手機原生「分享」），其次 blob 下載，最後長按儲存
export function renderShareOverlay(canvas, payload, onBack, root) {
  root.innerHTML = '';
  const box = el('div', 'scene-box share-box');
  box.appendChild(el('div', 'card-title', '稱 號 分 享 卡'));
  if (!canvas) {
    box.appendChild(el('p', 'text', '此瀏覽器不支援圖片合成，無法生成分享卡。'));
  } else {
    canvas.className = 'share-canvas';
    box.appendChild(canvas);
    const shareText = `我在《${GAME_TITLE}》獲判「${payload.title}」，悟性值 ${payload.wu}／100。${payload.motto}`;

    if (typeof canvas.toBlob === 'function') canvas.toBlob((blob) => {
      if (blob) {
        // 手機系統分享面板：可直接傳圖到 LINE／IG 等
        const file = new File([blob], '幽冥之旅-稱號卡.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          const shareBtn = el('button', 'btn btn-next', '分享結果');
          shareBtn.addEventListener('click', () => {
            navigator.share({ files: [file], title: GAME_TITLE, text: shareText })
              .catch(() => { /* 使用者取消分享，不當錯誤 */ });
          });
          box.insertBefore(shareBtn, hint);
        }
        // blob 連結比 dataURL 可靠（大圖 dataURL 在部分手機瀏覽器點了沒反應）
        const a = el('a', 'btn btn-choice', '下載分享卡 PNG');
        a.href = URL.createObjectURL(blob);
        a.download = '幽冥之旅-稱號卡.png';
        box.insertBefore(a, hint);
      }
      if (!blob && navigator.share) {
        const textBtn = el('button', 'btn btn-next', '分享結果（文字）');
        textBtn.addEventListener('click', () => {
          navigator.share({ title: GAME_TITLE, text: shareText, url: GAME_URL })
            .catch(() => { /* 使用者取消分享 */ });
        });
        box.insertBefore(textBtn, hint);
      }
    }, 'image/png');

    const hint = el('p', 'hint', '手機亦可長按上圖，直接儲存或分享。');
    box.appendChild(hint);
  }
  const back = el('button', 'btn btn-choice', '返回 ▸');
  back.addEventListener('click', onBack);
  box.appendChild(back);
  root.appendChild(box);
}
