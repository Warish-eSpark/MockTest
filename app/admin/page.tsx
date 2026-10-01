import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserForToken } from "../../lib/auth-store";
import { getRecentAuditEvents } from "../../lib/audit";
import { listQuestions, listRuleProfiles, listTests, getTaxonomy, listMockTests, listSubjectRequests } from "../../lib/admin-content";
import { notifications, plans } from "../../lib/phase1";
import "./admin.css";
import AdminQuestionHub from "./AdminQuestionHub";
import RuleForm from "./RuleForm";
import TestForm from "./TestForm";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const user = await getUserForToken(cookieStore.get("northstar_session")?.value);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [questions, rules, tests, auditEvents, taxonomy, mockTests, subjectRequests] = await Promise.all([
    listQuestions(),
    listRuleProfiles(),
    listTests(),
    getRecentAuditEvents(),
    getTaxonomy(),
    listMockTests({ status: "All" }),
    listSubjectRequests(),
  ]);

  const draftQuestions = questions.filter((q) => q.status === "Draft").length;
  const inReviewQuestions = questions.filter((q) => q.status === "In review").length;
  const publishedQuestions = questions.filter((q) => q.status === "Published").length;
  const liveMockTests = mockTests.filter((t) => t.status === "Published").length;

  return (
    <main className="admin-page">
      <nav className="admin-nav">
        <Link className="logo" href="/">
          <span className="logo-mark">N</span>
          <span>northstar<span className="logo-dot">.</span></span>
        </Link>
        <span className="admin-breadcrumb">Operations / Question Bank & Test Platform Management</span>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "11px", color: "#6d7b76", fontWeight: 600 }}>
            Admin: {user.displayName}
          </span>
          <Link className="back-link" href="/dashboard">← Learner view</Link>
        </div>
      </nav>

      <header className="admin-header">
        <div>
          <span className="kicker">PHASE 5 OPERATIONS & QUESTION BANK</span>
          <h1>Keep the practice<br /><em>trustworthy.</em></h1>
          <p>
            Author questions individually or in bulk, review scoring rule profiles, configure full
            and sectional mock tests, and track platform audit logs.
          </p>
        </div>
      </header>

      <section className="admin-stats">
        <div>
          <small>QUESTION BANK</small>
          <strong>{questions.length}</strong>
          <span>{publishedQuestions} published · {inReviewQuestions} in review · {draftQuestions} draft</span>
        </div>
        <div>
          <small>TESTS IN CATALOG</small>
          <strong>{mockTests.length}</strong>
          <span>{liveMockTests} live on frontend · {mockTests.length - liveMockTests} draft</span>
        </div>
        <div>
          <small>RULE PROFILES</small>
          <strong>{rules.length}</strong>
          <span>Versioned scoring & negative marking</span>
        </div>
        <div>
          <small>LEARNER DEMANDS</small>
          <strong>{subjectRequests.reduce((sum, r) => sum + r.requestCount, 0)}</strong>
          <span>{subjectRequests.length} requested subjects</span>
        </div>
      </section>

      {/* Primary Question Management Hub */}
      <AdminQuestionHub
        initialQuestions={questions}
        taxonomy={taxonomy}
        initialTests={mockTests}
        initialRequests={subjectRequests}
      />

      {/* Secondary Operational Panels */}
      <section className="admin-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="kicker">SCORING RULES</span>
              <h2>Published profiles</h2>
            </div>
            <div>
              <Link href="/api/admin/rules">API →</Link>
              <RuleForm />
            </div>
          </div>
          {rules.map((rule) => (
            <div className="rule-admin-row" key={rule.id}>
              <div>
                <strong>{rule.exam}</strong>
                <small>Version {rule.version} · {rule.options} options · {rule.status}</small>
              </div>
              <span>{rule.correctMarks} / {rule.wrongMarks}</span>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="kicker">TEST BUILDER</span>
              <h2>Publishing queue</h2>
            </div>
            <div>
              <Link href="/api/admin/tests">API →</Link>
              <TestForm rules={rules} />
            </div>
          </div>
          {tests.map((test) => (
            <div className="admin-row" key={test.id}>
              <span className="test-admin-icon">▣</span>
              <div>
                <strong>{test.name}</strong>
                <small>{test.exam} · {test.questions} questions · {test.access}</small>
              </div>
              <span className="status-label">{test.status}</span>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="kicker">COMMERCE & DISCOVERY</span>
              <h2>Launch controls</h2>
            </div>
          </div>
          <div className="control-links">
            <Link href="/plans">
              <strong>{plans.length} plans</strong>
              <small>Entitlements & pricing</small>
              <b>→</b>
            </Link>
            <Link href="/notifications">
              <strong>{notifications.length} notifications</strong>
              <small>Official links & exam CTAs</small>
              <b>→</b>
            </Link>
            <Link href="/api/search?q=bpsc">
              <strong>Unified search</strong>
              <small>Exams, tests, questions</small>
              <b>→</b>
            </Link>
            <Link href="/api/admin/audit">
              <strong>Audit activity ({auditEvents.length} events)</strong>
              <small>Operator action history</small>
              <b>→</b>
            </Link>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="kicker">AUDIT TRAIL</span>
              <h2>Recent activity</h2>
            </div>
            <Link href="/api/admin/audit">All logs →</Link>
          </div>
          {auditEvents.slice(0, 5).map((event, idx) => (
            <div className="admin-row" key={idx}>
              <span className="status-dot published" />
              <div>
                <strong>{event.action}</strong>
                <small>{event.actor} · {event.entityType} ({event.entityId})</small>
              </div>
              <span className="status-label">
                {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
