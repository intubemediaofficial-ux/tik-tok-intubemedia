import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { assertSameOrigin, getCurrentUser } from "@/lib/security";
import { zodMessage } from "@/lib/validation";

type Handler<C> = (ctx: { request: Request; user: User; context: C }) => Promise<Response | object>;

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function wrap<C>(handler: Handler<C>, opts: { admin?: boolean; csrf?: boolean }) {
  return async (request: Request, context: C) => {
    try {
      if (opts.csrf !== false && request.method !== "GET") await assertSameOrigin(request);
      const user = await getCurrentUser();
      if (!user) return fail("Sign in required.", 401);
      if (opts.admin && user.role !== "ADMIN") return fail("Admins only.", 403);
      const result = await handler({ request, user, context });
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (error) {
      if (error instanceof Response) return error;
      const message = zodMessage(error);
      if (message) return fail(message, 400);
      console.error(error);
      return fail(error instanceof Error && error.message.startsWith("!") ? error.message.slice(1) : "Something went wrong.", 500);
    }
  };
}

export const authed = <C = unknown>(handler: Handler<C>) => wrap(handler, {});
export const adminOnly = <C = unknown>(handler: Handler<C>) => wrap(handler, { admin: true });

export class UserError extends Error {
  constructor(message: string) {
    super(`!${message}`);
  }
}
