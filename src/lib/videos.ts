import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { visibleVideoWhere } from "@/lib/access";
import { extractTagsAndMentions } from "@/lib/validation";
import { absFromUrl, extractAudio, renderVideo, type RenderOptions } from "@/lib/media";
import { publishUserEvent } from "@/lib/events";
import { getSetting } from "@/lib/settings";
import { publicUserSelect } from "@/lib/user-dto";

export const videoInclude = {
  author: { select: { ...publicUserSelect, isPrivate: true, status: true } },
  sound: { select: { id: true, title: true, artist: true, coverUrl: true, audioUrl: true } },
  duetOf: { select: { id: true, author: { select: { username: true } } } },
  stitchOf: { select: { id: true, author: { select: { username: true } } } },
  _count: { select: { likes: true, comments: true, favorites: true, reposts: true } },
} satisfies Prisma.VideoInclude;

export type VideoRow = Prisma.VideoGetPayload<{ include: typeof videoInclude }>;

export type VideoDTO = {
  id: string;
  kind: "VIDEO" | "PHOTO";
  status: string;
  videoUrl: string | null;
  posterUrl: string | null;
  photoUrls: string[];
  caption: string;
  createdAt: string;
  durationSec: number | null;
  visibility: string;
  pinned: boolean;
  author: { id: string; username: string; name: string; avatarUrl: string | null; isVerified: boolean };
  sound: { id: string; title: string; artist: string; coverUrl: string | null; audioUrl: string } | null;
  duetOf: { id: string; username: string } | null;
  stitchOf: { id: string; username: string } | null;
  counts: { likes: number; comments: number; favorites: number; reposts: number; shares: number; views: number };
  viewer: { liked: boolean; favorited: boolean; reposted: boolean; following: boolean; isAuthor: boolean };
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  allowDownload: boolean;
  repostedBy?: string | null;
};

export async function toDTOs(rows: VideoRow[], viewerId: string | null | undefined): Promise<VideoDTO[]> {
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const [likes, favs, reps, follows] = viewerId && ids.length
    ? await Promise.all([
        db.like.findMany({ where: { userId: viewerId, videoId: { in: ids } }, select: { videoId: true } }),
        db.favorite.findMany({ where: { userId: viewerId, videoId: { in: ids } }, select: { videoId: true } }),
        db.repost.findMany({ where: { userId: viewerId, videoId: { in: ids } }, select: { videoId: true } }),
        db.follow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } }),
      ])
    : [[], [], [], []];
  const liked = new Set(likes.map((l) => l.videoId));
  const faved = new Set(favs.map((l) => l.videoId));
  const reposted = new Set(reps.map((l) => l.videoId));
  const following = new Set(follows.map((f) => f.followingId));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    videoUrl: r.videoUrl,
    posterUrl: r.posterUrl,
    photoUrls: r.photoUrls,
    caption: r.caption,
    createdAt: (r.publishedAt ?? r.createdAt).toISOString(),
    durationSec: r.durationSec,
    visibility: r.visibility,
    pinned: r.pinned,
    author: { id: r.author.id, username: r.author.username, name: r.author.name, avatarUrl: r.author.avatarUrl, isVerified: r.author.isVerified },
    sound: r.sound,
    duetOf: r.duetOf ? { id: r.duetOf.id, username: r.duetOf.author.username } : null,
    stitchOf: r.stitchOf ? { id: r.stitchOf.id, username: r.stitchOf.author.username } : null,
    counts: { ...r._count, shares: r.sharesCount, views: r.viewsCount },
    viewer: { liked: liked.has(r.id), favorited: faved.has(r.id), reposted: reposted.has(r.id), following: following.has(r.authorId), isAuthor: viewerId === r.authorId },
    allowComments: r.allowComments,
    allowDuet: r.allowDuet,
    allowStitch: r.allowStitch,
    allowDownload: r.allowDownload,
  }));
}

export async function publishDueScheduled() {
  const due = await db.video.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() }, videoUrl: { not: null } }, select: { id: true } });
  if (due.length) await db.video.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { status: "READY", publishedAt: new Date() } });
}

