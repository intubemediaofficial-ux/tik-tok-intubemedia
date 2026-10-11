"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ago, toast } from "@/lib/client";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AdminClient({ tab, q, data, me }: { tab: string; q: string; data: any; me: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: string, id?: string, extra?: Record<string, unknown>) {
    setBusy(true);
    try { await api("/api/admin", { body: { action, id, data: extra } }); toast("Done"); router.refresh(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  const search = <form className="row" style={{ marginBottom: 12 }}><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={q} className="input" placeholder="Search" /><button className="btn">Search</button></form>;
  const B = (p: { a: string; id?: string; label: string; danger?: boolean; extra?: Record<string, unknown>; ask?: string }) => <ActBtn {...p} busy={busy} act={act} />;
  const st = (s: string) => <span className="chip" style={{ padding: "2px 10px", fontSize: 12 }}>{s}</span>;

  if (tab === "overview") return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>{data.map((d: any[]) => <div key={d[0]} className="stat-card"><div className="muted" style={{ fontSize: 13 }}>{d[0]}</div><div className="v">{d[1]}</div><div className="muted" style={{ fontSize: 12 }}>{d[2]}</div></div>)}</div>
      <Broadcast onSend={(text) => act("broadcast", undefined, { text })} />
    </div>
  );
  if (tab === "users") return <>{search}<DataTable head={["User", "Email", "Role", "Status", "Videos", "Followers", "Coins", "Diamonds", "Joined", "Actions"]} rows={data.map((u: any) => [
    <Link key="u" href={`/@${u.username}`}><b>@{u.username}</b>{u.isVerified && " ✔"}<div className="muted" style={{ fontSize: 12 }}>{u.name}</div></Link>, u.email, st(u.role), st(u.status), u._count.videos, u._count.followers, u.coins, u.diamonds, ago(u.createdAt),
    <div key="a" className="row" style={{ gap: 4, flexWrap: "wrap" }}>
      {u.status === "ACTIVE" ? u.id !== me && <B a="user.ban" id={u.id} label="Ban" danger ask={`Ban @${u.username}?`} /> : <B a="user.unban" id={u.id} label="Unban" />}
      <B a={u.isVerified ? "user.unverify" : "user.verify"} id={u.id} label={u.isVerified ? "Unverify" : "Verify"} />
      {u.id !== me && <B a={u.role === "ADMIN" ? "user.removeAdmin" : "user.makeAdmin"} id={u.id} label={u.role === "ADMIN" ? "Remove admin" : "Make admin"} ask="Change admin role?" />}
      <button className="btn btn-sm" onClick={() => { const n = Number(prompt("Coins to add (negative to remove)")); if (n) act("user.coins", u.id, { amount: n }); }}>Coins</button>
    </div>,
  ])} /></>;
  if (tab === "videos") return <>{search}<DataTable head={["Video", "Author", "Status", "Views", "Posted", "Actions"]} rows={data.map((v: any) => [
    <Link key="v" href={`/v/${v.id}`} className="row">{(v.posterUrl || v.photoUrls[0]) && <img src={v.posterUrl ?? v.photoUrls[0]} alt="" style={{ width: 36, height: 48, objectFit: "cover", borderRadius: 6 }} />}<span style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.caption || "(no caption)"}</span></Link>,
    `@${v.author.username}`, <span key="s">{st(v.status)}{v.hidden && st("HIDDEN")}{v.featured && st("FEATURED")}</span>, v.viewsCount, ago(v.createdAt),
    <div key="a" className="row" style={{ gap: 4 }}><B a={v.hidden ? "video.unhide" : "video.hide"} id={v.id} label={v.hidden ? "Unhide" : "Hide"} /><B a={v.featured ? "video.unfeature" : "video.feature"} id={v.id} label={v.featured ? "Unfeature" : "Feature"} /><B a="video.delete" id={v.id} label="Delete" danger ask="Delete this video permanently?" /></div>,
  ])} /></>;
  if (tab === "comments") return <>{search}<DataTable head={["Comment", "Author", "Video", "When", "Actions"]} rows={data.map((c: any) => [
    <span key="c" style={{ opacity: c.hidden ? 0.5 : 1 }}>{c.body}</span>, `@${c.author.username}`, <Link key="v" href={`/v/${c.videoId}`}>Open</Link>, ago(c.createdAt),
    <div key="a" className="row" style={{ gap: 4 }}>{!c.hidden && <B a="comment.hide" id={c.id} label="Hide" />}<B a="comment.delete" id={c.id} label="Delete" danger ask="Delete comment?" /></div>,
  ])} /></>;
  if (tab === "reports") return <DataTable head={["Target", "Reason", "Reporter", "Status", "When", "Actions"]} rows={data.map((r: any) => [
    <Link key="t" href={r.targetType === "VIDEO" ? `/v/${r.targetId}` : r.targetType === "LIVE" ? `/live/${r.targetId}` : "#"}>{r.targetType} · {r.targetId.slice(0, 8)}</Link>, r.reason, `@${r.reporter.username}`, st(r.status), ago(r.createdAt),
    r.status === "OPEN" ? <div key="a" className="row" style={{ gap: 4 }}>{r.targetType === "VIDEO" && <B a="video.hide" id={r.targetId} label="Hide video" />}{r.targetType === "COMMENT" && <B a="comment.hide" id={r.targetId} label="Hide comment" />}{r.targetType === "USER" && <B a="user.ban" id={r.targetId} label="Ban user" danger ask="Ban this user?" />}{r.targetType === "LIVE" && <B a="live.end" id={r.targetId} label="End LIVE" danger />}<B a="report.resolve" id={r.id} label="Resolve" /><B a="report.dismiss" id={r.id} label="Dismiss" /></div> : "—",
  ])} />;
  if (tab === "lives") return <DataTable head={["Host", "Title", "Status", "Likes", "Diamonds", "Started", "Actions"]} rows={data.map((l: any) => [
    `@${l.host.username}`, <Link key="t" href={`/live/${l.id}`}>{l.title}</Link>, st(l.status), l.likesCount, l.diamonds, ago(l.startedAt), l.status === "LIVE" ? <B key="a" a="live.end" id={l.id} label="End" danger ask="End this LIVE?" /> : "—",
  ])} />;
  if (tab === "sounds") return <>
    <SoundUpload onDone={() => router.refresh()} />
    {search}
    <DataTable head={["Sound", "Artist", "Videos", "Flags", "Actions"]} rows={data.map((s: any) => [
      <Link key="s" href={`/sound/${s.id}`}><b>{s.title}</b></Link>, s.artist, s._count.videos, <span key="f">{s.featured && st("FEATURED")}{s.hidden && st("HIDDEN")}{s.isOriginal && st("ORIGINAL")}</span>,
      <div key="a" className="row" style={{ gap: 4 }}><B a={s.featured ? "sound.unfeature" : "sound.feature"} id={s.id} label={s.featured ? "Unfeature" : "Feature"} /><B a={s.hidden ? "sound.unhide" : "sound.hide"} id={s.id} label={s.hidden ? "Unhide" : "Hide"} /></div>,
    ])} />
  </>;
  if (tab === "payments") return <DataTable head={["User", "Coins", "Amount", "Provider", "Reference (UTR)", "Status", "When", "Actions"]} rows={data.map((p: any) => [
    `@${p.user.username}`, p.coins, `₹${p.amountInr}`, p.provider, p.providerRef ?? "—", st(p.status), ago(p.createdAt),
    p.status === "PENDING" ? <div key="a" className="row" style={{ gap: 4 }}><B a="purchase.approve" id={p.id} label="Approve" ask={`Add ${p.coins} coins to @${p.user.username}?`} /><button className="btn btn-sm btn-danger" onClick={() => { const note = prompt("Reason for rejection"); if (note !== null) act("purchase.reject", p.id, { note }); }}>Reject</button></div> : "—",
  ])} />;
  if (tab === "withdrawals") return <DataTable head={["User", "Diamonds", "Amount", "UPI", "Status", "When", "Actions"]} rows={data.map((w: any) => [
    `@${w.user.username}`, w.diamonds, `₹${w.amountInr}`, w.upiId, st(w.status), ago(w.createdAt),
    w.status === "PENDING" ? <div key="a" className="row" style={{ gap: 4 }}><button className="btn btn-sm btn-primary" onClick={() => { const note = prompt("Payment reference / UTR"); if (note !== null) act("withdrawal.paid", w.id, { note }); }}>Mark paid</button><button className="btn btn-sm btn-danger" onClick={() => { const note = prompt("Reason"); if (note !== null) act("withdrawal.reject", w.id, { note }); }}>Reject</button></div> : (w.note ?? "—"),
  ])} />;
  if (tab === "gifts") return <GiftsAdmin data={data} act={act} />;
  if (tab === "settings") return <SettingsAdmin data={data} save={(d) => act("settings.save", undefined, d)} />;
  return null;
}

