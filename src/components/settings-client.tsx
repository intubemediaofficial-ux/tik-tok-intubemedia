"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Lock, Shield, User, Ban, KeyRound, Trash2 } from "lucide-react";
import { Avatar, Toggle } from "@/components/ui";
import { api, toast } from "@/lib/client";

type U = { name: string; username: string; email: string; bio: string; website: string; avatarUrl: string | null; isPrivate: boolean; showLiked: boolean; allowDuet: boolean; allowStitch: boolean; allowDownload: boolean; allowMessages: string; commentFilter: string };

export function SettingsClient({ user, blocked }: { user: U; blocked: { id: string; username: string; name: string; avatarUrl: string | null }[] }) {
  const router = useRouter();
  const [u, setU] = useState(user);
  const [avatar, setAvatar] = useState(user.avatarUrl);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<U> & { currentPassword?: string; newPassword?: string }) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...patch };
      if (typeof patch.commentFilter === "string") body.commentFilter = patch.commentFilter.split(",").map((s) => s.trim()).filter(Boolean);
      await api("/api/account", { method: "PATCH", body });
      toast("Saved"); router.refresh();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  function flip(k: keyof U, v: boolean) { setU({ ...u, [k]: v }); save({ [k]: v }); }
  async function upload(f: File) {
    const form = new FormData(); form.set("file", f);
    try { const d = await api<{ url: string }>("/api/account/avatar", { form }); setAvatar(d.url); toast("Photo updated"); router.refresh(); } catch (e) { toast((e as Error).message); }
  }
  async function unblock(username: string) { await api(`/api/block/${username}`, { body: {} }); router.refresh(); }
  async function deleteAccount() {
    const password = prompt("Enter your password to permanently deactivate your account");
    if (!password) return;
    try { await api("/api/account", { method: "DELETE", body: { password } }); location.href = "/"; } catch (e) { toast((e as Error).message); }
  }
  const card = { padding: 18, display: "grid", gap: 12 } as const;
  return (
    <div className="page page-narrow" style={{ display: "grid", gap: 16 }}>
      <h1 className="section-title" style={{ fontSize: 26, margin: 0 }}>Settings</h1>
      <section className="card" style={card}>
        <b className="row"><User size={18} />Edit profile</b>
        <div className="row">
          <Avatar src={avatar} name={u.name} size={84} ring />
          <label className="btn"><Camera size={16} />Change photo<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        </div>
        <label><span className="label">Name</span><input className="input" value={u.name} maxLength={60} onChange={(e) => setU({ ...u, name: e.target.value })} /></label>
        <label><span className="label">Username</span><input className="input" value={u.username} maxLength={30} onChange={(e) => setU({ ...u, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") })} /></label>
        <label><span className="label">Bio · {u.bio.length}/160</span><textarea className="input" rows={3} maxLength={160} value={u.bio} onChange={(e) => setU({ ...u, bio: e.target.value })} /></label>
        <label><span className="label">Website</span><input className="input" value={u.website} maxLength={200} onChange={(e) => setU({ ...u, website: e.target.value })} placeholder="https://" /></label>
        <div className="muted" style={{ fontSize: 13 }}>Email: {u.email}</div>
        <button className="btn btn-primary" disabled={busy} onClick={() => save({ name: u.name, username: u.username, bio: u.bio, website: u.website })}>Save profile</button>
      </section>
      <section className="card" style={card}>
        <b className="row"><Lock size={18} />Privacy</b>
        <div>
          <Toggle on={u.isPrivate} onChange={(v) => flip("isPrivate", v)} label="Private account" hint="Only approved followers can see your videos" />
          <Toggle on={u.showLiked} onChange={(v) => flip("showLiked", v)} label="Show liked videos on profile" />
          <Toggle on={u.allowDuet} onChange={(v) => flip("allowDuet", v)} label="Allow Duets" />
          <Toggle on={u.allowStitch} onChange={(v) => flip("allowStitch", v)} label="Allow Stitches" />
          <Toggle on={u.allowDownload} onChange={(v) => flip("allowDownload", v)} label="Allow video downloads" />
        </div>
        <label><span className="label">Who can message you</span>
          <select className="input" value={u.allowMessages} onChange={(e) => { setU({ ...u, allowMessages: e.target.value }); save({ allowMessages: e.target.value }); }}><option value="everyone">Everyone</option><option value="friends">Friends</option><option value="nobody">No one</option></select>
        </label>
        <label><span className="label">Comment filter keywords (comma separated)</span><input className="input" value={u.commentFilter} onChange={(e) => setU({ ...u, commentFilter: e.target.value })} placeholder="spam, abuse" /></label>
        <button className="btn" disabled={busy} onClick={() => save({ commentFilter: u.commentFilter })}>Save filter</button>
      </section>
      <section className="card" style={card}>
        <b className="row"><KeyRound size={18} />Password</b>
        <input className="input" type="password" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <input className="input" type="password" placeholder="New password (8+ characters)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <button className="btn" disabled={busy || pw.newPassword.length < 8} onClick={async () => { await save(pw); setPw({ currentPassword: "", newPassword: "" }); }}>Change password</button>
      </section>
      <section className="card" style={card}>
        <b className="row"><Ban size={18} />Blocked accounts</b>
        {blocked.length === 0 ? <div className="muted">You haven&apos;t blocked anyone.</div> : blocked.map((b) => <div key={b.id} className="row"><Avatar src={b.avatarUrl} name={b.name} size={36} /><b style={{ flex: 1 }}>{b.username}</b><button className="btn btn-sm" onClick={() => unblock(b.username)}>Unblock</button></div>)}
      </section>
      <section className="card" style={card}>
        <b className="row"><Shield size={18} />Account</b>
        <button className="btn btn-danger" onClick={deleteAccount}><Trash2 size={16} />Deactivate account</button>
      </section>
    </div>
  );
}
