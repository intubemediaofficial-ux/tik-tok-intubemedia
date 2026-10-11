import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { ingestChunk } from "@/lib/live";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ request, user, context }) => {
  const { id } = await context.params;
  const live = await db.liveStream.findUnique({ where: { id } });
  if (!live || live.hostId !== user.id || live.status !== "LIVE") return fail("This LIVE has ended.", 410);
  const chunk = Buffer.from(await request.arrayBuffer());
  if (chunk.length > 20 * 1024 * 1024) return fail("Chunk too large", 413);
  await ingestChunk(id, user.id, chunk, request.headers.get("x-first-chunk") === "1");
  return { ok: true };
});
