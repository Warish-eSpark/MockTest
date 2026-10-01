"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { parseQuestionsFromRaw, type ParseResult } from "../../lib/csv-parser";
import type { AdminQuestion } from "../../lib/phase1";

interface BulkQuestionImportProps {
  onImportComplete?: (importedQuestions: AdminQuestion[]) => void;
  onCancel?: () => void;
}

const SAMPLE_CSV_DATA = `exam,subject,topic,stem,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,difficulty,status
"BPSC TRE 4.0","General Studies","Bihar Geography","Which district of Bihar recorded the highest female literacy rate in Census 2011?","Rohtas","Patna","Munger","Bhojpur","None of the above / More than one of the above",A,"Rohtas recorded the highest female literacy rate (62.97%) as well as overall literacy in Bihar Census 2011.",medium,Published
"BPSC TRE 4.0","General Studies","Indian National Movement","Who established the Bihar Provincial Kisan Sabha in 1929?","Swami Sahajanand Saraswati","Karyanand Sharma","Rahul Sankrityayan","Yadunandan Sharma","None of the above / More than one of the above",A,"Swami Sahajanand Saraswati formed the Bihar Provincial Kisan Sabha (BPKS) in 1929 to mobilize peasants against zamindari exploitation.",easy,Published
"Bihar STET","Teaching Art","Pedagogy","What is the primary role of a constructivist teacher in a modern classroom?","Sole dispenser of factual knowledge","Facilitator and scaffold of student-led discovery","Strict disciplinarian and evaluator","Passive observer during all learning tasks",,B,"In a constructivist classroom, the teacher acts as a facilitator and guide who supports learners to build understanding.",easy,Draft
"CTET","Child Development & Pedagogy","Inclusive Education","Which principle forms the core foundation of Inclusive Education?","Segregating children based on cognitive capacity","Creating separate vocational schools for disabled learners","Welcoming and educating all children regardless of physical or intellectual differences","Exclusively admitting children with verified above-average IQ",,C,"Inclusive education is founded on the fundamental principle that all children have the right to learn together in common classrooms.",medium,Draft`;

