import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canViewVideo } from "@/lib/access";
import { appName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Embed({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await db.video.findUnique({ where: { id }, include: { author: { select: { username: true, isPrivate: true, status: true } } } });
  if (!v || v.visibility !== "PUBLIC" || !(await canViewVideo(null, v))) notFound();
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 999 }}>
      {v.kind === "VIDEO" ? <video src={v.videoUrl ?? undefined} poster={v.posterUrl ?? undefined} controls playsInline loop style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <img src={v.photoUrls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
      <a href={`/v/${v.id}`} target="_blank" rel="noreferrer" style={{ position: "absolute", left: 10, top: 10, background: "#000a", padding: "6px 12px", borderRadius: 12, fontWeight: 800, fontSize: 13 }}>@{v.author.username} · {appName}</a>
    </div>
  );
}
