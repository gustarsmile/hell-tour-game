import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readdirSync } from 'node:fs';

export const ART_MANIFEST = [
  'jigong-main', 'jigong-warm', 'jigong-stern',
  'prologue-scene', 'interlude-scene',
  'hall1-scene', 'hall2-scene', 'hall3-scene', 'hall4-scene', 'hall5-scene',
  'hall6-scene', 'hall7-scene', 'hall8-scene', 'hall9-scene', 'hall10-scene',
  'soul-hall1', 'soul-hall3', 'soul-hall5', 'soul-hall7',
  'mirror-hall1-1', 'mirror-hall1-2', 'mirror-hall1-3',
  'mirror-hall3-1', 'mirror-hall3-2', 'mirror-hall3-3',
  'mirror-hall5-1', 'mirror-hall5-2', 'mirror-hall5-3',
  'mirror-hall7-1', 'mirror-hall7-2', 'mirror-hall7-3',
  'watch-hall2', 'watch-hall4', 'watch-hall6', 'watch-hall8', 'watch-hall9',
  'ending-highGood', 'ending-highBad', 'ending-lowGood', 'ending-lowBad',
  'share-bg',
].map((n) => `${n}.webp`);

describe('美術資產', () => {
  it('manifest 41 張齊備', () => {
    expect(ART_MANIFEST.length).toBe(41);
    for (const f of ART_MANIFEST) expect(existsSync(`assets/art/${f}`), f).toBe(true);
  });
  it('總體積在 6MB 預算內（手機掃碼即玩）', () => {
    const total = readdirSync('assets/art').reduce((s, f) => s + statSync(`assets/art/${f}`).size, 0);
    expect(total).toBeLessThan(6 * 1024 * 1024);
  });
  it('og 預覽圖存在', () => {
    expect(existsSync('assets/og.png')).toBe(true);
  });
  it('og 預覽圖體積在 500KB 內', () => {
    expect(statSync('assets/og.png').size).toBeLessThan(500 * 1024);
  });
});
