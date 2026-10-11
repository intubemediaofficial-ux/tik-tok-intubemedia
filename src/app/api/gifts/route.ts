import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail, UserError } from "@/lib/api";
import { publishLiveEvent, publishUserEvent } from "@/lib/events";
import { getSetting } from "@/lib/settings";
import { canViewVideo } from "@/lib/access";
import { notify } from "@/lib/notify";

export const GET = authed(async ({ user }) => ({
  gifts: await db.gift.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }),
  coins: user.coins,
}));

export const POST = authed(async ({ request, user }) => {
  const input = z.object({ giftId: z.string(), quantity: z.number().int().min(1).max(99).default(1), videoId: z.string().optional(), liveId: z.string().optional() }).parse(await request.json());
  if (!input.videoId === !input.liveId) return fail("Choose a video or LIVE.");
  const gift = await db.gift.findFirst({ where: { id: input.giftId, active: true } });
  if (!gift) return fail("Gift unavailable", 404);
  let receiverId: string;
  if (input.videoId) {
    const video = await db.video.findUnique({ where: { id: input.videoId }, include: { author: true } });
    if (!video || !(await canViewVideo(user.id, video))) return fail("Not found", 404);
    receiverId = video.authorId;
  } else {
    const live = await db.liveStream.findUnique({ where: { id: input.liveId } });
    if (!live || live.status !== "LIVE") return fail("LIVE has ended.", 410);
    receiverId = live.hostId;
  }
  if (receiverId === user.id) return fail("You can't gift yourself.");
  const coins = gift.coins * input.quantity;
  const rate = Number(await getSetting("diamondPerCoin")) || 0.5;
  const diamonds = Math.floor(coins * rate);
  const result = await db.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({ where: { id: user.id, coins: { gte: coins } }, data: { coins: { decrement: coins } } });
    if (debited.count === 0) throw new UserError("Not enough coins. Recharge your wallet.");
    await tx.user.update({ where: { id: receiverId }, data: { diamonds: { increment: diamonds } } });
    if (input.liveId) await tx.liveStream.update({ where: { id: input.liveId }, data: { diamonds: { increment: diamonds } } });
    await tx.giftTransaction.create({ data: { senderId: user.id, receiverId, giftId: gift.id, coins, diamonds, quantity: input.quantity, videoId: input.videoId ?? null, liveId: input.liveId ?? null } });
    return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { coins: true } });
  });
  const payload = { username: user.username, avatarUrl: user.avatarUrl, gift: { name: gift.name, emoji: gift.emoji, coins: gift.coins }, quantity: input.quantity };
  if (input.liveId) publishLiveEvent(input.liveId, { type: "gift", data: payload });
  await notify({ userId: receiverId, actorId: user.id, type: "GIFT", videoId: input.videoId ?? null, text: `sent ${input.quantity}× ${gift.emoji} ${gift.name}` });
  publishUserEvent(user.id, { type: "wallet", data: { coins: result.coins } });
  return { coins: result.coins };
});
