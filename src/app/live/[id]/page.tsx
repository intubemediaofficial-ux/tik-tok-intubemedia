import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { isBlockedEitherWay } from "@/lib/access";
import { LiveViewer } from "@/components/live-viewer";
import { publicUserSelect } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await db.liveStream.findUnique({ where: { id }, include: { host: { select: { username: true } } } });
  return { title: l ? `@${l.host.username} is LIVE: ${l.title}` : "LIVE" };
}

export default async function WatchLive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const live = await db.liveStream.findUnique({ where: { id }, include: { host: { select: publicUserSelect }, comments: { orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { username: true, avatarUrl: true } } } } } });
  if (!live || (await isBlockedEitherWay(user?.id, live.hostId))) notFound();
  const following = user ? Boolean(await db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: live.hostId } } })) : false;
  return (
    <LiveViewer
      live={{ id: live.id, title: live.title, status: live.status, likes: live.likesCount, host: live.host }}
      initialComments={live.comments.reverse().map((c) => ({ id: c.id, body: c.body, username: c.user.username, avatarUrl: c.user.avatarUrl }))}
      me={user?.username ?? null}
      following={following}
      isHost={user?.id === live.hostId}
    />
  );
}
