import { z } from "zod";
import { db } from "@/lib/db";
import { authed } from "@/lib/api";

export const POST = authed(async ({ request, user }) => {
  const input = z.object({
    targetType: z.enum(["USER", "VIDEO", "COMMENT", "LIVE", "MESSAGE"]),
    targetId: z.string().min(1).max(60),
    reason: z.string().trim().min(2).max(120),
    details: z.string().max(1000).optional(),
  }).parse(await request.json());
  await db.report.create({ data: { ...input, reporterId: user.id } });
  return { ok: true };
});
