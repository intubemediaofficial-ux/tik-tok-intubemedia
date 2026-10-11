"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Compass, Home, LogIn, LogOut, MessageCircle, Plus, Radio, Search, Settings, Shield, User, Users, Wallet, BarChart3 } from "lucide-react";
import { Avatar, Toaster } from "@/components/ui";
import { appName } from "@/lib/format";

type ShellUser = { username: string; avatarUrl: string | null; role: string; name: string } | null;

const BARE = ["/login", "/signup"];
const BARE_PREFIX = ["/embed/"];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  useEffect(() => {
    if (!user) return;
    const load = () => fetch("/api/notifications").then((r) => r.json()).then((d) => setCounts({ notifications: d.unread ?? 0, messages: d.unreadMessages ?? 0 })).catch(() => {});
    load();
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string };
        if (["notification", "message", "read"].includes(ev.type)) load();
        window.dispatchEvent(new CustomEvent("app-event", { detail: ev }));
      } catch {}
    };
    const t = setInterval(load, 60000);
    return () => { es.close(); clearInterval(t); };
  }, [user]);

  useEffect(() => {
    if (path === "/inbox" && counts.notifications) setCounts((c) => ({ ...c, notifications: 0 }));
  }, [path, counts.notifications]);

  if (BARE.includes(path) || BARE_PREFIX.some((p) => path.startsWith(p))) return <>{children}<Toaster /></>;

  const is = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const links = [
    { href: "/", label: "For You", icon: Home },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/following", label: "Following", icon: Users },
    { href: "/live", label: "LIVE", icon: Radio },
    { href: "/messages", label: "Messages", icon: MessageCircle, badge: counts.messages, auth: true },
    { href: "/inbox", label: "Activity", icon: Bell, badge: counts.notifications, auth: true },
    { href: "/upload", label: "Create", icon: Plus, auth: true },
    { href: "/wallet", label: "Wallet", icon: Wallet, auth: true },
    { href: "/studio", label: "Creator Studio", icon: BarChart3, auth: true },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar scroll-thin" style={{ overflowY: "auto" }}>
        <Link href="/" className="row" style={{ padding: "4px 10px 18px" }}>
          <span className="logo-mark">T</span>
          <span className="brand" style={{ fontSize: 26 }}>{appName}</span>
        </Link>
        <Link href="/search" className="row" style={{ margin: "0 4px 10px", padding: "10px 14px", borderRadius: 14, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--muted)", fontSize: 14 }}>
          <Search size={18} /> Search
        </Link>
        {links.filter((l) => !l.auth || user).map((l) => (
          <Link key={l.href} href={l.href} className={`side-link ${is(l.href) ? "active" : ""}`}>
            <l.icon size={22} />{l.label}
            {!!l.badge && <span className="badge">{l.badge > 99 ? "99+" : l.badge}</span>}
          </Link>
        ))}
        {user ? (
          <>
            <Link href={`/@${user.username}`} className={`side-link ${path === `/@${user.username}` ? "active" : ""}`}><Avatar src={user.avatarUrl} name={user.name} size={24} />Profile</Link>
            <Link href="/settings" className={`side-link ${is("/settings") ? "active" : ""}`}><Settings size={22} />Settings</Link>
            {user.role === "ADMIN" && <Link href="/admin" className={`side-link ${is("/admin") ? "active" : ""}`}><Shield size={22} />Admin panel</Link>}
            <button onClick={logout} className="side-link" style={{ textAlign: "left" }}><LogOut size={22} />Log out</button>
          </>
        ) : (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>Log in to follow creators, like videos and go LIVE.</p>
            <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}><LogIn size={18} />Log in</Link>
          </div>
        )}
        <div className="muted" style={{ marginTop: "auto", fontSize: 12, padding: "20px 10px 0" }}>© {new Date().getFullYear()} {appName} · Intube Media</div>
      </aside>
      <main className="main">{children}</main>
      <nav className="dock">
        <Link href="/" className={is("/") ? "active" : ""}><Home size={22} />Home</Link>
        <Link href="/explore" className={is("/explore") || is("/search") ? "active" : ""}><Compass size={22} />Explore</Link>
        <Link href={user ? "/upload" : "/login"}><span className="create"><Plus size={24} /></span></Link>
        <Link href={user ? "/inbox" : "/login"} className={is("/inbox") || is("/messages") ? "active" : ""}><Bell size={22} />Inbox{!!(counts.notifications + counts.messages) && <span className="badge" style={{ left: 26, top: 0 }}>{counts.notifications + counts.messages}</span>}</Link>
        <Link href={user ? `/@${user.username}` : "/login"} className={path.startsWith("/@") ? "active" : ""}><User size={22} />Me</Link>
      </nav>
      <Toaster />
    </div>
  );
}
