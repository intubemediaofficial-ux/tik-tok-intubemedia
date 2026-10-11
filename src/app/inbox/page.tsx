import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/security";
import { Avatar, Empty } from "@/components/ui";
import { InboxClient, RequestButtons } from "@/components/inbox-client";
import { timeAgo } from "@/lib/format";
import { publicUserSelect } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

const FILTERS: Record<string, string[] | null> = {
  all: null,
  likes: ["LIKE", "COMMENT_LIKE"],
  comments: ["COMMENT", "REPLY"],
  mentions: ["MENTION"],
  followers: ["FOLLOW", "FOLLOW_ACCEPT", "FOLLOW_REQUEST"],
  gifts: ["GIFT"],
  system: ["SYSTEM", "LIVE", "DUET", "STITCH", "REPOST"],
};

const VERB: Record<string, string> = {
  LIKE: "liked your video", COMMENT: "commented:", REPLY: "replied to your comment:", COMMENT_LIKE: "liked your comment:", FOLLOW: "started following you",
  FOLLOW_REQUEST: "requested to follow you", FOLLOW_ACCEPT: "accepted your follow request", MENTION: "mentioned you:", REPOST: "reposted your video",
  DUET: "made a duet with your video", STITCH: "stitched your video", GIFT: "", LIVE: "", SYSTEM: "",
};

export default async function Inbox({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?next=/inbox");
  const { f = "all" } = await searchParams;
  const types = FILTERS[f] ?? null;
  const [items, requests] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id, ...(types ? { type: { in: types as never } } : {}) }, include: { actor: { select: publicUserSelect } }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.follow.findMany({ where: { followingId: user.id, status: "PENDING" }, include: { follower: { select: publicUserSelect } }, orderBy: { createdAt: "desc" } }),
  ]);
  const videoIds = [...new Set(items.map((i) => i.videoId).filter(Boolean))] as string[];
  const posters = new Map((await db.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, posterUrl: true, photoUrls: true } })).map((v) => [v.id, v.posterUrl ?? v.photoUrls[0]]));
  return (
    <div className="page page-narrow">
      <InboxClient />
      <h1 className="section-title" style={{ fontSize: 26 }}><Bell color="var(--amber)" />Activity</h1>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {Object.keys(FILTERS).map((k) => <Link key={k} href={k === "all" ? "/inbox" : `/inbox?f=${k}`} className={`chip ${f === k ? "on" : ""}`} style={{ textTransform: "capitalize" }}>{k}</Link>)}
      </div>
      {requests.length > 0 && (f === "all" || f === "followers") && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Follow requests · {requests.length}</div>
          {requests.map((r) => (
            <div key={r.followerId} className="row" style={{ padding: "6px 0" }}>
              <Link href={`/@${r.follower.username}`} className="row" style={{ flex: 1 }}><Avatar src={r.follower.avatarUrl} name={r.follower.name} size={40} /><span><b>{r.follower.username}</b><div className="muted" style={{ fontSize: 13 }}>{r.follower.name}</div></span></Link>
              <RequestButtons userId={r.followerId} />
            </div>
          ))}
        </div>
      )}
      {items.length === 0 ? <Empty icon={<Bell />} title="No activity yet" text="Likes, comments, new followers and gifts will show up here." /> : (
        <div className="card" style={{ padding: "4px 14px" }}>
          {items.map((n) => {
            const href = n.videoId ? `/v/${n.videoId}` : n.actor ? `/@${n.actor.username}` : "#";
            const poster = n.videoId ? posters.get(n.videoId) : null;
            return (
              <Link key={n.id} href={href} className="row" style={{ padding: "12px 0", borderBottom: "1px solid #221f33", background: n.read ? undefined : "linear-gradient(90deg, #ffb02010, transparent)" }}>
                {n.actor ? <Avatar src={n.actor.avatarUrl} name={n.actor.name} size={44} /> : <span className="logo-mark" style={{ width: 44, height: 44 }}>T</span>}
                <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  <b>{n.actor ? n.actor.username : "Thirak"}</b> {VERB[n.type]} <span style={{ color: "#d9d4f0" }}>{n.text}</span>
                  <div className="muted" style={{ fontSize: 12 }}>{timeAgo(n.createdAt)}</div>
                </div>
                {poster && <img src={poster} alt="" style={{ width: 44, height: 58, objectFit: "cover", borderRadius: 8 }} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