function ActBtn({ a, id, label, danger, extra, ask, busy, act }: { a: string; id?: string; label: string; danger?: boolean; extra?: Record<string, unknown>; ask?: string; busy: boolean; act: (a: string, id?: string, e?: Record<string, unknown>) => void }) {
  return <button className={`btn btn-sm ${danger ? "btn-danger" : ""}`} disabled={busy} onClick={() => { if (ask && !confirm(ask)) return; act(a, id, extra); }}>{label}</button>;
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return <div className="card" style={{ overflowX: "auto", padding: 6 }}><table className="table"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nothing here</div>}</div>;
}

function Broadcast({ onSend }: { onSend: (t: string) => void }) {
  const [t, setT] = useState("");
  return <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}><b>Send announcement to all users</b><textarea className="input" rows={2} maxLength={300} value={t} onChange={(e) => setT(e.target.value)} placeholder="Message shown in everyone's Activity" /><button className="btn btn-primary" disabled={!t.trim()} onClick={() => { if (confirm("Send to all users?")) { onSend(t); setT(""); } }}>Send</button></div>;
}

function SoundUpload({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true);
    const form = new FormData(e.currentTarget);
    form.set("featured", String((e.currentTarget.elements.namedItem("featuredBox") as HTMLInputElement).checked));
    try { await api("/api/admin/sounds", { form }); toast("Sound added"); (e.target as HTMLFormElement).reset(); onDone(); } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card" style={{ padding: 16, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", marginBottom: 14, alignItems: "end" }}>
      <label><span className="label">Title</span><input name="title" className="input" required /></label>
      <label><span className="label">Artist</span><input name="artist" className="input" required /></label>
      <label><span className="label">Audio (mp3/m4a/wav)</span><input name="file" type="file" accept="audio/*" className="input" required style={{ paddingTop: 10 }} /></label>
      <label><span className="label">Cover (optional)</span><input name="cover" type="file" accept="image/*" className="input" style={{ paddingTop: 10 }} /></label>
      <label className="row"><input name="featuredBox" type="checkbox" defaultChecked /> Featured</label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Add sound"}</button>
    </form>
  );
}

