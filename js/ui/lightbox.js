import { pushLayer } from './layer.js';

// 全螢幕看圖：點圖放大、再點一下還原。全站共用單一疊層，第一次點圖時才建立。
let overlay = null;
let bigImg = null;
let layer = null;

function ensureOverlay(doc) {
  if (overlay) return;
  overlay = doc.createElement('div');
  overlay.id = 'lightbox';

  bigImg = doc.createElement('img');
  bigImg.className = 'lightbox-img';
  bigImg.alt = '';
  bigImg.decoding = 'async';
  overlay.appendChild(bigImg);

  const closeBtn = doc.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', '關閉大圖');
  overlay.appendChild(closeBtn);

  const hint = doc.createElement('p');
  hint.className = 'lightbox-hint';
  hint.textContent = '點任意處關閉';
  overlay.appendChild(hint);

  // 不檢查 e.target：點背景、點大圖、點 ✕ 都冒泡到這裡，一律關閉
  overlay.addEventListener('click', () => layer?.close());

  doc.body.appendChild(overlay);
}

export function openLightbox(src, doc = document) {
  ensureOverlay(doc);
  bigImg.src = src;
  // 已開啟時只換圖：重複推疊層會讓原始捲動狀態被 'hidden' 覆蓋而永久遺失，
  // 且會在 layer.js 堆疊裡留下無人消耗的殘層，破壞單層不變式
  if (layer) return;
  overlay.classList.add('open');
  // 以區域變數捕獲，讓 closure 持有屬於這一次開啟的值，不受後續開啟影響
  const prevOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';
  layer = pushLayer(() => {
    overlay.classList.remove('open');
    doc.body.style.overflow = prevOverflow;
    layer = null;
  }, doc);
}

export function enableLightbox(img, doc = document) {
  img.classList.add('zoomable');
  // 於點擊當下取 src，封面 error fallback 換圖後仍指向正確來源
  img.addEventListener('click', () => openLightbox(img.currentSrc || img.src, doc));
}
