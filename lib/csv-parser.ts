import type { QuestionInput } from "./admin-content";

export type ParsedQuestionRow = {
  rowNumber: number;
  data?: QuestionInput;
  raw?: Record<string, string>;
  isValid: boolean;
  errors: string[];
};

export type ParseResult = {
  totalRows: number;
  validRows: ParsedQuestionRow[];
  invalidRows: ParsedQuestionRow[];
  questions: QuestionInput[];
};

/**
 * Robust RFC-4180 compliant CSV / TSV parser that supports:
 * - Quoted values with embedded commas and quotes ("He said ""hello""")
 * - Embedded newlines inside quotes
 * - Tab-separated values (direct copy-paste from Excel or Google Sheets)
 */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.trim();
  if (!clean) return [];

  // Detect delimiter: check if tab is prevalent in the first non-empty line
  const firstLine = clean.split(/\r\n|\n|\r/)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if (!insideQuotes && (char === "\r" || char === "\n")) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Push last field & row if present
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes column header names for forgiving matching
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Maps raw CSV/TSV table or JSON array into validated QuestionInput objects
 */
export function parseQuestionsFromRaw(rawInput: string | unknown[]): ParseResult {
  if (Array.isArray(rawInput)) {
    return parseQuestionsFromJsonArray(rawInput);
  }

  const trimmed = rawInput.trim();
  // Check if user pasted JSON array directly
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseQuestionsFromJsonArray(parsed);
      }
    } catch {
      // Fall through to CSV parsing if JSON parse fails
    }
  }

  const table = parseDelimitedText(trimmed);
  if (table.length < 2) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [
        {
          rowNumber: 1,
          isValid: false,
          errors: ["File or text contains no data rows. Expected a header row followed by questions."],
        },
      ],
      questions: [],
    };
  }

  const rawHeaders = table[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Column index lookups
  const findCol = (...aliases: string[]) => {
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      const idx = normalizedHeaders.indexOf(norm);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colExam = findCol("exam", "examname", "exam_name", "category");
  const colSubject = findCol("subject", "subjectname", "subject_name");
  const colTopic = findCol("topic", "topicname", "topic_name", "subtopic");
  const colStem = findCol("stem", "question", "questiontext", "question_text", "problem");
  const colOptA = findCol("option_a", "optiona", "option1", "a");
  const colOptB = findCol("option_b", "optionb", "option2", "b");
  const colOptC = findCol("option_c", "optionc", "option3", "c");
  const colOptD = findCol("option_d", "optiond", "option4", "d");
  const colOptE = findCol("option_e", "optione", "option5", "e");
  const colCorrect = findCol("correct_option", "correctoption", "correct", "answer", "correctanswer", "key");
  const colExplanation = findCol("explanation", "solution", "rationale", "notes");
  const colDifficulty = findCol("difficulty", "level");
  const colStatus = findCol("status", "workflow_status");

  const validRows: ParsedQuestionRow[] = [];
  const invalidRows: ParsedQuestionRow[] = [];
  const questions: QuestionInput[] = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const rowNum = r + 1;
    const errors: string[] = [];

    const getVal = (idx: number) => (idx !== -1 && idx < row.length ? row[idx].trim() : "");

    const exam = getVal(colExam) || "BPSC TRE 4.0";
    const subject = getVal(colSubject);
    const topic = getVal(colTopic);
    const stem = getVal(colStem);
    const optA = getVal(colOptA);
    const optB = getVal(colOptB);
    const optC = getVal(colOptC);
    const optD = getVal(colOptD);
    const optE = getVal(colOptE);
    const correctRaw = getVal(colCorrect).toUpperCase();
    const explanation = getVal(colExplanation);
    const difficultyRaw = getVal(colDifficulty).toLowerCase();
    const statusRaw = getVal(colStatus);

    if (!exam) errors.push("Missing exam name.");
    if (!subject) errors.push("Missing subject.");
    if (!stem || stem.length < 5) errors.push("Question stem is required (at least 5 characters).");

    const rawOptions = [
      { key: "A", text: optA },
      { key: "B", text: optB },
      { key: "C", text: optC },
      { key: "D", text: optD },
      { key: "E", text: optE },
    ].filter((opt) => opt.text.length > 0);

    if (rawOptions.length < 2) {
      errors.push(`At least 2 answer options are required. Found ${rawOptions.length}.`);
    }

    // Determine correct option
    let correctKey = "";
    if (["A", "B", "C", "D", "E"].includes(correctRaw)) {
      correctKey = correctRaw;
    } else if (["1", "2", "3", "4", "5"].includes(correctRaw)) {
      correctKey = String.fromCharCode(64 + parseInt(correctRaw, 10));
    } else {
      errors.push(`Correct option '${correctRaw}' is invalid. Must be A, B, C, D, or E (or 1–5).`);
    }

    if (correctKey && !rawOptions.some((opt) => opt.key === correctKey)) {
      errors.push(`Correct option '${correctKey}' was specified, but Option ${correctKey} has no text.`);
    }

    const options = rawOptions.map((opt) => ({
      key: opt.key,
      text: opt.text,
      correct: opt.key === correctKey,
    }));

    const difficulty: "easy" | "medium" | "hard" =
      difficultyRaw === "easy" || difficultyRaw === "hard" ? difficultyRaw : "medium";

    const parsedQuestion: QuestionInput = {
      exam,
      subject,
      topic: topic || "Unassigned",
      stem,
      options,
      explanation,
      difficulty,
      status: (statusRaw as QuestionInput["status"]) || "Draft",
    };

    const parsedRow: ParsedQuestionRow = {
      rowNumber: rowNum,
      data: parsedQuestion,
      raw: Object.fromEntries(rawHeaders.map((h, i) => [h, row[i] ?? ""])),
      isValid: errors.length === 0,
      errors,
    };

    if (errors.length === 0) {
      validRows.push(parsedRow);
      questions.push(parsedQuestion);
    } else {
      invalidRows.push(parsedRow);
    }
  }

  return {
    totalRows: table.length - 1,
    validRows,
    invalidRows,
    questions,
  };
}

