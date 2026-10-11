import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { publishLiveEvent } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const { count } = (await request.json().catch(() => ({}))) as { count?: number };
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  const live = await db.liveStream.findUnique({ where: { id } });
  if (!live || live.status !== "LIVE") return fail("LIVE has ended.", 410);
  const updated = await db.liveStream.update({ where: { id }, data: { likesCount: { increment: n } } });
  publishLiveEvent(id, { type: "likes", data: { total: updated.likesCount, username: user.username, n } });
  return { total: updated.likesCount };
});
