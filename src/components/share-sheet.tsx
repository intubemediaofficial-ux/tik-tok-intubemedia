"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Repeat2, Send, Flag, EyeOff, Columns2, Scissors, Code } from "lucide-react";
import { Avatar, Sheet } from "@/components/ui";
import { api, toast } from "@/lib/client";
import type { VideoDTO } from "@/lib/videos";

type Friend = { id: string; username: string; name: string; avatarUrl: string | null };

export function ShareSheet({ video, me, onClose, onRepost, onHide }: { video: VideoDTO; me: string | null; onClose: () => void; onRepost: (v: boolean) => void; onHide?: () => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const url = typeof window !== "undefined" ? `${location.origin}/v/${video.id}` : "";

  useEffect(() => {
    if (me) api<{ users: Friend[] }>(`/api/users/${me}/following`).then((d) => setFriends(d.users.slice(0, 20))).catch(() => {});
  }, [me]);

  const counted = () => api(`/api/videos/${video.id}/share`, { body: {} }).catch(() => {});

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {});
    counted(); toast("Link copied");
  }
  async function native() {
    if (navigator.share) { await navigator.share({ title: video.caption || "Watch this", url }).catch(() => {}); counted(); }
    else copy();
  }
  async function sendTo(f: Friend) {
    try {
      await api("/api/messages", { body: { username: f.username, videoId: video.id } });
      setSent((s) => ({ ...s, [f.id]: true })); counted();
    } catch (e) { toast((e as Error).message); }
  }
  async function repost() {
    if (!me) return (location.href = "/login");
    try {
      const d = await api<{ reposted: boolean }>(`/api/videos/${video.id}/repost`, { body: {} });
      onRepost(d.reposted); toast(d.reposted ? "Reposted to your followers" : "Repost removed");
    } catch (e) { toast((e as Error).message); }
  }
  async function notInterested() {
    if (!me) return (location.href = "/login");
    await api(`/api/videos/${video.id}/not-interested`, { body: {} });
    toast("You'll see fewer videos like this"); onHide?.(); onClose();
  }
  async function report() {
    if (!me) return (location.href = "/login");
    const reason = prompt("Why are you reporting this video? (spam, nudity, violence, hate, copyright, other)");
    if (!reason) return;
    await api("/api/reports", { body: { targetType: "VIDEO", targetId: video.id, reason } });
    toast("Report submitted");
  }

  const actions = [
    { icon: Copy, label: "Copy link", on: copy },
    { icon: Send, label: "Share to…", on: native },
    { icon: Repeat2, label: video.viewer.reposted ? "Undo repost" : "Repost", on: repost },
    ...(video.kind === "VIDEO" && video.allowDownload ? [{ icon: Download, label: "Save video", on: () => { counted(); location.href = `/api/videos/${video.id}/download`; } }] : []),
    ...(video.kind === "VIDEO" && video.allowDuet ? [{ icon: Columns2, label: "Duet", on: () => (location.href = `/upload?duet=${video.id}`) }] : []),
    ...(video.kind === "VIDEO" && video.allowStitch ? [{ icon: Scissors, label: "Stitch", on: () => (location.href = `/upload?stitch=${video.id}`) }] : []),
    { icon: Code, label: "Embed", on: async () => { await navigator.clipboard.writeText(`<iframe src="${location.origin}/embed/${video.id}" width="340" height="600" frameborder="0" allowfullscreen></iframe>`).catch(() => {}); toast("Embed code copied"); } },
    { icon: EyeOff, label: "Not interested", on: notInterested },
    { icon: Flag, label: "Report", on: report },
  ];

  return (
    <Sheet title="Share" onClose={onClose}>
      {me && friends.length > 0 && (
        <>
          <div className="label">Send to</div>
          <div className="row scroll-thin" style={{ overflowX: "auto", gap: 16, paddingBottom: 12 }}>
            {friends.map((f) => (
              <button key={f.id} onClick={() => sendTo(f)} disabled={sent[f.id]} style={{ display: "grid", justifyItems: "center", gap: 4, width: 64, fontSize: 12 }}>
                <Avatar src={f.avatarUrl} name={f.name} size={52} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", width: 64, whiteSpace: "nowrap" }}>{sent[f.id] ? "Sent ✓" : f.username}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 10 }}>
        {actions.map((a) => (
          <button key={a.label} onClick={a.on} style={{ display: "grid", justifyItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 52, height: 52, borderRadius: 18, background: "var(--panel-2)", border: "1px solid var(--line)", display: "grid", placeItems: "center" }}><a.icon size={22} /></span>
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
