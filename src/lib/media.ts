import { spawn } from "node:child_process";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export const dataRoot = path.resolve(process.env.DATA_DIR || "./data");
export const uploadRoot = path.join(dataRoot, "uploads");
export const liveRoot = path.join(dataRoot, "live");
const ffmpegBin = () => process.env.FFMPEG_PATH || "ffmpeg";
const ffprobeBin = () => process.env.FFPROBE_PATH || "ffprobe";

export function datedPath(extension: string) {
  const now = new Date();
  const relative = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), `${randomUUID()}.${extension}`);
  return { relative, absolute: path.join(uploadRoot, relative), url: `/media/${relative.split(path.sep).join("/")}` };
}

export function absFromUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("/media/")) return null;
  const abs = path.resolve(uploadRoot, url.slice("/media/".length));
  return abs.startsWith(`${uploadRoot}${path.sep}`) ? abs : null;
}

export async function tempFile(extension = "upload") {
  const dir = path.join(uploadRoot, ".processing");
  await mkdir(dir, { recursive: true });
  return path.join(dir, `${randomUUID()}.${extension}`);
}

export async function processImage(input: Buffer, width = 1080) {
  const output = datedPath("webp");
  await mkdir(path.dirname(output.absolute), { recursive: true });
  const result = await sharp(input, { failOn: "error" }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toFile(output.absolute);
  return { url: output.url, width: result.width, height: result.height };
}

export async function processAvatar(input: Buffer) {
  const output = datedPath("webp");
  await mkdir(path.dirname(output.absolute), { recursive: true });
  await sharp(input, { failOn: "error" }).rotate().resize(320, 320, { fit: "cover" }).webp({ quality: 85 }).toFile(output.absolute);
  return output.url;
}

export function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    child.stderr.on("data", (chunk: Buffer) => {
      error += chunk.toString();
      if (error.length > 20000) error = error.slice(-10000);
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(error) : reject(new Error(error.split("\n").slice(-6).join("\n") || `${command} exited ${code}`))));
  });
}

export type Probe = { duration: number; width: number; height: number; hasAudio: boolean; hasVideo: boolean };

export async function probe(inputPath: string): Promise<Probe> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(ffprobeBin(), ["-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type", "-of", "json", inputPath]);
    let out = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error("Unable to read this media file."))));
  });
  const data = JSON.parse(output) as { format?: { duration?: string }; streams?: Array<{ width?: number; height?: number; codec_type?: string }> };
  const video = data.streams?.find((s) => s.codec_type === "video");
  const hasAudio = Boolean(data.streams?.some((s) => s.codec_type === "audio"));
  let duration = Number(data.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) duration = await decodeDuration(inputPath);
  return { duration, width: video?.width ?? 0, height: video?.height ?? 0, hasAudio, hasVideo: Boolean(video?.width) };
}

async function decodeDuration(inputPath: string) {
  const log = await run(ffmpegBin(), ["-hide_banner", "-i", inputPath, "-f", "null", "-"]).catch(() => "");
  const matches = [...log.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = matches.at(-1);
  return last ? Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) : 0;
}

export { FILTERS } from "@/lib/filters";
import { FILTERS } from "@/lib/filters";

export const SPEEDS = [0.5, 1, 1.5, 2, 3];

