import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "./db";
import { adminQuestions, adminTests, ruleProfiles, type AdminQuestion, type AdminTest, type RuleProfile } from "./phase1";

type QuestionInput = { exam: string; subject: string; topic?: string; stem: string; explanation?: string; options?: { text: string; correct?: boolean }[] };
type QuestionRow = RowDataPacket & { id: number; exam: string | null; subject: string | null; topic: string | null; stem: string; status: string };

const globalForAdminContent = globalThis as unknown as { questions?: AdminQuestion[]; rules?: RuleProfile[]; tests?: AdminTest[] };
const localQuestions = globalForAdminContent.questions ?? [...adminQuestions];
const localRules = globalForAdminContent.rules ?? [...ruleProfiles];
const localTests = globalForAdminContent.tests ?? [...adminTests];
if (process.env.NODE_ENV !== "production") { globalForAdminContent.questions = localQuestions; globalForAdminContent.rules = localRules; globalForAdminContent.tests = localTests; }

export async function listQuestions() {
  try {
    const [rows] = await db.query<QuestionRow[]>(`SELECT q.id, e.name AS exam, s.name AS subject, t.name AS topic, q.stem, q.status
      FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN exams e ON e.id = s.exam_id LEFT JOIN topics t ON t.id = q.topic_id
      ORDER BY q.id DESC LIMIT 250`);
    return rows.map((row) => ({ id: String(row.id), exam: row.exam ?? "Unassigned", subject: row.subject ?? "Unassigned", topic: row.topic ?? "Unassigned", stem: row.stem, status: normalizeQuestionStatus(row.status), usedIn: [] } satisfies AdminQuestion));
  } catch {
    // Keep local question management available before MySQL is initialized.
  }
  return [...localQuestions];
}

function normalizeQuestionStatus(status: string): AdminQuestion["status"] {
  if (status === "in_review") return "In review";
  if (status === "approved") return "Approved";
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export async function createQuestion(input: QuestionInput): Promise<AdminQuestion> {
  if (!input.exam?.trim() || !input.subject?.trim() || !input.stem?.trim()) throw new Error("Exam, subject, and question text are required.");
  if (input.options && (input.options.length < 2 || input.options.length > 5 || input.options.filter((option) => option.correct).length > 1)) throw new Error("Provide 2–5 answer options and at most one correct answer.");
  const fallback: AdminQuestion = { id: `q-${Date.now()}`, exam: input.exam.trim(), subject: input.subject.trim(), topic: input.topic?.trim() ?? "Unassigned", stem: input.stem.trim(), status: "Draft", usedIn: [] };

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [exams] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM exams WHERE slug = ? OR name = ? LIMIT 1", [input.exam, input.exam]);
      if (!exams[0]) throw new Error("Exam not found in the database catalog.");
      let [subjects] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM subjects WHERE exam_id = ? AND name = ? LIMIT 1", [exams[0].id, input.subject.trim()]);
      if (!subjects[0]) {
        const subjectSlug = input.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const [subjectInsert] = await connection.execute<ResultSetHeader>("INSERT INTO subjects (exam_id, name, slug) VALUES (?, ?, ?)", [exams[0].id, input.subject.trim(), subjectSlug]);
        subjects = [{ id: subjectInsert.insertId } as RowDataPacket & { id: number }];
      }
      let topicId: number | null = null;
      if (input.topic?.trim()) {
        const [topics] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM topics WHERE subject_id = ? AND name = ? LIMIT 1", [subjects[0].id, input.topic.trim()]);
        topicId = topics[0]?.id ?? null;
        if (!topicId) {
          const topicSlug = input.topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const [topicInsert] = await connection.execute<ResultSetHeader>("INSERT INTO topics (subject_id, name, slug) VALUES (?, ?, ?)", [subjects[0].id, input.topic.trim(), topicSlug]);
          topicId = topicInsert.insertId;
        }
      }
      const [insert] = await connection.execute<ResultSetHeader>("INSERT INTO questions (subject_id, topic_id, stem, explanation, status, version) VALUES (?, ?, ?, ?, 'draft', 1)", [subjects[0].id, topicId, input.stem.trim(), input.explanation?.trim() || null]);
      for (const [index, option] of (input.options ?? []).entries()) {
        await connection.execute("INSERT INTO question_options (question_id, option_key, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?)", [insert.insertId, String.fromCharCode(65 + index), option.text.trim(), option.correct ? 1 : 0, index]);
      }
      await connection.commit();
      fallback.id = String(insert.insertId);
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && error.message === "Exam not found in the database catalog.") throw error;
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw new Error("Question storage is unavailable. Check the database connection and schema.");
    if (error instanceof Error && error.message === "Exam not found in the database catalog.") throw error;
    localQuestions.unshift(fallback);
  }
  if (!localQuestions.some((question) => question.id === fallback.id)) localQuestions.unshift(fallback);
  return fallback;
}

