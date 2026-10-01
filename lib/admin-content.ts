import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "./db";
import { adminQuestions, adminTests, ruleProfiles, type AdminQuestion, type AdminTest, type RuleProfile, type QuestionOption } from "./phase1";
import { syllabusTracks } from "./syllabus";

export type QuestionInput = {
  exam: string;
  subject: string;
  topic?: string;
  stem: string;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  status?: AdminQuestion["status"];
  options?: { key?: string; text: string; correct?: boolean }[];
};

export type BulkImportResult = {
  total: number;
  importedCount: number;
  rejectedCount: number;
  imported: AdminQuestion[];
  rejected: { row: number; stem: string; reason: string }[];
};

type QuestionRow = RowDataPacket & {
  id: number;
  exam: string | null;
  subject: string | null;
  topic: string | null;
  stem: string;
  explanation: string | null;
  difficulty: string | null;
  status: string;
};

type OptionRow = RowDataPacket & {
  question_id: number;
  option_key: string;
  option_text: string;
  is_correct: number;
  sort_order: number;
};

const globalForAdminContent = globalThis as unknown as { questions?: AdminQuestion[]; rules?: RuleProfile[]; tests?: AdminTest[] };
const localQuestions = globalForAdminContent.questions ?? [...adminQuestions];
const localRules = globalForAdminContent.rules ?? [...ruleProfiles];
const localTests = globalForAdminContent.tests ?? [...adminTests];
if (process.env.NODE_ENV !== "production") {
  globalForAdminContent.questions = localQuestions;
  globalForAdminContent.rules = localRules;
  globalForAdminContent.tests = localTests;
}

export async function listQuestions(filters?: { exam?: string; subject?: string; status?: string; query?: string }) {
  try {
    let sql = `SELECT q.id, e.name AS exam, s.name AS subject, t.name AS topic, q.stem, q.explanation, q.difficulty, q.status
      FROM questions q
      LEFT JOIN subjects s ON s.id = q.subject_id
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN topics t ON t.id = q.topic_id`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters?.exam && filters.exam !== "All") {
      conditions.push("(e.name = ? OR e.slug = ?)");
      params.push(filters.exam, filters.exam);
    }
    if (filters?.subject && filters.subject !== "All") {
      conditions.push("s.name = ?");
      params.push(filters.subject);
    }
    if (filters?.status && filters.status !== "All") {
      conditions.push("q.status = ?");
      params.push(toDatabaseStatus(filters.status as AdminQuestion["status"]));
    }
    if (filters?.query?.trim()) {
      conditions.push("(q.stem LIKE ? OR q.explanation LIKE ? OR t.name LIKE ?)");
      const term = `%${filters.query.trim()}%`;
      params.push(term, term, term);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY q.id DESC LIMIT 500";

    const [rows] = await db.query<QuestionRow[]>(sql, params);

    if (rows.length > 0) {
      const qIds = rows.map((r) => r.id);
      const [optRows] = await db.query<OptionRow[]>(
        `SELECT question_id, option_key, option_text, is_correct, sort_order
         FROM question_options
         WHERE question_id IN (?)
         ORDER BY question_id, sort_order ASC`,
        [qIds]
      );

      const optionsMap = new Map<number, QuestionOption[]>();
      for (const opt of optRows) {
        if (!optionsMap.has(opt.question_id)) optionsMap.set(opt.question_id, []);
        optionsMap.get(opt.question_id)!.push({
          key: opt.option_key,
          text: opt.option_text,
          correct: Boolean(opt.is_correct),
        });
      }

      return rows.map((row) => ({
        id: String(row.id),
        exam: row.exam ?? "Unassigned",
        subject: row.subject ?? "Unassigned",
        topic: row.topic ?? "Unassigned",
        stem: row.stem,
        explanation: row.explanation ?? "",
        difficulty: (row.difficulty as "easy" | "medium" | "hard") || "medium",
        status: normalizeQuestionStatus(row.status),
        options: optionsMap.get(row.id) ?? [],
        usedIn: [],
      } satisfies AdminQuestion));
    } else if (!filters || Object.keys(filters).length === 0) {
      return [...localQuestions];
    }
    return [];
  } catch {
    // Keep local question management available before MySQL is initialized.
  }

  let results = [...localQuestions];
  if (filters?.exam && filters.exam !== "All") {
    results = results.filter((q) => q.exam === filters.exam);
  }
  if (filters?.subject && filters.subject !== "All") {
    results = results.filter((q) => q.subject === filters.subject);
  }
  if (filters?.status && filters.status !== "All") {
    results = results.filter((q) => q.status === filters.status);
  }
  if (filters?.query?.trim()) {
    const q = filters.query.toLowerCase();
    results = results.filter(
      (item) =>
        item.stem.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        (item.explanation && item.explanation.toLowerCase().includes(q))
    );
  }
  return results;
}

