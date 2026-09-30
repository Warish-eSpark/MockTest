"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, email, password }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Something went wrong."); setLoading(false); return; }
    window.location.href = payload.user?.role === "admin" ? "/admin" : "/dashboard";
  }

  return <main className="auth-page"><div className="auth-art"><Link className="logo" href="/"><span className="logo-mark">N</span><span>northstar<span className="logo-dot">.</span></span></Link><div className="auth-quote"><span>✦</span><h2>Make every<br /><em>attempt count.</em></h2><p>Clear practice. Honest progress. A calmer way to prepare.</p></div><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /></div><section className="auth-panel"><Link className="auth-back" href="/">← Back to northstar</Link><div className="auth-heading"><span className="kicker">{isRegister ? "WELCOME TO NORTHSTAR" : "WELCOME BACK"}</span><h1>{isRegister ? "Start with a clearer plan." : "Pick up where you left off."}</h1><p>{isRegister ? "Create your free account and begin with one focused test." : "Log in to continue your practice and keep your progress together."}</p></div><form onSubmit={submit}>{isRegister && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" autoComplete="name" required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "At least 8 characters" : "Your password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} required /></label>{error && <p className="auth-error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading ? "Please wait..." : isRegister ? "Create free account →" : "Log in →"}</button></form><p className="auth-switch">{isRegister ? "Already have an account?" : "New to northstar?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link></p><small className="auth-legal">By continuing, you agree to our terms and privacy policy.</small></section></main>;
}
