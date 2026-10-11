import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { publishLiveEvent } from "@/lib/events";
import { isBlockedEitherWay } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const { body } = z.object({ body: z.string().trim().min(1).max(300) }).parse(await request.json());
  const live = await db.liveStream.findUnique({ where: { id } });
  if (!live || live.status !== "LIVE") return fail("LIVE has ended.", 410);
  if (await isBlockedEitherWay(user.id, live.hostId)) return fail("Unavailable", 403);
  const comment = await db.liveComment.create({ data: { liveId: id, userId: user.id, body } });
  publishLiveEvent(id, { type: "comment", data: { id: comment.id, body, username: user.username, avatarUrl: user.avatarUrl } });
  return { ok: true };
});
