import { readFile } from "node:fs/promises";
import path from "node:path";
import { liveRoot } from "@/lib/media";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  if (parts.length !== 2 || parts.some((p) => !/^[a-z0-9_.]+$/i.test(p) || p.startsWith("."))) return new Response("Not found", { status: 404 });
  const file = path.join(liveRoot, ...parts);
  try {
    const body = await readFile(file);
    const type = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": file.endsWith(".m3u8") ? "no-cache" : "public, max-age=60" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
