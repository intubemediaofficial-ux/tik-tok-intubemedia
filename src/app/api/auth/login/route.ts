import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, createSession, SESSION_COOKIE } from "@/lib/security";
import { loginSchema, zodMessage } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    const input = loginSchema.parse(await request.json());
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkLoginRateLimit(`${forwarded}:${input.identity.toLowerCase()}`);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      });
    }
    const user = await authenticateUser(input.identity, input.password);
    if (!user) {
      return NextResponse.json({ error: "The username, email, or password is incorrect." }, { status: 401 });
    }
    const token = await createSession(user.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ user: { id: user.id, username: user.username } });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: (process.env.SITE_URL ?? "").startsWith("https:"),
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 864e2,
    });
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    if (zodMessage(error)) {
      return NextResponse.json({ error: zodMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: "We couldn’t sign you in. Please try again." }, { status: 500 });
  }
}
