import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { publishUserEvent } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  const members = await db.conversationMember.findMany({ where: { conversationId: id } });
  if (!members.some((m) => m.userId === user.id)) return fail("Not found", 404);
  for (const m of members) if (m.userId !== user.id) publishUserEvent(m.userId, { type: "typing", data: { conversationId: id, username: user.username } });
  return { ok: true };
});
