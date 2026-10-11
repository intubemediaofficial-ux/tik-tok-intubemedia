"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Share2, UserCheck, UserPlus, MessageCircle, Settings, Clock } from "lucide-react";
import { Avatar, Sheet } from "@/components/ui";
import { api, toast } from "@/lib/client";

export function ProfileActions({ username, userId, self, state: initial, followsMe, isPrivate, loggedIn = true, blocked = false }: { username: string; userId: string; self: boolean; state: "none" | "following" | "requested"; followsMe?: boolean; isPrivate: boolean; loggedIn?: boolean; blocked?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [menu, setMenu] = useState(false);

  const share = async () => {
    const url = `${location.origin}/@${username}`;
    if (navigator.share) await navigator.share({ url }).catch(() => {});
    else { await navigator.clipboard.writeText(url).catch(() => {}); toast("Profile link copied"); }
  };
  if (self) {
    return (
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Link href="/settings" className="btn"><Settings size={17} />Edit profile</Link>
        <Link href="/studio" className="btn">Creator Studio</Link>
        <button className="btn" onClick={share} aria-label="Share"><Share2 size={17} /></button>
      </div>
    );
  }
  async function follow() {
    if (!loggedIn) return (location.href = "/login");
    try {
      const d = await api<{ state: "none" | "following" | "requested" }>(`/api/follow/${username}`, { body: {} });
      setState(d.state); router.refresh();
    } catch (e) { toast((e as Error).message); }
  }
  async function message() {
    if (!loggedIn) return (location.href = "/login");
    try {
      const d = await api<{ conversationId: string }>("/api/messages", { body: { username } });
      router.push(`/messages/${d.conversationId}`);
    } catch (e) { toast((e as Error).message); }
  }
  async function block() {
    if (!blocked && !confirm(`Block @${username}? They won't be able to see your content or message you.`)) return;
    await api(`/api/block/${username}`, { body: {} });
    toast(blocked ? "Unblocked" : "Blocked"); setMenu(false); router.refresh();
  }
  async function report() {
    const reason = prompt("Why are you reporting this account?");
    if (!reason) return;
    await api("/api/reports", { body: { targetType: "USER", targetId: userId, reason } });
    toast("Report submitted"); setMenu(false);
  }
  if (blocked) return <button className="btn" onClick={block}>Unblock</button>;
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      {state === "none" ? <button className="btn btn-primary" onClick={follow} style={{ minWidth: 130 }}><UserPlus size={17} />{followsMe ? "Follow back" : isPrivate ? "Request" : "Follow"}</button>
        : <button className="btn" onClick={follow} style={{ minWidth: 130 }}>{state === "requested" ? <><Clock size={17} />Requested</> : <><UserCheck size={17} />{followsMe ? "Friends" : "Following"}</>}</button>}
      <button className="btn" onClick={message}><MessageCircle size={17} />Message</button>
      <button className="btn" onClick={share} aria-label="Share"><Share2 size={17} /></button>
      {loggedIn && <button className="btn" onClick={() => setMenu(true)} aria-label="More"><MoreHorizontal size={17} /></button>}
      {menu && (
        <Sheet title={`@${username}`} onClose={() => setMenu(false)}>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="btn" onClick={report}>Report account</button>
            <button className="btn btn-danger" onClick={block}>Block</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

type U = { id: string; username: string; name: string; avatarUrl: string | null; following: boolean; isSelf: boolean };

export function FollowCounts({ username, followers, following, likes, canSee }: { username: string; followers: number; following: number; likes: string; canSee: boolean }) {
  const [list, setList] = useState<null | "followers" | "following">(null);
  const [users, setUsers] = useState<U[] | null>(null);
  async function open(kind: "followers" | "following") {
    if (!canSee) return;
    setList(kind); setUsers(null);
    const d = await api<{ users: U[] }>(`/api/users/${username}/${kind}`);
    setUsers(d.users);
  }
  async function toggle(u: U) {
    const d = await api<{ state: string }>(`/api/follow/${u.username}`, { body: {} });
    setUsers((us) => us?.map((x) => (x.id === u.id ? { ...x, following: d.state !== "none" } : x)) ?? null);
  }
  return (
    <>
      <div className="row" style={{ gap: 22, margin: "16px 0 4px" }}>
        <button onClick={() => open("following")}><b style={{ fontSize: 18 }}>{following}</b> <span className="muted">Following</span></button>
        <button onClick={() => open("followers")}><b style={{ fontSize: 18 }}>{followers}</b> <span className="muted">Followers</span></button>
        <span><b style={{ fontSize: 18 }}>{likes}</b> <span className="muted">Likes</span></span>
      </div>
      {list && (
        <Sheet title={list === "followers" ? "Followers" : "Following"} onClose={() => setList(null)}>
          {users === null ? <div className="muted">Loading…</div> : users.length === 0 ? <div className="muted">No one yet</div> : users.map((u) => (
            <div key={u.id} className="row" style={{ padding: "8px 0" }}>
              <Link href={`/@${u.username}`} className="row" style={{ flex: 1, minWidth: 0 }} onClick={() => setList(null)}><Avatar src={u.avatarUrl} name={u.name} size={42} /><span><b>{u.username}</b><div className="muted" style={{ fontSize: 13 }}>{u.name}</div></span></Link>
              {!u.isSelf && <button className={`btn btn-sm ${u.following ? "" : "btn-primary"}`} onClick={() => toggle(u)}>{u.following ? "Following" : "Follow"}</button>}
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
}
