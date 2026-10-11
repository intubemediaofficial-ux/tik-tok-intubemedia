"use client";

import { useRouter } from "next/navigation";
import { Pin, Trash2, Send } from "lucide-react";
import { api, toast } from "@/lib/client";

export function StudioRowActions({ id, pinned, status, visibility }: { id: string; pinned: boolean; status: string; visibility: string }) {
  const router = useRouter();
  async function patch(body: Record<string, unknown>) {
    try { await api(`/api/videos/${id}`, { method: "PATCH", body }); router.refresh(); } catch (e) { toast((e as Error).message); }
  }
  async function remove() {
    if (!confirm("Delete this video permanently?")) return;
    await api(`/api/videos/${id}`, { method: "DELETE" }); router.refresh();
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      {status === "DRAFT" && <button className="btn btn-sm btn-primary" onClick={() => patch({ publish: true })}><Send size={13} />Publish</button>}
      {status === "READY" && <button className="btn btn-sm" title={pinned ? "Unpin" : "Pin to profile"} onClick={() => patch({ pinned: !pinned })} style={pinned ? { color: "var(--amber)" } : undefined}><Pin size={13} /></button>}
      <select className="input" style={{ height: 34, width: 110, fontSize: 13 }} value={visibility} onChange={(e) => patch({ visibility: e.target.value })}><option value="PUBLIC">Everyone</option><option value="FRIENDS">Friends</option><option value="PRIVATE">Only me</option></select>
      <button className="btn btn-sm btn-danger" onClick={remove} aria-label="Delete"><Trash2 size={13} /></button>
    </div>
  );
}
