import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";

export async function registerUser(input: { email: string; username: string; name: string; password: string }) {
  return db.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      username: input.username.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: await hash(input.password),
    },
  });
}

export async function authenticateUser(identity: string, password: string) {
  const user = await db.user.findFirst({
    where: { OR: [{ email: identity.toLowerCase() }, { username: identity.toLowerCase() }] },
  });
  if (!user || user.status !== "ACTIVE" || !(await verify(user.passwordHash, password))) return null;
  return user;
}
