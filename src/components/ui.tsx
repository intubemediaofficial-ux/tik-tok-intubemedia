"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, X } from "lucide-react";

export function Avatar({ src, name, size = 40, ring = false }: { src?: string | null; name: string; size?: number; ring?: boolean }) {
  const inner = src
    ? <img src={src} alt={name} className="avatar" style={{ width: size, height: size }} />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</span>;
  return ring ? <span className="ring" style={{ display: "inline-flex" }}>{inner}</span> : inner;
}

export function UserName({ username, verified, className = "" }: { username: string; verified?: boolean; className?: string }) {
  return (
    <Link href={`/@${username}`} className={`row ${className}`} style={{ gap: 4, display: "inline-flex", fontWeight: 800 }}>
      @{username}{verified && <BadgeCheck size={15} className="verified" />}
    </Link>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="row between" style={{ width: "100%", padding: "12px 0", textAlign: "left" }}>
      <span><span style={{ fontWeight: 700, display: "block" }}>{label}</span>{hint && <span className="muted" style={{ fontSize: 13 }}>{hint}</span>}</span>
      <span className={`toggle ${on ? "on" : ""}`} />
    </button>
  );
}

export function Sheet({ title, onClose, children, footer }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span>{title}</span><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="sheet-body scroll-thin">{children}</div>
        {footer && <div style={{ padding: 12, borderTop: "1px solid var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener("app-toast", on);
    return () => window.removeEventListener("app-toast", on);
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "48px 20px", textAlign: "center", display: "grid", justifyItems: "center", gap: 10 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--panel-2)", display: "grid", placeItems: "center", color: "var(--amber)" }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
      {text && <div className="muted" style={{ maxWidth: 380 }}>{text}</div>}
      {action}
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        const tag = part.match(/^#([\p{L}\p{N}_]{1,50})$/u);
        if (tag) return <Link key={i} href={`/tag/${encodeURIComponent(tag[1].toLowerCase())}`} style={{ fontWeight: 800, color: "#ffd27a" }}>{part}</Link>;
        const mention = part.match(/^@([a-z0-9._]{3,30})$/i);
        if (mention) return <Link key={i} href={`/@${mention[1].toLowerCase()}`} style={{ fontWeight: 800, color: "#ffd27a" }}>{part}</Link>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
