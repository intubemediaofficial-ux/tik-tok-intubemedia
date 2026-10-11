import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async ({ user, context }) => {
  const { id } = await context.params;
  if (!(await db.sound.findUnique({ where: { id } }))) return fail("Not found", 404);
  const key = { userId_soundId: { userId: user.id, soundId: id } };
  if (await db.favoriteSound.findUnique({ where: key })) {
    await db.favoriteSound.delete({ where: key });
    return { favorited: false };
  }
  await db.favoriteSound.create({ data: { userId: user.id, soundId: id } });
  return { favorited: true };
});
