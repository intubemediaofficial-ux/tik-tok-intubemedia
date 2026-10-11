import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { canMessage, findOrCreateDirect } from "@/lib/messaging";
import { publishUserEvent } from "@/lib/events";

export const POST = authed(async ({ request, user }) => {
  const input = z.object({ username: z.string().min(1), videoId: z.string().optional(), body: z.string().max(2000).optional() }).parse(await request.json());
  const target = await db.user.findUnique({ where: { username: input.username.toLowerCase() } });
  if (!target) return fail("User not found", 404);
  if (!(await canMessage(user.id, target.id))) return fail("This person isn't accepting messages from you.", 403);
  const conversationId = await findOrCreateDirect(user.id, target.id);
  if (input.videoId || input.body) {
    const message = await db.message.create({ data: { conversationId, senderId: user.id, type: input.videoId ? "VIDEO_SHARE" : "TEXT", videoId: input.videoId ?? null, body: input.body ?? "" } });
    await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    if (input.videoId) await db.video.updateMany({ where: { id: input.videoId }, data: { sharesCount: { increment: 1 } } });
    publishUserEvent(target.id, { type: "message", data: { conversationId, message: { ...message, sender: { username: user.username, avatarUrl: user.avatarUrl } } } });
  }
  return { conversationId };
});
