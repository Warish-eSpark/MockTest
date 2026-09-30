"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function QuestionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exam, setExam] = useState("BPSC TRE 4.0");
  const [subject, setSubject] = useState("General Studies");
  const [topic, setTopic] = useState("");
  const [stem, setStem] = useState("");
  const [options, setOptions] = useState(["", "", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const populated = options.map((text, index) => ({ text: text.trim(), correct: index === correctIndex })).filter((option) => option.text);
    if (populated.length < 2 || !populated.some((option) => option.correct)) {
      setMessage("Add at least two options and mark the correct answer.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam, subject, topic, stem, options: populated }) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(payload.error ?? "Unable to save question."); return; }
    setMessage(`Draft ${payload.data.id} saved.`);
    setStem("");
    setOptions(["", "", "", "", ""]);
    router.refresh();
  }

  return <div className="admin-question-tool"><button className="admin-action" onClick={() => setOpen((value) => !value)}>{open ? "Close question form" : "+ New question"}</button>{open && <form className="admin-question-form" onSubmit={submit}><div className="admin-form-grid"><label>Exam<select value={exam} onChange={(event) => setExam(event.target.value)}><option>BPSC TRE 4.0</option><option>Bihar STET</option><option>CTET</option></select></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} required /></label><label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Optional topic" /></label></div><label>Question<textarea value={stem} onChange={(event) => setStem(event.target.value)} required rows={3} /></label><fieldset><legend>Answer options</legend>{options.map((option, index) => <div className="admin-option-input" key={index}><input type="radio" name="correct-option" checked={correctIndex === index} onChange={() => setCorrectIndex(index)} aria-label={`Mark option ${String.fromCharCode(65 + index)} correct`} /><span>{String.fromCharCode(65 + index)}</span><input value={option} onChange={(event) => setOptions((current) => current.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} aria-label={`Option ${String.fromCharCode(65 + index)}`} placeholder={`Option ${String.fromCharCode(65 + index)}`} /></div>)}</fieldset><div className="admin-form-footer">{message && <span role="status">{message}</span>}<button className="admin-action" disabled={saving}>{saving ? "Saving..." : "Save draft question"}</button></div></form>}</div>;
}
