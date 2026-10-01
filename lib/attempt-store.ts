import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "./db";
import { attemptFixtures, type AttemptQuestion } from "./attempts";
import { fallbackExamDetails, type ExamDetail } from "./catalog";

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

export type TestDefinition = {
  title: string;
  exam: string;
  durationSeconds: number;
  questions: AttemptQuestion[];
  optionCount: number;
  marksCorrect: number;
  penaltyWrong: number;
};

export type TestStartInfo = {
  id: string;
  slug: string;
  name: string;
  type: string;
  questions: number;
  duration: string;
  access: "Free" | "Premium";
  examTitle: string;
  examSlug: string;
  correctMarks: string;
  wrongMarks: string;
  optionCount: number;
  description?: string;
};

export async function getTestStartInfo(testSlug: string): Promise<TestStartInfo | null> {
  try {
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      name: string;
      slug: string | null;
      test_type: string | null;
      question_count: number | null;
      duration_minutes: number | null;
      access_type: string | null;
      description: string | null;
      exam_name: string | null;
      exam_slug: string | null;
      option_count: number | null;
      marks_per_correct: number | null;
      penalty_wrong: number | null;
    })[]>(
      `SELECT t.id, t.name, t.slug, t.test_type, t.question_count, t.duration_minutes, t.access_type, t.description,
              e.name AS exam_name, e.slug AS exam_slug,
              r.option_count, r.marks_per_correct, r.penalty_wrong
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       LEFT JOIN rule_profiles r ON r.id = t.rule_profile_id
       WHERE t.slug = ? OR t.id = ? LIMIT 1`,
      [testSlug, testSlug]
    );

    if (rows[0]) {
      const r = rows[0];
      const isBpsc = (r.exam_slug || "").includes("bpsc");
      return {
        id: String(r.id),
        slug: r.slug || testSlug,
        name: r.name,
        type: r.test_type || "Full mock",
        questions: r.question_count || 150,
        duration: `${r.duration_minutes || 150} min`,
        access: r.access_type === "premium" ? "Premium" : "Free",
        examTitle: r.exam_name || "BPSC TRE 4.0",
        examSlug: r.exam_slug || "bpsc-tre-4",
        optionCount: r.option_count || (isBpsc ? 5 : 4),
        correctMarks: r.marks_per_correct ? `+${r.marks_per_correct}` : "+1",
        wrongMarks: r.penalty_wrong ? `-${r.penalty_wrong}` : isBpsc ? "-0.25" : "No negative marking",
        description: r.description || undefined,
      };
    }
  } catch {
    // fallback
  }

  for (const exam of Object.values(fallbackExamDetails) as ExamDetail[]) {
    const s = exam.series.find((item) => item.slug === testSlug);
    if (s) {
      return {
        id: s.slug,
        slug: s.slug,
        name: s.name,
        type: s.type,
        questions: s.questions,
        duration: s.duration,
        access: s.access,
        examTitle: exam.title,
        examSlug: exam.slug,
        optionCount: exam.optionCount,
        correctMarks: exam.correctMarks,
        wrongMarks: exam.wrongMarks,
        description: exam.description,
      };
    }
  }

  return null;
}

