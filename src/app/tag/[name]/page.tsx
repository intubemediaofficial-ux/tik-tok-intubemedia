import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { listVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video-grid";
import { compact } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const tag = decodeURIComponent(name).toLowerCase();
  return { title: `#${tag}`, description: `Watch videos tagged #${tag}`, alternates: { canonical: `/tag/${encodeURIComponent(tag)}` } };
}

export default async function TagPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const tag = decodeURIComponent(name).toLowerCase();
  const user = await getCurrentUser();
  const [videos, hashtag] = await Promise.all([
    listVideos({ hashtags: { some: { hashtag: { name: tag } } } }, user?.id, { take: 60, orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }] }),
    db.hashtag.findUnique({ where: { name: tag }, include: { _count: { select: { videos: true } } } }),
  ]);
  const views = videos.reduce((s, v) => s + v.counts.views, 0);
  return (
    <div className="page">
      <div className="card row" style={{ padding: 24, marginBottom: 22, gap: 20, flexWrap: "wrap", background: "linear-gradient(135deg, #ffb02018, #7c5cff18)" }}>
        <div className="logo-mark" style={{ width: 96, height: 96, borderRadius: 28 }}><Hash size={48} /></div>
        <div style={{ flex: 1 }}>
          <h1 className="brand" style={{ margin: 0, fontSize: 34 }}>#{tag}</h1>
          <div className="muted">{compact(hashtag?._count.videos ?? 0)} videos · {compact(views)} views</div>
        </div>
        {user && <Link href={`/upload?caption=${encodeURIComponent(`#${tag} `)}`} className="btn btn-primary"><Plus size={18} />Use this hashtag</Link>}
      </div>
      <VideoGrid videos={videos} showAuthor />
    </div>
  );
}
