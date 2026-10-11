import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { canViewVideo } from "@/lib/access";
import { getCurrentUser } from "@/lib/security";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string; action: string }> };

async function loadVisible(id: string, userId: string | null | undefined) {
  const video = await db.video.findUnique({ where: { id }, include: { author: { select: { isPrivate: true, status: true } } } });
  if (!video || !(await canViewVideo(userId, video))) return null;
  return video;
}

async function publicAction(request: Request, context: Ctx) {
  const { id, action } = await context.params;
  const user = await getCurrentUser();
  const video = await loadVisible(id, user?.id);
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action === "view") {
    const body = await request.json().catch(() => ({}));
    const watchedMs = Math.max(0, Math.min(600_000, Number(body.watchedMs) || 0));
    await db.view.create({ data: { videoId: id, userId: user?.id ?? null, watchedMs, completed: Boolean(body.completed) } });
    await db.video.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }
  await db.video.update({ where: { id }, data: { sharesCount: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}

const toggles = authed<Ctx>(async ({ request, user, context }) => {
  const { id, action } = await context.params;
  const video = await loadVisible(id, user.id);
  if (!video) return fail("Not found", 404);
  const key = { userId_videoId: { userId: user.id, videoId: id } };
  switch (action) {
    case "like": {
      const existing = await db.like.findUnique({ where: key });
      if (existing) {
        await db.like.delete({ where: key });
        return { liked: false, count: await db.like.count({ where: { videoId: id } }) };
      }
      await db.like.create({ data: { userId: user.id, videoId: id } });
      await notify({ userId: video.authorId, actorId: user.id, type: "LIKE", videoId: id });
      return { liked: true, count: await db.like.count({ where: { videoId: id } }) };
    }
    case "favorite": {
      const body = await request.json().catch(() => ({}));
      const collectionId = z.string().optional().nullable().parse(body.collectionId);
      const existing = await db.favorite.findUnique({ where: key });
      if (existing && collectionId === undefined) {
        await db.favorite.delete({ where: key });
        return { favorited: false, count: await db.favorite.count({ where: { videoId: id } }) };
      }
      if (collectionId && !(await db.collection.findFirst({ where: { id: collectionId, userId: user.id } }))) return fail("Collection not found", 404);
      await db.favorite.upsert({ where: key, create: { userId: user.id, videoId: id, collectionId: collectionId ?? null }, update: { collectionId: collectionId ?? null } });
      return { favorited: true, count: await db.favorite.count({ where: { videoId: id } }) };
    }
    case "repost": {
      const existing = await db.repost.findUnique({ where: key });
      if (existing) {
        await db.repost.delete({ where: key });
        return { reposted: false };
      }
      if (video.visibility !== "PUBLIC") return fail("Only public videos can be reposted.");
      await db.repost.create({ data: { userId: user.id, videoId: id } });
      await notify({ userId: video.authorId, actorId: user.id, type: "REPOST", videoId: id });
      return { reposted: true };
    }
    case "not-interested": {
      await db.notInterested.upsert({ where: key, create: { userId: user.id, videoId: id }, update: {} });
      return { ok: true };
    }
    default:
      return fail("Unknown action", 404);
  }
});

export async function POST(request: Request, context: Ctx) {
  const { action } = await context.params;
  if (action === "view" || action === "share") return publicAction(request, context);
  return toggles(request, context);
}
