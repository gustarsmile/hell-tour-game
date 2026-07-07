export function visitPhases(data) {
  return [
    'watch',
    ...(data.quiz || data.mercy ? ['ask'] : []),
    ...(data.branch ? ['branch'] : []),
    'closing',
    'done',
  ];
}

export function createVisit(data, hooks = {}) {
  return {
    data,
    hooks,
    phases: visitPhases(data),
    phase: 'watch',
    quizAttempted: false,
    quizPoints: null,
    mercyReply: null,
    branchTaken: null,
  };
}

export function nextVisitPhase(visit) {
  const i = visit.phases.indexOf(visit.phase);
  visit.phase = visit.phases[Math.min(i + 1, visit.phases.length - 1)];
  return visit.phase;
}

export function answerQuiz(visit, index) {
  if (visit.phase !== 'ask' || !visit.data.quiz) throw new Error('目前不在考題階段');
  if (visit.quizPoints !== null) return { correct: true, points: visit.quizPoints };
  const correct = index === visit.data.quiz.answer;
  if (correct) {
    visit.quizPoints = visit.quizAttempted ? 0 : 5;
    return { correct, points: visit.quizPoints };
  }
  visit.quizAttempted = true;
  return { correct, points: 0 };
}

export function chooseMercy(visit, index) {
  if (visit.phase !== 'ask' || !visit.data.mercy) throw new Error('目前不在慈悲抉擇階段');
  if (visit.mercyReply !== null) return { reply: visit.mercyReply };
  const opt = visit.data.mercy.choices[index];
  if (!opt) throw new Error(`選項不存在：${index}`);
  if (opt.karma && visit.hooks.onKarma) {
    visit.hooks.onKarma(opt.karma.axis, opt.karma.delta, 1);
  }
  visit.mercyReply = opt.reply;
  return { reply: opt.reply };
}

export function takeBranch(visit, accepted) {
  if (visit.phase !== 'branch') throw new Error('目前不在支線階段');
  visit.branchTaken = accepted;
}

export function visitScore(visit) {
  return visit.quizPoints ?? 0;
}