function GiftsAdmin({ data, act }: { data: any; act: (a: string, id?: string, d?: Record<string, unknown>) => void }) {
  const [g, setG] = useState({ name: "", emoji: "🎁", coins: 10 });
  const [p, setP] = useState({ coins: 100, bonus: 0, priceInr: 10 });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <b>Gifts</b>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, margin: "10px 0" }}>
          {data.gifts.map((x: any) => <div key={x.id} className="card" style={{ padding: 10, textAlign: "center", opacity: x.active ? 1 : 0.4 }}><div style={{ fontSize: 30 }}>{x.emoji}</div><b>{x.name}</b><div className="muted">{x.coins} coins</div>{x.active && <button className="btn btn-sm btn-danger" style={{ marginTop: 6 }} onClick={() => act("gift.delete", x.id)}>Disable</button>}</div>)}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ width: 80 }} value={g.emoji} onChange={(e) => setG({ ...g, emoji: e.target.value })} /><input className="input" style={{ width: 160 }} placeholder="Name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /><input className="input" style={{ width: 110 }} type="number" value={g.coins} onChange={(e) => setG({ ...g, coins: Number(e.target.value) })} /><button className="btn btn-primary" disabled={!g.name} onClick={() => act("gift.save", undefined, { ...g, active: true, sortOrder: 0 })}>Add gift</button></div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <b>Coin packages</b>
        <div style={{ display: "grid", gap: 6, margin: "10px 0" }}>{data.packages.map((x: any) => <div key={x.id} className="row between" style={{ opacity: x.active ? 1 : 0.4 }}><span>{x.coins} coins {x.bonus ? `+${x.bonus} bonus` : ""} · ₹{x.priceInr}</span>{x.active && <button className="btn btn-sm btn-danger" onClick={() => act("package.delete", x.id)}>Disable</button>}</div>)}</div>
        <div className="row" style={{ flexWrap: "wrap" }}><label>Coins<input className="input" style={{ width: 110 }} type="number" value={p.coins} onChange={(e) => setP({ ...p, coins: Number(e.target.value) })} /></label><label>Bonus<input className="input" style={{ width: 100 }} type="number" value={p.bonus} onChange={(e) => setP({ ...p, bonus: Number(e.target.value) })} /></label><label>Price ₹<input className="input" style={{ width: 100 }} type="number" value={p.priceInr} onChange={(e) => setP({ ...p, priceInr: Number(e.target.value) })} /></label><button className="btn btn-primary" onClick={() => act("package.save", undefined, { ...p, active: true, sortOrder: 0 })}>Add package</button></div>
      </div>
    </div>
  );
}

function SettingsAdmin({ data, save }: { data: Record<string, unknown>; save: (d: Record<string, unknown>) => void }) {
  const [s, setS] = useState<Record<string, string>>(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])));
  const labels: Record<string, string> = { diamondPerCoin: "Diamonds creator gets per coin gifted", inrPerDiamond: "₹ paid per diamond", minWithdrawDiamonds: "Minimum withdrawal (diamonds)", upiId: "UPI ID for coin payments", upiName: "UPI payee name", announcement: "Announcement banner", maxVideoSeconds: "Max video length (seconds)", signupsOpen: "Signups open (true/false)" };
  return (
    <div className="card" style={{ padding: 18, display: "grid", gap: 12, maxWidth: 640 }}>
      {Object.keys(s).map((k) => <label key={k}><span className="label">{labels[k] ?? k}</span><input className="input" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
      <button className="btn btn-primary" onClick={() => save(s)}>Save settings</button>
    </div>
  );
}
