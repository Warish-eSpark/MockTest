"use client";

import { useState } from "react";
import type { AdminQuestion, ContentStatus } from "../../lib/phase1";

interface QuestionBankListProps {
  initialQuestions: AdminQuestion[];
  onOpenSingleForm: () => void;
  onOpenBulkForm: () => void;
}

export default function QuestionBankList({
  initialQuestions,
  onOpenSingleForm,
  onOpenBulkForm,
}: QuestionBankListProps) {
  const [questions, setQuestions] = useState<AdminQuestion[]>(initialQuestions);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExam, setSelectedExam] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Extract unique exams for filter
  const examList = Array.from(new Set(questions.map((q) => q.exam).filter(Boolean)));

  // Filtered questions
  const filtered = questions.filter((q) => {
    if (selectedExam !== "All" && q.exam !== selectedExam) return false;
    if (selectedStatus !== "All" && q.status !== selectedStatus) return false;
    if (selectedDifficulty !== "All" && (q.difficulty || "medium") !== selectedDifficulty)
      return false;

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const inStem = q.stem.toLowerCase().includes(term);
      const inTopic = q.topic.toLowerCase().includes(term);
      const inSubject = q.subject.toLowerCase().includes(term);
      const inExp = q.explanation ? q.explanation.toLowerCase().includes(term) : false;
      if (!inStem && !inTopic && !inSubject && !inExp) return false;
    }

    return true;
  });

  async function handleStatusChange(id: string, newStatus: ContentStatus) {
    setUpdatingId(id);
    setActionMessage(null);

    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus } : q))
    );

    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setUpdatingId(null);

      if (!res.ok) {
        const payload = await res.json();
        setActionMessage(payload.error || "Failed to update status.");
      } else {
        setActionMessage(`Question #${id} status updated to ${newStatus}.`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      setUpdatingId(null);
      setActionMessage("Network error updating question status.");
    }
  }

  async function handleDelete(id: string, stem: string) {
    const preview = stem.length > 40 ? stem.slice(0, 40) + "..." : stem;
    if (!window.confirm(`Are you sure you want to delete question "${preview}"? This cannot be undone.`)) {
      return;
    }

    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      setUpdatingId(null);

      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setActionMessage(`Question #${id} deleted successfully.`);
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        const payload = await res.json();
        alert(payload.error || "Unable to delete question.");
      }
    } catch {
      setUpdatingId(null);
      alert("Network error deleting question.");
    }
  }

  return (
    <div className="qb-container">
      {/* Top Action Header */}
      <div className="qb-header">
        <div>
          <span className="kicker">QUESTION BANK MANAGEMENT</span>
          <h2>Central Question Repository</h2>
          <p>
            Search, filter, review options and explanations, update workflow statuses, or author new
            questions.
          </p>
        </div>

        <div className="qb-header-actions">
          <button type="button" className="btn-secondary" onClick={onOpenBulkForm}>
            ↑ Bulk Import (CSV / TSV / JSON)
          </button>
          <button type="button" className="btn-primary" onClick={onOpenSingleForm}>
            + Add Question (One by One)
          </button>
        </div>
      </div>

      {actionMessage && <div className="qb-toast-message">{actionMessage}</div>}

      {/* Filter and Search Bar */}
      <div className="qb-controls-bar">
        <div className="qb-search-box">
          <span>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions by text, subject, topic, or solution..."
          />
          {searchQuery && (
            <button
              type="button"
              className="qb-clear-search"
              onClick={() => setSearchQuery("")}
            >
              ✕
            </button>
          )}
        </div>

        <div className="qb-filter-group">
          {/* Exam Filter */}
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
            <option value="All">All Exams ({questions.length})</option>
            {examList.map((exam) => (
              <option key={exam} value={exam}>
                {exam}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="In review">In review</option>
            <option value="Approved">Approved</option>
            <option value="Published">Published</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <option value="All">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Results Count Bar */}
      <div className="qb-count-strip">
        <span>
          Showing <strong>{filtered.length}</strong> of {questions.length} questions
        </span>
        {(searchQuery ||
          selectedExam !== "All" ||
          selectedStatus !== "All" ||
          selectedDifficulty !== "All") && (
          <button
            type="button"
            className="qb-reset-filters-btn"
            onClick={() => {
              setSearchQuery("");
              setSelectedExam("All");
              setSelectedStatus("All");
              setSelectedDifficulty("All");
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Questions List */}
      {filtered.length === 0 ? (
        <div className="qb-empty-state">
          <div className="qb-empty-icon">📂</div>
          <h3>No matching questions found</h3>
          <p>
            Try adjusting your search query or filters, or add your first question using the single or
            bulk authoring tools above.
          </p>
          <div className="qb-empty-actions">
            <button type="button" className="btn-secondary" onClick={onOpenBulkForm}>
              Import Questions in Bulk
            </button>
            <button type="button" className="btn-primary" onClick={onOpenSingleForm}>
              + Add First Question
            </button>
          </div>
        </div>
      ) : (
        <div className="qb-list-stack">
          {filtered.map((question) => {
            const isExpanded = expandedQuestionId === question.id;
            const statusClass = question.status.toLowerCase().replace(/\s+/g, "-");
            const difficultyClass = (question.difficulty || "medium").toLowerCase();

            return (
              <div
                key={question.id}
                className={`qb-item-card ${isExpanded ? "is-expanded" : ""}`}
              >
                {/* Card Header Strip */}
                <div className="qb-card-top-row">
                  <div className="qb-meta-badges">
                    <span className="badge-exam">{question.exam}</span>
                    <span className="badge-subject">{question.subject}</span>
                    {question.topic && question.topic !== "Unassigned" && (
                      <span className="badge-topic">{question.topic}</span>
                    )}
                    <span className={`badge-difficulty ${difficultyClass}`}>
                      {(question.difficulty || "medium").toUpperCase()}
                    </span>
                  </div>

                  <div className="qb-status-wrapper">
                    <span className={`status-dot ${statusClass}`} />
                    <select
                      className={`status-select ${statusClass}`}
                      value={question.status}
                      disabled={updatingId === question.id}
                      onChange={(e) =>
                        handleStatusChange(question.id, e.target.value as ContentStatus)
                      }
                    >
                      <option value="Draft">Draft</option>
                      <option value="In review">In review</option>
                      <option value="Approved">Approved</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Question Stem */}
                <div
                  className="qb-stem-wrapper"
                  onClick={() => setExpandedQuestionId(isExpanded ? null : question.id)}
                >
                  <p className="qb-question-stem">{question.stem}</p>
                </div>

                {/* Option Count Preview and Quick Actions */}
                <div className="qb-card-footer-row">
                  <button
                    type="button"
                    className="qb-expand-toggle-btn"
                    onClick={() => setExpandedQuestionId(isExpanded ? null : question.id)}
                  >
                    <span>{isExpanded ? "▼ Hide Details" : "▶ View Options & Explanation"}</span>
                    <small>
                      ({question.options?.length ?? 0} options
                      {question.explanation ? " · Includes explanation" : ""})
                    </small>
                  </button>

                  <div className="qb-card-actions">
                    <span className="question-id-tag">ID: {question.id}</span>
                    <button
                      type="button"
                      className="qb-delete-btn"
                      title="Delete question"
                      disabled={updatingId === question.id}
                      onClick={() => handleDelete(question.id, question.stem)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expandable Options & Explanation Drawer */}
                {isExpanded && (
                  <div className="qb-expanded-drawer">
                    <div className="qb-drawer-section">
                      <strong className="drawer-title">Answer Options</strong>
                      <div className="qb-options-grid">
                        {(question.options ?? []).map((opt) => (
                          <div
                            key={opt.key}
                            className={`qb-option-box ${opt.correct ? "is-correct-box" : ""}`}
                          >
                            <span className="opt-key-badge">{opt.key}</span>
                            <span className="opt-text">{opt.text}</span>
                            {opt.correct && (
                              <span className="opt-correct-indicator">✓ Correct Key</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {question.explanation && (
                      <div className="qb-drawer-section">
                        <strong className="drawer-title">💡 Explanation & Solution</strong>
                        <div className="qb-explanation-content">
                          <p>{question.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