function normalizeQuestionStatus(status: string): AdminQuestion["status"] {
  if (status === "in_review") return "In review";
  if (status === "approved") return "Approved";
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

const toDatabaseStatus = (status: AdminQuestion["status"]) => (status === "In review" ? "in_review" : status.toLowerCase());

export async function createQuestion(input: QuestionInput): Promise<AdminQuestion> {
  if (!input.exam?.trim() || !input.subject?.trim() || !input.stem?.trim()) {
    throw new Error("Exam, subject, and question text are required.");
  }
  const cleanOptions = (input.options ?? []).filter((opt) => opt.text.trim().length > 0);
  if (cleanOptions.length < 2 || cleanOptions.length > 5) {
    throw new Error("Provide between 2 and 5 answer options.");
  }
  const correctCount = cleanOptions.filter((opt) => opt.correct).length;
  if (correctCount !== 1) {
    throw new Error("Exactly one option must be marked as the correct answer.");
  }

  const fallback: AdminQuestion = {
    id: `q-${Date.now()}`,
    exam: input.exam.trim(),
    subject: input.subject.trim(),
    topic: input.topic?.trim() || "Unassigned",
    stem: input.stem.trim(),
    explanation: input.explanation?.trim() || "",
    difficulty: input.difficulty || "medium",
    status: input.status ?? "Draft",
    options: cleanOptions.map((opt, index) => ({
      key: opt.key || String.fromCharCode(65 + index),
      text: opt.text.trim(),
      correct: Boolean(opt.correct),
    })),
    usedIn: [],
  };

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let [exams] = await connection.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM exams WHERE slug = ? OR name = ? LIMIT 1",
        [input.exam.trim(), input.exam.trim()]
      );
      if (!exams[0]) {
        const examSlug = input.exam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const [examInsert] = await connection.execute<ResultSetHeader>(
          "INSERT INTO exams (name, slug, status, visual_tone, visual_symbol) VALUES (?, ?, 'published', 'saffron', '✦')",
          [input.exam.trim(), examSlug || `exam-${Date.now()}`]
        );
        exams = [{ id: examInsert.insertId } as RowDataPacket & { id: number }];
      }

      let [subjects] = await connection.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM subjects WHERE exam_id = ? AND name = ? LIMIT 1",
        [exams[0].id, input.subject.trim()]
      );
      if (!subjects[0]) {
        const subjectSlug = input.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const [subjectInsert] = await connection.execute<ResultSetHeader>(
          "INSERT INTO subjects (exam_id, name, slug) VALUES (?, ?, ?)",
          [exams[0].id, input.subject.trim(), subjectSlug || `subject-${Date.now()}`]
        );
        subjects = [{ id: subjectInsert.insertId } as RowDataPacket & { id: number }];
      }

      let topicId: number | null = null;
      if (input.topic?.trim()) {
        const [topics] = await connection.query<(RowDataPacket & { id: number })[]>(
          "SELECT id FROM topics WHERE subject_id = ? AND name = ? LIMIT 1",
          [subjects[0].id, input.topic.trim()]
        );
        topicId = topics[0]?.id ?? null;
        if (!topicId) {
          const topicSlug = input.topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const [topicInsert] = await connection.execute<ResultSetHeader>(
            "INSERT INTO topics (subject_id, name, slug) VALUES (?, ?, ?)",
            [subjects[0].id, input.topic.trim(), topicSlug || `topic-${Date.now()}`]
          );
          topicId = topicInsert.insertId;
        }
      }

      const dbStatus = toDatabaseStatus(input.status ?? "Draft");
      const [insert] = await connection.execute<ResultSetHeader>(
        "INSERT INTO questions (subject_id, topic_id, stem, explanation, status, version, difficulty) VALUES (?, ?, ?, ?, ?, 1, ?)",
        [subjects[0].id, topicId, input.stem.trim(), input.explanation?.trim() || null, dbStatus, input.difficulty || "medium"]
      );

      for (const [index, option] of cleanOptions.entries()) {
        const key = option.key || String.fromCharCode(65 + index);
        await connection.execute(
          "INSERT INTO question_options (question_id, option_key, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?)",
          [insert.insertId, key, option.text.trim(), option.correct ? 1 : 0, index]
        );
      }

      await connection.commit();
      fallback.id = String(insert.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw new Error("Question storage is unavailable. Check the database connection and schema.");
    localQuestions.unshift(fallback);
  }

  if (!localQuestions.some((question) => question.id === fallback.id)) {
    localQuestions.unshift(fallback);
  }
  return fallback;
}

