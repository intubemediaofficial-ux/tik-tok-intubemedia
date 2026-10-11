import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { isBlockedEitherWay } from "@/lib/access";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ username: string }> };

export const POST = authed<Ctx>(async ({ user, context }) => {
  const { username } = await context.params;
  const target = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target || target.status !== "ACTIVE") return fail("User not found", 404);
  if (target.id === user.id) return fail("You can't follow yourself.");
  if (await isBlockedEitherWay(user.id, target.id)) return fail("Unavailable", 403);
  const key = { followerId_followingId: { followerId: user.id, followingId: target.id } };
  const existing = await db.follow.findUnique({ where: key });
  if (existing) {
    await db.follow.delete({ where: key });
    return { state: "none" };
  }
  const status = target.isPrivate ? "PENDING" : "ACCEPTED";
  await db.follow.create({ data: { followerId: user.id, followingId: target.id, status } });
  await notify({ userId: target.id, actorId: user.id, type: status === "PENDING" ? "FOLLOW_REQUEST" : "FOLLOW" });
  return { state: status === "PENDING" ? "requested" : "following" };
});

/** Remove a follower from your own followers list. */
export const DELETE = authed<Ctx>(async ({ user, context }) => {
  const { username } = await context.params;
  const target = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) return fail("User not found", 404);
  await db.follow.deleteMany({ where: { followerId: target.id, followingId: user.id } });
  return { ok: true };
});
