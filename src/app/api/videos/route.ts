import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { processImage, tempFile } from "@/lib/media";
import { linkHashtagsAndMentions, startProcessing } from "@/lib/videos";
import { canViewVideo } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

const bool = z.preprocess((v) => v === "true" || v === true || v === "on", z.boolean());
const num = (def: number) => z.preprocess((v) => (v === null || v === "" || v === undefined ? def : Number(v)), z.number().finite());

const schema = z.object({
  kind: z.enum(["VIDEO", "PHOTO"]).default("VIDEO"),
  caption: z.string().max(2200).default(""),
  visibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]).default("PUBLIC"),
  allowComments: bool.default(true),
  allowDuet: bool.default(true),
  allowStitch: bool.default(true),
  allowDownload: bool.default(true),
  location: z.string().max(100).optional().nullable(),
  soundId: z.string().optional().nullable(),
  trimStart: num(0),
  trimEnd: num(0),
  speed: num(1),
  filter: z.string().max(20).default("none"),
  originalVolume: num(1),
  soundVolume: num(1),
  coverTime: num(0.3),
  duetOfId: z.string().optional().nullable(),
  stitchOfId: z.string().optional().nullable(),
  stitchSeconds: num(5),
  draft: bool.default(false),
  scheduledAt: z.string().optional().nullable(),
});

export const POST = authed(async ({ request, user }) => {
  const form = await request.formData();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") raw[key] = value || undefined;
  const input = schema.parse(raw);
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000)) return fail("Pick a future time to schedule.");
  if (input.soundId && !(await db.sound.findFirst({ where: { id: input.soundId, hidden: false } }))) return fail("That sound is unavailable.");
  for (const [field, flag] of [["duetOfId", "allowDuet"], ["stitchOfId", "allowStitch"]] as const) {
    const id = input[field];
    if (!id) continue;
    const parent = await db.video.findUnique({ where: { id }, include: { author: true } });
    if (!parent || parent.kind !== "VIDEO" || !parent[flag] || !parent.author[flag] || !(await canViewVideo(user.id, parent))) return fail(`This video doesn't allow ${field === "duetOfId" ? "duets" : "stitches"}.`, 403);
  }
  const base = {
    authorId: user.id,
    kind: input.kind,
    caption: input.caption.trim(),
    visibility: input.visibility,
    allowComments: input.allowComments,
    allowDuet: input.allowDuet,
    allowStitch: input.allowStitch,
    allowDownload: input.allowDownload,
    location: input.location || null,
    soundId: input.soundId || null,
    duetOfId: input.duetOfId || null,
    stitchOfId: input.stitchOfId || null,
    scheduledAt,
  };
  if (input.kind === "PHOTO") {
    const images = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (!images.length || images.length > 35) return fail("Add 1–35 photos.");
    const urls: string[] = [];
    for (const image of images) {
      if (!image.type.startsWith("image/") || image.size > 25 * 1024 * 1024) return fail("Photos must be images under 25 MB.");
      const processed = await processImage(Buffer.from(await image.arrayBuffer())).catch(() => null);
      if (!processed) return fail("One of the photos couldn't be read.", 415);
      urls.push(processed.url);
    }
    const status = input.draft ? "DRAFT" : scheduledAt && scheduledAt > new Date() ? "SCHEDULED" : "READY";
    const video = await db.video.create({ data: { ...base, photoUrls: urls, posterUrl: urls[0], status, publishedAt: status === "READY" ? new Date() : null } });
    await linkHashtagsAndMentions(video.id, video.caption, user.id, user.username);
    return { id: video.id, status: video.status };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) return fail("Choose a video to upload.");
  if (file.size > 500 * 1024 * 1024) return fail("Videos must be smaller than 500 MB.", 413);
  if (file.type && !file.type.startsWith("video/")) return fail("Choose a video file.", 415);
  const rawPath = await tempFile();
  await writeFile(rawPath, Buffer.from(await file.arrayBuffer()));
  const video = await db.video.create({ data: { ...base, status: input.draft ? "DRAFT" : "PROCESSING" } });
  await linkHashtagsAndMentions(video.id, video.caption, user.id, user.username);
  startProcessing(video.id, {
    rawPath,
    soundId: base.soundId,
    duetOfId: base.duetOfId,
    stitchOfId: base.stitchOfId,
    trimStart: input.trimStart,
    trimEnd: input.trimEnd,
    speed: input.speed,
    filter: input.filter,
    originalVolume: Math.min(2, Math.max(0, input.originalVolume)),
    soundVolume: Math.min(2, Math.max(0, input.soundVolume)),
    coverTime: input.coverTime,
    stitchSeconds: Math.min(5, Math.max(1, input.stitchSeconds)),
  });
  return { id: video.id, status: video.status };
});
