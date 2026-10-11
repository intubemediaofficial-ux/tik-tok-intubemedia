import { db } from "@/lib/db";
import { authed, fail } from "@/lib/api";
import { processAvatar } from "@/lib/media";

export const POST = authed(async ({ request, user }) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return fail("Choose an image.");
  if (file.size > 15 * 1024 * 1024) return fail("Image must be under 15 MB.", 413);
  const url = await processAvatar(Buffer.from(await file.arrayBuffer())).catch(() => null);
  if (!url) return fail("This image format is not supported.", 415);
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  return { url };
});
