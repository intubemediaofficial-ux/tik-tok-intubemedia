import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Bookmark, Grid3x3, Heart, Link2, Lock, Repeat2, FileVideo } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { isBlockedEitherWay, isFollowing } from "@/lib/access";
import { listVideos, toDTOs, videoInclude } from "@/lib/videos";
import { VideoGrid } from "@/components/video-grid";
import { Avatar, Empty } from "@/components/ui";
import { ProfileActions, FollowCounts } from "@/components/profile-actions";
import { compact } from "@/lib/format";

export const dynamic = "force-dynamic";

async function findUser(username: string) {
  return db.user.findUnique({ where: { username: decodeURIComponent(username).toLowerCase().replace(/^@/, "") } });
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const u = await findUser(username);
  if (!u || u.status !== "ACTIVE") return { title: "User not found" };
  return { title: `${u.name} (@${u.username})`, description: u.bio || `Watch ${u.name}'s videos`, alternates: { canonical: `/@${u.username}` }, openGraph: { images: u.avatarUrl ? [u.avatarUrl] : [] } };
}

export default async function Profile({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { username } = await params;
  const { tab = "videos" } = await searchParams;
  const viewer = await getCurrentUser();
  if (username === "me") redirect(viewer ? `/@${viewer.username}${tab !== "videos" ? `?tab=${tab}` : ""}` : "/login");
  const u = await findUser(username);
  if (!u || u.status !== "ACTIVE") notFound();
  const self = viewer?.id === u.id;
  if (!self && (await isBlockedEitherWay(viewer?.id, u.id))) {
    const iBlocked = viewer ? await db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: u.id } } }) : null;
    return <div className="page page-narrow"><Empty icon={<Lock />} title="Profile unavailable" text={iBlocked ? `You blocked @${u.username}.` : "This account isn't available."} action={iBlocked ? <ProfileActions username={u.username} userId={u.id} self={false} state="none" blocked isPrivate={u.isPrivate} /> : undefined} /></div>;
  }
  const follow = viewer && !self ? await db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: u.id } } }) : null;
  const followsMe = viewer && !self ? await isFollowing(u.id, viewer.id) : false;
  const canSee = self || !u.isPrivate || follow?.status === "ACCEPTED";
  const [followers, following, likes] = await Promise.all([
    db.follow.count({ where: { followingId: u.id, status: "ACCEPTED" } }),
    db.follow.count({ where: { followerId: u.id, status: "ACCEPTED" } }),
    db.like.count({ where: { video: { authorId: u.id } } }),
  ]);
  const tabs = [
    { key: "videos", label: "Videos", icon: Grid3x3 },
    { key: "reposts", label: "Reposts", icon: Repeat2 },
    ...(self || u.showLiked ? [{ key: "liked", label: "Liked", icon: Heart }] : []),
    ...(self ? [{ key: "favorites", label: "Favorites", icon: Bookmark }, { key: "drafts", label: "Drafts", icon: FileVideo }] : []),
  ];
  let videos = [] as Awaited<ReturnType<typeof listVideos>>;
  if (canSee) {
    if (tab === "reposts") videos = await listVideos({ reposts: { some: { userId: u.id } } }, viewer?.id, { take: 60 });
    else if (tab === "liked" && (self || u.showLiked)) videos = await listVideos({ likes: { some: { userId: u.id } } }, viewer?.id, { take: 60 });
    else if (tab === "favorites" && self) videos = await listVideos({ favorites: { some: { userId: u.id } } }, viewer?.id, { take: 60 });
    else if (tab === "drafts" && self) videos = await toDTOs(await db.video.findMany({ where: { authorId: u.id, status: { in: ["DRAFT", "SCHEDULED", "PROCESSING", "FAILED"] } }, include: videoInclude, orderBy: { createdAt: "desc" } }), viewer?.id);
    else videos = await listVideos({ authorId: u.id }, viewer?.id, { take: 90, orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }] });
  }
  if (viewer && !self) await db.profileView.create({ data: { viewerId: viewer.id, profileId: u.id } }).catch(() => {});
  const live = await db.liveStream.findFirst({ where: { hostId: u.id, status: "LIVE" } });
  return (
    <div className="page">
      <div className="row" style={{ gap: 26, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ position: "relative" }}>
          {live ? <Link href={`/live/${live.id}`} className="ring" style={{ display: "inline-flex", background: "var(--rose)" }}><Avatar src={u.avatarUrl} name={u.name} size={128} /></Link> : <Avatar src={u.avatarUrl} name={u.name} size={128} ring />}
          {live && <span className="live-badge" style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)" }}>LIVE</span>}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="row" style={{ margin: 0, fontSize: 28, gap: 8 }}>{u.username}{u.isVerified && <BadgeCheck className="verified" />}{u.isPrivate && <Lock size={18} className="muted" />}</h1>
          <div style={{ fontSize: 17, fontWeight: 600, margin: "2px 0 14px" }}>{u.name}</div>
          <ProfileActions username={u.username} userId={u.id} self={self} state={follow ? (follow.status === "ACCEPTED" ? "following" : "requested") : "none"} followsMe={followsMe} isPrivate={u.isPrivate} loggedIn={Boolean(viewer)} />
          <FollowCounts username={u.username} followers={followers} following={following} likes={compact(likes)} canSee={canSee} />
          {u.bio && <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 4px" }}>{u.bio}</p>}
          {u.website && <a href={u.website.startsWith("http") ? u.website : `https://${u.website}`} target="_blank" rel="noreferrer nofollow" className="row" style={{ gap: 6, fontWeight: 700, color: "#ffd27a" }}><Link2 size={15} />{u.website.replace(/^https?:\/\//, "")}</a>}
        </div>
      </div>
      {!canSee ? (
        <Empty icon={<Lock />} title="This account is private" text="Follow this account to see their videos and likes." />
      ) : (
        <>
          <div className="tabs" style={{ marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
            {tabs.map((t) => <Link key={t.key} href={`/@${u.username}${t.key === "videos" ? "" : `?tab=${t.key}`}`} className={`tab row ${tab === t.key ? "on" : ""}`} style={{ gap: 6 }}><t.icon size={16} />{t.label}</Link>)}
          </div>
          <VideoGrid videos={videos} empty={<Empty icon={<Grid3x3 />} title={tab === "videos" ? (self ? "Post your first video" : "No videos yet") : "Nothing here yet"} action={self && tab === "videos" ? <Link href="/upload" className="btn btn-primary">Create</Link> : undefined} />} />
        </>
      )}
    </div>
  );
}
