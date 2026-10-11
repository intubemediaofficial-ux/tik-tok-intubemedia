import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { verifyRazorpaySignature } from "@/lib/razorpay";

export const POST = authed(async ({ request, user }) => {
  const input = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(await request.json());
  const purchase = await db.coinPurchase.findFirst({ where: { providerRef: input.orderId, userId: user.id, provider: "razorpay" } });
  if (!purchase) return fail("Order not found", 404);
  if (purchase.status === "PAID") return { ok: true };
  if (!verifyRazorpaySignature(input.orderId, input.paymentId, input.signature)) return fail("Payment verification failed.", 400);
  await db.$transaction([
    db.coinPurchase.update({ where: { id: purchase.id }, data: { status: "PAID", note: input.paymentId } }),
    db.user.update({ where: { id: user.id }, data: { coins: { increment: purchase.coins } } }),
  ]);
  return { ok: true };
});
