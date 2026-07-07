import { describe, it, expect } from 'vitest';
import {
  AXES, AXIS_LABELS, createState, addWu, recordKarma,
  karmaSum, karmaVerdict, serialize, deserialize, save, load, clearSave,
} from '../js/state.js';

function fakeStorage() {
  const data = {};
  return {
    setItem: (k, v) => { data[k] = String(v); },
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => { delete data[k]; },
  };
}

describe('state 基本結構', () => {
  it('初始狀態：悟性 0、四軸 0、畫面 prologue', () => {
    const s = createState();
    expect(s.wu).toBe(0);
    expect(s.karma).toEqual({ honesty: 0, speech: 0, filial: 0, mercy: 0 });
    expect(s.progress.screen).toBe('prologue');
  });
  it('四軸鍵名與標籤固定', () => {
    expect(AXES).toEqual(['honesty', 'speech', 'filial', 'mercy']);
    expect(AXIS_LABELS.speech).toBe('口業');
  });
});

describe('悟性值', () => {
  it('累加', () => {
    const s = createState();
    addWu(s, 10); addWu(s, 5);
    expect(s.wu).toBe(15);
  });
  it('上限 100 封頂', () => {
    const s = createState();
    addWu(s, 90); addWu(s, 30);
    expect(s.wu).toBe(100);
  });
  it('下限 0', () => {
    const s = createState();
    addWu(s, -10);
    expect(s.wu).toBe(0);
  });
});

describe('心性檔案', () => {
  it('記錄含權重', () => {
    const s = createState();
    recordKarma(s, 'honesty', 1, 2);
    recordKarma(s, 'mercy', -1);
    expect(s.karma.honesty).toBe(2);
    expect(s.karma.mercy).toBe(-1);
    expect(karmaSum(s)).toBe(1);
  });
  it('未知軸擲錯', () => {
    expect(() => recordKarma(createState(), 'luck', 1)).toThrow();
  });
  it('總和 0 判善、負判惡', () => {
    const s = createState();
    expect(karmaVerdict(s)).toBe('good');
    recordKarma(s, 'speech', -1);
    expect(karmaVerdict(s)).toBe('bad');
  });
});

describe('存讀檔', () => {
  it('serialize/deserialize 往返', () => {
    const s = createState();
    addWu(s, 30);
    recordKarma(s, 'filial', 1, 2);
    s.progress.screen = 'hall1';
    const r = deserialize(serialize(s));
    expect(r).toEqual(s);
  });
  it('save/load 經 storage 往返，無檔回 null', () => {
    const st = fakeStorage();
    expect(load(st)).toBeNull();
    const s = createState();
    addWu(s, 25);
    save(s, st);
    expect(load(st)).toEqual(s);
    clearSave(st);
    expect(load(st)).toBeNull();
  });
});
