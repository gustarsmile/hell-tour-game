const PHASES = ['testimony', 'mirror', 'spot', 'judge', 'persuade', 'done'];

export function createTrial(caseData) {
  return {
    caseData,
    phase: 'testimony',
    foundLies: new Set(),
    spotClean: true,
    spotPoints: null,
    judgeAttempted: false,
    judgePoints: null,
    persuadePoints: null,
    persuadeReaction: null,
  };
}

export function nextPhase(trial) {
  const i = PHASES.indexOf(trial.phase);
  trial.phase = PHASES[Math.min(i + 1, PHASES.length - 1)];
  return trial.phase;
}

export function lieIndexes(caseData) {
  return caseData.testimony
    .map((s, i) => (s.lie ? i : -1))
    .filter((i) => i >= 0);
}

export function spotLie(trial, index) {
  if (trial.phase !== 'spot') throw new Error('目前不在點破綻階段');
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
  const correct = index === trial.caseData.judgement.answer;
  if (correct) {
    trial.judgePoints = trial.judgeAttempted ? 0 : 10;
    return { correct, points: trial.judgePoints };
  }
  trial.judgeAttempted = true;
  return { correct, points: 0 };
}

export function persuade(trial, index) {
  if (trial.phase !== 'persuade') throw new Error('目前不在勸化階段');
  const opt = trial.caseData.persuasion.options[index];
  trial.persuadePoints = opt.score;
  trial.persuadeReaction = opt.reaction;
  return { score: opt.score, reaction: opt.reaction };
}

export function trialScore(trial) {
  return (trial.spotPoints ?? 0) + (trial.judgePoints ?? 0) + (trial.persuadePoints ?? 0);
}