export type FeedKind = "foryou" | "following" | "friends";

export async function getFeed(kind: FeedKind, viewerId: string | null | undefined, exclude: string[], limit = 6) {
  await publishDueScheduled();
  const where = await visibleVideoWhere(viewerId);
  const and: Prisma.VideoWhereInput[] = [where];
  if (exclude.length) and.push({ id: { notIn: exclude.slice(-400) } });
  if (viewerId) and.push({ notInterested: { none: { userId: viewerId } } });
  if (kind !== "foryou") {
    if (!viewerId) return [];
    const following = await db.follow.findMany({ where: { followerId: viewerId, status: "ACCEPTED" }, select: { followingId: true } });
    let ids = following.map((f) => f.followingId);
    if (kind === "friends") {
      const back = await db.follow.findMany({ where: { followingId: viewerId, followerId: { in: ids }, status: "ACCEPTED" }, select: { followerId: true } });
      ids = back.map((b) => b.followerId);
    }
    and.push({ authorId: { in: ids } });
    const rows = await db.video.findMany({ where: { AND: and }, include: videoInclude, orderBy: { createdAt: "desc" }, take: limit });
    return toDTOs(rows, viewerId);
  }
  if (viewerId) and.push({ authorId: { not: viewerId } });
  const candidates = await db.video.findMany({ where: { AND: and }, include: { ...videoInclude, hashtags: { select: { hashtagId: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  const interests = viewerId ? await interestProfile(viewerId) : null;
  const now = Date.now();
  const scored = candidates.map((v) => {
    const ageH = (now - (v.publishedAt ?? v.createdAt).getTime()) / 36e5;
    const engagement = v._count.likes * 3 + v._count.comments * 4 + v.sharesCount * 5 + v._count.favorites * 4 + v._count.reposts * 5 + v.viewsCount * 0.3 + 4;
    let score = engagement / Math.pow(ageH + 2, 1.15);
    if (v.featured) score *= 2.5;
    if (interests) {
      if (interests.authors.has(v.authorId)) score *= 1.8;
      if (v.soundId && interests.sounds.has(v.soundId)) score *= 1.4;
      if (v.hashtags.some((h) => interests.tags.has(h.hashtagId))) score *= 1.6;
      if (interests.seen.has(v.id)) score *= 0.15;
    }
    score *= 0.75 + Math.random() * 0.5;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return toDTOs(scored.slice(0, limit).map((s) => s.v), viewerId);
}

async function interestProfile(userId: string) {
  const since = new Date(Date.now() - 30 * 864e5);
  const [likes, follows, seen] = await Promise.all([
    db.like.findMany({ where: { userId, createdAt: { gte: since } }, take: 200, orderBy: { createdAt: "desc" }, select: { video: { select: { authorId: true, soundId: true, hashtags: { select: { hashtagId: true } } } } } }),
    db.follow.findMany({ where: { followerId: userId, status: "ACCEPTED" }, select: { followingId: true } }),
    db.view.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 2 * 864e5) } }, select: { videoId: true }, take: 500 }),
  ]);
  const authors = new Set(follows.map((f) => f.followingId));
  const sounds = new Set<string>();
  const tags = new Set<string>();
  for (const { video } of likes) {
    authors.add(video.authorId);
    if (video.soundId) sounds.add(video.soundId);
    for (const h of video.hashtags) tags.add(h.hashtagId);
  }
  return { authors, sounds, tags, seen: new Set(seen.map((s) => s.videoId)) };
}

export async function listVideos(where: Prisma.VideoWhereInput, viewerId: string | null | undefined, opts: { take?: number; orderBy?: Prisma.VideoOrderByWithRelationInput[]; skipVisibility?: boolean } = {}) {
  const base = opts.skipVisibility ? {} : await visibleVideoWhere(viewerId);
  const rows = await db.video.findMany({ where: { AND: [base, where] }, include: videoInclude, orderBy: opts.orderBy ?? [{ createdAt: "desc" }], take: opts.take ?? 60 });
  return toDTOs(rows, viewerId);
}

export async function linkHashtagsAndMentions(videoId: string, caption: string, actorId: string, actorUsername: string) {
  const { hashtags, mentions } = extractTagsAndMentions(caption);
  await db.videoHashtag.deleteMany({ where: { videoId } });
  for (const name of hashtags.slice(0, 30)) {
    const tag = await db.hashtag.upsert({ where: { name }, create: { name }, update: {} });
    await db.videoHashtag.create({ data: { videoId, hashtagId: tag.id } }).catch(() => null);
  }
  if (mentions.length) {
    const users = await db.user.findMany({ where: { username: { in: mentions }, id: { not: actorId } }, select: { id: true } });
    for (const u of users) {
      await db.notification.create({ data: { userId: u.id, actorId, type: "MENTION", videoId } });
      publishUserEvent(u.id, { type: "notification", data: { actor: actorUsername } });
    }
  }
}

export type ProcessJob = Omit<RenderOptions, "input" | "soundPath" | "duetWith" | "stitchWith"> & {
  rawPath: string;
  soundId?: string | null;
  duetOfId?: string | null;
  stitchOfId?: string | null;
};

const running = new Set<string>();

export function startProcessing(videoId: string, job: ProcessJob) {
  if (running.has(videoId)) return;
  running.add(videoId);
  void processVideoJob(videoId, job).finally(() => running.delete(videoId));
}

async function processVideoJob(videoId: string, job: ProcessJob) {
  const { rm } = await import("node:fs/promises");
  try {
    const video = await db.video.findUniqueOrThrow({ where: { id: videoId }, include: { author: { select: { username: true, id: true } } } });
    const sound = job.soundId ? await db.sound.findUnique({ where: { id: job.soundId } }) : null;
    const duet = job.duetOfId ? await db.video.findUnique({ where: { id: job.duetOfId } }) : null;
    const stitch = job.stitchOfId ? await db.video.findUnique({ where: { id: job.stitchOfId } }) : null;
    const maxSeconds = Number(await getSetting("maxVideoSeconds")) || 180;
    const result = await renderVideo({
      ...job,
      input: job.rawPath,
      soundPath: absFromUrl(sound?.audioUrl),
      duetWith: absFromUrl(duet?.videoUrl),
      stitchWith: absFromUrl(stitch?.videoUrl),
      maxSeconds,
    });
    let soundId = sound?.id ?? null;
    if (!soundId && result.hadAudio) {
      const audio = await extractAudio(absFromUrl(result.url)!);
      const created = await db.sound.create({
        data: { title: `original sound - ${video.author.username}`, artist: video.author.username, audioUrl: audio.url, coverUrl: result.posterUrl, durationSec: audio.durationSec, isOriginal: true, creatorId: video.authorId },
      });
      soundId = created.id;
    }
    const scheduled = video.scheduledAt && video.scheduledAt > new Date();
    const finalStatus = video.status === "DRAFT" ? "DRAFT" : scheduled ? "SCHEDULED" : "READY";
    await db.video.update({
      where: { id: videoId },
      data: { videoUrl: result.url, posterUrl: result.posterUrl, width: result.width, height: result.height, durationSec: result.durationSec, soundId, status: finalStatus, publishedAt: finalStatus === "READY" ? new Date() : null },
    });
    const parent = duet ?? stitch;
    if (parent && parent.authorId !== video.authorId && finalStatus === "READY") {
      await db.notification.create({ data: { userId: parent.authorId, actorId: video.authorId, type: duet ? "DUET" : "STITCH", videoId } });
      publishUserEvent(parent.authorId, { type: "notification", data: {} });
    }
    publishUserEvent(video.authorId, { type: "video-ready", data: { id: videoId } });
  } catch (error) {
    console.error("video processing failed", videoId, error);
    await db.video.update({ where: { id: videoId }, data: { status: "FAILED", failReason: error instanceof Error ? error.message.slice(0, 500) : "Processing failed" } }).catch(() => null);
  } finally {
    await rm(job.rawPath, { force: true }).catch(() => null);
  }
}
