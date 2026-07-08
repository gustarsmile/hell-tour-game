import { WU_THRESHOLD, PROLOGUE_ID } from '../config.js';
import { karmaVerdict } from '../state.js';

const PHASES = ['mengpo', 'wu', 'mirror', 'ending', 'mission', 'done'];

export function createFinale(data, state) {
  return { data, state, phases: [...PHASES], phase: 'mengpo', drank: null, mengpoReply: null };
}

export function nextFinalePhase(finale) {
  const i = finale.phases.indexOf(finale.phase);
  finale.phase = finale.phases[Math.min(i + 1, finale.phases.length - 1)];
  return finale.phase;
}

export function chooseMengpo(finale, index) {
  if (finale.phase !== 'mengpo') throw new Error('目前不在孟婆亭階段');
  if (finale.drank !== null) return { drank: finale.drank, reply: finale.mengpoReply };
  const opt = finale.data.mengpo.choices[index];
  if (!opt) throw new Error(`選項不存在：${index}`);
  finale.drank = opt.drank;
  finale.mengpoReply = opt.reply;
  return { drank: opt.drank, reply: opt.reply };
}

export function endingKey(state) {
  const high = state.wu >= WU_THRESHOLD;
  const good = karmaVerdict(state) === 'good';
  if (high) return good ? 'highGood' : 'highBad';
  return good ? 'lowGood' : 'lowBad';
}

export function prologueReplay(state) {
  return state.choices.filter((c) => c.scene === PROLOGUE_ID);
}

export function journeyTally(state) {
  const rest = state.choices.filter((c) => c.scene !== PROLOGUE_ID);
  return {
    good: rest.filter((c) => c.delta > 0).length,
    evil: rest.filter((c) => c.delta < 0).length,
  };
}

export function worstPrologueChoice(state) {
  return prologueReplay(state).find((c) => c.delta < 0) ?? null;
}

export function endingQuote(ending, state) {
  if (!ending.quote) return null;
  const worst = worstPrologueChoice(state);
  if (!worst) return ending.quoteFallback ?? null;
  return ending.quote
    .replaceAll('{label}', worst.label ?? '陽間那一日')
    .replaceAll('{text}', worst.text);
}
