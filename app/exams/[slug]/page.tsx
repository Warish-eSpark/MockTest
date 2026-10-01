import Link from "next/link";
import { fallbackExamDetails } from "../../../lib/catalog";
import { syllabusTracks } from "../../../lib/syllabus";
import { listMockTests, listSubjectRequests } from "../../../lib/admin-content";
import ExamTrackExplorer from "./ExamTrackExplorer";

export function generateStaticParams() {
  return Object.keys(fallbackExamDetails).map((slug) => ({ slug }));
}

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = fallbackExamDetails[slug];
  const tracks = syllabusTracks[slug] ?? [];
  if (!exam) {
    return (
      <main className="simple-page">
        <p>Exam not found.</p>
        <Link href="/">Return home</Link>
      </main>
    );
  }

  // Load published tests and learner demands for this exam
  const [initialTests, initialRequests] = await Promise.all([
    listMockTests({ examSlug: slug, status: "Published" }),
    listSubjectRequests(slug),
  ]);

  return (
    <main className="detail-page">
      <nav className="detail-nav">
        <Link className="logo" href="/">
          <span className="logo-mark">N</span>
          <span>northstar<span className="logo-dot">.</span></span>
        </Link>
        <Link className="back-link" href="/exams">
          ← Back to exam directory
        </Link>
      </nav>

      <section className={`exam-hero ${exam.tone}`}>
        <div>
          <span className="exam-badge">{exam.badge}</span>
          <p className="kicker">INDIA · TEACHING · EXAM SERIES</p>
          <h1>{exam.title}</h1>
          <p className="detail-lede">{exam.description}</p>
          <div className="hero-actions">
            <a className="dark-button" href="#series">
              Explore test series <span>↓</span>
            </a>
            <span className="trust-note">✓ Taxonomy mapped to the current structure</span>
          </div>
        </div>
        <div className="detail-symbol">{exam.symbol}</div>
      </section>

      <section className="detail-content">
        <div className="detail-main">
          <div className="section-heading detail-heading">
            <div>
              <span className="kicker">CHOOSE YOUR LEVEL</span>
              <h2>
                Practice mapped<br />
                <em>to your syllabus.</em>
              </h2>
            </div>
            <span className="series-count">{tracks.length} learning tracks</span>
          </div>

          {/* Interactive Exam Track Explorer with Subject Spotlights and Demand Request */}
          <ExamTrackExplorer
            tracks={tracks}
            initialTests={initialTests}
            initialRequests={initialRequests}
            examSlug={slug}
            examTitle={exam.title}
            examTone={exam.tone}
          />
        </div>

        <aside className="rule-card">
          <span className="kicker">EXAM SNAPSHOT</span>
          <h2>
            Know the rules<br />
            <em>before you begin.</em>
          </h2>
          <div className="rule-grid">
            <div>
              <small>QUESTIONS</small>
              <strong>{exam.questionCount}</strong>
            </div>
            <div>
              <small>DURATION</small>
              <strong>{exam.duration}</strong>
            </div>
            <div>
              <small>CORRECT</small>
              <strong>{exam.correctMarks}</strong>
            </div>
            <div>
              <small>WRONG</small>
              <strong>{exam.wrongMarks}</strong>
            </div>
          </div>
          <div className="option-note">
            <span>◉</span>
            <p>
              <strong>{exam.optionCount}-option format</strong>
              <br />
              All configured answer choices are shown consistently on desktop and mobile.
            </p>
          </div>
        </aside>
      </section>

      <footer className="detail-footer">
        <Link href="/">
          northstar<span>.</span>
        </Link>
        <span>Practice with purpose. Perform with confidence.</span>
      </footer>
    </main>
  );
}