export async function createQuestionsBulk(inputs: QuestionInput[]): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: inputs.length,
    importedCount: 0,
    rejectedCount: 0,
    imported: [],
    rejected: [],
  };

  const validInputs: { input: QuestionInput; index: number; options: { key: string; text: string; correct: boolean }[] }[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const item = inputs[i];
    const rowNum = i + 1;
    const stemPreview = item.stem ? item.stem.slice(0, 50) + "..." : `Row #${rowNum}`;

    if (!item.exam?.trim()) {
      result.rejected.push({ row: rowNum, stem: stemPreview, reason: "Exam name is required." });
      continue;
    }
    if (!item.subject?.trim()) {
      result.rejected.push({ row: rowNum, stem: stemPreview, reason: "Subject is required." });
      continue;
    }
    if (!item.stem?.trim() || item.stem.trim().length < 5) {
      result.rejected.push({ row: rowNum, stem: stemPreview, reason: "Question text (stem) must have at least 5 characters." });
      continue;
    }

    const cleanOptions = (item.options ?? []).filter((opt) => opt.text && opt.text.trim().length > 0);
    if (cleanOptions.length < 2 || cleanOptions.length > 5) {
      result.rejected.push({
        row: rowNum,
        stem: stemPreview,
        reason: `Found ${cleanOptions.length} options. Questions must have between 2 and 5 answer options.`,
      });
      continue;
    }

    const correctCount = cleanOptions.filter((opt) => opt.correct).length;
    if (correctCount !== 1) {
      result.rejected.push({
        row: rowNum,
        stem: stemPreview,
        reason: correctCount === 0 ? "No option is marked as correct." : "Multiple options marked as correct. Exactly one answer must be correct.",
      });
      continue;
    }

    validInputs.push({
      input: item,
      index: rowNum,
      options: cleanOptions.map((opt, idx) => ({
        key: opt.key || String.fromCharCode(65 + idx),
        text: opt.text.trim(),
        correct: Boolean(opt.correct),
      })),
    });
  }

  if (validInputs.length === 0) {
    result.rejectedCount = result.rejected.length;
    return result;
  }

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const examCache = new Map<string, number>();
      const subjectCache = new Map<string, number>();
      const topicCache = new Map<string, number>();

      for (const { input, options } of validInputs) {
        const examName = input.exam.trim();
        let examId = examCache.get(examName.toLowerCase());

        if (!examId) {
          const [exams] = await connection.query<(RowDataPacket & { id: number })[]>(
            "SELECT id FROM exams WHERE slug = ? OR name = ? LIMIT 1",
            [examName, examName]
          );
          if (exams[0]) {
            examId = exams[0].id;
          } else {
            const examSlug = examName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const [examInsert] = await connection.execute<ResultSetHeader>(
              "INSERT INTO exams (name, slug, status, visual_tone, visual_symbol) VALUES (?, ?, 'published', 'saffron', '✦')",
              [examName, examSlug || `exam-${Date.now()}`]
            );
            examId = examInsert.insertId;
          }
          examCache.set(examName.toLowerCase(), examId);
        }

        const subjectName = input.subject.trim();
        const subKey = `${examId}:${subjectName.toLowerCase()}`;
        let subjectId = subjectCache.get(subKey);

        if (!subjectId) {
          const [subjects] = await connection.query<(RowDataPacket & { id: number })[]>(
            "SELECT id FROM subjects WHERE exam_id = ? AND name = ? LIMIT 1",
            [examId, subjectName]
          );
          if (subjects[0]) {
            subjectId = subjects[0].id;
          } else {
            const subjectSlug = subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const [subjectInsert] = await connection.execute<ResultSetHeader>(
              "INSERT INTO subjects (exam_id, name, slug) VALUES (?, ?, ?)",
              [examId, subjectName, subjectSlug || `subject-${Date.now()}`]
            );
            subjectId = subjectInsert.insertId;
          }
          subjectCache.set(subKey, subjectId);
        }

        let topicId: number | null = null;
        if (input.topic?.trim()) {
          const topicName = input.topic.trim();
          const topKey = `${subjectId}:${topicName.toLowerCase()}`;
          topicId = topicCache.get(topKey) ?? null;

          if (!topicId) {
            const [topics] = await connection.query<(RowDataPacket & { id: number })[]>(
              "SELECT id FROM topics WHERE subject_id = ? AND name = ? LIMIT 1",
              [subjectId, topicName]
            );
            if (topics[0]) {
              topicId = topics[0].id;
            } else {
              const topicSlug = topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              const [topicInsert] = await connection.execute<ResultSetHeader>(
                "INSERT INTO topics (subject_id, name, slug) VALUES (?, ?, ?)",
                [subjectId, topicName, topicSlug || `topic-${Date.now()}`]
              );
              topicId = topicInsert.insertId;
            }
            topicCache.set(topKey, topicId);
          }
        }

        const dbStatus = toDatabaseStatus(input.status ?? "Draft");
        const [insert] = await connection.execute<ResultSetHeader>(
          "INSERT INTO questions (subject_id, topic_id, stem, explanation, status, version, difficulty) VALUES (?, ?, ?, ?, ?, 1, ?)",
          [subjectId, topicId, input.stem.trim(), input.explanation?.trim() || null, dbStatus, input.difficulty || "medium"]
        );

        for (const [idx, opt] of options.entries()) {
          await connection.execute(
            "INSERT INTO question_options (question_id, option_key, option_text, is_correct, sort_order) VALUES (?, ?, ?, ?, ?)",
            [insert.insertId, opt.key, opt.text, opt.correct ? 1 : 0, idx]
          );
        }

        const importedQ: AdminQuestion = {
          id: String(insert.insertId),
          exam: examName,
          subject: subjectName,
          topic: input.topic?.trim() || "Unassigned",
          stem: input.stem.trim(),
          explanation: input.explanation?.trim() || "",
          difficulty: input.difficulty || "medium",
          status: input.status ?? "Draft",
          options,
          usedIn: [],
        };
        result.imported.push(importedQ);
        localQuestions.unshift(importedQ);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch {
    // If DB is unavailable, fall back to in-memory store
    for (const { input, options } of validInputs) {
      const importedQ: AdminQuestion = {
        id: `q-bulk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        exam: input.exam.trim(),
        subject: input.subject.trim(),
        topic: input.topic?.trim() || "Unassigned",
        stem: input.stem.trim(),
        explanation: input.explanation?.trim() || "",
        difficulty: input.difficulty || "medium",
        status: input.status ?? "Draft",
        options,
        usedIn: [],
      };
      result.imported.push(importedQ);
      localQuestions.unshift(importedQ);
    }
  }

  result.importedCount = result.imported.length;
  result.rejectedCount = result.rejected.length;
  return result;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM question_options WHERE question_id = ?", [id]);
      await connection.execute("DELETE FROM test_questions WHERE question_id = ?", [id]);
      const [res] = await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE id = ?", [id]);
      await connection.commit();
      const idx = localQuestions.findIndex((q) => q.id === id);
      if (idx !== -1) localQuestions.splice(idx, 1);
      return res.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch {
    const idx = localQuestions.findIndex((q) => q.id === id);
    if (idx !== -1) {
      localQuestions.splice(idx, 1);
      return true;
    }
    return false;
  }
}

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

export async function getTaxonomy() {
  try {
    const [exams] = await db.query<(RowDataPacket & { id: number; name: string; slug: string })[]>(
      "SELECT id, name, slug FROM exams WHERE status != 'archived' ORDER BY name ASC"
    );
    const [subjects] = await db.query<(RowDataPacket & { id: number; exam_id: number; exam_name: string; name: string })[]>(
      "SELECT s.id, s.exam_id, e.name AS exam_name, s.name FROM subjects s JOIN exams e ON e.id = s.exam_id ORDER BY s.name ASC"
    );
    const [topics] = await db.query<(RowDataPacket & { id: number; subject_id: number; subject_name: string; name: string })[]>(
      "SELECT t.id, t.subject_id, s.name AS subject_name, t.name FROM topics t JOIN subjects s ON s.id = t.subject_id ORDER BY t.name ASC"
    );

    const examNames = new Set(exams.map((e) => e.name));
    // Also include syllabus tracks if not yet present
    for (const [examKey, tracks] of Object.entries(syllabusTracks)) {
      const defaultExamName = examKey === "bpsc-tre-4" ? "BPSC TRE 4.0" : examKey === "bihar-stet" ? "Bihar STET" : "CTET";
      if (!examNames.has(defaultExamName)) {
        exams.push({ id: Math.floor(Math.random() * 10000), name: defaultExamName, slug: examKey } as RowDataPacket & { id: number; name: string; slug: string });
      }
      for (const track of tracks) {
        for (const sub of track.subjects) {
          if (!subjects.some((s) => s.exam_name === defaultExamName && s.name === sub.name)) {
            const tempSubId = Math.floor(Math.random() * 10000);
            subjects.push({ id: tempSubId, exam_id: 1, exam_name: defaultExamName, name: sub.name } as RowDataPacket & { id: number; exam_id: number; exam_name: string; name: string });
            for (const top of sub.topics) {
              topics.push({ id: Math.floor(Math.random() * 100000), subject_id: tempSubId, subject_name: sub.name, name: top } as RowDataPacket & { id: number; subject_id: number; subject_name: string; name: string });
            }
          }
        }
      }
    }

    return {
      exams: exams.map((e) => ({ id: String(e.id), name: e.name, slug: e.slug })),
      subjects: subjects.map((s) => ({ id: String(s.id), examId: String(s.exam_id), examName: s.exam_name, name: s.name })),
      topics: topics.map((t) => ({ id: String(t.id), subjectId: String(t.subject_id), subjectName: t.subject_name, name: t.name })),
    };
  } catch {
    // Return taxonomy derived from syllabusTracks
    const fallbackExams = [
      { id: "1", name: "BPSC TRE 4.0", slug: "bpsc-tre-4" },
      { id: "2", name: "Bihar STET", slug: "bihar-stet" },
      { id: "3", name: "CTET", slug: "ctet" },
    ];
    const fallbackSubjects: { id: string; examId: string; examName: string; name: string }[] = [];
    const fallbackTopics: { id: string; subjectId: string; subjectName: string; name: string }[] = [];

    for (const [examKey, tracks] of Object.entries(syllabusTracks)) {
      const examName = examKey === "bpsc-tre-4" ? "BPSC TRE 4.0" : examKey === "bihar-stet" ? "Bihar STET" : "CTET";
      const examId = fallbackExams.find((e) => e.slug === examKey)?.id ?? "1";
      for (const track of tracks) {
        for (const sub of track.subjects) {
          if (!fallbackSubjects.some((s) => s.examName === examName && s.name === sub.name)) {
            const subId = `s-${fallbackSubjects.length + 1}`;
            fallbackSubjects.push({ id: subId, examId, examName, name: sub.name });
            for (const top of sub.topics) {
              fallbackTopics.push({ id: `t-${fallbackTopics.length + 1}`, subjectId: subId, subjectName: sub.name, name: top });
            }
          }
        }
      }
    }

    return {
      exams: fallbackExams,
      subjects: fallbackSubjects,
      topics: fallbackTopics,
    };
  }
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

export type MockTest = {
  id: string;
  slug: string;
  name: string;
  examId?: string;
  examName: string;
  examSlug: string;
  trackSlug: string;
  subjectId?: string;
  subjectName: string;
  testType: string;
  questionCount: number;
  durationMinutes: number;
  totalMarks: number;
  access: "Free" | "Premium";
  status: "Draft" | "Published" | "Archived";
  linkedQuestionsCount: number;
  description?: string;
};

export type MockTestInput = {
  name: string;
  slug?: string;
  examName: string;
  trackSlug: string;
  subjectName: string;
  testType?: string;
  questionCount?: number;
  durationMinutes?: number;
  totalMarks?: number;
  access?: "Free" | "Premium";
  status?: "Draft" | "Published";
  description?: string;
  questionIds?: string[];
};

export type SubjectDemandRequest = {
  id: string;
  examSlug: string;
  trackSlug: string;
  subjectName: string;
  requestCount: number;
  lastRequestedAt: string;
};

const localMockTests: MockTest[] = [
  {
    id: "2",
    slug: "bpsc-tre-4-general-studies",
    name: "General Studies: Full Mock 01",
    examName: "BPSC TRE 4.0",
    examSlug: "bpsc-tre-4",
    trackSlug: "primary-1-5",
    subjectName: "General Studies",
    testType: "Full mock",
    questionCount: 150,
    durationMinutes: 150,
    totalMarks: 150,
    access: "Free",
    status: "Published",
    linkedQuestionsCount: 1,
    description: "Realistic primary teacher recruitment practice mapped to Bihar GK, geography, and general science.",
  },
];

const localSubjectRequests = new Map<string, SubjectDemandRequest>();

export async function listMockTests(filter?: {
  examSlug?: string;
  trackSlug?: string;
  subjectName?: string;
  status?: string;
}): Promise<MockTest[]> {
  try {
    let sql = `
      SELECT t.id, t.slug, t.name, t.test_type, t.question_count, t.duration_minutes, t.total_marks,
             t.access_type, t.status, t.description, t.track_slug,
             e.id AS exam_id, e.name AS exam_name, e.slug AS exam_slug,
             s.id AS subject_id, s.name AS subject_name,
             (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id) AS linked_count
      FROM tests t
      LEFT JOIN exams e ON e.id = t.exam_id
      LEFT JOIN subjects s ON s.id = t.subject_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.examSlug && filter.examSlug !== "All") {
      conditions.push("(e.slug = ? OR e.name = ?)");
      params.push(filter.examSlug, filter.examSlug);
    }
    if (filter?.trackSlug && filter.trackSlug !== "All") {
      conditions.push("t.track_slug = ?");
      params.push(filter.trackSlug);
    }
    if (filter?.subjectName && filter.subjectName !== "All") {
      conditions.push("s.name = ?");
      params.push(filter.subjectName);
    }
    if (filter?.status && filter.status !== "All") {
      conditions.push("t.status = ?");
      params.push(filter.status.toLowerCase());
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY t.id DESC";

    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      slug: string | null;
      name: string;
      test_type: string;
      question_count: number;
      duration_minutes: number;
      total_marks: number;
      access_type: string;
      status: string;
      description: string | null;
      track_slug: string | null;
      exam_id: number | null;
      exam_name: string | null;
      exam_slug: string | null;
      subject_id: number | null;
      subject_name: string | null;
      linked_count: number;
    })[]>(sql, params);

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        slug: r.slug || `test-${r.id}`,
        name: r.name,
        examId: r.exam_id ? String(r.exam_id) : undefined,
        examName: r.exam_name || "Unassigned Exam",
        examSlug: r.exam_slug || "bpsc-tre-4",
        trackSlug: r.track_slug || "primary-1-5",
        subjectId: r.subject_id ? String(r.subject_id) : undefined,
        subjectName: r.subject_name || "General Studies",
        testType: r.test_type || "Full mock",
        questionCount: r.question_count || 150,
        durationMinutes: r.duration_minutes || 150,
        totalMarks: Number(r.total_marks) || 150,
        access: r.access_type === "premium" ? "Premium" : "Free",
        status: r.status === "published" ? "Published" : r.status === "archived" ? "Archived" : "Draft",
        linkedQuestionsCount: Number(r.linked_count) || 0,
        description: r.description || undefined,
      }));
    }
  } catch {
    // Fall back to local mock tests
  }

  let results = [...localMockTests];
  if (filter?.examSlug && filter.examSlug !== "All") {
    results = results.filter((t) => t.examSlug === filter.examSlug || t.examName.toLowerCase().includes(filter.examSlug!.toLowerCase()));
  }
  if (filter?.trackSlug && filter.trackSlug !== "All") {
    results = results.filter((t) => t.trackSlug === filter.trackSlug);
  }
  if (filter?.subjectName && filter.subjectName !== "All") {
    results = results.filter((t) => t.subjectName.toLowerCase() === filter.subjectName!.toLowerCase());
  }
  if (filter?.status && filter.status !== "All") {
    results = results.filter((t) => t.status === filter.status);
  }
  return results;
}

