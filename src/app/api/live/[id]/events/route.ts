import { sseStream } from "@/lib/sse";
import { viewerCount, viewerJoin, viewerLeave } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const host = new URL(request.url).searchParams.get("host") === "1";
  return sseStream(`live:${id}`, {
    initial: { type: "viewers", data: { count: viewerCount(id) } },
    onOpen: () => (host ? undefined : viewerJoin(id)),
    onClose: () => (host ? undefined : viewerLeave(id)),
  });
}
