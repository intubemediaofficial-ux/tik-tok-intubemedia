import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Eye, Heart, MessageCircle, Share2, Users, Gem, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { compact, daysAgo } from "@/lib/format";
import { StudioRowActions } from "@/components/studio-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator Studio" };

export default async function Studio({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/studio");
  const days = [7, 28, 60].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 28;
  const since = daysAgo(days);
  const mine = { video: { authorId: user.id } };
  const [videos, views, likes, comments, followers, newFollowers, diamonds, watch, profileViews] = await Promise.all([
    db.video.findMany({ where: { authorId: user.id }, include: { _count: { select: { likes: true, comments: true, favorites: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.view.count({ where: { ...mine, createdAt: { gte: since } } }),
    db.like.count({ where: { ...mine, createdAt: { gte: since } } }),
    db.comment.count({ where: { ...mine, createdAt: { gte: since } } }),
    db.follow.count({ where: { followingId: user.id, status: "ACCEPTED" } }),
    db.follow.count({ where: { followingId: user.id, status: "ACCEPTED", createdAt: { gte: since } } }),
    db.giftTransaction.aggregate({ where: { receiverId: user.id, createdAt: { gte: since } }, _sum: { diamonds: true } }),
    db.view.aggregate({ where: { ...mine, createdAt: { gte: since } }, _avg: { watchedMs: true } }),
    db.profileView.count({ where: { profileId: user.id, createdAt: { gte: since } } }).catch(() => 0),
  ]);
  const daily = await db.$queryRaw<{ d: Date; n: bigint }[]>`SELECT date_trunc('day', v."createdAt") AS d, COUNT(*)::bigint AS n FROM "View" v JOIN "Video" x ON x.id = v."videoId" WHERE x."authorId" = ${user.id} AND v."createdAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  const map = new Map(daily.map((r) => [r.d.toISOString().slice(0, 10), Number(r.n)]));
  const series = Array.from({ length: days }, (_, i) => { const d = daysAgo(days - 1 - i).toISOString().slice(0, 10); return { d, n: map.get(d) ?? 0 }; });
  const max = Math.max(1, ...series.map((s) => s.n));
  const stats = [
    { label: "Video views", v: views, icon: Eye, c: "var(--amber)", sub: `${compact(videos.reduce((n, v) => n + v.viewsCount, 0))} total` },
    { label: "Likes", v: likes, icon: Heart, c: "var(--rose)" },
    { label: "Comments", v: comments, icon: MessageCircle, c: "var(--violet)" },
    { label: "Profile views", v: profileViews, icon: Users, c: "#5ad1ff" },
    { label: "New followers", v: newFollowers, icon: Users, c: "#7cf0b0", sub: `${compact(followers)} total` },
    { label: "Diamonds earned", v: diamonds._sum.diamonds ?? 0, icon: Gem, c: "#5ad1ff" },
    { label: "Avg. watch time", v: Math.round((watch._avg.watchedMs ?? 0) / 1000), icon: Clock, c: "var(--amber)", suffix: "s" },
    { label: "Shares (all time)", v: videos.reduce((s, v) => s + v.sharesCount, 0), icon: Share2, c: "var(--rose)" },
  ];
  return (
    <div className="page">
      <div className="row between" style={{ flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <h1 className="section-title" style={{ fontSize: 26, margin: 0 }}><BarChart3 color="var(--amber)" />Creator Studio</h1>
        <div className="tabs">{[7, 28, 60].map((d) => <Link key={d} href={`/studio?days=${d}`} className={`chip ${days === d ? "on" : ""}`} style={{ whiteSpace: "nowrap" }}>{d} days</Link>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginBottom: 18 }}>
        {stats.map((s) => <div key={s.label} className="stat-card"><div className="row muted" style={{ fontSize: 13 }}><s.icon size={16} color={s.c} />{s.label}</div><div className="v">{compact(s.v)}{s.suffix}</div>{s.sub && <div className="muted" style={{ fontSize: 12 }}>{s.sub}</div>}</div>)}
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <b>Daily views</b>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, marginTop: 14 }}>
          {series.map((s) => <div key={s.d} title={`${s.d}: ${s.n}`} style={{ flex: 1, height: `${Math.max(2, (s.n / max) * 100)}%`, background: "var(--grad)", borderRadius: "6px 6px 2px 2px", opacity: s.n ? 1 : 0.25 }} />)}
        </div>
        <div className="row between muted" style={{ fontSize: 11, marginTop: 6 }}><span>{series[0].d}</span><span>{series[series.length - 1].d}</span></div>
      </div>
      <div className="card" style={{ padding: 8, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Video</th><th>Status</th><th>Views</th><th>Likes</th><th>Comments</th><th>Saves</th><th>Shares</th><th></th></tr></thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/v/${v.id}`} className="row" style={{ gap: 10 }}>{(v.posterUrl || v.photoUrls[0]) && <img src={v.posterUrl ?? v.photoUrls[0]} alt="" style={{ width: 40, height: 54, objectFit: "cover", borderRadius: 8 }} />}<span style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{v.caption || "(no caption)"}</span></Link></td>
                <td><span className="chip" style={{ padding: "2px 10px", fontSize: 12 }}>{v.status}{v.visibility !== "PUBLIC" ? ` · ${v.visibility}` : ""}</span></td>
                <td>{compact(v.viewsCount)}</td><td>{compact(v._count.likes)}</td><td>{compact(v._count.comments)}</td><td>{compact(v._count.favorites)}</td><td>{compact(v.sharesCount)}</td>
                <td><StudioRowActions id={v.id} pinned={v.pinned} status={v.status} visibility={v.visibility} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {videos.length === 0 && <div className="muted" style={{ padding: 24, textAlign: "center" }}>No videos yet. <Link href="/upload" className="grad-text" style={{ fontWeight: 800 }}>Create one</Link></div>}
      </div>
    </div>
  );
}