export async function createMockTest(input: MockTestInput): Promise<MockTest> {
  if (!input.name?.trim() || !input.examName?.trim() || !input.subjectName?.trim()) {
    throw new Error("Test title, target exam, and subject are required.");
  }

  const generatedSlug =
    input.slug?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

  const cleanDuration = Number(input.durationMinutes) || 150;
  const cleanQuestions = Number(input.questionCount) || 150;
  const cleanMarks = Number(input.totalMarks) || cleanQuestions;
  const cleanStatus = input.status === "Published" ? "published" : "draft";
  const cleanAccess = input.access === "Premium" ? "premium" : "free";

  const fallback: MockTest = {
    id: `test-${Date.now()}`,
    slug: generatedSlug,
    name: input.name.trim(),
    examName: input.examName.trim(),
    examSlug: input.examName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    trackSlug: input.trackSlug || "primary-1-5",
    subjectName: input.subjectName.trim(),
    testType: input.testType || "Full mock",
    questionCount: cleanQuestions,
    durationMinutes: cleanDuration,
    totalMarks: cleanMarks,
    access: cleanAccess === "premium" ? "Premium" : "Free",
    status: cleanStatus === "published" ? "Published" : "Draft",
    linkedQuestionsCount: (input.questionIds ?? []).length,
    description: input.description,
  };

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let [exams] = await connection.query<(RowDataPacket & { id: number; slug: string })[]>(
        "SELECT id, slug FROM exams WHERE name = ? OR slug = ? LIMIT 1",
        [input.examName.trim(), input.examName.trim()]
      );
      if (!exams[0]) {
        const examSlug = input.examName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const [eIns] = await connection.execute<ResultSetHeader>(
          "INSERT INTO exams (name, slug, status) VALUES (?, ?, 'published')",
          [input.examName.trim(), examSlug]
        );
        exams = [{ id: eIns.insertId, slug: examSlug } as RowDataPacket & { id: number; slug: string }];
      }

      let [subjects] = await connection.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM subjects WHERE exam_id = ? AND name = ? LIMIT 1",
        [exams[0].id, input.subjectName.trim()]
      );
      if (!subjects[0]) {
        const subSlug = input.subjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const [sIns] = await connection.execute<ResultSetHeader>(
          "INSERT INTO subjects (exam_id, name, slug) VALUES (?, ?, ?)",
          [exams[0].id, input.subjectName.trim(), subSlug]
        );
        subjects = [{ id: sIns.insertId } as RowDataPacket & { id: number }];
      }

      // Check or create test_series
      let [series] = await connection.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM test_series WHERE exam_id = ? LIMIT 1",
        [exams[0].id]
      );
      let seriesId = series[0]?.id;
      if (!seriesId) {
        const [serIns] = await connection.execute<ResultSetHeader>(
          "INSERT INTO test_series (exam_id, name, slug, access_type, status) VALUES (?, ?, ?, ?, 'published')",
          [exams[0].id, `${input.examName} Mock Series`, `${exams[0].slug}-mock-series`, cleanAccess]
        );
        seriesId = serIns.insertId;
      }

      // Check or create rule profile
      const [rules] = await connection.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM rule_profiles WHERE exam_id = ? LIMIT 1",
        [exams[0].id]
      );
      let ruleId = rules[0]?.id;
      if (!ruleId) {
        const isBpsc = exams[0].slug.includes("bpsc");
        const [rIns] = await connection.execute<ResultSetHeader>(
          "INSERT INTO rule_profiles (exam_id, version, name, option_count, marks_per_correct, penalty_wrong, status) VALUES (?, 1, 'Standard Marking', ?, 1, ?, 'published')",
          [exams[0].id, isBpsc ? 5 : 4, isBpsc ? 0.25 : 0]
        );
        ruleId = rIns.insertId;
      }

      const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO tests (test_series_id, exam_id, subject_id, track_slug, name, slug, test_type, question_count, duration_minutes, total_marks, access_type, description, status, rule_profile_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seriesId,
          exams[0].id,
          subjects[0].id,
          input.trackSlug || "primary-1-5",
          input.name.trim(),
          generatedSlug,
          input.testType || "full",
          cleanQuestions,
          cleanDuration,
          cleanMarks,
          cleanAccess,
          input.description?.trim() || null,
          cleanStatus,
          ruleId,
        ]
      );

      const testId = insert.insertId;
      fallback.id = String(testId);
      fallback.examId = String(exams[0].id);
      fallback.subjectId = String(subjects[0].id);

      // Link any initial questions
      for (const [idx, qId] of (input.questionIds ?? []).entries()) {
        await connection.execute(
          "INSERT IGNORE INTO test_questions (test_id, question_id, sort_order, marks) VALUES (?, ?, ?, 1)",
          [testId, qId, idx + 1]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
  }

  localMockTests.unshift(fallback);
  return fallback;
}

