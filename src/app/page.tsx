import { Feed } from "@/components/feed";
import { getCurrentUser } from "@/lib/security";
import { getFeed } from "@/lib/videos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const videos = await getFeed("foryou", user?.id, [], 6);
  return <Feed kind="foryou" initial={videos} me={user?.username ?? null} />;
}
