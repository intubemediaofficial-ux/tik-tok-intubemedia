import { hash } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { publishDueScheduled } from "@/lib/videos";
import { sweepIdleLives } from "@/lib/live";

const DEFAULT_GIFTS = [
  { name: "Rose", emoji: "🌹", coins: 1 },
  { name: "Chai", emoji: "☕", coins: 5 },
  { name: "Heart", emoji: "💖", coins: 10 },
  { name: "Dhol", emoji: "🥁", coins: 49 },
  { name: "Crown", emoji: "👑", coins: 99 },
  { name: "Rocket", emoji: "🚀", coins: 299 },
  { name: "Lion", emoji: "🦁", coins: 999 },
  { name: "Taj Mahal", emoji: "🕌", coins: 4999 },
];

const DEFAULT_PACKAGES = [
  { coins: 70, bonus: 0, priceInr: 19 },
  { coins: 350, bonus: 20, priceInr: 89 },
  { coins: 700, bonus: 50, priceInr: 179 },
  { coins: 1400, bonus: 150, priceInr: 349 },
  { coins: 3500, bonus: 500, priceInr: 849 },
  { coins: 7000, bonus: 1200, priceInr: 1699 },
];

export async function bootstrap() {
  const email = (process.env.ADMIN_EMAIL || "intubemediaofficial@gmail.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (password && password.length >= 8) {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      const taken = await db.user.findUnique({ where: { username: "admin" } });
      await db.user.create({ data: { email, username: taken ? `admin${Date.now() % 10000}` : "admin", name: "Intube Media", passwordHash: await hash(password), role: "ADMIN", isVerified: true } });
    } else if (existing.role !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    }
  }
  if ((await db.gift.count()) === 0) await db.gift.createMany({ data: DEFAULT_GIFTS.map((g, i) => ({ ...g, sortOrder: i })) });
  if ((await db.coinPackage.count()) === 0) await db.coinPackage.createMany({ data: DEFAULT_PACKAGES.map((p, i) => ({ ...p, sortOrder: i })) });
  await db.video.updateMany({ where: { status: "PROCESSING", createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } }, data: { status: "FAILED", failReason: "Processing interrupted by a server restart." } });
  await db.liveStream.updateMany({ where: { status: "LIVE" }, data: { status: "ENDED", endedAt: new Date() } });
  const g = globalThis as typeof globalThis & { __thirakTimer?: NodeJS.Timeout };
  if (!g.__thirakTimer) {
    g.__thirakTimer = setInterval(() => {
      void publishDueScheduled().catch(() => null);
      void sweepIdleLives().catch(() => null);
    }, 30_000);
  }
}