export default function BulkQuestionImport({
  onImportComplete,
  onCancel,
}: BulkQuestionImportProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [filterView, setFilterView] = useState<"all" | "valid" | "invalid">("all");
  const [importing, setImporting] = useState(false);
  const [serverResult, setServerResult] = useState<{
    success: boolean;
    importedCount: number;
    rejectedCount: number;
    message: string;
  } | null>(null);

  // File drag & drop handlers
  function handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  }

  function processSelectedFile(file: File) {
    setSelectedFile(file);
    setServerResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      setRawText(content);
      const res = parseQuestionsFromRaw(content);
      setParseResult(res);
      setFilterView(res.invalidRows.length > 0 && res.validRows.length === 0 ? "invalid" : "all");
    };
    reader.readAsText(file);
  }

  function handleValidateText() {
    setServerResult(null);
    if (!rawText.trim()) {
      alert("Please enter or paste question content to validate.");
      return;
    }
    const res = parseQuestionsFromRaw(rawText);
    setParseResult(res);
    setFilterView(res.invalidRows.length > 0 && res.validRows.length === 0 ? "invalid" : "all");
  }

  function loadSampleData() {
    setActiveTab("paste");
    setRawText(SAMPLE_CSV_DATA);
    setSelectedFile(null);
    setServerResult(null);
    const res = parseQuestionsFromRaw(SAMPLE_CSV_DATA);
    setParseResult(res);
    setFilterView("all");
  }

  function clearAll() {
    setRawText("");
    setSelectedFile(null);
    setParseResult(null);
    setServerResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function executeBulkImport() {
    if (!parseResult || parseResult.questions.length === 0) return;

    setImporting(true);
    setServerResult(null);

    try {
      const response = await fetch("/api/admin/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: parseResult.questions }),
      });

      const payload = await response.json();
      setImporting(false);

      if (!response.ok) {
        setServerResult({
          success: false,
          importedCount: 0,
          rejectedCount: parseResult.questions.length,
          message: payload.error || "Failed to process bulk import.",
        });
        return;
      }

      const res = payload.data;
      setServerResult({
        success: true,
        importedCount: res.importedCount,
        rejectedCount: res.rejectedCount,
        message: `Successfully imported ${res.importedCount} questions into the question bank!`,
      });

      if (onImportComplete && res.imported) {
        onImportComplete(res.imported);
      }
    } catch (err) {
      setImporting(false);
      setServerResult({
        success: false,
        importedCount: 0,
        rejectedCount: 0,
        message: err instanceof Error ? err.message : "Network error occurred.",
      });
    }
  }

  return (
    <div className="bulk-import-studio">
      {/* Studio Header */}
      <div className="bulk-studio-header">
        <div>
          <h3>Bulk Question Import Studio</h3>
          <p>
            Upload CSV/TSV spreadsheets or paste questions in bulk. Supported formats include
            standard 4-option and BPSC 5-option tests.
          </p>
        </div>

        <div className="bulk-header-actions">
          <a
            href="/api/admin/questions/template"
            className="authoring-pill-btn download-btn"
            download="question_bank_template.csv"
          >
            📥 Download Sample CSV Template
          </a>
          <button type="button" className="authoring-pill-btn sample-btn" onClick={loadSampleData}>
            ⚡ Load Sample Questions
          </button>
          {onCancel && (
            <button type="button" className="authoring-close-btn" onClick={onCancel}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Upload vs Paste */}
      <div className="bulk-tabs-bar">
        <button
          type="button"
          className={`bulk-tab-btn ${activeTab === "file" ? "active" : ""}`}
          onClick={() => setActiveTab("file")}
        >
          📁 File Upload (.csv, .tsv, .json)
        </button>
        <button
          type="button"
          className={`bulk-tab-btn ${activeTab === "paste" ? "active" : ""}`}
          onClick={() => setActiveTab("paste")}
        >
          📋 Direct Paste / Text Editor
        </button>
        {(rawText || selectedFile) && (
          <button type="button" className="clear-link-btn" onClick={clearAll}>
            Clear input
          </button>
        )}
      </div>

      {/* Input Panes */}
      {activeTab === "file" ? (
        <div
          className={`bulk-dropzone ${dragActive ? "drag-over" : ""} ${
            selectedFile ? "has-file" : ""
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.json,.txt"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <div className="dropzone-content">
            <span className="dropzone-icon">📥</span>
            {!selectedFile ? (
              <>
                <strong>Drag & Drop your question spreadsheet here</strong>
                <p>or click to browse from your device (.csv, .tsv, or .json)</p>
                <small>Maximum batch size: 500 questions per file</small>
              </>
            ) : (
              <div className="selected-file-info">
                <strong>{selectedFile.name}</strong>
                <span>
                  {(selectedFile.size / 1024).toFixed(1)} KB · Ready to preview & import
                </span>
                <button
                  type="button"
                  className="reselect-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose another file
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bulk-paste-container">
          <div className="paste-instructions">
            <span>
              Paste CSV or TSV data directly (you can copy & paste cells directly from Microsoft Excel
              or Google Sheets).
            </span>
          </div>
          <textarea
            className="bulk-code-editor"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`exam,subject,topic,stem,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,difficulty\n"BPSC TRE 4.0","General Studies","Bihar History","Who led 1857 revolt in Bihar?","Kunwar Singh","Amar Singh","Pir Ali","Nana Saheb","None of the above",A,"Kunwar Singh was the leader",easy`}
            rows={9}
          />
          <div className="paste-actions-strip">
            <button
              type="button"
              className="btn-primary-small"
              onClick={handleValidateText}
              disabled={!rawText.trim()}
            >
              🔍 Parse & Validate Text
            </button>
          </div>
        </div>
      )}

      {/* Validation & Preview Summary */}
      {parseResult && (
        <div className="validation-review-card">
          <div className="validation-summary-bar">
            <div className="summary-stat">
              <small>TOTAL DETECTED</small>
              <strong>{parseResult.totalRows}</strong>
            </div>
            <div className="summary-stat success-stat">
              <small>READY TO IMPORT</small>
              <strong>{parseResult.validRows.length}</strong>
            </div>
            <div className="summary-stat error-stat">
              <small>ERRORS / REJECTED</small>
              <strong>{parseResult.invalidRows.length}</strong>
            </div>

            <div className="validation-action-group">
              {parseResult.validRows.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={executeBulkImport}
                  disabled={importing}
                >
                  {importing ? "Importing..." : `Confirm & Import ${parseResult.validRows.length} Questions`}
                </button>
              )}
            </div>
          </div>

          {/* Server Response Feedback */}
          {serverResult && (
            <div
              className={`server-result-banner ${serverResult.success ? "success" : "failure"}`}
            >
              <span className="banner-icon">{serverResult.success ? "✓" : "⚠"}</span>
              <div>
                <strong>{serverResult.message}</strong>
                {serverResult.success && (
                  <p>
                    All {serverResult.importedCount} questions have been written to the database
                    and audit log. You can now use them in the Question Bank or Test Builder.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Filter Pills for Preview */}
          <div className="preview-filter-strip">
            <span>Filter Preview:</span>
            <button
              type="button"
              className={`filter-pill ${filterView === "all" ? "active" : ""}`}
              onClick={() => setFilterView("all")}
            >
              All Rows ({parseResult.totalRows})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterView === "valid" ? "active" : ""}`}
              onClick={() => setFilterView("valid")}
            >
              ✓ Valid ({parseResult.validRows.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterView === "invalid" ? "active" : ""}`}
              onClick={() => setFilterView("invalid")}
            >
              ⚠ Errors ({parseResult.invalidRows.length})
            </button>
          </div>

          {/* Invalid Rows Report */}
          {(filterView === "all" || filterView === "invalid") &&
            parseResult.invalidRows.length > 0 && (
              <div className="rejection-report-section">
                <div className="rejection-heading">
                  <span>⚠ Attention Required ({parseResult.invalidRows.length} Invalid Rows)</span>
                  <small>These rows will be skipped during import until corrected.</small>
                </div>
                <div className="rejection-table-wrapper">
                  <table className="rejection-table">
                    <thead>
                      <tr>
                        <th style={{ width: "70px" }}>Row #</th>
                        <th>Problem Statement</th>
                        <th>Identified Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.invalidRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>
                            <span className="row-badge">#{row.rowNumber}</span>
                          </td>
                          <td className="stem-cell">
                            {row.data?.stem || row.raw?.stem || row.raw?.question || "(Empty question text)"}
                          </td>
                          <td>
                            <ul className="error-list">
                              {row.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* Valid Questions Data Table */}
          {(filterView === "all" || filterView === "valid") && parseResult.validRows.length > 0 && (
            <div className="valid-preview-section">
              <div className="valid-heading">
                <span>✓ Validated Questions Ready to Import ({parseResult.validRows.length})</span>
              </div>
              <div className="preview-table-wrapper">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>Row</th>
                      <th>Exam & Subject</th>
                      <th>Question Statement</th>
                      <th>Options & Answer</th>
                      <th>Difficulty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.validRows.map((row) => {
                      const q = row.data!;
                      const correctOpt = q.options?.find((o) => o.correct);
                      return (
                        <tr key={row.rowNumber}>
                          <td>
                            <span className="row-badge-success">#{row.rowNumber}</span>
                          </td>
                          <td>
                            <strong>{q.exam}</strong>
                            <small className="sub-tag">
                              {q.subject} {q.topic !== "Unassigned" ? `· ${q.topic}` : ""}
                            </small>
                          </td>
                          <td className="stem-cell">
                            <p>{q.stem}</p>
                            {q.explanation && (
                              <small className="preview-exp">💡 {q.explanation}</small>
                            )}
                          </td>
                          <td>
                            <div className="mini-options-list">
                              {(q.options ?? []).map((opt) => (
                                <span
                                  key={opt.key}
                                  className={`mini-opt ${opt.correct ? "is-correct" : ""}`}
                                >
                                  <b>{opt.key}:</b> {opt.text}
                                </span>
                              ))}
                            </div>
                            <span className="correct-answer-pill">
                              Answer: Option {correctOpt?.key || "?"}
                            </span>
                          </td>
                          <td>
                            <span className={`diff-pill ${q.difficulty || "medium"}`}>
                              {(q.difficulty || "medium").toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className="status-pill">{q.status || "Draft"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
