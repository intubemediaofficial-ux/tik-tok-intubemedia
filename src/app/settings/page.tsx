import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { SettingsClient } from "@/components/settings-client";
import { publicUserSelect } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  const blocks = await db.block.findMany({ where: { blockerId: user.id }, include: { blocked: { select: publicUserSelect } } });
  return (
    <SettingsClient
      user={{ name: user.name, username: user.username, email: user.email, bio: user.bio, website: user.website ?? "", avatarUrl: user.avatarUrl, isPrivate: user.isPrivate, showLiked: user.showLiked, allowDuet: user.allowDuet, allowStitch: user.allowStitch, allowDownload: user.allowDownload, allowMessages: user.allowMessages, commentFilter: user.commentFilter.join(", ") }}
      blocked={blocks.map((b) => b.blocked)}
    />
  );
}
