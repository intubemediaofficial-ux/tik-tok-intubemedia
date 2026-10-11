import { redirect } from "next/navigation";
import { Feed } from "@/components/feed";
import { getCurrentUser } from "@/lib/security";
import { getFeed } from "@/lib/videos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/friends");
  return <Feed kind="friends" initial={await getFeed("friends", user.id, [], 6)} me={user.username} />;
}
