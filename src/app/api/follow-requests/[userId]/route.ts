import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ userId: string }> };

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { userId } = await context.params;
  const { accept } = (await request.json()) as { accept?: boolean };
  const key = { followerId_followingId: { followerId: userId, followingId: user.id } };
  const req = await db.follow.findUnique({ where: key });
  if (!req || req.status !== "PENDING") return fail("Request not found", 404);
  if (accept) {
    await db.follow.update({ where: key, data: { status: "ACCEPTED" } });
    await notify({ userId, actorId: user.id, type: "FOLLOW_ACCEPT" });
  } else await db.follow.delete({ where: key });
  await db.notification.deleteMany({ where: { userId: user.id, actorId: userId, type: "FOLLOW_REQUEST" } });
  return { ok: true };
});
