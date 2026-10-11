import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { liveRoot } from "@/lib/media";
import { publishLiveEvent } from "@/lib/events";

type Ingest = { proc: ChildProcessWithoutNullStreams; lastChunk: number; hostId: string };
const g = globalThis as typeof globalThis & { __thirakIngest?: Map<string, Ingest>; __thirakViewers?: Map<string, number> };
const ingests = (g.__thirakIngest ??= new Map());
const viewers = (g.__thirakViewers ??= new Map());

export function liveDir(liveId: string) {
  return path.join(liveRoot, liveId.replace(/[^a-z0-9]/gi, ""));
}

async function startFfmpeg(liveId: string, hostId: string) {
  const dir = liveDir(liveId);
  await mkdir(dir, { recursive: true });
  const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-fflags", "+genpts", "-i", "pipe:0",
    "-vf", "scale='min(720,iw)':-2,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-g", "60", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-f", "hls", "-hls_time", "2", "-hls_list_size", "8", "-hls_flags", "delete_segments+independent_segments+omit_endlist",
    "-hls_segment_filename", path.join(dir, "seg_%05d.ts"), path.join(dir, "index.m3u8"),
  ]);
  proc.stderr.on("data", (d: Buffer) => console.error(`[live ${liveId}]`, d.toString().slice(0, 300)));
  proc.stdin.on("error", () => null);
  proc.on("close", () => {
    if (ingests.get(liveId)?.proc === proc) ingests.delete(liveId);
  });
  const entry = { proc, lastChunk: Date.now(), hostId };
  ingests.set(liveId, entry);
  return entry;
}

export async function ingestChunk(liveId: string, hostId: string, chunk: Buffer, first: boolean) {
  let entry = ingests.get(liveId);
  if (entry && first) {
    entry.proc.stdin.end();
    entry.proc.kill("SIGKILL");
    ingests.delete(liveId);
    entry = undefined;
  }
  if (!entry) entry = await startFfmpeg(liveId, hostId);
  entry.lastChunk = Date.now();
  await new Promise<void>((resolve) => {
    if (!entry!.proc.stdin.write(chunk)) entry!.proc.stdin.once("drain", () => resolve());
    else resolve();
  });
}

export async function stopIngest(liveId: string) {
  const entry = ingests.get(liveId);
  if (entry) {
    entry.proc.stdin.end();
    setTimeout(() => entry.proc.kill("SIGKILL"), 3000);
    ingests.delete(liveId);
  }
  setTimeout(() => void rm(liveDir(liveId), { recursive: true, force: true }), 60_000);
}

export async function endLive(liveId: string) {
  const live = await db.liveStream.findUnique({ where: { id: liveId } });
  if (!live || live.status === "ENDED") return;
  await db.liveStream.update({ where: { id: liveId }, data: { status: "ENDED", endedAt: new Date() } });
  await stopIngest(liveId);
  publishLiveEvent(liveId, { type: "ended", data: {} });
}

export async function sweepIdleLives() {
  const now = Date.now();
  const lives = await db.liveStream.findMany({ where: { status: "LIVE" }, select: { id: true, startedAt: true } });
  for (const live of lives) {
    const entry = ingests.get(live.id);
    const idleSince = entry?.lastChunk ?? live.startedAt.getTime();
    if (now - idleSince > 45_000) await endLive(live.id);
  }
}

export function viewerJoin(liveId: string) {
  const count = (viewers.get(liveId) ?? 0) + 1;
  viewers.set(liveId, count);
  publishLiveEvent(liveId, { type: "viewers", data: { count } });
  void db.liveStream.updateMany({ where: { id: liveId, viewerPeak: { lt: count } }, data: { viewerPeak: count } });
  return count;
}

export function viewerLeave(liveId: string) {
  const count = Math.max(0, (viewers.get(liveId) ?? 1) - 1);
  viewers.set(liveId, count);
  publishLiveEvent(liveId, { type: "viewers", data: { count } });
}

export function viewerCount(liveId: string) {
  return viewers.get(liveId) ?? 0;
}

export function isStreaming(liveId: string) {
  return ingests.has(liveId);
}
