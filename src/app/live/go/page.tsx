import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security";
import { LiveHost } from "@/components/live-host";

export const dynamic = "force-dynamic";
export const metadata = { title: "Go LIVE" };

export default async function GoLive() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/live/go");
  return <LiveHost username={user.username} />;
}
