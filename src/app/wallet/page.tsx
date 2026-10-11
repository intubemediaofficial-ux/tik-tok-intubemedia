import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { getSettings } from "@/lib/settings";
import { razorpayEnabled } from "@/lib/razorpay";
import { WalletClient } from "@/components/wallet-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet" };

export default async function Wallet() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");
  const [packages, purchases, withdrawals, received, sent, settings] = await Promise.all([
    db.coinPackage.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceInr: "asc" }] }),
    db.coinPurchase.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.giftTransaction.findMany({ where: { receiverId: user.id }, include: { gift: true, sender: { select: { username: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.giftTransaction.findMany({ where: { senderId: user.id }, include: { gift: true, receiver: { select: { username: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    getSettings(),
  ]);
  const j = <T,>(v: T) => JSON.parse(JSON.stringify(v));
  return (
    <WalletClient
      coins={user.coins}
      diamonds={user.diamonds}
      packages={j(packages)}
      purchases={j(purchases)}
      withdrawals={j(withdrawals)}
      history={j([...received.map((g) => ({ id: g.id, at: g.createdAt, text: `@${g.sender.username} sent you ${g.quantity}× ${g.gift.emoji} ${g.gift.name}`, amount: `+${g.diamonds} 💎` })), ...sent.map((g) => ({ id: g.id, at: g.createdAt, text: `You sent ${g.quantity}× ${g.gift.emoji} ${g.gift.name} to @${g.receiver.username}`, amount: `-${g.coins} 🪙` }))].sort((a, b) => +b.at - +a.at))}
      upiId={String(settings.upiId)}
      upiName={String(settings.upiName)}
      inrPerDiamond={Number(settings.inrPerDiamond)}
      minWithdraw={Number(settings.minWithdrawDiamonds)}
      razorpay={razorpayEnabled()}
    />
  );
}
