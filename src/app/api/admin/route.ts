import { z } from "zod";
import { db } from "@/lib/db";
import { adminOnly, fail } from "@/lib/api";
import { endLive } from "@/lib/live";
import { defaultSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";

const schema = z.object({ action: z.string(), id: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() });

export const POST = adminOnly(async ({ request, user }) => {
  const { action, id, data = {} } = schema.parse(await request.json());
  const need = () => {
    if (!id) throw new Response(JSON.stringify({ error: "Missing id" }), { status: 400 });
    return id;
  };
  switch (action) {
    case "user.ban": {
      const target = need();
      if (target === user.id) return fail("You can't ban yourself.");
      await db.user.update({ where: { id: target }, data: { status: "BANNED" } });
      await db.session.deleteMany({ where: { userId: target } });
      break;
    }
    case "user.unban": await db.user.update({ where: { id: need() }, data: { status: "ACTIVE" } }); break;
    case "user.verify": await db.user.update({ where: { id: need() }, data: { isVerified: true } }); break;
    case "user.unverify": await db.user.update({ where: { id: need() }, data: { isVerified: false } }); break;
    case "user.makeAdmin": await db.user.update({ where: { id: need() }, data: { role: "ADMIN" } }); break;
    case "user.removeAdmin": {
      if (need() === user.id) return fail("You can't remove your own admin role.");
      await db.user.update({ where: { id: need() }, data: { role: "USER" } });
      break;
    }
    case "user.coins": {
      const amount = z.number().int().parse(data.amount);
      await db.user.update({ where: { id: need() }, data: { coins: { increment: amount } } });
      await notify({ userId: need(), type: "SYSTEM", text: `${amount >= 0 ? "Added" : "Removed"} ${Math.abs(amount)} coins by admin` });
      break;
    }
    case "video.hide": await db.video.update({ where: { id: need() }, data: { hidden: true } }); break;
    case "video.unhide": await db.video.update({ where: { id: need() }, data: { hidden: false } }); break;
    case "video.feature": await db.video.update({ where: { id: need() }, data: { featured: true } }); break;
    case "video.unfeature": await db.video.update({ where: { id: need() }, data: { featured: false } }); break;
    case "video.delete": await db.video.delete({ where: { id: need() } }); break;
    case "comment.hide": await db.comment.update({ where: { id: need() }, data: { hidden: true } }); break;
    case "comment.delete": await db.comment.delete({ where: { id: need() } }); break;
    case "report.resolve": await db.report.update({ where: { id: need() }, data: { status: "RESOLVED" } }); break;
    case "report.dismiss": await db.report.update({ where: { id: need() }, data: { status: "DISMISSED" } }); break;
    case "sound.feature": await db.sound.update({ where: { id: need() }, data: { featured: true } }); break;
    case "sound.unfeature": await db.sound.update({ where: { id: need() }, data: { featured: false } }); break;
    case "sound.hide": await db.sound.update({ where: { id: need() }, data: { hidden: true } }); break;
    case "sound.unhide": await db.sound.update({ where: { id: need() }, data: { hidden: false } }); break;
    case "live.end": await endLive(need()); break;
    case "gift.save": {
      const g = z.object({ name: z.string().min(1).max(40), emoji: z.string().min(1).max(16), coins: z.number().int().positive(), active: z.boolean().default(true), sortOrder: z.number().int().default(0) }).parse(data);
      if (id) await db.gift.update({ where: { id }, data: g });
      else await db.gift.create({ data: g });
      break;
    }
    case "gift.delete": await db.gift.update({ where: { id: need() }, data: { active: false } }); break;
    case "package.save": {
      const p = z.object({ coins: z.number().int().positive(), bonus: z.number().int().min(0).default(0), priceInr: z.number().int().positive(), active: z.boolean().default(true), sortOrder: z.number().int().default(0) }).parse(data);
      if (id) await db.coinPackage.update({ where: { id }, data: p });
      else await db.coinPackage.create({ data: p });
      break;
    }
    case "package.delete": await db.coinPackage.update({ where: { id: need() }, data: { active: false } }); break;
    case "purchase.approve": {
      const purchase = await db.coinPurchase.findUnique({ where: { id: need() } });
      if (!purchase || purchase.status !== "PENDING") return fail("Already processed");
      await db.$transaction([
        db.coinPurchase.update({ where: { id: purchase.id }, data: { status: "PAID" } }),
        db.user.update({ where: { id: purchase.userId }, data: { coins: { increment: purchase.coins } } }),
      ]);
      await notify({ userId: purchase.userId, type: "SYSTEM", text: `Payment approved: ${purchase.coins} coins added to your wallet` });
      break;
    }
    case "purchase.reject": {
      const purchase = await db.coinPurchase.update({ where: { id: need() }, data: { status: "REJECTED", note: String(data.note ?? "").slice(0, 300) || null } });
      await notify({ userId: purchase.userId, type: "SYSTEM", text: `Coin purchase rejected${purchase.note ? `: ${purchase.note}` : ""}` });
      break;
    }
    case "withdrawal.paid": {
      const w = await db.withdrawal.update({ where: { id: need() }, data: { status: "PAID", note: String(data.note ?? "").slice(0, 300) || null } });
      await notify({ userId: w.userId, type: "SYSTEM", text: `Withdrawal of ₹${w.amountInr} paid to ${w.upiId}` });
      break;
    }
    case "withdrawal.reject": {
      const w = await db.withdrawal.findUnique({ where: { id: need() } });
      if (!w || w.status !== "PENDING") return fail("Already processed");
      await db.$transaction([
        db.withdrawal.update({ where: { id: w.id }, data: { status: "REJECTED", note: String(data.note ?? "").slice(0, 300) || null } }),
        db.user.update({ where: { id: w.userId }, data: { diamonds: { increment: w.diamonds } } }),
      ]);
      await notify({ userId: w.userId, type: "SYSTEM", text: "Withdrawal rejected, diamonds returned to your wallet" });
      break;
    }
    case "settings.save": {
      for (const key of Object.keys(defaultSettings)) {
        if (data[key] === undefined) continue;
        const value = String(data[key]).slice(0, 500);
        await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
      break;
    }
    case "broadcast": {
      const text = z.string().trim().min(1).max(300).parse(data.text);
      const users = await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "SYSTEM" as const, text })) });
      break;
    }
    default:
      return fail("Unknown action", 404);
  }
  return { ok: true };
});
