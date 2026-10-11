import { db } from "@/lib/db";
import { authed } from "@/lib/api";

export const GET = authed(async ({ user }) => {
  const [unread, unreadMessages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, read: false } }),
    unreadMessageCount(user.id),
  ]);
  return { unread, unreadMessages };
});

export const POST = authed(async ({ user }) => {
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return { ok: true };
});

async function unreadMessageCount(userId: string) {
  const members = await db.conversationMember.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
  let total = 0;
  for (const m of members) total += await db.message.count({ where: { conversationId: m.conversationId, senderId: { not: userId }, createdAt: { gt: m.lastReadAt } } });
  return total;
}
