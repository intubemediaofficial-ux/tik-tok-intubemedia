"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, PenSquare, Send, Trash2, Play } from "lucide-react";
import { Avatar, Sheet } from "@/components/ui";
import { ago, api, toast } from "@/lib/client";

type Msg = { id: string; senderId: string; type: string; body: string; mediaUrl: string | null; videoId: string | null; deleted: boolean; createdAt: string };
type Other = { id: string; username: string; name: string; avatarUrl: string | null; isVerified: boolean };

export function Chat({ conversationId, me, other, otherLastRead }: { conversationId: string; me: string; other: Other; otherLastRead: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const router = useRouter();

  const load = useCallback(() => api<{ messages: Msg[] }>(`/api/messages/${conversationId}`).then((d) => setMsgs(d.messages)).catch(() => {}), [conversationId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length, typing]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const ev = (e as CustomEvent<{ type: string; data: { conversationId?: string; message?: Msg; messageId?: string } }>).detail;
      if (ev.data?.conversationId !== conversationId) return;
      if (ev.type === "message" && ev.data.message) { setTyping(false); setMsgs((m) => (m.some((x) => x.id === ev.data.message!.id) ? m : [...m, ev.data.message!])); load(); router.refresh(); }
      if (ev.type === "unsend") setMsgs((m) => m.map((x) => (x.id === ev.data.messageId ? { ...x, deleted: true } : x)));
      if (ev.type === "typing") { setTyping(true); clearTimeout(t); t = setTimeout(() => setTyping(false), 3000); }
    };
    window.addEventListener("app-event", on);
    return () => window.removeEventListener("app-event", on);
  }, [conversationId, load, router]);

  async function send(form?: FormData) {
    if (!form && !text.trim()) return;
    setBusy(true);
    try {
      const d = await api<{ message: Msg }>(`/api/messages/${conversationId}`, form ? { form } : { body: { body: text } });
      setMsgs((m) => [...m, d.message]);
      setText("");
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); api(`/api/messages/${conversationId}/typing`, { body: {} }).catch(() => {}); }
  }
  async function unsend(id: string) {
    if (!confirm("Unsend this message?")) return;
    await api(`/api/messages/${conversationId}`, { method: "DELETE", body: { messageId: id } });
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, deleted: true } : x)));
  }
  const lastMine = [...msgs].reverse().find((m) => m.senderId === me);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "calc(100dvh - 60px)" }}>
      <div className="row" style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
        <Link href="/messages" aria-label="Back"><ArrowLeft /></Link>
        <Link href={`/@${other.username}`} className="row"><Avatar src={other.avatarUrl} name={other.name} size={42} /><span><b>{other.name}</b><div className="muted" style={{ fontSize: 12 }}>@{other.username}</div></span></Link>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        {msgs.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className="row" style={{ alignSelf: mine ? "flex-end" : "flex-start", gap: 6, maxWidth: "100%", flexDirection: mine ? "row-reverse" : "row" }}>
              <div className={`bubble ${mine ? "me" : "them"}`} style={m.deleted ? { opacity: 0.6, fontStyle: "italic", background: "var(--panel-2)", color: "var(--muted)" } : m.type === "IMAGE" || m.type === "VIDEO_SHARE" ? { padding: 4, background: "var(--panel-2)" } : undefined} title={ago(m.createdAt)}>
                {m.deleted ? "Message unsent" : m.type === "IMAGE" && m.mediaUrl ? <img src={m.mediaUrl} alt="" style={{ maxWidth: 240, borderRadius: 14, display: "block" }} />
                  : m.type === "VIDEO_SHARE" && m.videoId ? <Link href={`/v/${m.videoId}`} className="row" style={{ padding: "8px 10px", color: "#fff" }}><Play size={18} />Shared a video — tap to watch</Link>
                  : m.body}
              </div>
              {mine && !m.deleted && <button onClick={() => unsend(m.id)} className="muted" aria-label="Unsend"><Trash2 size={13} /></button>}
            </div>
          );
        })}
        {lastMine && new Date(otherLastRead) >= new Date(lastMine.createdAt) && <div className="muted" style={{ alignSelf: "flex-end", fontSize: 11 }}>Seen</div>}
        {typing && <div className="bubble them muted">typing…</div>}
        <div ref={end} />
      </div>
      <form className="row" style={{ padding: 12, borderTop: "1px solid var(--line)" }} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.set("file", f); send(fd); } e.target.value = ""; }} />
        <button type="button" className="btn" onClick={() => file.current?.click()} aria-label="Send photo"><ImagePlus size={18} /></button>
        <input className="input" placeholder="Message…" value={text} onChange={(e) => onType(e.target.value)} maxLength={2000} />
        <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </div>
  );
}

export function NewMessage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Other[]>([]);
  const router = useRouter();
  useEffect(() => {
    if (!q.trim()) { setUsers([]); return; }
    const t = setTimeout(() => api<{ users: Other[] }>(`/api/search?q=${encodeURIComponent(q)}&limit=10`).then((d) => setUsers(d.users)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function start(u: Other) {
    try {
      const d = await api<{ conversationId: string }>("/api/messages", { body: { username: u.username } });
      router.push(`/messages/${d.conversationId}`);
    } catch (e) { toast((e as Error).message); }
  }
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)} aria-label="New message"><PenSquare size={16} /></button>
      {open && (
        <Sheet title="New message" onClose={() => setOpen(false)}>
          <input className="input" autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          {users.map((u) => <button key={u.id} onClick={() => start(u)} className="row" style={{ padding: "10px 0", width: "100%", textAlign: "left" }}><Avatar src={u.avatarUrl} name={u.name} size={40} /><span><b>{u.username}</b><div className="muted" style={{ fontSize: 13 }}>{u.name}</div></span></button>)}
        </Sheet>
      )}
    </>
  );
}
