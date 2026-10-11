import type { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { publishUserEvent } from "@/lib/events";

export async function notify(input: { userId: string; actorId?: string | null; type: NotificationType; videoId?: string | null; commentId?: string | null; text?: string | null }) {
  if (input.actorId && input.actorId === input.userId) return;
  await db.notification.create({ data: { userId: input.userId, actorId: input.actorId ?? null, type: input.type, videoId: input.videoId ?? null, commentId: input.commentId ?? null, text: input.text ?? null } });
  publishUserEvent(input.userId, { type: "notification", data: { type: input.type } });
}
