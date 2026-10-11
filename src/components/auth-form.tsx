"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { appName } from "@/lib/format";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ identity: "", email: "", name: "", username: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const body = mode === "login" ? { identity: form.identity, password: form.password } : { email: form.email, name: form.name, username: form.username, password: form.password };
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    const next = params.get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ width: "min(400px, 100%)", display: "grid", gap: 14 }}>
      <Link href="/" className="row" style={{ marginBottom: 6 }}><span className="logo-mark">T</span><span className="brand" style={{ fontSize: 28 }}>{appName}</span></Link>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="muted" style={{ margin: "0 0 6px" }}>{mode === "login" ? "Log in to continue watching and creating." : "Join to post videos, follow creators and go LIVE."}</p>
      {mode === "login" ? (
        <div><label className="label">Email or username</label><input className="input" value={form.identity} onChange={set("identity")} autoComplete="username" required /></div>
      ) : (
        <>
          <div><label className="label">Full name</label><input className="input" value={form.name} onChange={set("name")} required maxLength={60} /></div>
          <div><label className="label">Username</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") })} required minLength={3} maxLength={30} placeholder="yourname" /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></div>
        </>
      )}
      <div>
        <label className="label">Password</label>
        <div style={{ position: "relative" }}>
          <input className="input" type={show ? "text" : "password"} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 8 : 1} style={{ paddingRight: 46 }} />
          <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: 12 }} className="muted" aria-label="Show password">{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" disabled={busy} style={{ height: 48 }}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>
        {mode === "login" ? <>New here? <Link href="/signup" className="grad-text" style={{ fontWeight: 800 }}>Create an account</Link></> : <>Already have an account? <Link href="/login" className="grad-text" style={{ fontWeight: 800 }}>Log in</Link></>}
      </p>
    </form>
  );
}

export function AuthArt() {
  return (
    <div className="auth-art">
      <div className="brand" style={{ fontSize: 64, lineHeight: 1, maxWidth: 520 }}>Every beat <span className="grad-text">moves</span> someone.</div>
      <p style={{ fontSize: 18, color: "#cfc9e8", maxWidth: 460, marginTop: 20 }}>Short videos, duets, stitches, trending sounds and real-time LIVE with gifts — made in India by Intube Media.</p>
      <div className="row" style={{ gap: 12, marginTop: 30, flexWrap: "wrap" }}>
        {["#ForYou", "🎵 Trending sounds", "🔴 LIVE", "🎁 Gifts", "✂️ Stitch", "🎭 Duet"].map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
    </div>
  );
}
