import { db } from "@/lib/db";
import { publicUserSelect } from "@/lib/user-dto";

export async function listConversations(userId: string) {
  const members = await db.conversationMember.findMany({
    where: { userId },
    include: { conversation: { include: { members: { include: { user: { select: publicUserSelect } } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  const rows = await Promise.all(members.map(async (m) => {
    const last = m.conversation.messages[0] ?? null;
    const other = m.conversation.members.find((x) => x.userId !== userId)?.user ?? m.conversation.members[0]?.user;
    const unread = await db.message.count({ where: { conversationId: m.conversationId, senderId: { not: userId }, createdAt: { gt: m.lastReadAt } } });
    return { id: m.conversationId, other, last, unread, updatedAt: last?.createdAt ?? m.conversation.createdAt };
  }));
  return rows.filter((r) => r.other).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}
