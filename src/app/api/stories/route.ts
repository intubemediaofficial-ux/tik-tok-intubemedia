import { writeFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { publicUserSelect } from "@/lib/user-dto";
import { blockedIds } from "@/lib/access";
import { processImage, processStoryVideo, tempFile } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = authed(async ({ request, user }) => {
  const form = await request.formData();
  const file = form.get("file");
  const caption = String(form.get("caption") ?? "").slice(0, 200);
  if (!(file instanceof File) || file.size < 1) return fail("Choose a photo or video.");
  if (file.size > 200 * 1024 * 1024) return fail("Files must be under 200 MB.", 413);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  if (file.type.startsWith("image/")) {
    const img = await processImage(Buffer.from(await file.arrayBuffer())).catch(() => null);
    if (!img) return fail("Unsupported image.", 415);
    return { story: await db.story.create({ data: { authorId: user.id, type: "IMAGE", mediaUrl: img.url, caption, expiresAt } }) };
  }
  const raw = await tempFile();
  await writeFile(raw, Buffer.from(await file.arrayBuffer()));
  try {
    const video = await processStoryVideo(raw);
    return { story: await db.story.create({ data: { authorId: user.id, type: "VIDEO", mediaUrl: video.url, posterUrl: video.posterUrl, caption, expiresAt } }) };
  } catch (error) {
    return fail(error instanceof Error ? error.message.split("\n")[0] : "Could not process video.", 422);
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(raw, { force: true });
  }
});

export const GET = authed(async ({ user }) => {
  const following = await db.follow.findMany({ where: { followerId: user.id, status: "ACCEPTED" }, select: { followingId: true } });
  const blocked = await blockedIds(user.id);
  const ids = [user.id, ...following.map((f) => f.followingId)].filter((id) => !blocked.includes(id));
  const stories = await db.story.findMany({
    where: { authorId: { in: ids }, expiresAt: { gt: new Date() }, author: { status: "ACTIVE" } },
    include: { author: { select: publicUserSelect }, views: { where: { userId: user.id }, select: { liked: true } }, _count: { select: { views: true } } },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, { user: (typeof stories)[number]["author"]; items: unknown[]; unseen: boolean }>();
  for (const s of stories) {
    const g = groups.get(s.authorId) ?? { user: s.author, items: [], unseen: false };
    const seen = s.views.length > 0 || s.authorId === user.id;
    g.items.push({ id: s.id, type: s.type, mediaUrl: s.mediaUrl, posterUrl: s.posterUrl, caption: s.caption, createdAt: s.createdAt, liked: s.views[0]?.liked ?? false, viewCount: s._count.views });
    if (!seen) g.unseen = true;
    groups.set(s.authorId, g);
  }
  const list = [...groups.values()].sort((a, b) => (a.user.id === user.id ? -1 : b.user.id === user.id ? 1 : Number(b.unseen) - Number(a.unseen)));
  return { me: user.id, groups: list };
});
