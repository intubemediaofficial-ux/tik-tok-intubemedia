import Link from "next/link";
import { Hash, Music2, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/security";
import { searchAll } from "@/lib/search";
import { VideoGrid } from "@/components/video-grid";
import { Avatar, Empty } from "@/components/ui";
import { compact } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const TABS = ["top", "users", "videos", "sounds", "hashtags", "live"] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const { q = "", tab = "top" } = await searchParams;
  const user = await getCurrentUser();
  const r = q.trim() ? await searchAll(q.trim().slice(0, 80), user?.id, 30) : null;
  const users = r ? (
    <div style={{ display: "grid", gap: 8 }}>
      {r.users.map((u) => (
        <Link key={u.id} href={`/@${u.username}`} className="card row" style={{ padding: 12 }}>
          <Avatar src={u.avatarUrl} name={u.name} size={52} />
          <div style={{ minWidth: 0 }}><b>{u.username}</b><div className="muted" style={{ fontSize: 13 }}>{u.name} · {compact(u._count.followers)} followers · {u._count.videos} videos</div>{u.bio && <div className="muted" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.bio}</div>}</div>
        </Link>
      ))}
    </div>
  ) : null;
  const sounds = r ? (
    <div style={{ display: "grid", gap: 8 }}>
      {r.sounds.map((s) => <Link key={s.id} href={`/sound/${s.id}`} className="card row" style={{ padding: 12 }}><span className="avatar" style={{ width: 48, height: 48, borderRadius: 12 }}><Music2 size={20} /></span><span><b>{s.title}</b><div className="muted" style={{ fontSize: 13 }}>{s.artist} · {compact(s.uses)} videos</div></span></Link>)}
    </div>
  ) : null;
  const tags = r ? (
    <div style={{ display: "grid", gap: 8 }}>
      {r.hashtags.map((h) => <Link key={h.name} href={`/tag/${encodeURIComponent(h.name)}`} className="card row" style={{ padding: 12 }}><span className="avatar" style={{ width: 44, height: 44 }}><Hash size={20} /></span><span><b>#{h.name}</b><div className="muted" style={{ fontSize: 13 }}>{compact(h.uses)} videos</div></span></Link>)}
    </div>
  ) : null;
  const lives = r ? (
    <div style={{ display: "grid", gap: 8 }}>
      {r.lives.map((l) => <Link key={l.id} href={`/live/${l.id}`} className="card row" style={{ padding: 12 }}><Avatar src={l.host.avatarUrl} name={l.host.name} size={48} /><span><span className="live-badge">LIVE</span> <b>@{l.host.username}</b><div className="muted" style={{ fontSize: 13 }}>{l.title}</div></span></Link>)}
    </div>
  ) : null;
  const total = r ? r.users.length + r.videos.length + r.sounds.length + r.hashtags.length + r.lives.length : 0;
  return (
    <div className="page">
      <form className="row" style={{ marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} className="muted" style={{ position: "absolute", left: 14, top: 14 }} />
          <input name="q" defaultValue={q} autoFocus className="input" placeholder="Search" style={{ paddingLeft: 42, height: 48 }} />
          <input type="hidden" name="tab" value={tab} />
        </div>
        <button className="btn btn-primary" style={{ height: 48 }}>Search</button>
      </form>
      {r && (
        <div className="tabs" style={{ marginBottom: 18 }}>
          {TABS.map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(q)}&tab=${t}`} className={`tab ${tab === t ? "on" : ""}`} style={{ textTransform: "capitalize" }}>{t}</Link>)}
        </div>
      )}
      {!r ? <Empty icon={<Search />} title="Find anything" text="Search for creators, videos, sounds, hashtags and LIVE streams." /> : total === 0 ? <Empty icon={<Search />} title={`No results for “${q}”`} text="Try a different word or check the spelling." /> : (
        <>
          {tab === "top" && (
            <div style={{ display: "grid", gap: 24 }}>
              {r.users.length > 0 && <section><h2 className="section-title">Accounts</h2>{users}</section>}
              {r.videos.length > 0 && <section><h2 className="section-title">Videos</h2><VideoGrid videos={r.videos.slice(0, 12)} showAuthor /></section>}
              {r.sounds.length > 0 && <section><h2 className="section-title">Sounds</h2>{sounds}</section>}
              {r.hashtags.length > 0 && <section><h2 className="section-title">Hashtags</h2>{tags}</section>}
            </div>
          )}
          {tab === "users" && users}
          {tab === "videos" && <VideoGrid videos={r.videos} showAuthor />}
          {tab === "sounds" && sounds}
          {tab === "hashtags" && tags}
          {tab === "live" && (r.lives.length ? lives : <div className="muted">No one matching is LIVE right now.</div>)}
        </>
      )}
    </div>
  );
}
