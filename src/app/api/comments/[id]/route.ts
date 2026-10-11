import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  const comment = await db.comment.findUnique({ where: { id }, include: { video: { select: { authorId: true, id: true } } } });
  if (!comment) return fail("Not found", 404);
  if (action === "pin") {
    if (comment.video.authorId !== user.id) return fail("Only the creator can pin.", 403);
    await db.comment.updateMany({ where: { videoId: comment.videoId, pinned: true }, data: { pinned: false } });
    if (!comment.pinned) await db.comment.update({ where: { id }, data: { pinned: true } });
    return { pinned: !comment.pinned };
  }
  const key = { userId_commentId: { userId: user.id, commentId: id } };
  if (await db.commentLike.findUnique({ where: key })) {
    await db.commentLike.delete({ where: key });
    return { liked: false, count: await db.commentLike.count({ where: { commentId: id } }) };
  }
  await db.commentLike.create({ data: { userId: user.id, commentId: id } });
  await notify({ userId: comment.authorId, actorId: user.id, type: "COMMENT_LIKE", videoId: comment.videoId, commentId: id, text: comment.body.slice(0, 120) });
  return { liked: true, count: await db.commentLike.count({ where: { commentId: id } }) };
});

export const DELETE = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  const comment = await db.comment.findUnique({ where: { id }, include: { video: { select: { authorId: true } } } });
  if (!comment) return fail("Not found", 404);
  if (comment.authorId !== user.id && comment.video.authorId !== user.id && user.role !== "ADMIN") return fail("Not allowed", 403);
  await db.comment.delete({ where: { id } });
  return { ok: true };
});
