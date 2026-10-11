import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { notify } from "@/lib/notify";
import { publicUserSelect } from "@/lib/user-dto";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  const story = await db.story.findUnique({ where: { id } });
  if (!story || story.authorId !== user.id) return fail("Not found", 404);
  const views = await db.storyView.findMany({ where: { storyId: id }, include: { user: { select: publicUserSelect } }, orderBy: { createdAt: "desc" } });
  return { views };
});

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const { like } = (await request.json().catch(() => ({}))) as { like?: boolean };
  const story = await db.story.findUnique({ where: { id } });
  if (!story || story.expiresAt < new Date()) return fail("Story expired", 404);
  if (story.authorId === user.id) return { ok: true };
  const key = { storyId_userId: { storyId: id, userId: user.id } };
  await db.storyView.upsert({ where: key, create: { storyId: id, userId: user.id, liked: Boolean(like) }, update: like === undefined ? {} : { liked: like } });
  if (like) await notify({ userId: story.authorId, actorId: user.id, type: "LIKE", text: "liked your story" });
  return { ok: true };
});

export const DELETE = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  await db.story.deleteMany({ where: { id, authorId: user.id } });
  return { ok: true };
});
