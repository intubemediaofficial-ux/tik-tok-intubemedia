import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertSameOrigin, hashToken, SESSION_COOKIE } from "@/lib/security";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
  } catch (error) {
    if (error instanceof Response) return error;
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
