import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { uploadRoot } from "@/lib/media";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return new Response("Not found.", { status: 404 });
  }
  const filename = path.resolve(uploadRoot, ...parts);
  if (!filename.startsWith(`${uploadRoot}${path.sep}`)) return new Response("Not found.", { status: 404 });
  try {
    const info = await stat(filename);
    if (!info.isFile()) return new Response("Not found.", { status: 404 });
    const range = request.headers.get("range");
    const commonHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentTypes[path.extname(filename).toLowerCase()] || "application/octet-stream",
    };
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      const stream = Readable.toWeb(createReadStream(filename, { start, end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: { ...commonHeaders, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${info.size}` },
      });
    }
    const stream = Readable.toWeb(createReadStream(filename)) as ReadableStream;
    return new Response(stream, { headers: { ...commonHeaders, "Content-Length": String(info.size) } });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
