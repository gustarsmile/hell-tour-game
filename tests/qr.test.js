import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { GAME_URL } from '../js/config.js';

describe('QR 資產守門', () => {
  it('assets/qr.png 解碼結果恆等於 GAME_URL（改網址必須重跑 npm run gen-qr）', () => {
    const png = PNG.sync.read(readFileSync('assets/qr.png'));
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(code).not.toBeNull();
    expect(code.data).toBe(GAME_URL);
  });
});
