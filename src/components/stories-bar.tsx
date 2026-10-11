"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { StoryViewer, type StoryGroup } from "@/components/story-viewer";
import { api, toast } from "@/lib/client";

export function StoriesBar() {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api<{ me: string; groups: StoryGroup[] }>("/api/stories").then((d) => { setGroups(d.groups); setMe(d.me); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function upload(f: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", f);
      await api("/api/stories", { form });
      toast("Story posted for 24 hours");
      load();
    } catch (e) { toast((e as Error).message); } finally { setUploading(false); }
  }

  const mine = groups.find((g) => g.user.id === me);
  return (
    <div style={{ position: "absolute", top: 66, left: 0, right: 0, zIndex: 15, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div className="row scroll-thin" style={{ gap: 12, overflowX: "auto", padding: "6px 12px", maxWidth: 560, pointerEvents: "auto" }}>
        <input ref={file} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div style={{ display: "grid", justifyItems: "center", gap: 4, fontSize: 11, width: 60, position: "relative" }}>
          <button onClick={() => (mine ? setOpen(groups.indexOf(mine)) : file.current?.click())} className={mine ? "ring" : ""} style={{ display: "inline-flex", borderRadius: 99 }}>
            <span className="avatar" style={{ width: 52, height: 52, background: "var(--panel-2)", border: "2px dashed #4a4470", color: "var(--amber)" }}>{uploading ? "…" : mine ? "▶" : <Plus />}</span>
          </button>
          {mine && <button onClick={() => file.current?.click()} aria-label="Add story" style={{ position: "absolute", right: 0, top: 36, width: 20, height: 20, borderRadius: 99, background: "var(--rose)", display: "grid", placeItems: "center" }}><Plus size={13} /></button>}
          <span>Your story</span>
        </div>
        {groups.filter((g) => g.user.id !== me).map((g) => (
          <button key={g.user.id} onClick={() => setOpen(groups.indexOf(g))} style={{ display: "grid", justifyItems: "center", gap: 4, fontSize: 11, width: 60 }}>
            <span className={g.unseen ? "ring" : ""} style={{ display: "inline-flex", borderRadius: 99, border: g.unseen ? undefined : "2px solid var(--line)" }}><Avatar src={g.user.avatarUrl} name={g.user.name} size={52} /></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: 60 }}>{g.user.username}</span>
          </button>
        ))}
      </div>
      {open !== null && groups[open] && <StoryViewer groups={groups} start={open} me={me} onClose={() => { setOpen(null); load(); }} />}
    </div>
  );
}
