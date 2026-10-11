import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { createRazorpayOrder, razorpayEnabled } from "@/lib/razorpay";

export const POST = authed(async ({ request, user }) => {
  const input = z.object({ packageId: z.string(), utr: z.string().trim().max(60).optional() }).parse(await request.json());
  const pkg = await db.coinPackage.findFirst({ where: { id: input.packageId, active: true } });
  if (!pkg) return fail("Package unavailable", 404);
  const coins = pkg.coins + pkg.bonus;
  if (razorpayEnabled() && !input.utr) {
    const purchase = await db.coinPurchase.create({ data: { userId: user.id, packageId: pkg.id, coins, amountInr: pkg.priceInr, provider: "razorpay" } });
    const order = await createRazorpayOrder(pkg.priceInr, purchase.id);
    await db.coinPurchase.update({ where: { id: purchase.id }, data: { providerRef: order.id } });
    return { mode: "razorpay", keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, purchaseId: purchase.id };
  }
  if (!input.utr || input.utr.length < 6) return fail("Enter the UPI transaction ID (UTR) after paying.");
  if (await db.coinPurchase.findFirst({ where: { providerRef: input.utr, provider: "upi" } })) return fail("This UTR was already submitted.");
  await db.coinPurchase.create({ data: { userId: user.id, packageId: pkg.id, coins, amountInr: pkg.priceInr, provider: "upi", providerRef: input.utr } });
  return { mode: "upi", pending: true };
});
