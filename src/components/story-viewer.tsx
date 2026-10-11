"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Heart, Send, Trash2, X } from "lucide-react";
import { Avatar, Sheet } from "@/components/ui";
import { ago, api, toast } from "@/lib/client";

type Item = { id: string; type: "IMAGE" | "VIDEO"; mediaUrl: string; posterUrl: string | null; caption: string; createdAt: string; liked: boolean; viewCount: number };
export type StoryGroup = { user: { id: string; username: string; name: string; avatarUrl: string | null }; items: Item[]; unseen: boolean };
type Viewer = { user: { username: string; name: string; avatarUrl: string | null }; liked: boolean };

export function StoryViewer({ groups, start, me, onClose }: { groups: StoryGroup[]; start: number; me: string | null; onClose: () => void }) {
  const [gi, setGi] = useState(start);
  const [ii, setIi] = useState(0);
  const [pct, setPct] = useState(0);
  const [reply, setReply] = useState("");
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const hold = useRef(false);
  const g = groups[gi];
  const item = g?.items[ii];
  const own = g?.user.id === me;

  const next = useCallback(() => {
    setPct(0);
    if (ii < g.items.length - 1) setIi(ii + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setIi(0); }
    else onClose();
  }, [ii, gi, g, groups.length, onClose]);
  const prev = () => { setPct(0); if (ii > 0) setIi(ii - 1); else if (gi > 0) { setGi(gi - 1); setIi(0); } };

  useEffect(() => {
    if (!item) return;
    if (!own) api(`/api/stories/${item.id}`, { body: {} }).catch(() => {});
    if (item.type === "VIDEO") return;
    const t = setInterval(() => { if (!hold.current) setPct((p) => Math.min(100, p + 2)); }, 100);
    return () => clearInterval(t);
  }, [item, own]);
  useEffect(() => { if (pct >= 100) next(); }, [pct, next]);

  if (!item) return null;
  const isLiked = liked[item.id] ?? item.liked;

  async function like() {
    setLiked((l) => ({ ...l, [item.id]: !isLiked }));
    await api(`/api/stories/${item.id}`, { body: { like: !isLiked } }).catch(() => {});
  }
  async function sendReply() {
    if (!reply.trim()) return;
    try {
      await api("/api/messages", { body: { username: g.user.username, body: `↩ Story reply: ${reply}` } });
      setReply(""); toast("Reply sent");
    } catch (e) { toast((e as Error).message); }
  }
  async function showViewers() {
    hold.current = true;
    const d = await api<{ views: Viewer[] }>(`/api/stories/${item.id}`);
    setViewers(d.views);
  }
  async function remove() {
    if (!confirm("Delete this story?")) return;
    await api(`/api/stories/${item.id}`, { method: "DELETE" });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "grid", placeItems: "center", pointerEvents: "auto" }}>
      <div style={{ position: "relative", height: "100dvh", aspectRatio: "9 / 16", maxWidth: "100vw", background: "#111" }}
        onPointerDown={() => (hold.current = true)} onPointerUp={() => (hold.current = false)}>
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 4, zIndex: 3 }}>
          {g.items.map((it, i) => <div key={it.id} style={{ flex: 1, height: 3, borderRadius: 3, background: "#fff4", overflow: "hidden" }}><div style={{ height: "100%", background: "#fff", width: i < ii ? "100%" : i === ii ? `${pct}%` : 0 }} /></div>)}
        </div>
        <div className="row between" style={{ position: "absolute", top: 22, left: 12, right: 12, zIndex: 3 }}>
          <div className="row" style={{ gap: 8 }}><Avatar src={g.user.avatarUrl} name={g.user.name} size={34} /><b>{g.user.username}</b><span className="muted" style={{ fontSize: 12 }}>{ago(item.createdAt)}</span></div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {item.type === "IMAGE"
          ? <img src={item.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <video key={item.id} src={item.mediaUrl} poster={item.posterUrl ?? undefined} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onTimeUpdate={(e) => setPct(e.currentTarget.duration ? (e.currentTarget.currentTime / e.currentTarget.duration) * 100 : 0)} onEnded={next} />}
        <button aria-label="Previous" onClick={prev} style={{ position: "absolute", left: 0, top: 80, bottom: 90, width: "30%" }} />
        <button aria-label="Next" onClick={next} style={{ position: "absolute", right: 0, top: 80, bottom: 90, width: "40%" }} />
        {item.caption && <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, textAlign: "center", padding: "8px 16px", background: "#0007", fontWeight: 600 }}>{item.caption}</div>}
        <div className="row" style={{ position: "absolute", bottom: 20, left: 12, right: 12, zIndex: 3 }}>
          {own ? (
            <>
              <button className="btn btn-sm" onClick={showViewers}><Eye size={16} />{item.viewCount} viewers</button>
              <button className="btn btn-sm btn-danger" onClick={remove} style={{ marginLeft: "auto" }}><Trash2 size={16} />Delete</button>
            </>
          ) : (
            <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); sendReply(); }}>
              <input className="input" placeholder={`Reply to ${g.user.username}…`} value={reply} onFocus={() => (hold.current = true)} onBlur={() => (hold.current = false)} onChange={(e) => setReply(e.target.value)} />
              <button type="button" onClick={like} aria-label="Like story" style={{ color: isLiked ? "var(--rose)" : "#fff" }}><Heart fill={isLiked ? "currentColor" : "none"} /></button>
              <button aria-label="Send"><Send /></button>
            </form>
          )}
        </div>
      </div>
      {viewers && (
        <Sheet title="Viewers" onClose={() => { setViewers(null); hold.current = false; }}>
          {viewers.length === 0 ? <div className="muted">No views yet</div> : viewers.map((v) => (
            <div key={v.user.username} className="row" style={{ padding: "8px 0" }}><Avatar src={v.user.avatarUrl} name={v.user.name} size={36} /><b>{v.user.username}</b>{v.liked && <Heart size={14} fill="var(--rose)" color="var(--rose)" style={{ marginLeft: "auto" }} />}</div>
          ))}
        </Sheet>
      )}
    </div>
  );
}
