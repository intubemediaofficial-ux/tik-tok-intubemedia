import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail, UserError } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const POST = authed(async ({ request, user }) => {
  const input = z.object({ diamonds: z.number().int().positive(), upiId: z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "Enter a valid UPI ID (name@bank).") }).parse(await request.json());
  const settings = await getSettings();
  const min = Number(settings.minWithdrawDiamonds) || 1000;
  if (input.diamonds < min) return fail(`Minimum withdrawal is ${min} diamonds.`);
  const amountInr = Math.round(input.diamonds * (Number(settings.inrPerDiamond) || 0.05) * 100) / 100;
  await db.$transaction(async (tx) => {
    const res = await tx.user.updateMany({ where: { id: user.id, diamonds: { gte: input.diamonds } }, data: { diamonds: { decrement: input.diamonds } } });
    if (!res.count) throw new UserError("Not enough diamonds.");
    await tx.withdrawal.create({ data: { userId: user.id, diamonds: input.diamonds, amountInr, upiId: input.upiId } });
  });
  return { ok: true, amountInr };
});
