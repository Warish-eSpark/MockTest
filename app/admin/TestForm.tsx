"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { RuleProfile } from "../../lib/phase1";

export default function TestForm({ rules }: { rules: RuleProfile[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const response = await fetch("/api/admin/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, questionCount: Number(values.questionCount), durationMinutes: Number(values.durationMinutes) }) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(payload.error ?? "Unable to save test."); return; }
    setMessage(`Draft test ${payload.data.id} saved.`);
    router.refresh();
  }

  return <div className="admin-inline-form"><button className="admin-small-action" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "+ Build test"}</button>{open && <form onSubmit={submit}><div className="admin-form-grid"><label>Exam<select name="exam"><option>BPSC TRE 4.0</option><option>Bihar STET</option><option>CTET</option></select></label><label>Series name<input name="seriesName" required defaultValue="New practice series" /></label><label>Series slug<input name="seriesSlug" required defaultValue="new-practice-series" /></label><label>Test name<input name="name" required defaultValue="Full Mock 01" /></label><label>Type<select name="type"><option value="full">Full mock</option><option value="section">Section test</option><option value="subject">Subject test</option><option value="topic">Topic test</option><option value="mini">Mini test</option><option value="pyq">Previous year</option><option value="live">Live test</option></select></label><label>Rule profile<select name="ruleProfileId" required>{rules.map((rule) => <option value={rule.id} key={rule.id}>{rule.exam} · v{rule.version} · {rule.options} options</option>)}</select></label><label>Question count<input name="questionCount" type="number" min="1" defaultValue="50" required /></label><label>Duration (minutes)<input name="durationMinutes" type="number" min="1" defaultValue="50" required /></label><label>Access<select name="access"><option>Free</option><option>Premium</option></select></label></div><div className="admin-form-footer">{message && <span role="status">{message}</span>}<button className="admin-small-action" disabled={saving || rules.length === 0}>{saving ? "Saving..." : "Save draft test"}</button></div></form>}</div>;
}
