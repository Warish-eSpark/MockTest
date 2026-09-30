"use client";

import { useEffect, useState } from "react";
import type { AttemptQuestion } from "../../../lib/attempts";

type AttemptClientProps = { title: string; exam: string; durationSeconds: number; questions: AttemptQuestion[]; testSlug: string };

type ResponseState = "unanswered" | "answered" | "review" | "answered-review";

export default function AttemptClient({ title, exam, durationSeconds, questions, testSlug }: AttemptClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const reviewCount = reviewed.length;
  const correctCount = questions.filter((question) => answers[question.id] === question.correctIndex).length;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const getState = (question: AttemptQuestion): ResponseState => {
    const hasAnswer = answers[question.id] !== undefined;
    const isReviewed = reviewed.includes(question.id);
    if (hasAnswer && isReviewed) return "answered-review";
    if (isReviewed) return "review";
    if (hasAnswer) return "answered";
    return "unanswered";
  };

  useEffect(() => {
    void fetch("/api/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testSlug }) })
      .then((response) => response.json())
      .then((payload) => setAttemptId(payload.data?.id ?? null));
  }, [testSlug]);

  useEffect(() => {
    if (submitted || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => setRemainingSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds, submitted]);

  useEffect(() => {
    if (remainingSeconds === 0 && attemptId) void fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" }).then(() => { window.location.href = `/results/${attemptId}`; });
  }, [remainingSeconds, attemptId]);

  const saveResponseToServer = (optionIndex: number | null, markForReview?: boolean) => { if (attemptId) void fetch(`/api/attempts/${attemptId}/responses`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: currentQuestion.id, optionIndex, markForReview }) }); };
  const selectAnswer = (optionIndex: number) => { setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex })); saveResponseToServer(optionIndex); };
  const toggleReview = () => { const nextReviewed = !reviewed.includes(currentQuestion.id); setReviewed((current) => nextReviewed ? [...current, currentQuestion.id] : current.filter((id) => id !== currentQuestion.id)); saveResponseToServer(answers[currentQuestion.id] ?? null, nextReviewed); };
  const clearAnswer = () => { setAnswers((current) => { const next = { ...current }; delete next[currentQuestion.id]; return next; }); saveResponseToServer(null); };
  const submitToServer = async () => { if (!attemptId) { setSubmitted(true); return; } await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" }); window.location.href = `/results/${attemptId}`; };

  if (submitted) return <main className="attempt-page"><nav className="attempt-nav"><span className="logo"><span className="logo-mark">N</span><span>northstar<span className="logo-dot">.</span></span></span><span className="attempt-status">Attempt submitted</span></nav><section className="result-card"><span className="result-icon">✓</span><span className="kicker">YOUR PRACTICE RESULT</span><h1>Good work. Now make it useful.</h1><p>Here is your first signal. Review the questions you missed and use the explanation to choose your next practice session.</p><div className="result-score"><strong>{Math.round((correctCount / questions.length) * 100)}%</strong><span>accuracy<br />{correctCount} of {questions.length} correct</span></div><div className="result-actions"><button onClick={() => { setSubmitted(false); setCurrentIndex(0); setRemainingSeconds(durationSeconds); }}>Review answers</button><a href={`/exams/bpsc-tre-4#series`}>Back to test series</a></div></section></main>;

  return <main className="attempt-page"><nav className="attempt-nav"><a className="logo" href="/"><span className="logo-mark">N</span><span>northstar<span className="logo-dot">.</span></span></a><div className="attempt-title"><strong>{title}</strong><small>{exam}</small></div><div className={`timer ${remainingSeconds < 300 ? "timer-warning" : ""}`}><span>◷</span>{formatTime(remainingSeconds)}</div></nav><div className="attempt-layout"><aside className="question-sidebar"><div className="sidebar-heading"><div><small>QUESTION PALETTE</small><strong>{currentIndex + 1} <span>/ {questions.length}</span></strong></div><span className="autosaved">● Saved</span></div><div className="palette">{questions.map((question, index) => <button className={`palette-button ${getState(question)} ${index === currentIndex ? "current" : ""}`} key={question.id} onClick={() => setCurrentIndex(index)} aria-label={`Question ${index + 1}, ${getState(question)}`}>{index + 1}</button>)}</div><div className="palette-legend"><span><i className="legend-dot answered-dot" />Answered</span><span><i className="legend-dot review-dot" />Review</span><span><i className="legend-dot unanswered-dot" />Unanswered</span></div><div className="attempt-summary"><small>SESSION SUMMARY</small><div><span>Answered</span><b>{answeredCount}</b></div><div><span>Review</span><b>{reviewCount}</b></div><div><span>Remaining</span><b>{questions.length - answeredCount}</b></div></div></aside><section className="question-panel"><div className="question-meta"><span>{currentQuestion.section}</span><span>Question {currentIndex + 1} of {questions.length}</span></div><h1>{currentQuestion.prompt}</h1><p className="question-note">Select one answer. Your response is saved automatically.</p><div className="answer-list">{currentQuestion.options.map((option, optionIndex) => <button className={`answer-option ${answers[currentQuestion.id] === optionIndex ? "selected" : ""}`} key={option} onClick={() => selectAnswer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>{answers[currentQuestion.id] === optionIndex && <i>✓</i>}</button>)}</div><div className="question-actions"><button className="quiet-button" onClick={clearAnswer}>Clear response</button><button className={`review-button ${reviewed.includes(currentQuestion.id) ? "active" : ""}`} onClick={toggleReview}>⚑ {reviewed.includes(currentQuestion.id) ? "Marked for review" : "Mark for review"}</button><div className="navigation-actions"><button disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>← Previous</button>{currentIndex === questions.length - 1 ? <button className="submit-button" onClick={submitToServer}>Submit test <span>→</span></button> : <button className="next-button" onClick={() => setCurrentIndex((index) => index + 1)}>Save & next <span>→</span></button>}</div></div></section></div></main>;
}
