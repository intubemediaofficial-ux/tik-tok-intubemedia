import { writeFile, rm } from "node:fs/promises";
import { db } from "@/lib/db";
import { adminOnly, fail } from "@/lib/api";
import { processAudio, processImage, tempFile } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = adminOnly(async ({ request, user }) => {
  const form = await request.formData();
  const file = form.get("file");
  const cover = form.get("cover");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const artist = String(form.get("artist") ?? "").trim().slice(0, 120);
  if (!(file instanceof File) || !title || !artist) return fail("Title, artist and an audio file are required.");
  const raw = await tempFile();
  await writeFile(raw, Buffer.from(await file.arrayBuffer()));
  try {
    const audio = await processAudio(raw);
    const coverUrl = cover instanceof File && cover.size > 0 ? (await processImage(Buffer.from(await cover.arrayBuffer()), 600).catch(() => null))?.url : null;
    const sound = await db.sound.create({ data: { title, artist, audioUrl: audio.url, durationSec: audio.durationSec, coverUrl: coverUrl ?? null, featured: form.get("featured") === "true", creatorId: user.id } });
    return { sound };
  } catch (error) {
    return fail(error instanceof Error ? error.message.split("\n")[0] : "Could not process audio.", 422);
  } finally {
    await rm(raw, { force: true });
  }
});
