import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const tab = url.searchParams.get("tab") ?? "discover";
  const user = await getCurrentUser();
  if (tab === "favorites") {
    if (!user) return NextResponse.json({ sounds: [] });
    const favs = await db.favoriteSound.findMany({ where: { userId: user.id, sound: { hidden: false } }, include: { sound: { include: { _count: { select: { videos: true } } } } }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ sounds: favs.map((f) => ({ ...f.sound, uses: f.sound._count.videos, favorited: true })) });
  }
  const sounds = await db.sound.findMany({
    where: { hidden: false, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { artist: { contains: q, mode: "insensitive" } }] } : { OR: [{ isOriginal: false }, { videos: { some: {} } }] }) },
    include: { _count: { select: { videos: true } } },
    orderBy: [{ featured: "desc" }, { videos: { _count: "desc" } }, { createdAt: "desc" }],
    take: 60,
  });
  const favIds = user ? new Set((await db.favoriteSound.findMany({ where: { userId: user.id, soundId: { in: sounds.map((s) => s.id) } } })).map((f) => f.soundId)) : new Set();
  return NextResponse.json({ sounds: sounds.map((s) => ({ ...s, uses: s._count.videos, favorited: favIds.has(s.id) })) });
}
