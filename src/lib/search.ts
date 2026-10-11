import { db } from "@/lib/db";
import { blockedIds } from "@/lib/access";
import { listVideos } from "@/lib/videos";
import { publicUserSelect } from "@/lib/user-dto";

export async function searchAll(q: string, viewerId: string | null | undefined, limit = 20) {
  const term = q.replace(/^[#@]/, "");
  const blocked = await blockedIds(viewerId);
  const [users, videos, sounds, hashtags, lives] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE", id: { notIn: blocked }, OR: [{ username: { contains: term, mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }] },
      select: { ...publicUserSelect, bio: true, _count: { select: { followers: { where: { status: "ACCEPTED" } }, videos: true } } },
      orderBy: { followers: { _count: "desc" } },
      take: limit,
    }),
    listVideos({ OR: [{ caption: { contains: term, mode: "insensitive" } }, { hashtags: { some: { hashtag: { name: { contains: term.toLowerCase() } } } } }, { author: { username: { contains: term, mode: "insensitive" } } }, { sound: { title: { contains: term, mode: "insensitive" } } }] }, viewerId, { take: limit * 2, orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }] }),
    db.sound.findMany({ where: { hidden: false, OR: [{ title: { contains: term, mode: "insensitive" } }, { artist: { contains: term, mode: "insensitive" } }] }, include: { _count: { select: { videos: true } } }, orderBy: { videos: { _count: "desc" } }, take: limit }),
    db.hashtag.findMany({ where: { name: { contains: term.toLowerCase() } }, include: { _count: { select: { videos: true } } }, orderBy: { videos: { _count: "desc" } }, take: limit }),
    db.liveStream.findMany({ where: { status: "LIVE", OR: [{ title: { contains: term, mode: "insensitive" } }, { host: { username: { contains: term, mode: "insensitive" } } }] }, include: { host: { select: publicUserSelect } }, take: limit }),
  ]);
  return { users, videos, sounds: sounds.map((s) => ({ ...s, uses: s._count.videos })), hashtags: hashtags.map((h) => ({ name: h.name, uses: h._count.videos })), lives };
}

export async function trendingHashtags(limit = 12) {
  const since = new Date(Date.now() - 14 * 864e5);
  const rows = await db.hashtag.findMany({
    include: { _count: { select: { videos: { where: { video: { status: "READY", hidden: false, createdAt: { gte: since } } } } } } },
    orderBy: { videos: { _count: "desc" } },
    take: limit * 2,
  });
  return rows.filter((r) => r._count.videos > 0).slice(0, limit).map((r) => ({ name: r.name, uses: r._count.videos }));
}
