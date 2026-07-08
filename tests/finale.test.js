import { describe, it, expect } from 'vitest';
import { WU_THRESHOLD } from '../js/config.js';
import { createState, recordChoice, recordKarma, addWu } from '../js/state.js';
import {
  createFinale, nextFinalePhase, chooseMengpo, endingKey,
  prologueReplay, journeyTally, worstPrologueChoice, endingQuote,
} from '../js/engine/finale.js';

const mengpoData = {
  mengpo: {
    choices: [
      { text: '不喝', drank: false, reply: '好志氣。' },
      { text: '喝下', drank: true, reply: '忘了故事，別忘了心。' },
    ],
  },
};

function stateWith(wu, karmaDelta) {
  const s = createState();
  addWu(s, wu);
  if (karmaDelta) recordKarma(s, 'mercy', karmaDelta);
  return s;
}

describe('四象限結局判定', () => {
  it('門檻為 70', () => expect(WU_THRESHOLD).toBe(70));
  it('悟性 70／心善 → highGood；69 → lowGood', () => {
    expect(endingKey(stateWith(70, 0))).toBe('highGood');
    expect(endingKey(stateWith(69, 0))).toBe('lowGood');
  });
  it('心性總和負 → Bad 象限；0 判善（沿用 karmaVerdict）', () => {
    expect(endingKey(stateWith(70, -1))).toBe('highBad');
    expect(endingKey(stateWith(69, -1))).toBe('lowBad');
    expect(endingKey(stateWith(100, 0))).toBe('highGood');
  });
});

describe('孟婆亭', () => {
  it('依選項設定 drank 與 reply；重複選擇回傳既有值', () => {
    const f = createFinale(mengpoData, createState());
    expect(f.phase).toBe('mengpo');
    expect(chooseMengpo(f, 1)).toEqual({ drank: true, reply: '忘了故事，別忘了心。' });
    expect(chooseMengpo(f, 0)).toEqual({ drank: true, reply: '忘了故事，別忘了心。' });
  });
  it('非 mengpo 階段擲錯；不存在選項擲錯', () => {
    const f = createFinale(mengpoData, createState());
    expect(() => chooseMengpo(f, 9)).toThrow();
    nextFinalePhase(f);
    expect(f.phase).toBe('wu');
    expect(() => chooseMengpo(f, 0)).toThrow();
  });
  it('階段機走到 done 停住', () => {
    const f = createFinale(mengpoData, createState());
    for (const expected of ['wu', 'mirror', 'ending', 'mission', 'done', 'done']) {
      expect(nextFinalePhase(f)).toBe(expected);
    }
  });
});

describe('孽鏡反照資料', () => {
  function journeyState() {
    const s = createState();
    recordChoice(s, { scene: 'prologue', label: '早市多找的錢', text: '退還', axis: 'honesty', delta: 1, weight: 2 });
    recordChoice(s, { scene: 'prologue', label: '群組裡的謠言', text: '轉傳', axis: 'speech', delta: -1, weight: 2 });
    recordChoice(s, { scene: 'hall4', text: '別過頭去', axis: 'mercy', delta: -1 });
    recordChoice(s, { scene: 'hall5-lookout', text: '深深一揖', axis: 'filial', delta: 1 });
    return s;
  }
  it('prologueReplay 只取序章、依序；journeyTally 只計旅途', () => {
    const s = journeyState();
    expect(prologueReplay(s).map((c) => c.axis)).toEqual(['honesty', 'speech']);
    expect(journeyTally(s)).toEqual({ good: 1, evil: 1 });
  });
  it('worstPrologueChoice 取序章第一筆惡選；全善回 null', () => {
    const s = journeyState();
    expect(worstPrologueChoice(s).text).toBe('轉傳');
    const good = createState();
    recordChoice(good, { scene: 'prologue', text: 'x', axis: 'mercy', delta: 1, weight: 2 });
    expect(worstPrologueChoice(good)).toBeNull();
  });
  it('endingQuote：代入 label/text；無惡選用 fallback；無 quote 回 null', () => {
    const ending = { quote: '{label}——你選的是「{text}」。', quoteFallback: '陽間那日你走得端正。' };
    const s = journeyState();
    expect(endingQuote(ending, s)).toBe('群組裡的謠言——你選的是「轉傳」。');
    const good = createState();
    recordChoice(good, { scene: 'prologue', text: 'x', axis: 'mercy', delta: 1, weight: 2 });
    expect(endingQuote(ending, good)).toBe('陽間那日你走得端正。');
    expect(endingQuote({ title: 't' }, s)).toBeNull();
  });
});
