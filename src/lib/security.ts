import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "thirak_session";
const SESSION_DAYS = 30;

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      userAgent: userAgent?.slice(0, 240) ?? null,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  if (session.expiresAt.getTime() - Date.now() < 15 * 24 * 60 * 60 * 1000) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) },
    });
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/accounts/login");
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export async function requireAdmin() {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Response("Origin header required", { status: 403 });
  let source: string;
  try {
    source = new URL(origin).origin;
  } catch {
    throw new Response("Invalid request origin", { status: 403 });
  }
  const url = new URL(request.url);
  const allowed = new Set([url.origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  if (process.env.SITE_URL) allowed.add(new URL(process.env.SITE_URL).origin);
  if (!allowed.has(source)) throw new Response("Invalid request origin", { status: 403 });
}

export async function getRequestUserAgent() {
  return (await headers()).get("user-agent");
}
