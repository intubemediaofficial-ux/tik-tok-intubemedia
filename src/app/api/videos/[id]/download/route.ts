import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { canViewVideo } from "@/lib/access";
import { absFromUrl, watermarked } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const video = await db.video.findUnique({ where: { id }, include: { author: true } });
  if (!video || video.kind !== "VIDEO" || !video.videoUrl || !(await canViewVideo(user?.id, video))) return new Response("Not found", { status: 404 });
  if (video.authorId !== user?.id && (!video.allowDownload || !video.author.allowDownload)) return new Response("Downloads are turned off for this video.", { status: 403 });
  const source = absFromUrl(video.videoUrl);
  if (!source) return new Response("Not found", { status: 404 });
  const file = await watermarked(source, `${video.id}-${video.updatedAt.getTime()}`, `@${video.author.username}`);
  const info = await stat(file);
  await db.video.update({ where: { id }, data: { sharesCount: { increment: 1 } } });
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { "Content-Type": "video/mp4", "Content-Length": String(info.size), "Content-Disposition": `attachment; filename="${video.author.username}-${video.id}.mp4"` },
  });
}
