"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Pin, Trash2, Flag, Send } from "lucide-react";
import { Avatar, RichText, Sheet, UserName } from "@/components/ui";
import { ago, api, compactNum, toast } from "@/lib/client";

type C = { id: string; body: string; createdAt: string; pinned: boolean; parentId: string | null; authorId: string; author: { id: string; username: string; name: string; avatarUrl: string | null; isVerified: boolean }; likes: number; replies: number; liked: boolean; byCreator: boolean; creatorLiked: boolean };

export function CommentsSheet({ videoId, onClose, onCount, me }: { videoId: string; onClose: () => void; onCount?: (delta: number) => void; me: string | null }) {
  const [comments, setComments] = useState<C[] | null>(null);
  const [allow, setAllow] = useState(true);
  const [isAuthor, setIsAuthor] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<C | null>(null);
  const [replies, setReplies] = useState<Record<string, C[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ comments: C[]; allowComments: boolean; isAuthor: boolean }>(`/api/videos/${videoId}/comments`);
    setComments(d.comments); setAllow(d.allowComments); setIsAuthor(d.isAuthor);
  }, [videoId]);
  useEffect(() => { load().catch(() => setComments([])); }, [load]);

  async function loadReplies(id: string) {
    const d = await api<{ comments: C[] }>(`/api/videos/${videoId}/comments?parent=${id}`);
    setReplies((r) => ({ ...r, [id]: d.comments }));
  }

  async function send() {
    if (!me) return (location.href = "/login");
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { comment } = await api<{ comment: C }>(`/api/videos/${videoId}/comments`, { body: { body: text, parentId: replyTo?.id ?? null } });
      if (replyTo) {
        const root = replyTo.parentId ?? replyTo.id;
        setReplies((r) => ({ ...r, [root]: [...(r[root] ?? []), comment] }));
        setComments((cs) => cs?.map((c) => (c.id === root ? { ...c, replies: c.replies + 1 } : c)) ?? null);
      } else setComments((cs) => [comment, ...(cs ?? [])]);
      onCount?.(1);
      setText(""); setReplyTo(null);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }

  function patch(id: string, fn: (c: C) => C) {
    setComments((cs) => cs?.map((c) => (c.id === id ? fn(c) : c)) ?? null);
    setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map((c) => (c.id === id ? fn(c) : c))])));
  }

  async function like(c: C) {
    if (!me) return (location.href = "/login");
    const d = await api<{ liked: boolean; count: number }>(`/api/comments/${c.id}`, { body: { action: "like" } });
    patch(c.id, (x) => ({ ...x, liked: d.liked, likes: d.count }));
  }
  async function pin(c: C) {
    await api(`/api/comments/${c.id}`, { body: { action: "pin" } });
    load();
  }
  async function remove(c: C) {
    if (!confirm("Delete this comment?")) return;
    await api(`/api/comments/${c.id}`, { method: "DELETE" });
    setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
    setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.filter((x) => x.id !== c.id)])));
    onCount?.(-1);
  }
  async function report(c: C) {
    const reason = prompt("Why are you reporting this comment?");
    if (!reason) return;
    await api("/api/reports", { body: { targetType: "COMMENT", targetId: c.id, reason } });
    toast("Thanks, our team will review it.");
  }

  const row = (c: C, reply = false) => (
    <div key={c.id} className="row" style={{ alignItems: "flex-start", gap: 10, padding: "10px 0", marginLeft: reply ? 46 : 0 }}>
      <Avatar src={c.author.avatarUrl} name={c.author.name} size={reply ? 28 : 36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 6, fontSize: 13 }}>
          <UserName username={c.author.username} verified={c.author.isVerified} />
          {c.byCreator && <span className="chip" style={{ padding: "1px 8px", fontSize: 11 }}>Creator</span>}
          {c.pinned && <span className="muted row" style={{ gap: 3, fontSize: 12 }}><Pin size={12} />Pinned</span>}
        </div>
        <div style={{ margin: "3px 0", wordBreak: "break-word" }}><RichText text={c.body} /></div>
        <div className="row muted" style={{ gap: 14, fontSize: 12 }}>
          <span>{ago(c.createdAt)}</span>
          <button onClick={() => { setReplyTo(c); setText(`@${c.author.username} `); }}>Reply</button>
          {c.creatorLiked && !c.byCreator && <span style={{ color: "var(--rose)" }}>♥ by creator</span>}
          {isAuthor && !reply && <button onClick={() => pin(c)}>{c.pinned ? "Unpin" : "Pin"}</button>}
          {(isAuthor || me === c.author.username) ? <button onClick={() => remove(c)} aria-label="Delete"><Trash2 size={13} /></button> : me && <button onClick={() => report(c)} aria-label="Report"><Flag size={13} /></button>}
        </div>
        {!reply && c.replies > 0 && !replies[c.id] && <button className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }} onClick={() => loadReplies(c.id)}>— View {c.replies} {c.replies === 1 ? "reply" : "replies"}</button>}
      </div>
      <button onClick={() => like(c)} className="muted" style={{ display: "grid", justifyItems: "center", fontSize: 11, color: c.liked ? "var(--rose)" : undefined }}>
        <Heart size={16} fill={c.liked ? "currentColor" : "none"} />{compactNum(c.likes)}
      </button>
    </div>
  );

  return (
    <Sheet
      title={`${comments ? compactNum(comments.length) : ""} Comments`}
      onClose={onClose}
      footer={allow ? (
        <div>
          {replyTo && <div className="muted row between" style={{ fontSize: 12, marginBottom: 6 }}>Replying to @{replyTo.author.username}<button onClick={() => { setReplyTo(null); setText(""); }}>Cancel</button></div>}
          <form className="row" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" placeholder={me ? "Add a comment…" : "Log in to comment"} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Send"><Send size={18} /></button>
          </form>
        </div>
      ) : <div className="muted" style={{ textAlign: "center" }}>Comments are turned off</div>}
    >
      {comments === null ? <div className="muted">Loading…</div> : comments.length === 0 ? <div className="muted" style={{ textAlign: "center", padding: 30 }}>No comments yet. Start the conversation!</div> : comments.map((c) => (
        <div key={c.id}>{row(c)}{replies[c.id]?.map((r) => row(r, true))}</div>
      ))}
    </Sheet>
  );
}
