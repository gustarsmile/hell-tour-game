import { describe, it, expect } from 'vitest';
import { GAME_TITLE, WU_CAP } from '../js/config.js';

describe('config', () => {
  it('定義遊戲標題', () => {
    expect(GAME_TITLE).toBe('幽冥之旅：地獄遊記');
  });
  it('悟性值上限為 100', () => {
    expect(WU_CAP).toBe(100);
  });
});
