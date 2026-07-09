import { describe, it, expect } from 'vitest';
import {
  AXES, AXIS_LABELS, createState, creditWu, resetScreen, rawWu, recordChoice,
  karmaSum, karmaByAxis, karmaVerdict, karmaPenalty, finalWu,
  serialize, deserialize, save, load, clearSave,
} from '../js/state.js';
import { KARMA_PENALTY } from '../js/config.js';

function fakeStorage() {
  const data = {};
  return {
    setItem: (k, v) => { data[k] = String(v); },
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => { delete data[k]; },
  };
}

describe('state 基本結構', () => {
  it('初始狀態：無得分、無選擇、畫面 prologue、預設完整模式', () => {
    const s = createState();
    expect(s.wuByScreen).toEqual({});
    expect(s.choices).toEqual([]);
    expect(s.progress.screen).toBe('prologue');
    expect(s.mode).toBe('full');
    expect(s.wuMax).toBe(0);
  });
  it('四軸鍵名與標籤固定', () => {
    expect(AXES).toEqual(['honesty', 'speech', 'filial', 'mercy']);
    expect(AXIS_LABELS.speech).toBe('口業');
  });
});

describe('分殿計分', () => {
  it('creditWu 分殿累加，rawWu 加總', () => {
    const s = createState();
    creditWu(s, 'hall1', 10);
    creditWu(s, 'hall1', 5);
    creditWu(s, 'hall2', 5);
    expect(s.wuByScreen).toEqual({ hall1: 15, hall2: 5 });
    expect(rawWu(s)).toBe(20);
  });
  it('resetScreen 清該殿得分與選擇（重玩不灌分）', () => {
    const s = createState();
    creditWu(s, 'hall1', 30);
    creditWu(s, 'hall2', 5);
    recordChoice(s, { screen: 'hall1', scene: 'hall1-merchant', text: 'a', axis: 'honesty', delta: -1 });
    recordChoice(s, { screen: 'hall2', scene: 'hall2', text: 'b', axis: 'speech', delta: 1 });
    resetScreen(s, 'hall1');
    expect(rawWu(s)).toBe(5);
    expect(s.choices.map((c) => c.screen)).toEqual(['hall2']);
  });
});

describe('悟性值 finalWu（正規化＋心性扣分）', () => {
  it('依 wuMax 折算百分制', () => {
    const s = createState();
    s.wuMax = 145;
    creditWu(s, 'x', 145);
    expect(finalWu(s)).toBe(100);
    resetScreen(s, 'x');
    creditWu(s, 'x', 105);
    expect(finalWu(s)).toBe(72); // round(105/145*100)
  });
  it('每筆惡選依權重扣分', () => {
    const s = createState();
    s.wuMax = 100;
    creditWu(s, 'x', 100);
    recordChoice(s, { screen: 'prologue', scene: 'prologue', text: 'a', axis: 'honesty', delta: -1, weight: 2 });
    recordChoice(s, { screen: 'hall4', scene: 'hall4', text: 'b', axis: 'mercy', delta: -1 });
    expect(karmaPenalty(s)).toBe(3 * KARMA_PENALTY);
    expect(finalWu(s)).toBe(100 - 3 * KARMA_PENALTY);
  });
  it('下限 0、上限 100；wuMax 未設時直接取 rawWu 封頂', () => {
    const s = createState();
    s.wuMax = 10;
    creditWu(s, 'x', 1);
    for (let i = 0; i < 10; i++) {
      recordChoice(s, { screen: 'p', scene: 'p', text: 'a', axis: 'mercy', delta: -1, weight: 2 });
    }
    expect(finalWu(s)).toBe(0);
    const t = createState();
    creditWu(t, 'x', 120);
    expect(finalWu(t)).toBe(100);
  });
});

describe('心性檔案（由選擇推導）', () => {
  it('karmaByAxis／karmaSum 含權重', () => {
    const s = createState();
    recordChoice(s, { screen: 'prologue', scene: 'prologue', text: 'a', axis: 'honesty', delta: 1, weight: 2 });
    recordChoice(s, { screen: 'hall4', scene: 'hall4', text: 'b', axis: 'mercy', delta: -1 });
    expect(karmaByAxis(s).honesty).toBe(2);
    expect(karmaByAxis(s).mercy).toBe(-1);
    expect(karmaSum(s)).toBe(1);
  });
  it('總和 0 判善、負判惡', () => {
    const s = createState();
    expect(karmaVerdict(s)).toBe('good');
    recordChoice(s, { screen: 'hall3', scene: 'hall3', text: 'b', axis: 'speech', delta: -1 });
    expect(karmaVerdict(s)).toBe('bad');
  });
});

