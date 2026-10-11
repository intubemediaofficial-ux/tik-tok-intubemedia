import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { endLive } from "@/lib/live";
import { notify } from "@/lib/notify";

export const POST = authed(async ({ request, user }) => {
  const { title } = z.object({ title: z.string().trim().min(1, "Add a title for your LIVE.").max(120) }).parse(await request.json());
  const existing = await db.liveStream.findMany({ where: { hostId: user.id, status: "LIVE" } });
  for (const live of existing) await endLive(live.id);
  const live = await db.liveStream.create({ data: { hostId: user.id, title } });
  const followers = await db.follow.findMany({ where: { followingId: user.id, status: "ACCEPTED" }, select: { followerId: true }, take: 5000 });
  for (const f of followers) await notify({ userId: f.followerId, actorId: user.id, type: "LIVE", text: `is LIVE: ${title}`.slice(0, 300) });
  return { id: live.id };
});

export const DELETE = authed(async ({ request, user }) => {
  const { id } = z.object({ id: z.string() }).parse(await request.json());
  const live = await db.liveStream.findUnique({ where: { id } });
  if (!live || (live.hostId !== user.id && user.role !== "ADMIN")) return fail("Not found", 404);
  await endLive(id);
  return { ok: true };
});
