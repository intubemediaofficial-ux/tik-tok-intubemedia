import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Music2, Video } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { listVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video-grid";
import { compact, duration } from "@/lib/format";
import { SoundActions } from "@/components/sound-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await db.sound.findUnique({ where: { id } });
  return s ? { title: `${s.title} — ${s.artist}`, description: `Videos using “${s.title}” by ${s.artist}` } : { title: "Sound" };
}

export default async function SoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const sound = await db.sound.findUnique({ where: { id }, include: { _count: { select: { videos: true } }, creator: { select: { username: true } } } });
  if (!sound || sound.hidden) notFound();
  const fav = user ? Boolean(await db.favoriteSound.findUnique({ where: { userId_soundId: { userId: user.id, soundId: id } } })) : false;
  const videos = await listVideos({ soundId: id }, user?.id, { take: 60, orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="page">
      <div className="card row" style={{ padding: 24, marginBottom: 22, gap: 22, flexWrap: "wrap", background: "linear-gradient(135deg, #7c5cff1f, #ff3d7f14)" }}>
        <div className="avatar" style={{ width: 120, height: 120, borderRadius: 26, backgroundImage: sound.coverUrl ? `url(${sound.coverUrl})` : undefined, backgroundSize: "cover" }}>{!sound.coverUrl && <Music2 size={50} />}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="brand" style={{ margin: 0, fontSize: 30 }}>{sound.title}</h1>
          <div style={{ fontSize: 17, margin: "4px 0" }}>{sound.isOriginal && sound.creator ? <Link href={`/@${sound.creator.username}`}>{sound.artist}</Link> : sound.artist}</div>
          <div className="muted" style={{ fontSize: 14 }}>{compact(sound._count.videos)} videos · {duration(sound.durationSec)}</div>
          <SoundActions id={sound.id} audioUrl={sound.audioUrl} favorited={fav} loggedIn={Boolean(user)} />
        </div>
        {user && <Link href={`/upload?sound=${sound.id}`} className="btn btn-primary" style={{ height: 50 }}><Video size={18} />Use this sound</Link>}
      </div>
      <VideoGrid videos={videos} showAuthor />
    </div>
  );
}