describe('存讀檔', () => {
  it('serialize/deserialize 往返', () => {
    const s = createState('lite');
    creditWu(s, 'hall1', 30);
    recordChoice(s, { screen: 'prologue', scene: 'prologue', text: 'x', axis: 'filial', delta: 1, weight: 2 });
    s.progress.screen = 'hall1';
    const r = deserialize(serialize(s));
    expect(r).toEqual(s);
  });
  it('save/load 經 storage 往返，無檔回 null', () => {
    const st = fakeStorage();
    expect(load(st)).toBeNull();
    const s = createState();
    creditWu(s, 'hall1', 25);
    save(s, st);
    expect(load(st)).toEqual(s);
    clearSave(st);
    expect(load(st)).toBeNull();
  });
  it('load 讀到損壞 JSON 回 null 並清除存檔', () => {
    const st = fakeStorage();
    st.setItem('hellTourSave.v3', '{oops');
    expect(load(st)).toBeNull();
    expect(st.getItem('hellTourSave.v3')).toBeNull();
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
    recordChoice(s, { screen: 'prologue', scene: 'prologue', label: '早市多找的錢', text: '收進口袋', axis: 'honesty', delta: -1, weight: 2 });
    recordChoice(s, { screen: 'hall4', scene: 'hall4', text: '別過頭去', axis: 'mercy', delta: -1 });
    expect(s.choices.length).toBe(2);
    expect(s.choices[0].weight).toBe(2);
    expect(s.choices[1]).toEqual({ screen: 'hall4', scene: 'hall4', label: null, text: '別過頭去', axis: 'mercy', delta: -1, weight: 1 });
  });
  it('recordChoice 拒絕未知心性軸', () => {
    const s = createState();
    expect(() => recordChoice(s, { screen: 'x', scene: 'x', text: 't', axis: 'luck', delta: 1 })).toThrow(/未知的心性軸/);
  });
  it('serialize/deserialize 保留 choices；舊格式無 choices 補空陣列；損壞型別補空陣列', () => {
    const s = createState();
    recordChoice(s, { screen: 'prologue', scene: 'prologue', text: 'x', axis: 'mercy', delta: 1, weight: 2 });
    expect(deserialize(serialize(s)).choices).toEqual(s.choices);
    const legacy = JSON.parse(serialize(createState()));
    delete legacy.choices;
    expect(deserialize(JSON.stringify(legacy)).choices).toEqual([]);
    legacy.choices = 'oops';
    expect(deserialize(JSON.stringify(legacy)).choices).toEqual([]);
  });
});

describe('存檔 v3 與舊檔遷移', () => {
  it('save 寫入 hellTourSave.v3', () => {
    const st = fakeStorage();
    save(createState(), st);
    expect(st.getItem('hellTourSave.v3')).not.toBeNull();
  });
  it('v2 存檔遷移：wu 併入 _v2 桶、choices 依 scene 前綴補 screen、v2 鍵移除', () => {
    const st = fakeStorage();
    st.setItem('hellTourSave.v2', JSON.stringify({
      wu: 55,
      karma: { honesty: 1, speech: 0, filial: 0, mercy: 0 },
      choices: [
        { scene: 'prologue', label: '早市', text: 'a', axis: 'honesty', delta: 1, weight: 2 },
        { scene: 'hall3-gossip', label: null, text: 'b', axis: 'speech', delta: -1, weight: 1 },
      ],
      progress: { screen: 'hall5' },
    }));
    const s = load(st);
    expect(rawWu(s)).toBe(55);
    expect(s.choices[0].screen).toBe('prologue');
    expect(s.choices[1].screen).toBe('hall3');
    expect(s.progress.screen).toBe('hall5');
    expect(st.getItem('hellTourSave.v2')).toBeNull();
    expect(st.getItem('hellTourSave.v3')).not.toBeNull();
  });
  it('只有 v1 舊檔時 load 回 null 並移除 v1', () => {
    const st = fakeStorage();
    st.setItem('hellTourSave.v1', JSON.stringify(createState()));
    expect(load(st)).toBeNull();
    expect(st.getItem('hellTourSave.v1')).toBeNull();
  });
});
