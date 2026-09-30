"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RuleForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch("/api/admin/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, options: Number(body.options), correctMarks: Number(body.correctMarks), wrongMarks: Number(body.wrongMarks), unansweredMarks: Number(body.unansweredMarks) }) });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(payload.error ?? "Unable to save rule."); return; }
    setMessage(`Draft rule ${payload.data.id} saved.`);
    router.refresh();
  }

  return <div className="admin-inline-form"><button className="admin-small-action" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "+ Rule profile"}</button>{open && <form onSubmit={submit}><div className="admin-form-grid"><label>Exam<select name="exam"><option>BPSC TRE 4.0</option><option>Bihar STET</option><option>CTET</option></select></label><label>Profile name<input name="name" required defaultValue="Draft marking profile" /></label><label>Options<select name="options"><option value="5">5 options</option><option value="4">4 options</option></select></label><label>Marks per correct<input name="correctMarks" type="number" step="0.01" min="0" defaultValue="1" required /></label><label>Penalty for wrong<input name="wrongMarks" type="number" step="0.01" min="0" defaultValue="0" required /></label><label>Penalty for omitted<input name="unansweredMarks" type="number" step="0.01" min="0" defaultValue="0" required /></label><label>Official source URL<input name="source" type="url" placeholder="https://..." /></label><label>Effective date<input name="effectiveFrom" type="date" /></label></div><div className="admin-form-footer">{message && <span role="status">{message}</span>}<button className="admin-small-action" disabled={saving}>{saving ? "Saving..." : "Save draft rule"}</button></div></form>}</div>;
}
