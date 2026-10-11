import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";

type Ctx = { params: Promise<{ username: string }> };

export const POST = authed<Ctx>(async ({ user, context }) => {
  const { username } = await context.params;
  const target = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target || target.id === user.id) return fail("User not found", 404);
  const key = { blockerId_blockedId: { blockerId: user.id, blockedId: target.id } };
  if (await db.block.findUnique({ where: key })) {
    await db.block.delete({ where: key });
    return { blocked: false };
  }
  await db.block.create({ data: { blockerId: user.id, blockedId: target.id } });
  await db.follow.deleteMany({ where: { OR: [{ followerId: user.id, followingId: target.id }, { followerId: target.id, followingId: user.id }] } });
  return { blocked: true };
});
