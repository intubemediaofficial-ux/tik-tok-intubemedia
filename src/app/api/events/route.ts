import { getCurrentUser } from "@/lib/security";
import { sseStream } from "@/lib/sse";
import { presence } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  return sseStream(`user:${user.id}`, {
    onOpen: () => presence.set(user.id, (presence.get(user.id) ?? 0) + 1),
    onClose: () => presence.set(user.id, Math.max(0, (presence.get(user.id) ?? 1) - 1)),
  });
}
