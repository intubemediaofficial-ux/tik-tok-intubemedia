import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { listConversations } from "@/lib/conversations";

export function ConversationList({ items, active }: { items: Awaited<ReturnType<typeof listConversations>>; active?: string }) {
  if (!items.length) return <div className="muted" style={{ padding: 24, textAlign: "center" }}><MessageCircle size={32} style={{ display: "block", margin: "0 auto 8px" }} />No messages yet. Open a profile and tap Message.</div>;
  return (
    <div>
      {items.map((c) => (
        <Link key={c.id} href={`/messages/${c.id}`} className="row" style={{ padding: "12px 14px", background: active === c.id ? "var(--panel-2)" : undefined, borderRadius: 14 }}>
          <Avatar src={c.other!.avatarUrl} name={c.other!.name} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row between"><b>{c.other!.name}</b><span className="muted" style={{ fontSize: 12 }}>{c.last ? timeAgo(c.last.createdAt) : ""}</span></div>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: c.unread ? 800 : 400, color: c.unread ? "#fff" : undefined }}>
                {!c.last ? "Say hi 👋" : c.last.deleted ? "Message unsent" : c.last.type === "IMAGE" ? "📷 Photo" : c.last.type === "VIDEO_SHARE" ? "🎬 Shared a video" : c.last.type === "GIFT" ? "🎁 Gift" : c.last.body}
              </span>
              {c.unread > 0 && <span className="badge" style={{ position: "static", background: "var(--rose)", borderRadius: 9, padding: "0 6px", fontSize: 11, fontWeight: 800 }}>{c.unread}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
