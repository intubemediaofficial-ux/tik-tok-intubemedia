import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { publishUserEvent } from "@/lib/events";
import { canMessage } from "@/lib/messaging";
import { processImage } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

async function membership(conversationId: string, userId: string) {
  return db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
}

export const GET = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  if (!(await membership(id, user.id))) return fail("Not found", 404);
  const after = new URL(request.url).searchParams.get("after");
  const messages = await db.message.findMany({
    where: { conversationId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { sender: { select: { username: true, avatarUrl: true } } },
  });
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, data: { lastReadAt: new Date() } });
  return { messages };
});

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  if (!(await membership(id, user.id))) return fail("Not found", 404);
  const others = await db.conversationMember.findMany({ where: { conversationId: id, userId: { not: user.id } } });
  for (const o of others) if (!(await canMessage(user.id, o.userId))) return fail("You can't message this person.", 403);
  let data: { type: "TEXT" | "IMAGE" | "VIDEO_SHARE"; body: string; mediaUrl?: string; videoId?: string };
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return fail("Choose an image.");
    const img = await processImage(Buffer.from(await file.arrayBuffer()), 1080).catch(() => null);
    if (!img) return fail("Unsupported image.", 415);
    data = { type: "IMAGE", body: "", mediaUrl: img.url };
  } else {
    const input = z.object({ body: z.string().max(2000).default(""), videoId: z.string().optional() }).parse(await request.json());
    if (!input.body.trim() && !input.videoId) return fail("Message is empty.");
    data = { type: input.videoId ? "VIDEO_SHARE" : "TEXT", body: input.body.trim(), videoId: input.videoId };
  }
  const message = await db.message.create({ data: { ...data, conversationId: id, senderId: user.id }, include: { sender: { select: { username: true, avatarUrl: true } } } });
  await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, data: { lastReadAt: new Date() } });
  for (const o of others) publishUserEvent(o.userId, { type: "message", data: { conversationId: id, message } });
  return { message };
});

export const DELETE = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const { messageId } = z.object({ messageId: z.string() }).parse(await request.json());
  const msg = await db.message.findFirst({ where: { id: messageId, conversationId: id, senderId: user.id } });
  if (!msg) return fail("Not found", 404);
  await db.message.update({ where: { id: messageId }, data: { deleted: true, body: "", mediaUrl: null, videoId: null } });
  const others = await db.conversationMember.findMany({ where: { conversationId: id, userId: { not: user.id } } });
  for (const o of others) publishUserEvent(o.userId, { type: "unsend", data: { conversationId: id, messageId } });
  return { ok: true };
});
