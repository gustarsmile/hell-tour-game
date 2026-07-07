function buildPhases(caseData) {
  return ['testimony', 'mirror', 'spot', 'judge', ...(caseData.react ? ['react'] : []), 'persuade', 'done'];
}

export function createTrial(caseData, hooks = {}) {
  return {
    caseData,
    hooks,
    phases: buildPhases(caseData),
    phase: 'testimony',
    foundLies: new Set(),
    spotClean: true,
    spotPoints: null,
    judgeAttempted: false,
    judgePoints: null,
    reactReply: null,
    persuadePoints: null,
    persuadeReaction: null,
  };
}

export function nextPhase(trial) {
  const i = trial.phases.indexOf(trial.phase);
  trial.phase = trial.phases[Math.min(i + 1, trial.phases.length - 1)];
  return trial.phase;
}

export function lieIndexes(caseData) {
  return caseData.testimony
    .map((s, i) => (s.lie ? i : -1))
    .filter((i) => i >= 0);
}

export function spotLie(trial, index) {
  if (trial.phase !== 'spot') throw new Error('目前不在點破綻階段');
  if (trial.spotPoints !== null) return { hit: true, allFound: true };
  const lies = lieIndexes(trial.caseData);
  if (!lies.includes(index)) {
    trial.spotClean = false;
    return { hit: false, allFound: false };
  }
  trial.foundLies.add(index);
  const allFound = trial.foundLies.size === lies.length;
  if (allFound) trial.spotPoints = trial.spotClean ? 10 : 0;
  return { hit: true, allFound };
}

export function judge(trial, index) {
  if (trial.phase !== 'judge') throw new Error('目前不在斷因果階段');
  if (trial.judgePoints !== null) return { correct: true, points: trial.judgePoints };
  const correct = index === trial.caseData.judgement.answer;
  if (correct) {
    trial.judgePoints = trial.judgeAttempted ? 0 : 10;
    return { correct, points: trial.judgePoints };
  }
  trial.judgeAttempted = true;
  return { correct, points: 0 };
}

export function react(trial, index) {
  if (trial.phase !== 'react') throw new Error('目前不在反應階段');
  if (trial.reactReply !== null) return { reply: trial.reactReply };
  const opt = trial.caseData.react.choices[index];
  if (!opt) throw new Error(`反應選項不存在：${index}`);
  if (opt.karma && trial.hooks.onKarma) {
    trial.hooks.onKarma(opt.karma.axis, opt.karma.delta, 1);
  }
  trial.reactReply = opt.reply;
  return { reply: opt.reply };
}

export function persuade(trial, index) {
  if (trial.phase !== 'persuade') throw new Error('目前不在勸化階段');
  if (trial.persuadePoints !== null) {
    return { score: trial.persuadePoints, reaction: trial.persuadeReaction };
  }
  const opt = trial.caseData.persuasion.options[index];
  if (!opt) throw new Error(`勸化選項不存在：${index}`);
  if (opt.karma && trial.hooks.onKarma) {
    trial.hooks.onKarma(opt.karma.axis, opt.karma.delta, 1);
  }
  trial.persuadePoints = opt.score;
  trial.persuadeReaction = opt.reaction;
  return { score: opt.score, reaction: opt.reaction };
}

export function trialScore(trial) {
  return (trial.spotPoints ?? 0) + (trial.judgePoints ?? 0) + (trial.persuadePoints ?? 0);
}
