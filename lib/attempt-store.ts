import { attemptFixtures, type AttemptQuestion } from "./attempts";

export type AttemptResult = {
  id: string;
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  submittedAt: number;
};

type AttemptRecord = {
  id: string;
  testSlug: string;
  title: string;
  exam: string;
  questions: AttemptQuestion[];
  answers: Record<number, number>;
  reviewed: number[];
  startedAt: number;
  durationSeconds: number;
  submittedAt?: number;
  result?: AttemptResult;
};

const globalForAttempts = globalThis as unknown as { attemptStore?: Map<string, AttemptRecord> };
const attemptStore = globalForAttempts.attemptStore ?? new Map<string, AttemptRecord>();
if (process.env.NODE_ENV !== "production") globalForAttempts.attemptStore = attemptStore;

export function createAttempt(testSlug: string) {
  const fixture = attemptFixtures[testSlug];
  if (!fixture) return null;
  const id = crypto.randomUUID();
  const attempt: AttemptRecord = { id, testSlug, title: fixture.title, exam: fixture.exam, questions: fixture.questions, answers: {}, reviewed: [], startedAt: Date.now(), durationSeconds: fixture.durationSeconds };
  attemptStore.set(id, attempt);
  return attempt;
}

export function getAttempt(id: string) {
  return attemptStore.get(id);
}

export function getAttemptResult(id: string) {
  const attempt = attemptStore.get(id);
  if (!attempt?.result) return null;
  return { attempt, result: attempt.result };
}

export function saveResponse(id: string, questionId: number, optionIndex: number | null, markForReview?: boolean) {
  const attempt = attemptStore.get(id);
  if (!attempt || attempt.submittedAt) return null;
  if (optionIndex === null) delete attempt.answers[questionId];
  else attempt.answers[questionId] = optionIndex;
  if (markForReview !== undefined) attempt.reviewed = markForReview ? [...new Set([...attempt.reviewed, questionId])] : attempt.reviewed.filter((value) => value !== questionId);
  return attempt;
}

export function submitAttempt(id: string) {
  const attempt = attemptStore.get(id);
  if (!attempt) return null;
  attempt.submittedAt = Date.now();
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  attempt.questions.forEach((question) => {
    const selected = attempt.answers[question.id];
    if (selected === undefined) return;
    if (selected === question.correctIndex) { correct += 1; score += 1; }
    else { incorrect += 1; score -= 0.25; }
  });
  const result: AttemptResult = { id: attempt.id, score: Math.max(0, score), maxScore: attempt.questions.length, correct, incorrect, unanswered: attempt.questions.length - Object.keys(attempt.answers).length, submittedAt: attempt.submittedAt };
  attempt.result = result;
  return result;
}
