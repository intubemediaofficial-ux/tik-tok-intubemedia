import Link from "next/link";
import { Eye, Images, Pin, Lock, Users } from "lucide-react";
import { compact } from "@/lib/format";
import type { VideoDTO } from "@/lib/videos";

export function VideoGrid({ videos, showAuthor = false, empty }: { videos: VideoDTO[]; showAuthor?: boolean; empty?: React.ReactNode }) {
  if (!videos.length) return <>{empty ?? <div className="muted" style={{ padding: 30, textAlign: "center" }}>No videos yet</div>}</>;
  return (
    <div className="grid-videos">
      {videos.map((v) => (
        <Link key={v.id} href={`/v/${v.id}`} className="tile">
          {v.posterUrl || v.photoUrls[0] ? <img src={v.posterUrl ?? v.photoUrls[0]} alt={v.caption.slice(0, 80)} loading="lazy" /> : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }} className="muted">{v.status === "PROCESSING" ? "Processing…" : v.status}</div>}
          {v.pinned && <span className="flag" style={{ background: "var(--rose)" }}><Pin size={10} /> Pinned</span>}
          {!v.pinned && v.kind === "PHOTO" && <span className="flag"><Images size={11} /> {v.photoUrls.length}</span>}
          {!v.pinned && v.status !== "READY" && <span className="flag">{v.status === "DRAFT" ? "Draft" : v.status === "SCHEDULED" ? "Scheduled" : v.status === "FAILED" ? "Failed" : "Processing"}</span>}
          <div className="meta">
            {v.visibility === "PRIVATE" ? <Lock size={12} /> : v.visibility === "FRIENDS" ? <Users size={12} /> : <Eye size={13} />}{compact(v.counts.views)}
            {showAuthor && <span style={{ marginLeft: "auto", opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{v.author.username}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}
