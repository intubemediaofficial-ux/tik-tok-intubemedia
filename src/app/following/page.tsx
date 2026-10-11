import { redirect } from "next/navigation";
import { Feed } from "@/components/feed";
import { getCurrentUser } from "@/lib/security";
import { getFeed } from "@/lib/videos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Following" };

export default async function FollowingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/following");
  return <Feed kind="following" initial={await getFeed("following", user.id, [], 6)} me={user.username} />;
}
