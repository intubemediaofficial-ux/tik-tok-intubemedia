"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Gift, Heart, Send, Share2, Users, X, Flag } from "lucide-react";
import { Avatar } from "@/components/ui";
import { GiftSheet } from "@/components/gift-sheet";
import { api, compactNum, toast } from "@/lib/client";

type Live = { id: string; title: string; status: string; likes: number; host: { id: string; username: string; name: string; avatarUrl: string | null; isVerified: boolean } };
type C = { id: string; body: string; username: string; avatarUrl: string | null; gift?: boolean };

export function LiveViewer({ live, initialComments, me, following: initFollow, isHost }: { live: Live; initialComments: C[]; me: string | null; following: boolean; isHost: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<C[]>(initialComments);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(live.likes);
  const [ended, setEnded] = useState(live.status !== "LIVE");
  const [waiting, setWaiting] = useState(true);
  const [text, setText] = useState("");
  const [gift, setGift] = useState(false);
  const [pops, setPops] = useState<{ id: number; text: string }[]>([]);
  const [hearts, setHearts] = useState<number[]>([]);
  const [following, setFollowing] = useState(initFollow);
  const pendingLikes = useRef(0);

  useEffect(() => {
    if (ended || !video.current) return;
    const src = `/live-hls/${live.id}/index.m3u8`;
    const el = video.current;
    let hls: Hls | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const attach = () => {
      if (Hls.isSupported()) {
        hls = new Hls({ liveSyncDurationCount: 2, manifestLoadingMaxRetry: 30, manifestLoadingRetryDelay: 1500 });
        hls.loadSource(src); hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { setWaiting(false); el.play().catch(() => { el.muted = true; el.play(); }); });
        hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { hls?.destroy(); retry = setTimeout(attach, 3000); } });
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = src; el.onloadedmetadata = () => { setWaiting(false); el.play(); }; }
    };
    attach();
    return () => { hls?.destroy(); clearTimeout(retry); };
  }, [live.id, ended]);

  useEffect(() => {
    const es = new EventSource(`/api/live/${live.id}/events`);
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as { type: string; data: Record<string, unknown> };
      if (ev.type === "viewers") setViewers(Number(ev.data.count) || 0);
      if (ev.type === "likes") { setLikes(Number(ev.data.total) || 0); setHearts((h) => [...h.slice(-12), Date.now() + Math.random()]); }
      if (ev.type === "comment") setComments((c) => [...c.slice(-80), { id: String(ev.data.id), body: String(ev.data.body), username: String(ev.data.username), avatarUrl: (ev.data.avatarUrl as string) ?? null }]);
      if (ev.type === "gift") {
        const g = ev.data.gift as { emoji: string; name: string };
        const txt = `${ev.data.username} sent ${ev.data.quantity}× ${g.emoji} ${g.name}`;
        const id = Date.now() + Math.random();
        setPops((p) => [...p, { id, text: txt }]); setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 3000);
        setComments((c) => [...c.slice(-80), { id: String(id), body: txt, username: String(ev.data.username), avatarUrl: null, gift: true }]);
      }
      if (ev.type === "ended") setEnded(true);
    };
    return () => es.close();
  }, [live.id]);
  useEffect(() => { chat.current?.scrollTo({ top: chat.current.scrollHeight }); }, [comments.length]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!pendingLikes.current) return;
      const n = pendingLikes.current; pendingLikes.current = 0;
      api(`/api/live/${live.id}/like`, { body: { count: n } }).catch(() => {});
    }, 1200);
    return () => clearInterval(t);
  }, [live.id]);

  function tapLike() {
    if (!me) return (location.href = "/login");
    pendingLikes.current += 1;
    setHearts((h) => [...h.slice(-12), Date.now() + Math.random()]);
  }
  async function send() {
    if (!me) return (location.href = "/login");
    if (!text.trim()) return;
    try { await api(`/api/live/${live.id}/comment`, { body: { body: text } }); setText(""); } catch (e) { toast((e as Error).message); }
  }
  async function follow() {
    if (!me) return (location.href = "/login");
    const d = await api<{ state: string }>(`/api/follow/${live.host.username}`, { body: {} });
    setFollowing(d.state !== "none");
  }
  async function report() {
    const reason = prompt("Why are you reporting this LIVE?");
    if (reason) { await api("/api/reports", { body: { targetType: "LIVE", targetId: live.id, reason } }); toast("Report submitted"); }
  }

  return (
    <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 0, #ff3d7f22, transparent 60%)" }}>
      <div className="stage" style={{ background: "#000" }}>
        <video ref={video} playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} onDoubleClick={tapLike} />
        {(ended || waiting) && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", background: "#0009" }}>
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <Avatar src={live.host.avatarUrl} name={live.host.name} size={90} ring />
              <b style={{ fontSize: 20 }}>{ended ? "This LIVE has ended" : "Connecting to LIVE…"}</b>
              {ended && <Link href={`/@${live.host.username}`} className="btn btn-primary">View profile</Link>}
            </div>
          </div>
        )}
        <div className="row between" style={{ position: "absolute", top: 12, left: 12, right: 12 }}>
          <div className="row" style={{ background: "#0008", borderRadius: 99, padding: "4px 10px 4px 4px", gap: 8 }}>
            <Link href={`/@${live.host.username}`}><Avatar src={live.host.avatarUrl} name={live.host.name} size={34} /></Link>
            <div style={{ fontSize: 13, lineHeight: 1.1 }}><b>{live.host.username}</b><div className="muted" style={{ fontSize: 11 }}>{compactNum(likes)} likes</div></div>
            {!isHost && !following && <button className="btn btn-sm btn-primary" style={{ height: 28 }} onClick={follow}>Follow</button>}
          </div>
          <div className="row" style={{ gap: 6 }}><span className="live-badge">LIVE</span><span className="chip" style={{ background: "#0008", padding: "4px 10px" }}><Users size={13} />{viewers}</span><Link href="/live" aria-label="Close"><X /></Link></div>
        </div>
        <div style={{ position: "absolute", top: 58, left: 12, fontSize: 13, background: "#0006", padding: "4px 10px", borderRadius: 10 }}>{live.title}</div>
        {pops.map((p, i) => <div key={p.id} className="gift-pop" style={{ top: 96 + i * 44 }}>{p.text}</div>)}
        {hearts.map((h) => <Heart key={h} className="float-heart" size={30} fill="var(--rose)" color="var(--rose)" style={{ ["--dx" as string]: `${Math.round((h % 1) * 80 - 40)}px` }} />)}
        <div className="live-chat" ref={chat}>{comments.map((c) => <div key={c.id} className="msg" style={c.gift ? { background: "#ffb02055" } : undefined}><b style={{ color: "#ffd27a" }}>{c.username}</b> {c.gift ? "" : c.body}{c.gift && c.body.replace(c.username, "")}</div>)}</div>
        {!ended && (
          <div className="row" style={{ position: "absolute", left: 12, right: 12, bottom: 16, gap: 8 }}>
            <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input className="input" style={{ background: "#000a", height: 44 }} placeholder={me ? "Say something…" : "Log in to chat"} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
              <button className="btn" style={{ background: "#000a" }} aria-label="Send"><Send size={17} /></button>
            </form>
            {!isHost && <button className="btn" style={{ background: "#000a", color: "var(--amber)" }} onClick={() => (me ? setGift(true) : (location.href = "/login"))} aria-label="Gift"><Gift size={18} /></button>}
            <button className="btn" style={{ background: "#000a", color: "var(--rose)" }} onClick={tapLike} aria-label="Like"><Heart size={18} fill="currentColor" /></button>
            <button className="btn" style={{ background: "#000a" }} onClick={() => { navigator.clipboard.writeText(location.href); toast("Link copied"); }} aria-label="Share"><Share2 size={17} /></button>
            {me && !isHost && <button className="btn" style={{ background: "#000a" }} onClick={report} aria-label="Report"><Flag size={16} /></button>}
          </div>
        )}
      </div>
      {gift && <GiftSheet liveId={live.id} onClose={() => setGift(false)} />}
    </div>
  );
}
