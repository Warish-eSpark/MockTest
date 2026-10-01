"use client";

import { useState, useMemo } from "react";
import type { MockTest, SubjectDemandRequest } from "../../lib/admin-content";
import type { AdminQuestion } from "../../lib/phase1";
import { syllabusTracks } from "../../lib/syllabus";

interface MockTestManagerProps {
  initialTests: MockTest[];
  initialRequests: SubjectDemandRequest[];
  questions: AdminQuestion[];
  onTestCreated?: (newTest: MockTest) => void;
}

export default function MockTestManager({
  initialTests,
  initialRequests,
  questions,
  onTestCreated,
}: MockTestManagerProps) {
  const [tests, setTests] = useState<MockTest[]>(initialTests);
  const [requests, setRequests] = useState<SubjectDemandRequest[]>(initialRequests);
  const [subTab, setSubTab] = useState<"catalog" | "create" | "demands">("catalog");

  // Filters for catalog
  const [examFilter, setExamFilter] = useState("All");
  const [trackFilter, setTrackFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Create form state
  const [createExam, setCreateExam] = useState("BPSC TRE 4.0");
  const [createTrack, setCreateTrack] = useState("primary-1-5");
  const [createSubject, setCreateSubject] = useState("General Studies");
  const [customSubject, setCustomSubject] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState("Full mock");
  const [createDuration, setCreateDuration] = useState("150");
  const [createQuestionsCount, setCreateQuestionsCount] = useState("150");
  const [createAccess, setCreateAccess] = useState<"Free" | "Premium">("Free");
  const [createStatus, setCreateStatus] = useState<"Draft" | "Published">("Published");
  const [createDescription, setCreateDescription] = useState("");
  const [selectedInitialQuestions, setSelectedInitialQuestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Question linking drawer state
  const [activeTestForQuestions, setActiveTestForQuestions] = useState<MockTest | null>(null);
  const [linkedQuestions, setLinkedQuestions] = useState<AdminQuestion[]>([]);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);
  const [questionSearch, setQuestionSearch] = useState("");
  const [linkingQId, setLinkingQId] = useState<string | null>(null);

  // Derive available tracks for selected exam
  const currentExamSlug = createExam === "BPSC TRE 4.0" ? "bpsc-tre-4" : createExam === "Bihar STET" ? "bihar-stet" : "ctet";
  const tracksForSelectedExam = syllabusTracks[currentExamSlug] ?? [];
  const activeTrackObj = tracksForSelectedExam.find((t) => t.slug === createTrack) || tracksForSelectedExam[0];
  const subjectsForActiveTrack = activeTrackObj?.subjects ?? [];

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (examFilter !== "All" && t.examName !== examFilter && t.examSlug !== examFilter) return false;
      if (trackFilter !== "All" && t.trackSlug !== trackFilter) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tests, examFilter, trackFilter, statusFilter]);

  // Questions available for linking to active test
  const availableToLink = useMemo(() => {
    if (!activeTestForQuestions) return [];
    const linkedIds = new Set(linkedQuestions.map((q) => q.id));
    return questions.filter((q) => {
      if (linkedIds.has(q.id)) return false;
      if (questionSearch.trim()) {
        const query = questionSearch.toLowerCase();
        return (
          q.stem.toLowerCase().includes(query) ||
          q.subject.toLowerCase().includes(query) ||
          q.topic?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [activeTestForQuestions, linkedQuestions, questions, questionSearch]);

  // Handle opening question drawer
  async function openQuestionDrawer(test: MockTest) {
    setActiveTestForQuestions(test);
    setIsLoadingLinked(true);
    try {
      const res = await fetch(`/api/admin/mock-tests/${test.id}/questions`);
      const data = await res.json();
      setLinkedQuestions(data.questions || []);
    } catch {
      setLinkedQuestions([]);
    } finally {
      setIsLoadingLinked(false);
    }
  }

  // Handle linking a question
  async function handleLinkQuestion(qId: string) {
    if (!activeTestForQuestions) return;
    setLinkingQId(qId);
    try {
      const res = await fetch(`/api/admin/mock-tests/${activeTestForQuestions.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [qId] }),
      });
      if (res.ok) {
        const qToAdd = questions.find((q) => q.id === qId);
        if (qToAdd) {
          setLinkedQuestions((prev) => [...prev, qToAdd]);
        }
        setTests((prev) =>
          prev.map((t) =>
            t.id === activeTestForQuestions.id
              ? { ...t, linkedQuestionsCount: t.linkedQuestionsCount + 1 }
              : t
          )
        );
      }
    } catch {
      // error handling
    } finally {
      setLinkingQId(null);
    }
  }

  // Handle unlinking a question
  async function handleUnlinkQuestion(qId: string) {
    if (!activeTestForQuestions) return;
    try {
      const res = await fetch(`/api/admin/mock-tests/${activeTestForQuestions.id}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: qId }),
      });
      if (res.ok) {
        setLinkedQuestions((prev) => prev.filter((q) => q.id !== qId));
        setTests((prev) =>
          prev.map((t) =>
            t.id === activeTestForQuestions.id
              ? { ...t, linkedQuestionsCount: Math.max(0, t.linkedQuestionsCount - 1) }
              : t
          )
        );
      }
    } catch {
      // error handling
    }
  }

  // Handle status toggle
  async function handleStatusToggle(testId: string, currentStatus: "Draft" | "Published" | "Archived") {
    const nextStatus = currentStatus === "Published" ? "Draft" : "Published";
    try {
      const res = await fetch(`/api/admin/mock-tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTests((prev) =>
          prev.map((t) => (t.id === testId ? { ...t, status: nextStatus } : t))
        );
      }
    } catch {
      // error handling
    }
  }

  // Handle delete test
  async function handleDeleteTest(testId: string) {
    if (!confirm("Are you sure you want to delete this mock test? This will remove it from learner view.")) return;
    try {
      const res = await fetch(`/api/admin/mock-tests/${testId}`, { method: "DELETE" });
      if (res.ok) {
        setTests((prev) => prev.filter((t) => t.id !== testId));
      }
    } catch {
      // error handling
    }
  }

  // Pre-fill create form from learner demand
  function handleFulfillDemand(req: SubjectDemandRequest) {
    const examMap: Record<string, string> = {
      "bpsc-tre-4": "BPSC TRE 4.0",
      "bihar-stet": "Bihar STET",
      ctet: "CTET",
    };
    setCreateExam(examMap[req.examSlug] || "BPSC TRE 4.0");
    setCreateTrack(req.trackSlug);
    setCreateSubject(req.subjectName);
    setCreateTitle(`${req.subjectName}: High-Yield Mock 01`);
    setSubTab("create");
    setFormFeedback({
      type: "success",
      message: `Form pre-filled for ${req.subjectName} (${req.requestCount} student requests awaiting test creation).`,
    });
  }

  // Handle Create Mock Test submission
  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormFeedback(null);

    const subjectToUse = createSubject === "__custom__" ? customSubject.trim() : createSubject;
    if (!createTitle.trim() || !subjectToUse) {
      setFormFeedback({ type: "error", message: "Test title and subject are required." });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/mock-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createTitle.trim(),
          examName: createExam,
          trackSlug: createTrack,
          subjectName: subjectToUse,
          testType: createType,
          questionCount: Number(createQuestionsCount) || 150,
          durationMinutes: Number(createDuration) || 150,
          totalMarks: Number(createQuestionsCount) || 150,
          access: createAccess,
          status: createStatus,
          description: createDescription.trim() || undefined,
          questionIds: selectedInitialQuestions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create mock test.");
      }

      const newTest = data.test as MockTest;
      setTests((prev) => [newTest, ...prev]);
      if (onTestCreated) onTestCreated(newTest);

      setFormFeedback({
        type: "success",
        message: `Successfully created "${newTest.name}"! It is now ${newTest.status.toLowerCase()} and visible on the frontend.`,
      });

      // Reset form
      setCreateTitle("");
      setCreateDescription("");
      setSelectedInitialQuestions([]);
      setSubTab("catalog");
    } catch (err) {
      setFormFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "An error occurred while creating the test.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mock-test-manager">
      {/* Sub Navigation */}
      <div className="test-mgr-subnav">
        <button
          type="button"
          className={`test-mgr-tab ${subTab === "catalog" ? "active" : ""}`}
          onClick={() => setSubTab("catalog")}
        >
          <span>📚 All Mock Tests</span>
          <span className="test-mgr-badge">{tests.length}</span>
        </button>

        <button
          type="button"
          className={`test-mgr-tab ${subTab === "create" ? "active" : ""}`}
          onClick={() => setSubTab("create")}
        >
          <span>➕ Create New Mock Test</span>
        </button>

        <button
          type="button"
          className={`test-mgr-tab ${subTab === "demands" ? "active" : ""}`}
          onClick={() => setSubTab("demands")}
        >
          <span>🔥 Learner Demands</span>
          <span className="test-mgr-badge demand-badge">
            {requests.reduce((sum, r) => sum + r.requestCount, 0)} votes
          </span>
        </button>
      </div>

      {formFeedback && (
        <div className={`test-feedback-banner ${formFeedback.type}`}>
          {formFeedback.type === "success" ? "✓" : "⚠"} {formFeedback.message}
          <button type="button" onClick={() => setFormFeedback(null)}>✕</button>
        </div>
      )}

      {/* SUB-TAB 1: CATALOG OF MOCK TESTS */}
      {subTab === "catalog" && (
        <div className="test-mgr-catalog">
          <div className="test-filter-toolbar">
            <div className="filter-group">
              <label>Exam:</label>
              <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
                <option value="All">All Exams</option>
                <option value="BPSC TRE 4.0">BPSC TRE 4.0</option>
                <option value="Bihar STET">Bihar STET</option>
                <option value="CTET">CTET</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Class Track:</label>
              <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)}>
                <option value="All">All Tracks</option>
                <option value="primary-1-5">Primary (Classes 1–5)</option>
                <option value="middle-6-8">Middle (Classes 6–8)</option>
                <option value="secondary-9-10">Secondary (Classes 9–10)</option>
                <option value="higher-secondary-11-12">Higher Secondary (Classes 11–12)</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Published">Published (Live)</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-create-shortcut"
              onClick={() => setSubTab("create")}
            >
              + Create Mock Test
            </button>
          </div>

          {filteredTests.length === 0 ? (
            <div className="test-empty-state">
              <p>No mock tests match the selected filters.</p>
              <button
                type="button"
                className="btn-primary-small"
                onClick={() => setSubTab("create")}
              >
                Create the first mock test now
              </button>
            </div>
          ) : (
            <div className="test-cards-grid">
              {filteredTests.map((test) => (
                <div className="admin-test-card" key={test.id}>
                  <div className="admin-test-card-header">
                    <span className="admin-test-kicker">
                      {test.examName} · {test.trackSlug}
                    </span>
                    <div className="admin-test-pills">
                      <span className={`status-pill ${test.status.toLowerCase()}`}>
                        {test.status}
                      </span>
                      <span className={`access-pill ${test.access.toLowerCase()}`}>
                        {test.access}
                      </span>
                    </div>
                  </div>

                  <h3 className="admin-test-title">{test.name}</h3>
                  <div className="admin-test-subject">
                    <strong>Subject:</strong> {test.subjectName}
                  </div>

                  <div className="admin-test-specs">
                    <span>⏱ {test.durationMinutes} mins</span>
                    <span>📝 {test.questionCount} target Qs</span>
                    <span className="linked-count-chip">
                      🔗 <strong>{test.linkedQuestionsCount}</strong> linked in DB
                    </span>
                  </div>

                  {test.description && (
                    <p className="admin-test-desc">{test.description}</p>
                  )}

                  <div className="admin-test-actions">
                    <button
                      type="button"
                      className="btn-manage-questions"
                      onClick={() => openQuestionDrawer(test)}
                    >
                      📋 Add / Manage Questions ({test.linkedQuestionsCount})
                    </button>

                    <button
                      type="button"
                      className={`btn-toggle-status ${test.status === "Published" ? "live" : "draft"}`}
                      onClick={() => handleStatusToggle(test.id, test.status)}
                    >
                      {test.status === "Published" ? "Unpublish (Draft)" : "Publish (Make Live)"}
                    </button>

                    <button
                      type="button"
                      className="btn-delete-test"
                      onClick={() => handleDeleteTest(test.id)}
                      title="Delete test"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CREATE NEW MOCK TEST */}
      {subTab === "create" && (
        <form className="test-create-form" onSubmit={handleCreateTest}>
          <div className="form-section-title">
            <h3>Configure Mock Test Details</h3>
            <p>Every mock test created here is dynamically published to the student syllabus tracks.</p>
          </div>

          <div className="form-grid-row">
            <div className="form-field">
              <label>Target Exam *</label>
              <select
                value={createExam}
                onChange={(e) => {
                  setCreateExam(e.target.value);
                  const newExamSlug = e.target.value === "BPSC TRE 4.0" ? "bpsc-tre-4" : e.target.value === "Bihar STET" ? "bihar-stet" : "ctet";
                  const tracks = syllabusTracks[newExamSlug] ?? [];
                  if (tracks[0]) setCreateTrack(tracks[0].slug);
                }}
              >
                <option value="BPSC TRE 4.0">BPSC TRE 4.0</option>
                <option value="Bihar STET">Bihar STET</option>
                <option value="CTET">CTET</option>
              </select>
            </div>

            <div className="form-field">
              <label>Class Level / Track *</label>
              <select
                value={createTrack}
                onChange={(e) => {
                  setCreateTrack(e.target.value);
                  const trackObj = tracksForSelectedExam.find((t) => t.slug === e.target.value);
                  if (trackObj?.subjects[0]) setCreateSubject(trackObj.subjects[0].name);
                }}
              >
                {tracksForSelectedExam.map((t) => (
                  <option value={t.slug} key={t.slug}>
                    {t.audience} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Subject *</label>
              <select
                value={createSubject}
                onChange={(e) => setCreateSubject(e.target.value)}
              >
                {subjectsForActiveTrack.map((s) => (
                  <option value={s.name} key={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="__custom__">+ Enter Custom Subject...</option>
              </select>
            </div>
          </div>

          {createSubject === "__custom__" && (
            <div className="form-field" style={{ marginTop: "12px" }}>
              <label>Custom Subject Name *</label>
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="e.g., Computer Science / Psychology"
                required
              />
            </div>
          )}

          <div className="form-field" style={{ marginTop: "16px" }}>
            <label>Mock Test Title *</label>
            <input
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="e.g., General Studies: Full Mock 02"
              required
            />
          </div>

          <div className="form-grid-row" style={{ marginTop: "16px" }}>
            <div className="form-field">
              <label>Test Type</label>
              <select value={createType} onChange={(e) => setCreateType(e.target.value)}>
                <option value="Full mock">Full mock</option>
                <option value="Subject test">Subject test</option>
                <option value="Topic test">Topic test</option>
                <option value="PYQ practice">PYQ practice</option>
              </select>
            </div>

            <div className="form-field">
              <label>Duration (Minutes)</label>
              <input
                type="number"
                value={createDuration}
                onChange={(e) => setCreateDuration(e.target.value)}
                min="5"
                max="300"
              />
            </div>

            <div className="form-field">
              <label>Questions Target</label>
              <input
                type="number"
                value={createQuestionsCount}
                onChange={(e) => setCreateQuestionsCount(e.target.value)}
                min="1"
                max="300"
              />
            </div>

            <div className="form-field">
              <label>Access Type</label>
              <select
                value={createAccess}
                onChange={(e) => setCreateAccess(e.target.value as "Free" | "Premium")}
              >
                <option value="Free">Free (All learners)</option>
                <option value="Premium">Premium</option>
              </select>
            </div>

            <div className="form-field">
              <label>Publish Status</label>
              <select
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value as "Published" | "Draft")}
              >
                <option value="Published">Published (Instantly Live on Frontend)</option>
                <option value="Draft">Draft (Hidden from students)</option>
              </select>
            </div>
          </div>

          <div className="form-field" style={{ marginTop: "16px" }}>
            <label>Description / Syllabus Alignment</label>
            <textarea
              rows={2}
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="e.g., Comprehensive 150-question mock mapped to SCERT/NCERT pattern."
            />
          </div>

          {/* Quick attach questions selector */}
          <div className="quick-attach-section">
            <div className="quick-attach-header">
              <h4>Attach Initial Questions from Question Bank ({questions.length} available)</h4>
              <span>{selectedInitialQuestions.length} questions selected</span>
            </div>
            <div className="quick-attach-list">
              {questions.slice(0, 10).map((q) => {
                const isChecked = selectedInitialQuestions.includes(q.id);
                return (
                  <label className="quick-attach-item" key={q.id}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInitialQuestions((prev) => [...prev, q.id]);
                        } else {
                          setSelectedInitialQuestions((prev) => prev.filter((id) => id !== q.id));
                        }
                      }}
                    />
                    <div>
                      <strong className="quick-attach-stem">{q.stem}</strong>
                      <small className="quick-attach-meta">
                        {q.exam} · {q.subject} · {q.difficulty}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-submit-row">
            <button
              type="submit"
              className="btn-create-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating & Publishing..." : "Create Mock Test & Make Available →"}
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setSubTab("catalog")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 3: LEARNER DEMAND (SUBJECT REQUESTS) */}
      {subTab === "demands" && (
        <div className="test-mgr-demands">
          <div className="demands-intro">
            <div>
              <h3>Learner Subject Demand Priority Hub</h3>
              <p>
                When a student clicks on a subject that does not have a test yet, they click
                <strong> "Raise a Request to Provide Mock Test"</strong>. Below is the live tally
                sorted by highest priority.
              </p>
            </div>
            <span className="demands-total-badge">
              🔥 {requests.length} subjects requested
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="test-empty-state">
              <p>No student requests recorded yet. When learners request tests on the frontend, they will appear here.</p>
            </div>
          ) : (
            <div className="demands-table-wrapper">
              <table className="demands-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Target Exam</th>
                    <th>Class Track</th>
                    <th>Requested Subject</th>
                    <th>Learner Requests</th>
                    <th>Last Requested</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, idx) => (
                    <tr key={req.id}>
                      <td>
                        <span className={`priority-rank rank-${idx < 3 ? idx + 1 : "other"}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td><strong>{req.examSlug.toUpperCase()}</strong></td>
                      <td><span className="track-tag">{req.trackSlug}</span></td>
                      <td>
                        <strong className="demand-subject-name">{req.subjectName}</strong>
                      </td>
                      <td>
                        <span className="demand-votes-chip">
                          🔥 {req.requestCount} student{req.requestCount > 1 ? "s" : ""}
                        </span>
                      </td>
                      <td>
                        <small className="demand-date">
                          {new Date(req.lastRequestedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-fulfill-demand"
                          onClick={() => handleFulfillDemand(req)}
                        >
                          + Create Test for this Subject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QUESTION LINKING DRAWER */}
      {activeTestForQuestions && (
        <div className="question-drawer-backdrop" onClick={() => setActiveTestForQuestions(null)}>
          <div
            className="question-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="question-drawer-header">
              <div>
                <span className="kicker">TEST CONTENT STUDIO</span>
                <h2>{activeTestForQuestions.name}</h2>
                <p>
                  {activeTestForQuestions.examName} · {activeTestForQuestions.subjectName} ·{" "}
                  {linkedQuestions.length} questions attached
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setActiveTestForQuestions(null)}
              >
                ✕
              </button>
            </div>

            <div className="question-drawer-body">
              {/* Linked Questions Section */}
              <div className="drawer-linked-section">
                <h3>Currently Linked Questions ({linkedQuestions.length})</h3>
                {isLoadingLinked ? (
                  <p className="loading-state">Loading linked questions...</p>
                ) : linkedQuestions.length === 0 ? (
                  <div className="empty-linked-notice">
                    <p>No questions are linked to this test yet.</p>
                    <small>Choose from the Question Bank below to attach questions to this test.</small>
                  </div>
                ) : (
                  <div className="linked-questions-scroll">
                    {linkedQuestions.map((q, idx) => (
                      <div className="linked-question-item" key={q.id}>
                        <span className="q-order-badge">Q{idx + 1}</span>
                        <div className="q-details">
                          <p className="q-stem">{q.stem}</p>
                          <div className="q-tags">
                            <span>{q.subject}</span>
                            <span className={`diff-${q.difficulty}`}>{q.difficulty}</span>
                            <span className="opt-count">{(q.options?.length ?? 0)} options</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-unlink-q"
                          onClick={() => handleUnlinkQuestion(q.id)}
                          title="Remove question from test"
                        >
                          ✕ Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach Questions From Bank Section */}
              <div className="drawer-attach-section">
                <div className="attach-search-bar">
                  <h3>Attach from Question Bank ({availableToLink.length} available)</h3>
                  <input
                    type="text"
                    placeholder="Search question stem or subject..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                  />
                </div>

                <div className="available-questions-scroll">
                  {availableToLink.length === 0 ? (
                    <p className="empty-search-notice">No unlinked questions found.</p>
                  ) : (
                    availableToLink.map((q) => (
                      <div className="available-q-item" key={q.id}>
                        <div className="avail-q-info">
                          <p className="avail-q-stem">{q.stem}</p>
                          <small>
                            {q.exam} · {q.subject} · {q.options?.length ?? 0} options
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn-attach-q"
                          disabled={linkingQId === q.id}
                          onClick={() => handleLinkQuestion(q.id)}
                        >
                          {linkingQId === q.id ? "Adding..." : "+ Add to Test"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
