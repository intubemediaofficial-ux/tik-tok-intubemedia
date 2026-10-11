import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, "Use 3–30 letters, numbers, dots, or underscores.");

export const signupSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(1).max(60),
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const loginSchema = z.object({
  identity: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

export function extractTagsAndMentions(text: string) {
  const hashtags = [...new Set([...text.matchAll(/(?:^|\s)#([\p{L}\p{M}\p{N}_]{1,50})/gu)].map((m) => m[1].toLowerCase()))];
  const mentions = [...new Set([...text.matchAll(/(?:^|\s)@([a-z0-9._]{3,30})/gi)].map((m) => m[1].toLowerCase()))];
  return { hashtags, mentions };
}

export function zodMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  return null;
}
