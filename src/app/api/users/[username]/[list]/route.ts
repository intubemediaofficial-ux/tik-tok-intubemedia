import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { isFollowing } from "@/lib/access";
import { publicUserSelect } from "@/lib/user-dto";

export async function GET(_request: Request, context: { params: Promise<{ username: string; list: string }> }) {
  const { username, list } = await context.params;
  const viewer = await getCurrentUser();
  const target = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target || target.status !== "ACTIVE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.isPrivate && viewer?.id !== target.id && !(await isFollowing(viewer?.id, target.id))) return NextResponse.json({ users: [], private: true });
  const rows = list === "followers"
    ? (await db.follow.findMany({ where: { followingId: target.id, status: "ACCEPTED" }, include: { follower: { select: publicUserSelect } }, orderBy: { createdAt: "desc" }, take: 500 })).map((r) => r.follower)
    : (await db.follow.findMany({ where: { followerId: target.id, status: "ACCEPTED" }, include: { following: { select: publicUserSelect } }, orderBy: { createdAt: "desc" }, take: 500 })).map((r) => r.following);
  const mine = viewer ? new Set((await db.follow.findMany({ where: { followerId: viewer.id, followingId: { in: rows.map((r) => r.id) } } })).map((f) => f.followingId)) : new Set();
  return NextResponse.json({ users: rows.map((u) => ({ ...u, following: mine.has(u.id), isSelf: u.id === viewer?.id })) });
}
