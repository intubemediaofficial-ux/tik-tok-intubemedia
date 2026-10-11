import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { getSettings } from "@/lib/settings";
import { AdminClient } from "@/components/admin-client";
import { compact, daysAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin panel" };

const TABS = ["overview", "users", "videos", "comments", "reports", "lives", "sounds", "payments", "withdrawals", "gifts", "settings"] as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  const { tab = "overview", q = "" } = await searchParams;
  const like = q ? { contains: q, mode: "insensitive" as const } : undefined;
  const j = <T,>(v: T) => JSON.parse(JSON.stringify(v));
  const day = daysAgo(1);
  let data: unknown = null;
  if (tab === "overview") {
    const [users, newUsers, videos, newVideos, views, lives, reports, pendingPay, pendingW, revenue, payout] = await Promise.all([
      db.user.count(), db.user.count({ where: { createdAt: { gte: day } } }), db.video.count(), db.video.count({ where: { createdAt: { gte: day } } }),
      db.video.aggregate({ _sum: { viewsCount: true } }), db.liveStream.count({ where: { status: "LIVE" } }), db.report.count({ where: { status: "OPEN" } }),
      db.coinPurchase.count({ where: { status: "PENDING" } }), db.withdrawal.count({ where: { status: "PENDING" } }),
      db.coinPurchase.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }), db.withdrawal.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }),
    ]);
    data = [
      ["Users", compact(users), `+${newUsers} today`], ["Videos", compact(videos), `+${newVideos} today`], ["Total views", compact(views._sum.viewsCount ?? 0), ""], ["LIVE now", lives, ""],
      ["Open reports", reports, ""], ["Pending payments", pendingPay, ""], ["Pending withdrawals", pendingW, ""], ["Coin revenue", `₹${revenue._sum.amountInr ?? 0}`, `Paid out ₹${payout._sum.amountInr ?? 0}`],
    ];
  }
  if (tab === "users") data = await db.user.findMany({ where: like ? { OR: [{ username: like }, { email: like }, { name: like }] } : {}, select: { id: true, username: true, name: true, email: true, role: true, status: true, isVerified: true, coins: true, diamonds: true, createdAt: true, _count: { select: { videos: true, followers: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  if (tab === "videos") data = await db.video.findMany({ where: like ? { OR: [{ caption: like }, { author: { username: like } }] } : {}, select: { id: true, caption: true, posterUrl: true, photoUrls: true, status: true, hidden: true, featured: true, viewsCount: true, createdAt: true, author: { select: { username: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  if (tab === "comments") data = await db.comment.findMany({ where: like ? { body: like } : {}, select: { id: true, body: true, hidden: true, createdAt: true, videoId: true, author: { select: { username: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  if (tab === "reports") data = await db.report.findMany({ include: { reporter: { select: { username: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  if (tab === "lives") data = await db.liveStream.findMany({ include: { host: { select: { username: true } } }, orderBy: { startedAt: "desc" }, take: 60 });
  if (tab === "sounds") data = await db.sound.findMany({ where: like ? { OR: [{ title: like }, { artist: like }] } : {}, include: { _count: { select: { videos: true } } }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 100 });
  if (tab === "payments") data = await db.coinPurchase.findMany({ include: { user: { select: { username: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  if (tab === "withdrawals") data = await db.withdrawal.findMany({ include: { user: { select: { username: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  if (tab === "gifts") data = { gifts: await db.gift.findMany({ orderBy: [{ sortOrder: "asc" }, { coins: "asc" }] }), packages: await db.coinPackage.findMany({ orderBy: [{ sortOrder: "asc" }, { priceInr: "asc" }] }) };
  if (tab === "settings") data = await getSettings();
  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <h1 className="section-title" style={{ fontSize: 26 }}><Shield color="var(--amber)" />Admin panel</h1>
      <div className="tabs" style={{ marginBottom: 16 }}>{TABS.map((t) => <Link key={t} href={`/admin?tab=${t}`} className={`tab ${tab === t ? "on" : ""}`} style={{ textTransform: "capitalize" }}>{t}</Link>)}</div>
      <AdminClient tab={tab} q={q} data={j(data)} me={user.id} />
    </div>
  );
}