const toDatabaseStatus = (status: AdminQuestion["status"]) => status === "In review" ? "in_review" : status.toLowerCase();

export async function transitionQuestion(id: string, status: AdminQuestion["status"]) {
  const nextStatus = toDatabaseStatus(status);
  if (!["draft", "in_review", "approved", "published", "archived"].includes(nextStatus)) throw new Error("Invalid question status.");
  try {
    const [result] = await db.execute<ResultSetHeader>("UPDATE questions SET status = ?, version = version + 1 WHERE id = ?", [nextStatus, id]);
    if (result.affectedRows === 0) throw new Error("Question not found.");
  } catch (error) {
    if (error instanceof Error && error.message === "Question not found.") throw error;
    const question = localQuestions.find((item) => item.id === id);
    if (!question) throw new Error("Question not found.");
    question.status = status;
  }
  const question = localQuestions.find((item) => item.id === id);
  if (question) question.status = status;
  return question ?? { id, exam: "", subject: "", topic: "", stem: "", status, usedIn: [] };
}

export async function listRuleProfiles() {
  try {
    const [rows] = await db.query<(RowDataPacket & { id: number; exam: string; version: number; option_count: number; marks_per_correct: number; penalty_wrong: number; penalty_unanswered: number; status: string; source_url: string | null })[]>(`SELECT r.id, e.name AS exam, r.version, r.option_count, r.marks_per_correct, r.penalty_wrong, r.penalty_unanswered, r.status, r.source_url
      FROM rule_profiles r JOIN exams e ON e.id = r.exam_id ORDER BY e.name, r.version DESC`);
    return rows.map((row) => ({ id: String(row.id), exam: row.exam, version: row.version, options: row.option_count, correctMarks: `+${row.marks_per_correct}`, wrongMarks: row.penalty_wrong ? `-${row.penalty_wrong}` : "0", unansweredMarks: row.penalty_unanswered ? `-${row.penalty_unanswered}` : "0", status: normalizeQuestionStatus(row.status), source: row.source_url ?? "Not specified" } satisfies RuleProfile));
  } catch { /* Local fallback before schema setup. */ }
  return [...localRules];
}

type RuleInput = { exam: string; name: string; options: number; correctMarks: number; wrongMarks: number; unansweredMarks?: number; source?: string; effectiveFrom?: string };

export async function createRuleProfile(input: RuleInput): Promise<RuleProfile> {
  if (!input.exam?.trim() || !input.name?.trim() || ![4, 5].includes(Number(input.options))) throw new Error("Exam, profile name, and 4 or 5 answer options are required.");
  if (![input.correctMarks, input.wrongMarks, input.unansweredMarks ?? 0].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error("Mark values must be non-negative numbers.");
  let created: RuleProfile = { id: `rule-${Date.now()}`, exam: input.exam, version: Math.max(0, ...localRules.filter((rule) => rule.exam === input.exam).map((rule) => rule.version)) + 1, options: Number(input.options), correctMarks: `+${input.correctMarks}`, wrongMarks: input.wrongMarks ? `-${input.wrongMarks}` : "0", unansweredMarks: input.unansweredMarks ? `-${input.unansweredMarks}` : "0", status: "Draft", source: input.source || "Not specified" };
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [exams] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM exams WHERE slug = ? OR name = ? LIMIT 1", [input.exam, input.exam]);
      if (!exams[0]) throw new Error("Exam not found in the database catalog.");
      const [versions] = await connection.query<(RowDataPacket & { next_version: number })[]>("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM rule_profiles WHERE exam_id = ?", [exams[0].id]);
      const [insert] = await connection.execute<ResultSetHeader>("INSERT INTO rule_profiles (exam_id, version, name, option_count, marks_per_correct, penalty_wrong, penalty_unanswered, source_url, effective_from, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')", [exams[0].id, versions[0].next_version, input.name.trim(), input.options, input.correctMarks, input.wrongMarks, input.unansweredMarks ?? 0, input.source || null, input.effectiveFrom || null]);
      created = { ...created, id: String(insert.insertId), version: versions[0].next_version };
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && error.message === "Exam not found in the database catalog.") throw error;
      throw error;
    } finally { connection.release(); }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw new Error("Rule storage is unavailable. Check the database connection and schema.");
    if (error instanceof Error && error.message === "Exam not found in the database catalog.") throw error;
  }
  localRules.unshift(created);
  return created;
}

