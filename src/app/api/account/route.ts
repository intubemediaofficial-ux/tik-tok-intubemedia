import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { usernameSchema } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  username: usernameSchema.optional(),
  bio: z.string().max(160).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  isPrivate: z.boolean().optional(),
  showLiked: z.boolean().optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  allowMessages: z.enum(["everyone", "friends", "nobody"]).optional(),
  commentFilter: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128).optional(),
});

export const PATCH = authed(async ({ request, user }) => {
  const input = schema.parse(await request.json());
  const { currentPassword, newPassword, ...data } = input;
  if (data.username && data.username !== user.username) {
    const taken = await db.user.findUnique({ where: { username: data.username } });
    if (taken) return fail("That username is taken.", 409);
  }
  const update: Record<string, unknown> = { ...data };
  if (data.website === "") update.website = null;
  if (newPassword) {
    if (!currentPassword || !(await verify(user.passwordHash, currentPassword))) return fail("Current password is incorrect.", 400);
    update.passwordHash = await hash(newPassword);
  }
  if (data.isPrivate === false && user.isPrivate) {
    await db.follow.updateMany({ where: { followingId: user.id, status: "PENDING" }, data: { status: "ACCEPTED" } });
  }
  const updated = await db.user.update({ where: { id: user.id }, data: update, select: { username: true } });
  return { ok: true, username: updated.username };
});

export const DELETE = authed(async ({ request, user }) => {
  const { password } = z.object({ password: z.string() }).parse(await request.json());
  if (user.role === "ADMIN") return fail("Admin accounts cannot be self-deleted.", 400);
  if (!(await verify(user.passwordHash, password))) return fail("Password is incorrect.", 400);
  await db.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
  await db.session.deleteMany({ where: { userId: user.id } });
  return { ok: true };
});
