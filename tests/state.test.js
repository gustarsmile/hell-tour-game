import { describe, it, expect } from 'vitest';
import {
  AXES, AXIS_LABELS, createState, addWu, recordKarma, recordChoice,
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
  it('load 讀到損壞 JSON 回 null 並清除存檔', () => {
    const st = fakeStorage();
    st.setItem('hellTourSave.v2', '{oops');
    expect(load(st)).toBeNull();
    expect(st.getItem('hellTourSave.v2')).toBeNull();
  });
  it('storage 擲錯時 save/load/clearSave 不擲錯', () => {
    const boom = {
      setItem() { throw new Error('quota'); },
      getItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    expect(() => save(createState(), boom)).not.toThrow();
    expect(load(boom)).toBeNull();
    expect(() => clearSave(boom)).not.toThrow();
  });
});

describe('選擇紀錄（階段3）', () => {
  it('初始 choices 為空；recordChoice 追加，label/weight 有預設值', () => {
    const s = createState();
    expect(s.choices).toEqual([]);
    recordChoice(s, { scene: 'prologue', label: '早市多找的錢', text: '收進口袋', axis: 'honesty', delta: -1, weight: 2 });
    recordChoice(s, { scene: 'hall4', text: '別過頭去', axis: 'mercy', delta: -1 });
    expect(s.choices.length).toBe(2);
    expect(s.choices[0].weight).toBe(2);
    expect(s.choices[1]).toEqual({ scene: 'hall4', label: null, text: '別過頭去', axis: 'mercy', delta: -1, weight: 1 });
  });
  it('serialize/deserialize 保留 choices；舊格式無 choices 補空陣列；損壞型別補空陣列', () => {
    const s = createState();
    recordChoice(s, { scene: 'prologue', text: 'x', axis: 'mercy', delta: 1, weight: 2 });
    expect(deserialize(serialize(s)).choices).toEqual(s.choices);
    const legacy = JSON.parse(serialize(createState()));
    delete legacy.choices;
    expect(deserialize(JSON.stringify(legacy)).choices).toEqual([]);
    legacy.choices = 'oops';
    expect(deserialize(JSON.stringify(legacy)).choices).toEqual([]);
  });
});

describe('存檔 v2 與舊檔淘汰', () => {
  it('save 寫入 hellTourSave.v2', () => {
    const st = fakeStorage();
    save(createState(), st);
    expect(st.getItem('hellTourSave.v2')).not.toBeNull();
  });
  it('只有 v1 舊檔時 load 回 null 並移除 v1', () => {
    const st = fakeStorage();
    st.setItem('hellTourSave.v1', JSON.stringify(createState()));
    expect(load(st)).toBeNull();
    expect(st.getItem('hellTourSave.v1')).toBeNull();
  });
});
