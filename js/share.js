import { GAME_TITLE } from './config.js';

export const CARD_W = 1080;
export const CARD_H = 1440;

// 與 css/style.css :root 同一套廟宇彩繪色票
const C = {
  ink: '#17130f',
  ink2: '#241d16',
  vermilion: '#9e2b25',
  gold: '#c9a227',
  goldDim: '#8a7020',
  paper: '#efe3c8',
  paperDim: '#cbbc9c',
};
const FONT = '"Noto Serif TC", "PMingLiU", serif';

// 純 CJK 定寬斷行（文案無半形空白，逐字切即可）
export function wrapText(text, maxChars) {
  const lines = [];
  for (let i = 0; i < text.length; i += maxChars) lines.push(text.slice(i, i + maxChars));
  return lines.length ? lines : [''];
}

export function drawShareCard(ctx, { title, wu, motto }, qrImg) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = C.ink2;
  ctx.fillRect(48, 48, CARD_W - 96, CARD_H - 96);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, CARD_W - 96, CARD_H - 96);
  ctx.strokeStyle = C.goldDim;
  ctx.lineWidth = 2;
  ctx.strokeRect(72, 72, CARD_W - 144, CARD_H - 144);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.paperDim;
  ctx.font = `44px ${FONT}`;
  ctx.fillText(GAME_TITLE, CARD_W / 2, 190);

  ctx.fillStyle = C.gold;
  ctx.font = `bold 92px ${FONT}`;
  const [t1, t2] = title.split('·');
  if (t2) {
    ctx.fillText(t1, CARD_W / 2, 400);
    ctx.fillText(t2, CARD_W / 2, 530);
  } else {
    ctx.fillText(title, CARD_W / 2, 460);
  }

  // 心燈（悟性的介面語言：漸亮的心燈）
  ctx.fillStyle = C.vermilion;
  ctx.beginPath();
  ctx.arc(CARD_W / 2, 700, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.font = `52px ${FONT}`;
  ctx.fillText(`悟性值 ${wu}／100`, CARD_W / 2, 840);

  ctx.fillStyle = C.paper;
  ctx.font = `42px ${FONT}`;
  wrapText(`「${motto}」`, 18).forEach((line, i) => {
    ctx.fillText(line, CARD_W / 2, 950 + i * 64);
  });

  if (qrImg) ctx.drawImage(qrImg, CARD_W / 2 - 105, 1110, 210, 210);
  ctx.fillStyle = C.paperDim;
  ctx.font = `34px ${FONT}`;
  ctx.fillText('掃碼同遊幽冥・善書勸世', CARD_W / 2, 1382);
}

export function buildShareCard(doc, payload, qrImg) {
  const canvas = doc.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return null;
  drawShareCard(ctx, payload, qrImg);
  return canvas;
}

export function loadQrImage(doc) {
  return new Promise((resolve) => {
    const img = doc.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'assets/qr.png';
  });
}
