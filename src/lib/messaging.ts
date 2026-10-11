import { db } from "@/lib/db";
import { areFriends, isBlockedEitherWay } from "@/lib/access";

export async function canMessage(senderId: string, targetId: string) {
  if (senderId === targetId) return false;
  if (await isBlockedEitherWay(senderId, targetId)) return false;
  const target = await db.user.findUnique({ where: { id: targetId }, select: { allowMessages: true, status: true } });
  if (!target || target.status !== "ACTIVE") return false;
  if (target.allowMessages === "nobody") return false;
  if (target.allowMessages === "friends") return areFriends(senderId, targetId);
  return true;
}

export async function findOrCreateDirect(a: string, b: string) {
  const existing = await db.conversation.findFirst({ where: { AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }] }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.conversation.create({ data: { members: { create: [{ userId: a }, { userId: b }] } } });
  return created.id;
}
