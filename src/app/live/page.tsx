import Link from "next/link";
import { Radio, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { blockedIds } from "@/lib/access";
import { viewerCount } from "@/lib/live";
import { Avatar, Empty } from "@/components/ui";
import { publicUserSelect } from "@/lib/user-dto";
import { compact } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "LIVE" };

export default async function LiveList() {
  const user = await getCurrentUser();
  const blocked = await blockedIds(user?.id);
  const lives = await db.liveStream.findMany({ where: { status: "LIVE", hostId: { notIn: blocked } }, include: { host: { select: publicUserSelect } }, orderBy: { startedAt: "desc" }, take: 60 });
  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 className="section-title" style={{ fontSize: 26, margin: 0 }}><Radio color="var(--rose)" />LIVE now</h1>
        {user && <Link href="/live/go" className="btn btn-primary"><Radio size={18} />Go LIVE</Link>}
      </div>
      {lives.length === 0 ? <Empty icon={<Radio />} title="No one is LIVE right now" text="Start your own LIVE and your followers will get notified." action={user ? <Link href="/live/go" className="btn btn-primary">Go LIVE</Link> : <Link href="/login" className="btn btn-primary">Log in to go LIVE</Link>} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {lives.map((l) => (
            <Link key={l.id} href={`/live/${l.id}`} className="tile" style={{ aspectRatio: "3/4", background: "radial-gradient(circle at 30% 20%, #ff3d7f44, transparent 60%), radial-gradient(circle at 80% 80%, #7c5cff44, transparent 60%), var(--panel-2)", display: "grid", placeItems: "center" }}>
              <span className="flag live-badge" style={{ background: "var(--rose)" }}>LIVE</span>
              <span className="flag" style={{ left: "auto", right: 8 }}><Users size={11} /> {compact(viewerCount(l.id))}</span>
              <span style={{ display: "grid", justifyItems: "center", gap: 8 }}><span className="ring" style={{ background: "var(--rose)" }}><Avatar src={l.host.avatarUrl} name={l.host.name} size={90} /></span><b>@{l.host.username}</b></span>
              <div className="meta">{l.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
