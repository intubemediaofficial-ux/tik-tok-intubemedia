import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { getCurrentUser } from "@/lib/security";
import { canViewVideo } from "@/lib/access";
import { notify } from "@/lib/notify";
import { publicUserSelect } from "@/lib/user-dto";
import { extractTagsAndMentions } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const commentSelect = {
  id: true, body: true, createdAt: true, pinned: true, parentId: true, authorId: true,
  author: { select: publicUserSelect },
  _count: { select: { likes: true, replies: true } },
} as const;

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const parentId = url.searchParams.get("parent");
  const user = await getCurrentUser();
  const video = await db.video.findUnique({ where: { id }, include: { author: { select: { isPrivate: true, status: true } } } });
  if (!video || !(await canViewVideo(user?.id, video))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db.comment.findMany({
    where: { videoId: id, hidden: false, parentId: parentId || null, author: { status: "ACTIVE" } },
    select: commentSelect,
    orderBy: parentId ? [{ createdAt: "asc" }] : [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const liked = user ? new Set((await db.commentLike.findMany({ where: { userId: user.id, commentId: { in: rows.map((r) => r.id) } } })).map((l) => l.commentId)) : new Set<string>();
  const creatorLiked = new Set((await db.commentLike.findMany({ where: { userId: video.authorId, commentId: { in: rows.map((r) => r.id) } } })).map((l) => l.commentId));
  return NextResponse.json({
    allowComments: video.allowComments,
    isAuthor: user?.id === video.authorId,
    comments: rows.map((r) => ({ ...r, likes: r._count.likes, replies: r._count.replies, liked: liked.has(r.id), byCreator: r.authorId === video.authorId, creatorLiked: creatorLiked.has(r.id) })),
  });
}

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const input = z.object({ body: z.string().trim().min(1, "Write a comment.").max(500), parentId: z.string().optional().nullable() }).parse(await request.json());
  const video = await db.video.findUnique({ where: { id }, include: { author: true } });
  if (!video || !(await canViewVideo(user.id, video))) return fail("Not found", 404);
  if (!video.allowComments) return fail("Comments are turned off.", 403);
  const filtered = video.author.commentFilter.some((word) => input.body.toLowerCase().includes(word.toLowerCase()));
  let parent = null;
  if (input.parentId) {
    parent = await db.comment.findFirst({ where: { id: input.parentId, videoId: id } });
    if (!parent) return fail("Comment not found", 404);
  }
  const rootId = parent?.parentId ?? parent?.id ?? null;
  const comment = await db.comment.create({ data: { videoId: id, authorId: user.id, body: input.body, parentId: rootId, hidden: filtered && user.id !== video.authorId }, select: commentSelect });
  if (!filtered) {
    await notify({ userId: video.authorId, actorId: user.id, type: "COMMENT", videoId: id, commentId: comment.id, text: input.body.slice(0, 200) });
    if (parent && parent.authorId !== video.authorId) await notify({ userId: parent.authorId, actorId: user.id, type: "REPLY", videoId: id, commentId: comment.id, text: input.body.slice(0, 200) });
    const { mentions } = extractTagsAndMentions(input.body);
    if (mentions.length) {
      const users = await db.user.findMany({ where: { username: { in: mentions } }, select: { id: true } });
      for (const u of users) await notify({ userId: u.id, actorId: user.id, type: "MENTION", videoId: id, commentId: comment.id, text: input.body.slice(0, 200) });
    }
  }
  return { comment: { ...comment, likes: 0, replies: 0, liked: false, byCreator: user.id === video.authorId, creatorLiked: false } };
});
