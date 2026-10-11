import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { canViewVideo } from "@/lib/access";
import { getSetting } from "@/lib/settings";
import { Studio } from "@/components/upload-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ duet?: string; stitch?: string; sound?: string; caption?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/upload");
  const sp = await searchParams;
  const refId = sp.duet || sp.stitch;
  let ref: { id: string; videoUrl: string; username: string; mode: "duet" | "stitch" } | null = null;
  if (refId) {
    const v = await db.video.findUnique({ where: { id: refId }, include: { author: true } });
    if (v && v.videoUrl && (await canViewVideo(user.id, v)) && (sp.duet ? v.allowDuet && v.author.allowDuet : v.allowStitch && v.author.allowStitch)) {
      ref = { id: v.id, videoUrl: v.videoUrl, username: v.author.username, mode: sp.duet ? "duet" : "stitch" };
    }
  }
  const sound = sp.sound ? await db.sound.findFirst({ where: { id: sp.sound, hidden: false }, select: { id: true, title: true, artist: true, audioUrl: true, coverUrl: true } }) : null;
  const maxSeconds = Number(await getSetting("maxVideoSeconds")) || 600;
  return <Studio refVideo={ref} initialSound={sound} initialCaption={sp.caption ?? ""} maxSeconds={maxSeconds} />;
}
