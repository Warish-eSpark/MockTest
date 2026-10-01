"use client";

import { FormEvent, useState, useEffect } from "react";
import type { AdminQuestion } from "../../lib/phase1";

type Taxonomy = {
  exams: { id: string; name: string; slug: string }[];
  subjects: { id: string; examId: string; examName: string; name: string }[];
  topics: { id: string; subjectId: string; subjectName: string; name: string }[];
};

interface SingleQuestionFormProps {
  taxonomy?: Taxonomy;
  onQuestionCreated?: (question: AdminQuestion) => void;
  onCancel?: () => void;
}

export default function SingleQuestionForm({
  taxonomy,
  onQuestionCreated,
  onCancel,
}: SingleQuestionFormProps) {
  const [exam, setExam] = useState("BPSC TRE 4.0");
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [customExamName, setCustomExamName] = useState("");

  const [subject, setSubject] = useState("General Studies");
  const [topic, setTopic] = useState("");
  const [stem, setStem] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [status, setStatus] = useState<AdminQuestion["status"]>("Draft");

  // Options state
  const [optionCount, setOptionCount] = useState<4 | 5>(5);
  const [options, setOptions] = useState<string[]>([
    "",
    "",
    "",
    "",
    "None of the above / More than one of the above",
  ]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Subject and Topic suggestions based on selected Exam
  const examSubjects = (taxonomy?.subjects ?? []).filter(
    (s) => s.examName.toLowerCase() === exam.toLowerCase()
  );
  const subjectTopics = (taxonomy?.topics ?? []).filter(
    (t) => t.subjectName.toLowerCase() === subject.toLowerCase()
  );

  const effectiveExam = isCustomExam ? customExamName.trim() : exam;

  // Handle option count change (4 vs 5)
  function handleOptionCountToggle(count: 4 | 5) {
    setOptionCount(count);
    if (count === 4) {
      if (correctIndex >= 4) setCorrectIndex(0);
      setOptions((prev) => prev.slice(0, 4));
    } else {
      setOptions((prev) => {
        const next = [...prev];
        while (next.length < 5) {
          next.push(next.length === 4 ? "None of the above / More than one of the above" : "");
        }
        return next;
      });
    }
  }

  function insertBpscFifthOption() {
    setOptionCount(5);
    setOptions((prev) => {
      const copy = [...prev];
      copy[4] = "None of the above / More than one of the above";
      return copy;
    });
  }

  function resetForm() {
    setStem("");
    setExplanation("");
    setTopic("");
    setOptions(
      optionCount === 5
        ? ["", "", "", "", "None of the above / More than one of the above"]
        : ["", "", "", ""]
    );
    setCorrectIndex(0);
  }

  async function handleSubmit(event: FormEvent, andAddAnother = false) {
    event.preventDefault();
    setMessage(null);

    if (!effectiveExam) {
      setMessage({ text: "Please select or enter an examination.", type: "error" });
      return;
    }
    if (!subject.trim()) {
      setMessage({ text: "Please specify a subject for classification.", type: "error" });
      return;
    }
    if (!stem.trim() || stem.trim().length < 5) {
      setMessage({ text: "Question text must have at least 5 characters.", type: "error" });
      return;
    }

    const populatedOptions = options
      .slice(0, optionCount)
      .map((text, idx) => ({
        key: String.fromCharCode(65 + idx),
        text: text.trim(),
        correct: idx === correctIndex,
      }))
      .filter((opt) => opt.text.length > 0);

    if (populatedOptions.length < 2) {
      setMessage({ text: "Please enter at least two answer options.", type: "error" });
      return;
    }

    if (!populatedOptions.some((opt) => opt.correct)) {
      setMessage({ text: "Please mark the correct answer option.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam: effectiveExam,
          subject: subject.trim(),
          topic: topic.trim() || "Unassigned",
          stem: stem.trim(),
          explanation: explanation.trim(),
          difficulty,
          status,
          options: populatedOptions,
        }),
      });

      const payload = await response.json();
      setSaving(false);

      if (!response.ok) {
        setMessage({ text: payload.error ?? "Failed to save question.", type: "error" });
        return;
      }

      const created: AdminQuestion = payload.data;
      setMessage({ text: `Question #${created.id} saved successfully!`, type: "success" });
      if (onQuestionCreated) onQuestionCreated(created);

      if (andAddAnother) {
        resetForm();
      } else if (onCancel) {
        setTimeout(onCancel, 1200);
      }
    } catch (err) {
      setSaving(false);
      setMessage({ text: err instanceof Error ? err.message : "Network error occurred.", type: "error" });
    }
  }

  return (
    <div className="single-question-authoring">
      <div className="authoring-header-bar">
        <div>
          <h3>Question Authoring Studio</h3>
          <p>Compose individual questions with live learner preview and full option control.</p>
        </div>
        <div className="header-bar-actions">
          <button
            type="button"
            className="authoring-pill-btn"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide Live Preview" : "Show Live Preview"}
          </button>
          {onCancel && (
            <button type="button" className="authoring-close-btn" onClick={onCancel}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={`authoring-layout ${showPreview ? "has-preview" : ""}`}>
        {/* Left Column: Form */}
        <form className="authoring-form" onSubmit={(e) => handleSubmit(e, false)}>
          {/* Exam & Classification */}
          <div className="form-section-card">
            <span className="section-label">1. Classification & Scope</span>
            <div className="form-grid-3">
              <label>
                Target Examination *
                {!isCustomExam ? (
                  <select
                    value={exam}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomExam(true);
                      } else {
                        setExam(e.target.value);
                      }
                    }}
                  >
                    <option value="BPSC TRE 4.0">BPSC TRE 4.0</option>
                    <option value="Bihar STET">Bihar STET</option>
                    <option value="CTET">CTET</option>
                    {(taxonomy?.exams ?? [])
                      .filter((ex) => !["BPSC TRE 4.0", "Bihar STET", "CTET"].includes(ex.name))
                      .map((ex) => (
                        <option key={ex.id} value={ex.name}>
                          {ex.name}
                        </option>
                      ))}
                    <option value="__custom__">+ Add Custom Exam</option>
                  </select>
                ) : (
                  <div className="custom-input-with-cancel">
                    <input
                      value={customExamName}
                      onChange={(e) => setCustomExamName(e.target.value)}
                      placeholder="e.g. UPSC CSE, SSC CGL"
                      required
                    />
                    <button
                      type="button"
                      className="text-cancel-btn"
                      onClick={() => {
                        setIsCustomExam(false);
                        setCustomExamName("");
                      }}
                    >
                      Use list
                    </button>
                  </div>
                )}
              </label>

              <label>
                Subject *
                <input
                  list="subject-suggestions"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. General Studies"
                  required
                />
                <datalist id="subject-suggestions">
                  {examSubjects.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                  <option value="General Studies" />
                  <option value="Elementary Mathematics" />
                  <option value="Teaching Art" />
                  <option value="Social Science" />
                  <option value="Science" />
                  <option value="Child Development & Pedagogy" />
                  <option value="Language (Hindi / English)" />
                </datalist>
              </label>

              <label>
                Topic / Chapter
                <input
                  list="topic-suggestions"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Bihar Geography, Percentage"
                />
                <datalist id="topic-suggestions">
                  {subjectTopics.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </label>
            </div>

            <div className="form-grid-2" style={{ marginTop: "12px" }}>
              <label>
                Difficulty Level
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                >
                  <option value="easy">Easy (Foundational)</option>
                  <option value="medium">Medium (Standard)</option>
                  <option value="hard">Hard (Advanced / Application)</option>
                </select>
              </label>

              <label>
                Initial Workflow Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdminQuestion["status"])}
                >
                  <option value="Draft">Draft (Editable)</option>
                  <option value="In review">In review (Pending QA)</option>
                  <option value="Approved">Approved (Ready for tests)</option>
                  <option value="Published">Published (Live in catalog)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Question Stem */}
          <div className="form-section-card">
            <div className="section-label-row">
              <span className="section-label">2. Question Text (Stem) *</span>
              <span className="char-counter">{stem.length} characters</span>
            </div>
            <textarea
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              placeholder="Type or paste the complete question statement here. Markdown and math symbols are supported..."
              rows={4}
              required
            />
          </div>

          {/* Answer Options */}
          <div className="form-section-card">
            <div className="section-label-row">
              <span className="section-label">3. Answer Options & Correct Key *</span>
              <div className="option-count-controls">
                <span>Format:</span>
                <button
                  type="button"
                  className={`toggle-btn ${optionCount === 4 ? "active" : ""}`}
                  onClick={() => handleOptionCountToggle(4)}
                >
                  4 Options (STET/CTET)
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${optionCount === 5 ? "active" : ""}`}
                  onClick={() => handleOptionCountToggle(5)}
                >
                  5 Options (BPSC)
                </button>
              </div>
            </div>

            <p className="field-hint">
              Select the radio button on the left to designate the single correct answer.
            </p>

            <div className="options-stack">
              {Array.from({ length: optionCount }).map((_, index) => {
                const key = String.fromCharCode(65 + index);
                const isCorrect = correctIndex === index;
                return (
                  <div
                    key={key}
                    className={`option-entry-row ${isCorrect ? "is-correct-target" : ""}`}
                  >
                    <label className="radio-container" title={`Mark option ${key} as correct`}>
                      <input
                        type="radio"
                        name="correct-option-group"
                        checked={isCorrect}
                        onChange={() => setCorrectIndex(index)}
                      />
                      <span className="option-key-badge">{key}</span>
                    </label>

                    <input
                      className="option-text-input"
                      value={options[index] ?? ""}
                      onChange={(e) =>
                        setOptions((current) =>
                          current.map((val, idx) => (idx === index ? e.target.value : val))
                        )
                      }
                      placeholder={`Enter text for Option ${key}...`}
                      required
                    />

                    {isCorrect && <span className="correct-tag">✓ Correct Answer</span>}
                  </div>
                );
              })}
            </div>

            {optionCount === 5 && (
              <div className="bpsc-helper-strip">
                <span>✦ BPSC Shortcut:</span>
                <button
                  type="button"
                  className="insert-shortcut-btn"
                  onClick={insertBpscFifthOption}
                >
                  Fill Option E with &quot;None of the above / More than one of the above&quot;
                </button>
              </div>
            )}
          </div>

          {/* Explanation / Solution */}
          <div className="form-section-card">
            <span className="section-label">4. Solution & Explanation (Recommended)</span>
            <p className="field-hint">
              Explain why the correct answer is right. This will be shown to learners in the post-test
              review screen.
            </p>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. As per Census 2011, Rohtas recorded 73.37% literacy rate, followed by Patna..."
              rows={3}
            />
          </div>

          {/* Status Message */}
          {message && (
            <div className={`authoring-alert ${message.type === "success" ? "success" : "error"}`}>
              {message.type === "success" ? "✓" : "⚠"} {message.text}
            </div>
          )}

          {/* Form Actions */}
          <div className="authoring-footer-actions">
            {onCancel && (
              <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Add Another"}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Question"}
            </button>
          </div>
        </form>

        {/* Right Column: Live Learner Preview */}
        {showPreview && (
          <aside className="authoring-preview-column">
            <div className="preview-sticky-card">
              <div className="preview-header">
                <span className="preview-tag">LIVE LEARNER SIMULATION</span>
                <span className="preview-exam-badge">{effectiveExam || "Examination"}</span>
              </div>

              <div className="preview-meta-row">
                <span className="preview-sub">{subject || "Subject"}</span>
                {topic && <span className="preview-top">· {topic}</span>}
                <span className={`preview-diff ${difficulty}`}>{difficulty.toUpperCase()}</span>
              </div>

              <div className="preview-question-stem">
                {stem.trim() ? stem : "Your question statement will appear here in real time as you type..."}
              </div>

              <div className="preview-options-list">
                {Array.from({ length: optionCount }).map((_, index) => {
                  const key = String.fromCharCode(65 + index);
                  const text = options[index];
                  const isCorrect = correctIndex === index;
                  return (
                    <div
                      key={key}
                      className={`preview-option-item ${isCorrect ? "highlighted-correct" : ""}`}
                    >
                      <span className="preview-opt-key">{key}</span>
                      <span className="preview-opt-text">
                        {text && text.trim() ? text : <em className="muted-text">Option {key} empty</em>}
                      </span>
                      {isCorrect && <span className="preview-check-badge">✓ Correct Key</span>}
                    </div>
                  );
                })}
              </div>

              {explanation.trim() && (
                <div className="preview-explanation-box">
                  <div className="exp-heading">
                    <span>💡 Solution & Explanation</span>
                  </div>
                  <p>{explanation}</p>
                </div>
              )}

              <div className="preview-footer-note">
                <small>Learners will only see the solution after submitting their attempt.</small>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
