import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import { attemptFixtures, type AttemptQuestion } from "./attempts";

export type AttemptResult = { id: string; score: number; maxScore: number; correct: number; incorrect: number; unanswered: number; submittedAt: number };
type RuleSnapshot = { optionCount: number; marksCorrect: number; penaltyWrong: number; penaltyUnanswered: number };
type AttemptRecord = { id: string; userId: string | null; testSlug: string; title: string; exam: string; questions: AttemptQuestion[]; ruleSnapshot: RuleSnapshot; answers: Record<number, number>; reviewed: number[]; startedAt: number; durationSeconds: number; submittedAt?: number; result?: AttemptResult };
type AttemptRow = RowDataPacket & { id: string; user_id: string | null; test_slug: string; test_title: string; exam_name: string; question_snapshot: string | AttemptQuestion[]; rule_snapshot: string | RuleSnapshot; answers: string | Record<number, number>; reviewed: string | number[]; duration_seconds: number; started_at: Date | string; submitted_at: Date | string | null; result_snapshot: string | AttemptResult | null };

const globalForAttempts = globalThis as unknown as { attemptStore?: Map<string, AttemptRecord> };
const attemptStore = globalForAttempts.attemptStore ?? new Map<string, AttemptRecord>();
if (process.env.NODE_ENV !== "production") globalForAttempts.attemptStore = attemptStore;
const decode = <T,>(value: string | T): T => typeof value === "string" ? JSON.parse(value) as T : value;
const asTime = (value: Date | string | null) => value ? new Date(value).getTime() : undefined;

async function loadAttempt(id: string): Promise<AttemptRecord | null> {
  try {
    const [rows] = await db.query<AttemptRow[]>("SELECT * FROM test_attempts WHERE id = ? LIMIT 1", [id]);
    const row = rows[0];
    if (row) {
      const result = row.result_snapshot ? decode<AttemptResult>(row.result_snapshot) : undefined;
      return { id: row.id, userId: row.user_id, testSlug: row.test_slug, title: row.test_title, exam: row.exam_name, questions: decode<AttemptQuestion[]>(row.question_snapshot), ruleSnapshot: decode<RuleSnapshot>(row.rule_snapshot), answers: decode<Record<number, number>>(row.answers), reviewed: decode<number[]>(row.reviewed), durationSeconds: row.duration_seconds, startedAt: asTime(row.started_at) ?? Date.now(), submittedAt: asTime(row.submitted_at), result };
    }
  } catch {
    // Fall back to the process store when MySQL/schema is unavailable.
  }
  return attemptStore.get(id) ?? null;
}

export async function createAttempt(testSlug: string, userId: string | null = null) {
  const fixture = attemptFixtures[testSlug];
  if (!fixture) return null;
  const id = randomUUID();
  const ruleSnapshot: RuleSnapshot = { optionCount: testSlug.startsWith("bpsc-") ? 5 : 4, marksCorrect: 1, penaltyWrong: testSlug.startsWith("bpsc-") ? 0.25 : 0, penaltyUnanswered: 0 };
  const attempt: AttemptRecord = { id, userId, testSlug, title: fixture.title, exam: fixture.exam, questions: fixture.questions, ruleSnapshot, answers: {}, reviewed: [], startedAt: Date.now(), durationSeconds: fixture.durationSeconds };
  attemptStore.set(id, attempt);
  try {
    await db.execute("INSERT INTO test_attempts (id, user_id, test_slug, test_title, exam_name, question_snapshot, rule_snapshot, answers, reviewed, duration_seconds, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())", [id, userId, testSlug, fixture.title, fixture.exam, JSON.stringify(fixture.questions), JSON.stringify(ruleSnapshot), JSON.stringify({}), JSON.stringify([]), fixture.durationSeconds]);
  } catch {
    // Keep the same API usable before the XAMPP schema is imported.
  }
  return attempt;
}

export async function getAttempt(id: string) {
  return loadAttempt(id);
}

export async function getAttemptResult(id: string) {
  const attempt = await loadAttempt(id);
  if (!attempt?.result) return null;
  return { attempt, result: attempt.result };
}

export async function saveResponse(id: string, questionId: number, optionIndex: number | null, markForReview?: boolean) {
  const attempt = await loadAttempt(id);
  if (!attempt || attempt.submittedAt || Date.now() >= attempt.startedAt + attempt.durationSeconds * 1000) return null;
  const question = attempt.questions.find((item) => item.id === questionId);
  if (!question || (optionIndex !== null && (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length))) return null;
  if (optionIndex === null) delete attempt.answers[questionId];
  else attempt.answers[questionId] = optionIndex;
  if (markForReview !== undefined) attempt.reviewed = markForReview ? [...new Set([...attempt.reviewed, questionId])] : attempt.reviewed.filter((value) => value !== questionId);
  attemptStore.set(id, attempt);
  try {
    await db.execute("UPDATE test_attempts SET answers = ?, reviewed = ? WHERE id = ? AND submitted_at IS NULL", [JSON.stringify(attempt.answers), JSON.stringify(attempt.reviewed), id]);
  } catch {
    // Process store is the local fallback.
  }
  return attempt;
}

export async function submitAttempt(id: string) {
  const attempt = await loadAttempt(id);
  if (!attempt) return null;
  if (attempt.result) return attempt.result;
  attempt.submittedAt = Date.now();
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  attempt.questions.forEach((question) => {
    const selected = attempt.answers[question.id];
    if (selected === undefined) return;
    if (selected === question.correctIndex) { correct += 1; score += attempt.ruleSnapshot.marksCorrect; }
    else { incorrect += 1; score -= attempt.ruleSnapshot.penaltyWrong; }
  });
  const result: AttemptResult = { id: attempt.id, score: Math.max(0, score), maxScore: attempt.questions.length * attempt.ruleSnapshot.marksCorrect, correct, incorrect, unanswered: attempt.questions.length - Object.keys(attempt.answers).length, submittedAt: attempt.submittedAt };
  attempt.result = result;
  attemptStore.set(id, attempt);
  try {
    await db.execute("UPDATE test_attempts SET submitted_at = UTC_TIMESTAMP(), result_snapshot = ? WHERE id = ? AND submitted_at IS NULL", [JSON.stringify(result), id]);
  } catch {
    // Process store is the local fallback.
  }
  return result;
}
