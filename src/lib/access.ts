import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function isBlockedEitherWay(a: string | null | undefined, b: string) {
  if (!a || a === b) return false;
  const block = await db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
  return Boolean(block);
}

export async function isFollowing(followerId: string | null | undefined, followingId: string) {
  if (!followerId) return false;
  if (followerId === followingId) return true;
  const follow = await db.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
  return follow?.status === "ACCEPTED";
}

export async function areFriends(a: string, b: string) {
  const count = await db.follow.count({
    where: { status: "ACCEPTED", OR: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] },
  });
  return count === 2;
}

export async function blockedIds(userId: string | null | undefined) {
  if (!userId) return [] as string[];
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
}

/** Prisma filter for videos a viewer may see in public listings. */
export async function visibleVideoWhere(viewerId: string | null | undefined): Promise<Prisma.VideoWhereInput> {
  const blocked = await blockedIds(viewerId);
  const base: Prisma.VideoWhereInput = {
    status: "READY",
    hidden: false,
    author: { status: "ACTIVE" },
    ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
  };
  if (!viewerId) return { ...base, visibility: "PUBLIC", author: { status: "ACTIVE", isPrivate: false } };
  const [following, followers] = await Promise.all([
    db.follow.findMany({ where: { followerId: viewerId, status: "ACCEPTED" }, select: { followingId: true } }),
    db.follow.findMany({ where: { followingId: viewerId, status: "ACCEPTED" }, select: { followerId: true } }),
  ]);
  const followingIds = following.map((f) => f.followingId);
  const followerSet = new Set(followers.map((f) => f.followerId));
  const friendIds = followingIds.filter((id) => followerSet.has(id));
  return {
    ...base,
    OR: [
      { authorId: viewerId },
      { visibility: "PUBLIC", author: { isPrivate: false } },
      { visibility: "PUBLIC", authorId: { in: followingIds } },
      { visibility: "FRIENDS", authorId: { in: friendIds } },
    ],
  };
}

export async function canViewVideo(viewerId: string | null | undefined, video: { authorId: string; visibility: string; hidden: boolean; status: string; author: { isPrivate: boolean; status: string } }) {
  if (viewerId === video.authorId) return true;
  if (video.hidden || video.status !== "READY" || video.author.status !== "ACTIVE") return false;
  if (viewerId && (await isBlockedEitherWay(viewerId, video.authorId))) return false;
  if (video.visibility === "PRIVATE") return false;
  if (video.visibility === "FRIENDS") return viewerId ? areFriends(viewerId, video.authorId) : false;
  if (video.author.isPrivate) return isFollowing(viewerId, video.authorId);
  return true;
}