export async function deleteMockTest(testId: string): Promise<boolean> {
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM test_questions WHERE test_id = ?", [testId]);
      const [res] = await connection.execute<ResultSetHeader>("DELETE FROM tests WHERE id = ?", [testId]);
      await connection.commit();

      const idx = localMockTests.findIndex((t) => t.id === testId);
      if (idx !== -1) localMockTests.splice(idx, 1);
      return res.affectedRows > 0;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch {
    const idx = localMockTests.findIndex((t) => t.id === testId);
    if (idx !== -1) {
      localMockTests.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export async function updateMockTestStatus(testId: string, status: "Draft" | "Published" | "Archived"): Promise<boolean> {
  const dbStatus = status.toLowerCase();
  try {
    await db.execute("UPDATE tests SET status = ? WHERE id = ?", [dbStatus, testId]);
  } catch {
    // fallback
  }
  const item = localMockTests.find((t) => t.id === testId);
  if (item) item.status = status;
  return true;
}

export async function addQuestionsToMockTest(testId: string, questionIds: string[]): Promise<number> {
  let count = 0;
  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query<(RowDataPacket & { max_order: number })[]>(
        "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM test_questions WHERE test_id = ?",
        [testId]
      );
      let nextOrder = existing[0]?.max_order || 0;

      for (const qId of questionIds) {
        nextOrder++;
        const [res] = await connection.execute<ResultSetHeader>(
          "INSERT IGNORE INTO test_questions (test_id, question_id, sort_order, marks) VALUES (?, ?, ?, 1)",
          [testId, qId, nextOrder]
        );
        if (res.affectedRows > 0) count++;
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch {
    count = questionIds.length;
  }

  const test = localMockTests.find((t) => t.id === testId);
  if (test) test.linkedQuestionsCount += count;
  return count;
}

export async function removeQuestionFromMockTest(testId: string, questionId: string): Promise<boolean> {
  try {
    const [res] = await db.execute<ResultSetHeader>(
      "DELETE FROM test_questions WHERE test_id = ? AND question_id = ?",
      [testId, questionId]
    );
    const test = localMockTests.find((t) => t.id === testId);
    if (test && test.linkedQuestionsCount > 0) test.linkedQuestionsCount--;
    return res.affectedRows > 0;
  } catch {
    const test = localMockTests.find((t) => t.id === testId);
    if (test && test.linkedQuestionsCount > 0) test.linkedQuestionsCount--;
    return true;
  }
}

export async function getQuestionsForMockTest(testId: string): Promise<AdminQuestion[]> {
  try {
    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      exam: string | null;
      subject: string | null;
      topic: string | null;
      stem: string;
      explanation: string | null;
      difficulty: string | null;
      status: string;
      sort_order: number;
    })[]>(
      `SELECT q.id, e.name AS exam, s.name AS subject, t.name AS topic, q.stem, q.explanation, q.difficulty, q.status, tq.sort_order
       FROM test_questions tq
       JOIN questions q ON q.id = tq.question_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN exams e ON e.id = s.exam_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE tq.test_id = ?
       ORDER BY tq.sort_order ASC`,
      [testId]
    );

    if (rows.length > 0) {
      const qIds = rows.map((r) => r.id);
      const [optRows] = await db.query<(RowDataPacket & {
        question_id: number;
        option_key: string;
        option_text: string;
        is_correct: number;
        sort_order: number;
      })[]>(
        `SELECT question_id, option_key, option_text, is_correct, sort_order
         FROM question_options
         WHERE question_id IN (?)
         ORDER BY question_id, sort_order ASC`,
        [qIds]
      );

      const optionsMap = new Map<number, QuestionOption[]>();
      for (const opt of optRows) {
        if (!optionsMap.has(opt.question_id)) optionsMap.set(opt.question_id, []);
        optionsMap.get(opt.question_id)!.push({
          key: opt.option_key,
          text: opt.option_text,
          correct: Boolean(opt.is_correct),
        });
      }

      return rows.map((r) => ({
        id: String(r.id),
        exam: r.exam || "Unassigned",
        subject: r.subject || "Unassigned",
        topic: r.topic || "Unassigned",
        stem: r.stem,
        explanation: r.explanation || "",
        difficulty: (r.difficulty as "easy" | "medium" | "hard") || "medium",
        status: normalizeQuestionStatus(r.status),
        options: optionsMap.get(r.id) ?? [],
        usedIn: [],
      }));
    }
  } catch {
    // Fall back to questions matching test
  }
  return [...localQuestions].slice(0, 5);
}

export async function recordSubjectRequest(
  examSlug: string,
  trackSlug: string,
  subjectName: string
): Promise<{ success: boolean; requestCount: number }> {
  const key = `${examSlug}:${trackSlug}:${subjectName.toLowerCase()}`;
  try {
    await db.execute(
      `INSERT INTO test_requests (exam_slug, track_slug, subject_name, request_count)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE request_count = request_count + 1, last_requested_at = CURRENT_TIMESTAMP`,
      [examSlug, trackSlug, subjectName]
    );

    const [rows] = await db.query<(RowDataPacket & { request_count: number })[]>(
      "SELECT request_count FROM test_requests WHERE exam_slug = ? AND track_slug = ? AND subject_name = ? LIMIT 1",
      [examSlug, trackSlug, subjectName]
    );
    const count = rows[0]?.request_count ?? 1;

    localSubjectRequests.set(key, {
      id: key,
      examSlug,
      trackSlug,
      subjectName,
      requestCount: count,
      lastRequestedAt: new Date().toISOString(),
    });

    return { success: true, requestCount: count };
  } catch {
    const existing = localSubjectRequests.get(key);
    const count = (existing?.requestCount ?? 0) + 1;
    localSubjectRequests.set(key, {
      id: key,
      examSlug,
      trackSlug,
      subjectName,
      requestCount: count,
      lastRequestedAt: new Date().toISOString(),
    });
    return { success: true, requestCount: count };
  }
}

export async function listSubjectRequests(examSlug?: string): Promise<SubjectDemandRequest[]> {
  try {
    let sql = "SELECT id, exam_slug, track_slug, subject_name, request_count, last_requested_at FROM test_requests";
    const params: unknown[] = [];
    if (examSlug) {
      sql += " WHERE exam_slug = ?";
      params.push(examSlug);
    }
    sql += " ORDER BY request_count DESC, last_requested_at DESC LIMIT 50";

    const [rows] = await db.query<(RowDataPacket & {
      id: number;
      exam_slug: string;
      track_slug: string;
      subject_name: string;
      request_count: number;
      last_requested_at: Date | string;
    })[]>(sql, params);

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        examSlug: r.exam_slug,
        trackSlug: r.track_slug,
        subjectName: r.subject_name,
        requestCount: Number(r.request_count),
        lastRequestedAt: new Date(r.last_requested_at).toISOString(),
      }));
    }
  } catch {
    // fallback
  }

  const list = [...localSubjectRequests.values()];
  if (examSlug) return list.filter((r) => r.examSlug === examSlug).sort((a, b) => b.requestCount - a.requestCount);
  return list.sort((a, b) => b.requestCount - a.requestCount);
}
