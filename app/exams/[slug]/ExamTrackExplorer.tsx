"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { ExamTrack, SubjectGroup } from "../../../lib/syllabus";
import type { MockTest, SubjectDemandRequest } from "../../../lib/admin-content";

interface ExamTrackExplorerProps {
  tracks: ExamTrack[];
  initialTests: MockTest[];
  initialRequests: SubjectDemandRequest[];
  examSlug: string;
  examTitle: string;
  examTone: string;
}

export default function ExamTrackExplorer({
  tracks,
  initialTests,
  initialRequests,
  examSlug,
  examTitle,
}: ExamTrackExplorerProps) {
  // Track & subject selection
  const [activeTrackSlug, setActiveTrackSlug] = useState<string>(tracks[0]?.slug ?? "");
  const [activeSubjectName, setActiveSubjectName] = useState<string>(
    tracks[0]?.subjects[0]?.name ?? ""
  );

  // Level filter: "all" or specific track slug
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // Demands state
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const r of initialRequests) {
      map[`${r.trackSlug}:${r.subjectName.toLowerCase()}`] = r.requestCount;
    }
    return map;
  });

  const [hasRequestedSet, setHasRequestedSet] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Refs for smooth scrolling to inline panel
  const inlinePanelRef = useRef<HTMLDivElement | null>(null);

  // Helper to find tests for a track & subject
  function getTestsFor(trackSlug: string, subjectName: string) {
    return initialTests.filter(
      (t) =>
        t.trackSlug === trackSlug &&
        t.subjectName.toLowerCase() === subjectName.toLowerCase() &&
        t.status === "Published"
    );
  }

  // Active tests
  const activeTests = getTestsFor(activeTrackSlug, activeSubjectName);

  // Active demand count
  const requestKey = `${activeTrackSlug}:${activeSubjectName.toLowerCase()}`;
  const currentDemandCount = requestCounts[requestKey] || 0;
  const alreadyRequested = hasRequestedSet.has(requestKey);

  // Handle raising a request
  async function handleRaiseRequest() {
    if (alreadyRequested || isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSlug,
          trackSlug: activeTrackSlug,
          subjectName: activeSubjectName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRequestCounts((prev) => ({
          ...prev,
          [requestKey]: data.requestCount ?? (prev[requestKey] || 0) + 1,
        }));
        setHasRequestedSet((prev) => new Set([...prev, requestKey]));
        setFeedback(
          `Request registered! Your vote for ${activeSubjectName} has been recorded with priority.`
        );
      }
    } catch {
      setFeedback("Unable to submit request right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectSubject(trackSlug: string, subjectName: string) {
    setActiveTrackSlug(trackSlug);
    setActiveSubjectName(subjectName);
    setFeedback(null);

    // Give React a frame to mount the inline panel, then smoothly scroll it into clear view
    setTimeout(() => {
      if (inlinePanelRef.current) {
        inlinePanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 60);
  }

  // Filtered tracks based on level filter
  const visibleTracks = tracks.filter((t) => {
    if (levelFilter === "all") return true;
    return t.slug === levelFilter;
  });

  return (
    <div className="exam-track-explorer">
      {/* Level Selection Bar */}
      <div className="track-level-filter-bar">
        <span className="level-filter-label">Quick Class Filter:</span>
        <button
          type="button"
          className={`level-pill-btn ${levelFilter === "all" ? "active" : ""}`}
          onClick={() => setLevelFilter("all")}
        >
          🌟 All Classes (1–12)
        </button>

        {tracks.map((t) => (
          <button
            type="button"
            className={`level-pill-btn ${levelFilter === t.slug ? "active" : ""}`}
            key={t.slug}
            onClick={() => {
              setLevelFilter(t.slug);
              if (activeTrackSlug !== t.slug) {
                setActiveTrackSlug(t.slug);
                if (t.subjects[0]) setActiveSubjectName(t.subjects[0].name);
              }
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Class Tracks List with CONTEXTUAL INLINE DETAILS */}
      <div className="track-detail-list">
        {visibleTracks.map((track) => {
          const isTrackSelected = track.slug === activeTrackSlug;

          return (
            <article
              className={`track-detail ${isTrackSelected ? "track-active" : ""}`}
              id={track.slug}
              key={track.slug}
            >
              <div className="track-detail-heading">
                <div>
                  <span className="track-label">{track.audience}</span>
                  <h3>{track.name}</h3>
                </div>
                <span className="track-groups-count">
                  {track.subjects.length} subject groups
                </span>
              </div>

              {/* Interactive Subject Pills */}
              <div className="subject-pills">
                {track.subjects.map((subject: SubjectGroup) => {
                  const isSubjectSelected =
                    isTrackSelected &&
                    activeSubjectName.toLowerCase() === subject.name.toLowerCase();
                  const availableForSub = getTestsFor(track.slug, subject.name);
                  const hasTests = availableForSub.length > 0;
                  const key = `${track.slug}:${subject.name.toLowerCase()}`;
                  const votes = requestCounts[key] || 0;

                  return (
                    <button
                      type="button"
                      className={`subject-pill interactive ${isSubjectSelected ? "active" : ""} ${hasTests ? "has-tests" : ""}`}
                      key={subject.name}
                      onClick={() => handleSelectSubject(track.slug, subject.name)}
                      aria-pressed={isSubjectSelected}
                    >
                      <div className="subject-pill-top">
                        <strong>{subject.name}</strong>
                        {hasTests ? (
                          <span className="live-pill-badge">
                            ● {availableForSub.length} Live
                          </span>
                        ) : votes > 0 ? (
                          <span className="demand-pill-badge">🔥 {votes}</span>
                        ) : (
                          <span className="soon-pill-badge">Request</span>
                        )}
                      </div>
                      <small>
                        {subject.topics.slice(0, 3).join(" · ")}
                        {subject.topics.length > 3 ? " · ..." : ""}
                      </small>
                      {isSubjectSelected && (
                        <span className="active-subject-caret" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* CONTEXTUAL INLINE SPOTLIGHT: RENDERED DIRECTLY UNDER THE CLICKED SUBJECT! */}
              {isTrackSelected && (
                <div
                  className="inline-subject-spotlight"
                  id={`spotlight-${track.slug}`}
                  ref={inlinePanelRef}
                >
                  <div className="spotlight-header">
                    <div>
                      <span className="spotlight-kicker">
                        {track.audience} · {activeSubjectName}
                      </span>
                      <h4 className="spotlight-title">
                        {activeSubjectName} <em>Practice Tests</em>
                      </h4>
                    </div>
                    <span className="spotlight-badge">
                      {activeTests.length > 0
                        ? `${activeTests.length} Mock Test${activeTests.length > 1 ? "s" : ""} Available`
                        : "In Development"}
                    </span>
                  </div>

                  {/* CASE 1: TESTS ARE AVAILABLE */}
                  {activeTests.length > 0 ? (
                    <div className="spotlight-tests-grid">
                      {activeTests.map((test) => (
                        <article className="series-card spotlight-card" key={test.slug}>
                          <div className="series-type">
                            {test.testType.toUpperCase()}
                            <span className={test.access === "Free" ? "free-pill" : "premium-pill"}>
                              {test.access}
                            </span>
                          </div>
                          <h3>{test.name}</h3>
                          <p>
                            {test.questionCount} questions <span>·</span> {test.durationMinutes} min{" "}
                            <span>·</span> {test.totalMarks} marks
                          </p>
                          {test.description && (
                            <p className="test-card-desc">{test.description}</p>
                          )}
                          <div className="spotlight-actions">
                            <Link className="start-test-action" href={`/tests/${test.slug}`}>
                              View Instructions <span>→</span>
                            </Link>
                            <Link className="start-test-action direct" href={`/attempt/${test.slug}`}>
                              Start Test Now <span>⚡</span>
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    /* CASE 2: NO TESTS AVAILABLE YET - SHOW "VERY SOON" & REQUEST BUTTON RIGHT HERE! */
                    <div className="spotlight-empty-state">
                      <div className="empty-icon-wrap">
                        <span className="empty-icon">⏳</span>
                      </div>

                      <div className="empty-copy">
                        <span className="empty-kicker">MOCK TEST IN CURATION</span>
                        <h4>Very soon your mock test will be here.</h4>
                        <p>
                          Our subject matter experts are currently authoring verified exam-pattern
                          mock tests for <strong>{activeSubjectName}</strong> ({track.audience})
                          aligned with the official {examTitle} syllabus.
                        </p>

                        <div className="demand-signal-box">
                          <span className="demand-fire">🔥</span>
                          <span>
                            {currentDemandCount > 0 ? (
                              <>
                                <strong>
                                  {currentDemandCount} learner{currentDemandCount > 1 ? "s" : ""}
                                </strong>{" "}
                                have requested this mock test. Highest requested tests are prioritized
                                for immediate publishing.
                              </>
                            ) : (
                              <>Be the first learner to request a mock test for this subject!</>
                            )}
                          </span>
                        </div>

                        {feedback && (
                          <div className="request-feedback-message">
                            ✓ {feedback}
                          </div>
                        )}

                        <div className="empty-actions">
                          {alreadyRequested ? (
                            <div className="btn-requested-status">
                              ✓ Request Registered! Prioritized in Admin Queue (#{currentDemandCount})
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-raise-request"
                              disabled={isSubmitting}
                              onClick={handleRaiseRequest}
                            >
                              {isSubmitting
                                ? "Registering Request..."
                                : "🙋‍♂️ Raise a Request to Provide Mock Test"}
                            </button>
                          )}
                        </div>
                        <small className="request-help-text">
                          Requests are reviewed systematically in the admin dashboard to decide what to build next.
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* RESTRUCTURED CATALOG: ALL AVAILABLE PUBLISHED TESTS (ZERO DUMMY DATA) */}
      <div className="section-heading detail-heading series-heading" id="series" style={{ marginTop: "60px" }}>
        <div>
          <span className="kicker">OFFICIAL PRACTICE CATALOG</span>
          <h2>
            Available Mock Tests<br />
            <em>ready for your attempt.</em>
          </h2>
        </div>
        <span className="series-count">
          {initialTests.filter((t) => t.status === "Published").length} live tests
        </span>
      </div>

      {initialTests.filter((t) => t.status === "Published").length === 0 ? (
        <div className="no-published-tests-banner">
          <p>
            No mock tests are currently published for this exam series yet. Select any subject above
            and click <strong>"Raise a Request to Provide Mock Test"</strong> so our team prioritizes
            it!
          </p>
        </div>
      ) : (
        <div className="series-list">
          {initialTests
            .filter((t) => t.status === "Published")
            .map((test) => (
              <article className="series-card" key={test.slug}>
                <div className="series-type">
                  {test.testType.toUpperCase()} · {test.subjectName.toUpperCase()}
                  <span className={test.access === "Free" ? "free-pill" : "premium-pill"}>
                    {test.access}
                  </span>
                </div>
                <h3>{test.name}</h3>
                <p>
                  {test.questionCount} questions <span>·</span> {test.durationMinutes} min{" "}
                  <span>·</span> {test.totalMarks} marks
                </p>
                {test.description && (
                  <p style={{ marginTop: "6px", color: "#74847e", fontSize: "13px", lineHeight: "1.5" }}>
                    {test.description}
                  </p>
                )}
                <Link className="series-action" href={`/tests/${test.slug}`}>
                  View instructions <span>→</span>
                </Link>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
