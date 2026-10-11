import Link from "next/link";
import { Flame, Hash, Music2, Radio, Search, TrendingUp, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { listVideos } from "@/lib/videos";
import { trendingHashtags } from "@/lib/search";
import { blockedIds } from "@/lib/access";
import { VideoGrid } from "@/components/video-grid";
import { Avatar } from "@/components/ui";
import { compact, daysAgo } from "@/lib/format";
import { publicUserSelect } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore" };

export default async function Explore({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const user = await getCurrentUser();
  const blocked = await blockedIds(user?.id);
  const since = daysAgo(30);
  const [tags, trending, sounds, creators, lives] = await Promise.all([
    trendingHashtags(14),
    listVideos(c ? { hashtags: { some: { hashtag: { name: c } } } } : { createdAt: { gte: since } }, user?.id, { take: 30, orderBy: [{ featured: "desc" }, { viewsCount: "desc" }, { createdAt: "desc" }] }),
    db.sound.findMany({ where: { hidden: false }, include: { _count: { select: { videos: true } } }, orderBy: [{ featured: "desc" }, { videos: { _count: "desc" } }], take: 8 }),
    db.user.findMany({ where: { status: "ACTIVE", id: { notIn: [...blocked, ...(user ? [user.id] : [])] }, videos: { some: { status: "READY" } } }, select: { ...publicUserSelect, _count: { select: { followers: { where: { status: "ACCEPTED" } } } } }, orderBy: { followers: { _count: "desc" } }, take: 10 }),
    db.liveStream.findMany({ where: { status: "LIVE" }, include: { host: { select: publicUserSelect } }, take: 6, orderBy: { startedAt: "desc" } }),
  ]);
  return (
    <div className="page">
      <form action="/search" className="row" style={{ marginBottom: 22 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} className="muted" style={{ position: "absolute", left: 14, top: 14 }} />
          <input name="q" className="input" placeholder="Search creators, videos, sounds, hashtags" style={{ paddingLeft: 42, height: 48 }} />
        </div>
        <button className="btn btn-primary" style={{ height: 48 }}>Search</button>
      </form>
      <div className="tabs" style={{ marginBottom: 20 }}>
        <Link href="/explore" className={`chip ${!c ? "on" : ""}`}><Flame size={14} />Trending</Link>
        {tags.map((t) => <Link key={t.name} href={`/explore?c=${encodeURIComponent(t.name)}`} className={`chip ${c === t.name ? "on" : ""}`}>#{t.name}</Link>)}
      </div>
      {lives.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="section-title"><Radio color="var(--rose)" />LIVE now</h2>
          <div className="row scroll-thin" style={{ overflowX: "auto", gap: 12 }}>
            {lives.map((l) => (
              <Link key={l.id} href={`/live/${l.id}`} className="card" style={{ minWidth: 180, padding: 14, display: "grid", justifyItems: "center", gap: 6 }}>
                <span className="ring" style={{ background: "var(--rose)" }}><Avatar src={l.host.avatarUrl} name={l.host.name} size={64} /></span>
                <span className="live-badge">LIVE</span>
                <b>@{l.host.username}</b>
                <span className="muted" style={{ fontSize: 13, textAlign: "center" }}>{l.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 28 }}>
        <section>
          <h2 className="section-title"><TrendingUp color="var(--amber)" />{c ? `#${c}` : "Trending videos"}</h2>
          <VideoGrid videos={trending} showAuthor />
        </section>
        <section>
          <h2 className="section-title"><Music2 color="var(--violet)" />Popular sounds</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {sounds.map((s) => (
              <Link key={s.id} href={`/sound/${s.id}`} className="card row" style={{ padding: 10 }}>
                <span className="avatar" style={{ width: 52, height: 52, borderRadius: 12, backgroundImage: s.coverUrl ? `url(${s.coverUrl})` : undefined, backgroundSize: "cover" }}>{!s.coverUrl && <Music2 size={22} />}</span>
                <span style={{ minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</b><span className="muted" style={{ fontSize: 13 }}>{s.artist} · {compact(s._count.videos)} videos</span></span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="section-title"><UserPlus color="var(--rose)" />Creators to follow</h2>
          <div className="row scroll-thin" style={{ overflowX: "auto", gap: 12, paddingBottom: 6 }}>
            {creators.map((u) => (
              <Link key={u.id} href={`/@${u.username}`} className="card" style={{ minWidth: 150, padding: 16, display: "grid", justifyItems: "center", gap: 6, textAlign: "center" }}>
                <Avatar src={u.avatarUrl} name={u.name} size={70} ring />
                <b style={{ fontSize: 14 }}>{u.name}</b>
                <span className="muted" style={{ fontSize: 12 }}>@{u.username}</span>
                <span className="chip" style={{ fontSize: 12 }}>{compact(u._count.followers)} followers</span>
              </Link>
            ))}
          </div>
        </section>
        {tags.length > 0 && (
          <section>
            <h2 className="section-title"><Hash color="var(--amber)" />Hashtags</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {tags.map((t) => <Link key={t.name} href={`/tag/${encodeURIComponent(t.name)}`} className="card row" style={{ padding: 12 }}><span className="avatar" style={{ width: 40, height: 40 }}><Hash size={18} /></span><span><b>#{t.name}</b><div className="muted" style={{ fontSize: 12 }}>{compact(t.uses)} videos</div></span></Link>)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
