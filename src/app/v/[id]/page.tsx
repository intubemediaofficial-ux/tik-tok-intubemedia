import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Feed } from "@/components/feed";
import { getCurrentUser } from "@/lib/security";
import { db } from "@/lib/db";
import { canViewVideo } from "@/lib/access";
import { toDTOs, videoInclude } from "@/lib/videos";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const user = await getCurrentUser();
  const row = await db.video.findUnique({ where: { id }, include: videoInclude });
  if (!row || !(await canViewVideo(user?.id, row))) return null;
  return { user, video: (await toDTOs([row], user?.id))[0] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await load(id);
  if (!d) return { title: "Video not found" };
  const title = `${d.video.author.name} (@${d.video.author.username})`;
  const description = d.video.caption.slice(0, 160) || `Watch @${d.video.author.username}'s video`;
  const image = d.video.posterUrl ?? d.video.photoUrls[0];
  return { title, description, alternates: { canonical: `/v/${id}` }, openGraph: { title, description, type: "video.other", images: image ? [image] : [] }, twitter: { card: "summary_large_image", title, description } };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await load(id);
  if (!d) notFound();
  return (
    <div style={{ position: "relative" }}>
      <Link href="/" className="btn btn-sm" style={{ position: "fixed", zIndex: 20, top: 14, left: 14, background: "#0008" }}><ArrowLeft size={16} />Feed</Link>
      <Feed kind="foryou" initial={[d.video]} me={d.user?.username ?? null} single />
    </div>
  );
}
