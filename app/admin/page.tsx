import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserForToken } from "../../lib/auth-store";
import { getRecentAuditEvents } from "../../lib/audit";
import { listQuestions, listRuleProfiles, listTests } from "../../lib/admin-content";
import { notifications, plans } from "../../lib/phase1";
import "./admin.css";
import QuestionForm from "./QuestionForm";
import RuleForm from "./RuleForm";
import TestForm from "./TestForm";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const user = await getUserForToken(cookieStore.get("northstar_session")?.value);
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const [questions, rules, tests, auditEvents] = await Promise.all([
    listQuestions(),
    listRuleProfiles(),
    listTests(),
    getRecentAuditEvents(),
  ]);

  return (
    <main className="admin-page">
      <nav className="admin-nav">
        <Link className="logo" href="/"><span className="logo-mark">N</span><span>northstar<span className="logo-dot">.</span></span></Link>
        <span className="admin-breadcrumb">Operations / Launch workspace</span>
        <Link className="back-link" href="/dashboard">← Learner view</Link>
      </nav>
      <header className="admin-header">
        <div><span className="kicker">PHASE 1 OPERATIONS</span><h1>Keep the practice<br /><em>trustworthy.</em></h1><p>Review content, scoring rules, tests, access, and discovery updates from one calm workspace.</p></div>
        <QuestionForm />
      </header>
      <section className="admin-stats">
        <div><small>QUESTIONS</small><strong>{questions.length}</strong><span>Draft and published bank</span></div>
        <div><small>TESTS</small><strong>{tests.length}</strong><span>Publishing queue</span></div>
        <div><small>RULE PROFILES</small><strong>{rules.length}</strong><span>Versioned scoring</span></div>
        <div><small>NOTIFICATIONS</small><strong>{notifications.length}</strong><span>Linked to practice</span></div>
      </section>
      <section className="admin-grid">
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><span className="kicker">QUESTION BANK</span><h2>Review queue</h2></div><Link href="/api/admin/questions">API →</Link></div>
          {questions.map((question) => <div className="admin-row" key={question.id}><span className={`status-dot ${question.status.toLowerCase().replace(" ", "-")}`} /><div><strong>{question.stem}</strong><small>{question.exam} · {question.subject} · {question.topic}</small></div><span className="status-label">{question.status}</span></div>)}
        </div>
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><span className="kicker">SCORING RULES</span><h2>Published profiles</h2></div><div><Link href="/api/admin/rules">API →</Link><RuleForm /></div></div>
          {rules.map((rule) => <div className="rule-admin-row" key={rule.id}><div><strong>{rule.exam}</strong><small>Version {rule.version} · {rule.options} options</small></div><span>{rule.correctMarks} / {rule.wrongMarks}</span></div>)}
        </div>
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><span className="kicker">TEST BUILDER</span><h2>Publishing queue</h2></div><div><Link href="/api/admin/tests">API →</Link><TestForm rules={rules} /></div></div>
          {tests.map((test) => <div className="admin-row" key={test.id}><span className="test-admin-icon">▣</span><div><strong>{test.name}</strong><small>{test.exam} · {test.questions} questions · {test.access}</small></div><span className="status-label">{test.status}</span></div>)}
        </div>
        <div className="admin-panel">
          <div className="admin-panel-heading"><div><span className="kicker">COMMERCE & DISCOVERY</span><h2>Launch controls</h2></div></div>
          <div className="control-links"><Link href="/plans"><strong>{plans.length} plans</strong><small>Entitlements & pricing</small><b>→</b></Link><Link href="/notifications"><strong>{notifications.length} notifications</strong><small>Official links & exam CTAs</small><b>→</b></Link><Link href="/api/search?q=bpsc"><strong>Unified search</strong><small>Exams, tests, questions</small><b>→</b></Link><Link href="/api/admin/audit"><strong>Audit activity</strong><small>Operator action history</small><b>→</b></Link></div>
        </div>
      </section>
    </main>
  );
}