export async function getTestAttemptDefinition(testSlug: string): Promise<TestDefinition | null> {
  try {
    const [testRows] = await db.query<(RowDataPacket & {
      id: number;
      name: string;
      duration_minutes: number;
      subject_id: number | null;
      exam_id: number | null;
      exam_name: string | null;
      exam_slug: string | null;
    })[]>(
      `SELECT t.id, t.name, t.duration_minutes, t.subject_id, t.exam_id, e.name AS exam_name, e.slug AS exam_slug
       FROM tests t
       LEFT JOIN exams e ON e.id = t.exam_id
       WHERE t.slug = ? OR t.id = ? LIMIT 1`,
      [testSlug, testSlug]
    );

    if (testRows[0]) {
      const test = testRows[0];
      const examName = test.exam_name || "Northstar Exam Series";
      const durationSeconds = (test.duration_minutes || 150) * 60;
      const isBpsc = (test.exam_slug || "").includes("bpsc") || examName.toLowerCase().includes("bpsc");

      let [qRows] = await db.query<(RowDataPacket & {
        id: number;
        stem: string;
        explanation: string | null;
        section: string | null;
      })[]>(
        `SELECT q.id, q.stem, q.explanation, s.name AS section
         FROM test_questions tq
         JOIN questions q ON q.id = tq.question_id
         LEFT JOIN subjects s ON s.id = q.subject_id
         WHERE tq.test_id = ?
         ORDER BY tq.sort_order ASC`,
        [test.id]
      );

      // If test has no explicitly linked questions yet, pull available questions from the question bank
      if (qRows.length === 0) {
        const [fallbackQ] = await db.query<(RowDataPacket & {
          id: number;
          stem: string;
          explanation: string | null;
          section: string | null;
        })[]>(
          `SELECT q.id, q.stem, q.explanation, s.name AS section
           FROM questions q
           LEFT JOIN subjects s ON s.id = q.subject_id
           WHERE q.status = 'published' OR q.status = 'approved' OR q.status = 'draft'
           ORDER BY q.id ASC
           LIMIT 15`
        );
        qRows = fallbackQ;
      }

      if (qRows.length > 0) {
        const qIds = qRows.map((r) => r.id);
        const [optRows] = await db.query<(RowDataPacket & {
          question_id: number;
          option_key: string;
          option_text: string;
          is_correct: number;
        })[]>(
          `SELECT question_id, option_key, option_text, is_correct
           FROM question_options WHERE question_id IN (?)
           ORDER BY question_id, sort_order ASC`,
          [qIds]
        );

        const optsByQ = new Map<number, { texts: string[]; correctIdx: number }>();
        for (const opt of optRows) {
          if (!optsByQ.has(opt.question_id)) optsByQ.set(opt.question_id, { texts: [], correctIdx: 0 });
          const entry = optsByQ.get(opt.question_id)!;
          if (opt.is_correct) entry.correctIdx = entry.texts.length;
          entry.texts.push(opt.option_text);
        }

        const questions: AttemptQuestion[] = qRows.map((q, idx) => {
          const optData = optsByQ.get(q.id) || {
            texts: isBpsc
              ? ["Option A", "Option B", "Option C", "Option D", "None of the above / More than one of the above"]
              : ["Option A", "Option B", "Option C", "Option D"],
            correctIdx: 0,
          };
          return {
            id: idx + 1,
            section: q.section || "General Studies",
            prompt: q.stem,
            options: optData.texts,
            correctIndex: optData.correctIdx,
            explanation: q.explanation || "Official answer key and rationale.",
          };
        });

        return {
          title: test.name,
          exam: examName,
          durationSeconds,
          questions,
          optionCount: isBpsc ? 5 : 4,
          marksCorrect: 1,
          penaltyWrong: isBpsc ? 0.25 : 0,
        };
      }
    }
  } catch {
    // Fall back to fixture
  }

  const fixture = attemptFixtures[testSlug];
  if (fixture) {
    const isBpsc = testSlug.startsWith("bpsc-");
    return {
      title: fixture.title,
      exam: fixture.exam,
      durationSeconds: fixture.durationSeconds,
      questions: fixture.questions,
      optionCount: isBpsc ? 5 : 4,
      marksCorrect: 1,
      penaltyWrong: isBpsc ? 0.25 : 0,
    };
  }

  return null;
}

export async function createAttempt(testSlug: string, userId: string | null = null) {
  const def = await getTestAttemptDefinition(testSlug);
  if (!def) return null;
  const id = randomUUID();
  const ruleSnapshot: RuleSnapshot = {
    optionCount: def.optionCount,
    marksCorrect: def.marksCorrect,
    penaltyWrong: def.penaltyWrong,
    penaltyUnanswered: 0,
  };
  const attempt: AttemptRecord = {
    id,
    userId,
    testSlug,
    title: def.title,
    exam: def.exam,
    questions: def.questions,
    ruleSnapshot,
    answers: {},
    reviewed: [],
    startedAt: Date.now(),
    durationSeconds: def.durationSeconds,
  };
  attemptStore.set(id, attempt);
  try {
    await db.execute(
      "INSERT INTO test_attempts (id, user_id, test_slug, test_title, exam_name, question_snapshot, rule_snapshot, answers, reviewed, duration_seconds, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())",
      [
        id,
        userId,
        testSlug,
        def.title,
        def.exam,
        JSON.stringify(def.questions),
        JSON.stringify(ruleSnapshot),
        JSON.stringify({}),
        JSON.stringify([]),
        def.durationSeconds,
      ]
    );
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
