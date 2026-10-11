import { z } from "zod";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";

export const GET = authed(async ({ user }) => ({
  collections: await db.collection.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { favorites: true } } } }),
}));

export const POST = authed(async ({ request, user }) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(await request.json());
  if ((await db.collection.count({ where: { userId: user.id } })) >= 50) return fail("You can have up to 50 collections.");
  return { collection: await db.collection.create({ data: { userId: user.id, name } }) };
});

export const DELETE = authed(async ({ request, user }) => {
  const { id } = z.object({ id: z.string() }).parse(await request.json());
  await db.collection.deleteMany({ where: { id, userId: user.id } });
  return { ok: true };
});