export async function listTests() {
  try {
    const [rows] = await db.query<(RowDataPacket & { id: number; name: string; exam: string; test_type: string; question_count: number; duration_minutes: number; access_type: "free" | "premium"; status: string })[]>(`SELECT t.id, t.name, e.name AS exam, t.test_type, t.question_count, t.duration_minutes, ts.access_type, t.status
      FROM tests t JOIN test_series ts ON ts.id = t.test_series_id JOIN exams e ON e.id = ts.exam_id ORDER BY t.id DESC`);
    return rows.map((row) => ({ id: String(row.id), name: row.name, exam: row.exam, type: row.test_type, questions: row.question_count, duration: `${row.duration_minutes} min`, access: row.access_type === "free" ? "Free" : "Premium", status: normalizeQuestionStatus(row.status) } satisfies AdminTest));
  } catch { /* Local fallback before schema setup. */ }
  return [...localTests];
}

type TestInput = { exam: string; seriesName: string; seriesSlug: string; name: string; type: string; questionCount: number; durationMinutes: number; access: "Free" | "Premium"; ruleProfileId: string };

export async function createTest(input: TestInput): Promise<AdminTest> {
  if (!input.exam?.trim() || !input.seriesName?.trim() || !input.seriesSlug?.trim() || !input.name?.trim() || !input.ruleProfileId) throw new Error("Exam, series, test name, and rule profile are required.");
  const validTypes = ["full", "section", "subject", "topic", "mini", "pyq", "live"];
  if (!validTypes.includes(input.type) || !Number.isInteger(Number(input.questionCount)) || Number(input.questionCount) < 1 || !Number.isInteger(Number(input.durationMinutes)) || Number(input.durationMinutes) < 1) throw new Error("Test type, question count, or duration is invalid.");
  let created: AdminTest = { id: `test-${Date.now()}`, exam: input.exam, name: input.name, type: input.type, questions: Number(input.questionCount), duration: `${input.durationMinutes} min`, access: input.access, status: "Draft" };
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [exams] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM exams WHERE slug = ? OR name = ? LIMIT 1", [input.exam, input.exam]);
      if (!exams[0]) throw new Error("Exam not found in the database catalog.");
      const [rules] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM rule_profiles WHERE id = ? AND exam_id = ?", [input.ruleProfileId, exams[0].id]);
      if (!rules[0]) throw new Error("Rule profile not found for the selected exam.");
      const [seriesRows] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM test_series WHERE slug = ?", [input.seriesSlug]);
      let seriesId = seriesRows[0]?.id;
      if (!seriesId) {
        const [seriesInsert] = await connection.execute<ResultSetHeader>("INSERT INTO test_series (exam_id, name, slug, access_type, status) VALUES (?, ?, ?, ?, 'draft')", [exams[0].id, input.seriesName, input.seriesSlug, input.access.toLowerCase()]);
        seriesId = seriesInsert.insertId;
      }
      const [insert] = await connection.execute<ResultSetHeader>("INSERT INTO tests (test_series_id, rule_profile_id, name, test_type, question_count, duration_minutes, total_marks, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')", [seriesId, rules[0].id, input.name, input.type, input.questionCount, input.durationMinutes, input.questionCount]);
      created = { ...created, id: String(insert.insertId) };
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && ["Exam not found in the database catalog.", "Rule profile not found for the selected exam."].includes(error.message)) throw error;
      throw error;
    } finally { connection.release(); }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw new Error("Test storage is unavailable. Check the database connection and schema.");
    if (error instanceof Error && ["Exam not found in the database catalog.", "Rule profile not found for the selected exam."].includes(error.message)) throw error;
  }
  localTests.unshift(created);
  return created;
}
