import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { getCurrentUser } from "@/lib/security";
import { canViewVideo } from "@/lib/access";
import { linkHashtagsAndMentions, toDTOs, videoInclude } from "@/lib/videos";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const video = await db.video.findUnique({ where: { id }, include: videoInclude });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (video.authorId !== user?.id && !(await canViewVideo(user?.id, video))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [dto] = await toDTOs([video], user?.id);
  return NextResponse.json({ video: dto, failReason: video.authorId === user?.id ? video.failReason : null });
}

const patch = z.object({
  caption: z.string().max(2200).optional(),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).optional(),
  allowComments: z.boolean().optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  pinned: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export const PATCH = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const video = await db.video.findUnique({ where: { id } });
  if (!video || (video.authorId !== user.id && user.role !== "ADMIN")) return fail("Not found", 404);
  const { publish, ...data } = patch.parse(await request.json());
  if (data.pinned) {
    const pinnedCount = await db.video.count({ where: { authorId: video.authorId, pinned: true, id: { not: id } } });
    if (pinnedCount >= 3) return fail("You can pin up to 3 videos.");
  }
  const extra: Record<string, unknown> = {};
  if (publish && video.status === "DRAFT") {
    if (video.kind === "VIDEO" && !video.videoUrl) return fail("This draft is still processing.");
    extra.status = "READY";
    extra.publishedAt = new Date();
  }
  await db.video.update({ where: { id }, data: { ...data, ...extra } });
  if (data.caption !== undefined) await linkHashtagsAndMentions(id, data.caption, user.id, user.username);
  return { ok: true };
});

export const DELETE = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  const video = await db.video.findUnique({ where: { id } });
  if (!video || (video.authorId !== user.id && user.role !== "ADMIN")) return fail("Not found", 404);
  await db.video.delete({ where: { id } });
  return { ok: true };
});