function parseQuestionsFromJsonArray(arr: unknown[]): ParseResult {
  const validRows: ParsedQuestionRow[] = [];
  const invalidRows: ParsedQuestionRow[] = [];
  const questions: QuestionInput[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    const rowNum = i + 1;
    const errors: string[] = [];

    if (!item || typeof item !== "object") {
      invalidRows.push({ rowNumber: rowNum, isValid: false, errors: ["Invalid JSON object format."] });
      continue;
    }

    const exam = String(item.exam || item.examName || "").trim();
    const subject = String(item.subject || item.subjectName || "").trim();
    const topic = String(item.topic || item.topicName || "").trim();
    const stem = String(item.stem || item.question || "").trim();
    const explanation = String(item.explanation || item.solution || "").trim();
    const difficultyRaw = String(item.difficulty || "medium").toLowerCase();
    const difficulty: "easy" | "medium" | "hard" =
      difficultyRaw === "easy" || difficultyRaw === "hard" ? difficultyRaw : "medium";

    if (!exam) errors.push("Missing exam name.");
    if (!subject) errors.push("Missing subject.");
    if (!stem || stem.length < 5) errors.push("Question stem is required (at least 5 characters).");

    let options: { key?: string; text: string; correct?: boolean }[] = [];

    // Support item.options array
    if (Array.isArray(item.options)) {
      options = item.options.map((opt: unknown, idx: number) => {
        if (typeof opt === "string") {
          return { key: String.fromCharCode(65 + idx), text: opt, correct: false };
        }
        const o = opt as Record<string, unknown>;
        return {
          key: String(o.key || String.fromCharCode(65 + idx)),
          text: String(o.text || o.option || "").trim(),
          correct: Boolean(o.correct || o.isCorrect),
        };
      });
    } else {
      // Support flat option_a, option_b, etc.
      const optA = String(item.option_a || item.optionA || "").trim();
      const optB = String(item.option_b || item.optionB || "").trim();
      const optC = String(item.option_c || item.optionC || "").trim();
      const optD = String(item.option_d || item.optionD || "").trim();
      const optE = String(item.option_e || item.optionE || "").trim();
      const correctRaw = String(item.correct_option || item.correctOption || item.answer || "").toUpperCase();

      const flatOpts = [
        { key: "A", text: optA },
        { key: "B", text: optB },
        { key: "C", text: optC },
        { key: "D", text: optD },
        { key: "E", text: optE },
      ].filter((o) => o.text.length > 0);

      options = flatOpts.map((o) => ({
        key: o.key,
        text: o.text,
        correct: o.key === correctRaw,
      }));
    }

    const cleanOptions = options.filter((o) => o.text.length > 0);
    if (cleanOptions.length < 2 || cleanOptions.length > 5) {
      errors.push(`Between 2 and 5 answer options required. Found ${cleanOptions.length}.`);
    }

    const correctCount = cleanOptions.filter((o) => o.correct).length;
    if (correctCount !== 1) {
      errors.push(correctCount === 0 ? "No option is marked as correct." : "Multiple options marked as correct. Exactly one answer must be correct.");
    }

    const parsedQuestion: QuestionInput = {
      exam,
      subject,
      topic: topic || "Unassigned",
      stem,
      options: cleanOptions,
      explanation,
      difficulty,
      status: (item.status as QuestionInput["status"]) || "Draft",
    };

    const parsedRow: ParsedQuestionRow = {
      rowNumber: rowNum,
      data: parsedQuestion,
      isValid: errors.length === 0,
      errors,
    };

    if (errors.length === 0) {
      validRows.push(parsedRow);
      questions.push(parsedQuestion);
    } else {
      invalidRows.push(parsedRow);
    }
  }

  return {
    totalRows: arr.length,
    validRows,
    invalidRows,
    questions,
  };
}
