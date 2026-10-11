import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSameOrigin, createSession, SESSION_COOKIE } from "@/lib/security";
import { signupSchema, zodMessage } from "@/lib/validation";
import { getSetting } from "@/lib/settings";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    if ((await getSetting("signupsOpen")) !== "true") return NextResponse.json({ error: "Sign-ups are paused right now." }, { status: 403 });
    const input = signupSchema.parse(await request.json());
    const taken = await db.user.findFirst({ where: { OR: [{ email: input.email }, { username: input.username }] }, select: { email: true } });
    if (taken) return NextResponse.json({ error: taken.email === input.email ? "This email already has an account." : "That username is taken." }, { status: 409 });
    const user = await registerUser(input);
    const token = await createSession(user.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ user: { id: user.id, username: user.username } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: (process.env.SITE_URL ?? "").startsWith("https:"), sameSite: "lax", path: "/", maxAge: 30 * 864e2 });
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    const message = zodMessage(error);
    if (message) return NextResponse.json({ error: message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }
}
