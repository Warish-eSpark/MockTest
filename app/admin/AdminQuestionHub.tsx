"use client";

import { useState } from "react";
import type { AdminQuestion } from "../../lib/phase1";
import type { MockTest, SubjectDemandRequest } from "../../lib/admin-content";
import SingleQuestionForm from "./SingleQuestionForm";
import BulkQuestionImport from "./BulkQuestionImport";
import QuestionBankList from "./QuestionBankList";
import MockTestManager from "./MockTestManager";

type Taxonomy = {
  exams: { id: string; name: string; slug: string }[];
  subjects: { id: string; examId: string; examName: string; name: string }[];
  topics: { id: string; subjectId: string; subjectName: string; name: string }[];
};

interface AdminQuestionHubProps {
  initialQuestions: AdminQuestion[];
  taxonomy: Taxonomy;
  initialTests?: MockTest[];
  initialRequests?: SubjectDemandRequest[];
}

export default function AdminQuestionHub({
  initialQuestions,
  taxonomy,
  initialTests = [],
  initialRequests = [],
}: AdminQuestionHubProps) {
  const [activeTab, setActiveTab] = useState<"bank" | "single" | "bulk" | "tests">("bank");
  const [questions, setQuestions] = useState<AdminQuestion[]>(initialQuestions);
  const [mockTests, setMockTests] = useState<MockTest[]>(initialTests);

  function handleQuestionCreated(newQuestion: AdminQuestion) {
    setQuestions((prev) => [newQuestion, ...prev]);
  }

  function handleBulkImported(importedList: AdminQuestion[]) {
    setQuestions((prev) => [...importedList, ...prev]);
    setActiveTab("bank");
  }

  function handleTestCreated(newTest: MockTest) {
    setMockTests((prev) => [newTest, ...prev]);
  }

  return (
    <div className="admin-question-hub">
      {/* Top Navigation Tabs */}
      <div className="hub-nav-tabs">
        <button
          type="button"
          className={`hub-tab-button ${activeTab === "bank" ? "active" : ""}`}
          onClick={() => setActiveTab("bank")}
        >
          <span className="hub-tab-icon">📋</span>
          <span className="hub-tab-label">Question Bank</span>
          <span className="hub-tab-count">{questions.length}</span>
        </button>

        <button
          type="button"
          className={`hub-tab-button ${activeTab === "single" ? "active" : ""}`}
          onClick={() => setActiveTab("single")}
        >
          <span className="hub-tab-icon">✍️</span>
          <span className="hub-tab-label">Add Single Question (One by One)</span>
        </button>

        <button
          type="button"
          className={`hub-tab-button ${activeTab === "bulk" ? "active" : ""}`}
          onClick={() => setActiveTab("bulk")}
        >
          <span className="hub-tab-icon">📦</span>
          <span className="hub-tab-label">Bulk Question Import (CSV / TSV / JSON)</span>
          <span className="hub-new-badge">Batch</span>
        </button>

        <button
          type="button"
          className={`hub-tab-button ${activeTab === "tests" ? "active" : ""}`}
          onClick={() => setActiveTab("tests")}
        >
          <span className="hub-tab-icon">🎯</span>
          <span className="hub-tab-label">Mock Tests & Demands</span>
          <span className="hub-tab-count">{mockTests.length}</span>
        </button>
      </div>

      {/* Hub Body */}
      <div className="hub-content-container">
        {activeTab === "bank" && (
          <QuestionBankList
            initialQuestions={questions}
            onOpenSingleForm={() => setActiveTab("single")}
            onOpenBulkForm={() => setActiveTab("bulk")}
          />
        )}

        {activeTab === "single" && (
          <SingleQuestionForm
            taxonomy={taxonomy}
            onQuestionCreated={handleQuestionCreated}
            onCancel={() => setActiveTab("bank")}
          />
        )}

        {activeTab === "bulk" && (
          <BulkQuestionImport
            onImportComplete={handleBulkImported}
            onCancel={() => setActiveTab("bank")}
          />
        )}

        {activeTab === "tests" && (
          <MockTestManager
            initialTests={mockTests}
            initialRequests={initialRequests}
            questions={questions}
            onTestCreated={handleTestCreated}
          />
        )}
      </div>
    </div>
  );
}