function atempo(speed: number) {
  const parts: string[] = [];
  let s = speed;
  while (s > 2) { parts.push("atempo=2"); s /= 2; }
  while (s < 0.5) { parts.push("atempo=0.5"); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(",");
}

const AUDIO_NORM = "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo";

export type RenderOptions = {
  input: string;
  trimStart?: number;
  trimEnd?: number;
  speed?: number;
  filter?: string;
  soundPath?: string | null;
  originalVolume?: number;
  soundVolume?: number;
  coverTime?: number;
  duetWith?: string | null;
  stitchWith?: string | null;
  stitchSeconds?: number;
  maxSeconds?: number;
};

export async function renderVideo(opts: RenderOptions) {
  const meta = await probe(opts.input);
  if (!meta.hasVideo) throw new Error("This file has no video track.");
  const speed = SPEEDS.includes(opts.speed ?? 1) ? opts.speed ?? 1 : 1;
  const start = Math.max(0, Math.min(opts.trimStart ?? 0, meta.duration - 0.5));
  const end = Math.min(meta.duration, opts.trimEnd && opts.trimEnd > start ? opts.trimEnd : meta.duration);
  let mainLen = (end - start) / speed;
  const max = opts.maxSeconds ?? 180;
  const args: string[] = ["-y", "-hide_banner"];
  const filters: string[] = [];
  let idx = 0;
  args.push("-ss", start.toFixed(3), "-t", (end - start).toFixed(3), "-i", opts.input);
  const mainIdx = idx++;
  const ff = FILTERS[opts.filter ?? "none"]?.ff;
  const duet = Boolean(opts.duetWith);
  const W = duet ? 360 : 720;
  const H = duet ? 640 : 1280;
  const canvas = (w: number, h: number) => `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0b0a12,setsar=1,fps=30,format=yuv420p`;
  filters.push(`[${mainIdx}:v]setpts=PTS/${speed}${ff ? `,${ff}` : ""},${canvas(W, H)}[mv]`);
  const ov = opts.originalVolume ?? 1;
  if (meta.hasAudio) filters.push(`[${mainIdx}:a]${atempo(speed)},volume=${ov.toFixed(2)},${AUDIO_NORM}[ma]`);
  else {
    args.push("-f", "lavfi", "-t", mainLen.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
    filters.push(`[${idx++}:a]${AUDIO_NORM}[ma]`);
  }
  let vOut = "[mv]";
  let aOut = "[ma]";
  if (opts.duetWith) {
    const other = await probe(opts.duetWith);
    args.push("-i", opts.duetWith);
    const o = idx++;
    filters.push(`[${o}:v]${canvas(360, 640)}[dv]`);
    filters.push(`[mv][dv]hstack=inputs=2,pad=720:1280:0:320:color=0x0b0a12[sv]`);
    vOut = "[sv]";
    if (other.hasAudio) {
      filters.push(`[${o}:a]${AUDIO_NORM}[da]`, `[ma][da]amix=inputs=2:duration=first:normalize=0[sa]`);
      aOut = "[sa]";
    }
  } else if (opts.stitchWith) {
    const other = await probe(opts.stitchWith);
    const secs = Math.min(other.duration, Math.max(1, opts.stitchSeconds ?? 5));
    args.push("-t", secs.toFixed(3), "-i", opts.stitchWith);
    const o = idx++;
    filters.push(`[${o}:v]${canvas(720, 1280)}[pv]`);
    if (other.hasAudio) filters.push(`[${o}:a]${AUDIO_NORM}[pa]`);
    else {
      args.push("-f", "lavfi", "-t", secs.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
      filters.push(`[${idx++}:a]${AUDIO_NORM}[pa]`);
    }
    filters.push(`[pv][pa][mv][ma]concat=n=2:v=1:a=1[cv][ca]`);
    vOut = "[cv]";
    aOut = "[ca]";
    mainLen += secs;
  }
  if (opts.soundPath) {
    args.push("-stream_loop", "-1", "-i", opts.soundPath);
    const s = idx++;
    filters.push(`[${s}:a]volume=${(opts.soundVolume ?? 1).toFixed(2)},${AUDIO_NORM}[snd]`, `${aOut}[snd]amix=inputs=2:duration=first:normalize=0[fa]`);
    aOut = "[fa]";
  }
  const total = Math.min(mainLen, max);
  const output = datedPath("mp4");
  const poster = datedPath("jpg");
  await mkdir(path.dirname(output.absolute), { recursive: true });
  args.push(
    "-filter_complex", filters.join(";"), "-map", vOut, "-map", aOut, "-t", total.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", output.absolute,
  );
  try {
    await run(ffmpegBin(), args);
    const cover = Math.max(0, Math.min(opts.coverTime ?? 0.3, total - 0.1));
    await run(ffmpegBin(), ["-y", "-ss", cover.toFixed(2), "-i", output.absolute, "-frames:v", "1", "-q:v", "3", poster.absolute]);
    return { url: output.url, posterUrl: poster.url, width: 720, height: 1280, durationSec: total, hadAudio: meta.hasAudio || Boolean(opts.duetWith || opts.stitchWith) };
  } catch (error) {
    await Promise.all([rm(output.absolute, { force: true }), rm(poster.absolute, { force: true })]);
    throw error;
  }
}

export async function extractAudio(videoPath: string) {
  const out = datedPath("m4a");
  await mkdir(path.dirname(out.absolute), { recursive: true });
  await run(ffmpegBin(), ["-y", "-i", videoPath, "-vn", "-c:a", "aac", "-b:a", "128k", out.absolute]);
  const meta = await probe(out.absolute).catch(() => null);
  return { url: out.url, durationSec: meta?.duration ?? 0 };
}

export async function processAudio(inputPath: string) {
  const meta = await probe(inputPath);
  if (!meta.hasAudio) throw new Error("This file has no audio track.");
  const out = datedPath("m4a");
  await mkdir(path.dirname(out.absolute), { recursive: true });
  await run(ffmpegBin(), ["-y", "-i", inputPath, "-vn", "-t", "300", "-c:a", "aac", "-b:a", "160k", out.absolute]);
  return { url: out.url, durationSec: Math.min(meta.duration, 300) };
}

export async function processStoryVideo(inputPath: string) {
  const meta = await probe(inputPath);
  if (meta.duration > 60.5) throw new Error("Story videos must be 60 seconds or shorter.");
  return renderVideo({ input: inputPath, maxSeconds: 60 });
}

export async function watermarked(videoPath: string, cacheKey: string, label: string) {
  const out = path.join(dataRoot, "downloads", `${cacheKey}.mp4`);
  try {
    await stat(out);
    return out;
  } catch {}
  await mkdir(path.dirname(out), { recursive: true });
  const safe = label.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffb020"/><stop offset="1" stop-color="#ff3d7f"/></linearGradient></defs><rect x="4" y="10" width="64" height="64" rx="18" fill="url(#g)"/><text x="36" y="58" font-family="DejaVu Sans" font-weight="bold" font-size="38" fill="#120f1d" text-anchor="middle">T</text><text x="82" y="44" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#fff" stroke="#000" stroke-opacity=".35" stroke-width="1">${process.env.NEXT_PUBLIC_APP_NAME || "Thirak"}</text><text x="82" y="78" font-family="DejaVu Sans" font-size="22" fill="#fff" fill-opacity=".9">${safe}</text></svg>`;
  const mark = path.join(dataRoot, "downloads", `${cacheKey}.png`);
  await sharp(Buffer.from(svg)).png().toFile(mark);
  const tmp = `${out}.tmp.mp4`;
  await run(ffmpegBin(), ["-y", "-i", videoPath, "-i", mark, "-filter_complex", "[1]format=rgba,colorchannelmixer=aa=0.85[m];[0:v][m]overlay=24:H-h-140", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy", "-movflags", "+faststart", tmp]);
  await rename(tmp, out);
  await rm(mark, { force: true });
  return out;
}
