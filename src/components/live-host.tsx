"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Radio, Users, Heart, Gem, Square, Camera } from "lucide-react";
import { api, compactNum, toast } from "@/lib/client";

type Ev = { type: string; data: Record<string, unknown> };

export function LiveHost({ username }: { username: string }) {
  const [title, setTitle] = useState("");
  const [liveId, setLiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [diamonds, setDiamonds] = useState(0);
  const [feed, setFeed] = useState<{ id: number; text: string; gift?: boolean }[]>([]);
  const [secs, setSecs] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  async function camera() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 720, height: 1280 }, audio: true });
      if (video.current) { video.current.srcObject = stream.current; await video.current.play(); }
      setReady(true);
    } catch { toast("Allow camera & microphone to go LIVE"); }
  }
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); rec.current?.stop(); }, []);

  async function start() {
    if (!stream.current) return;
    try {
      const { id } = await api<{ id: string }>("/api/live", { body: { title } });
      setLiveId(id);
      const type = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const r = new MediaRecorder(stream.current, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1_500_000 });
      let first = true;
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        const isFirst = first; first = false;
        queue.current = queue.current.then(() => fetch(`/api/live/${id}/ingest`, { method: "POST", body: e.data, headers: { "x-first-chunk": isFirst ? "1" : "0" } }).then((res) => { if (res.status === 410) r.stop(); }).catch(() => {}));
      };
      r.start(1000);
      rec.current = r;
    } catch (e) { toast((e as Error).message); }
  }
  async function end() {
    rec.current?.stop();
    if (liveId) await api("/api/live", { method: "DELETE", body: { id: liveId } }).catch(() => {});
    stream.current?.getTracks().forEach((t) => t.stop());
    setLiveId("ended");
  }
  useEffect(() => {
    if (!liveId || liveId === "ended") return;
    const es = new EventSource(`/api/live/${liveId}/events?host=1`);
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as Ev;
      const push = (text: string, gift = false) => setFeed((f) => [...f.slice(-40), { id: Date.now() + Math.random(), text, gift }]);
      if (ev.type === "viewers") setViewers(Number(ev.data.count) || 0);
      if (ev.type === "likes") setLikes(Number(ev.data.total) || 0);
      if (ev.type === "comment") push(`${ev.data.username}: ${ev.data.body}`);
      if (ev.type === "gift") { const g = ev.data.gift as { emoji: string; name: string; coins: number }; push(`${ev.data.username} sent ${ev.data.quantity}× ${g.emoji} ${g.name}`, true); setDiamonds((d) => d + Math.floor(g.coins * Number(ev.data.quantity) * 0.5)); }
    };
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => { es.close(); clearInterval(t); };
  }, [liveId]);

  if (liveId === "ended") {
    return (
      <div className="page page-narrow" style={{ textAlign: "center" }}>
        <div className="card" style={{ padding: 40, display: "grid", gap: 12, justifyItems: "center" }}>
          <div className="logo-mark" style={{ width: 70, height: 70 }}><Radio /></div>
          <h1 className="brand" style={{ margin: 0 }}>LIVE ended</h1>
          <div className="row" style={{ gap: 24 }}><span><b>{Math.floor(secs / 60)}m {secs % 60}s</b><div className="muted">Duration</div></span><span><b>{compactNum(likes)}</b><div className="muted">Likes</div></span><span><b>{diamonds}</b><div className="muted">Diamonds</div></span></div>
          <div className="row"><Link href={`/@${username}`} className="btn">Profile</Link><Link href="/wallet" className="btn btn-primary">Wallet</Link></div>
        </div>
      </div>
    );
  }
  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 420px) 1fr", gap: 20 }}>
      <div style={{ position: "relative", aspectRatio: "9/16", borderRadius: 22, overflow: "hidden", background: "var(--panel-2)" }}>
        <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
        {!ready && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><button className="btn btn-primary" onClick={camera}><Camera size={18} />Turn on camera</button></div>}
        {liveId && (
          <>
            <div className="row" style={{ position: "absolute", top: 12, left: 12, gap: 8 }}><span className="live-badge">LIVE {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span><span className="chip" style={{ background: "#0008" }}><Users size={13} />{viewers}</span><span className="chip" style={{ background: "#0008" }}><Heart size={13} />{compactNum(likes)}</span><span className="chip" style={{ background: "#0008" }}><Gem size={13} />{diamonds}</span></div>
            <div className="live-chat" style={{ right: 12 }}>{feed.map((f) => <div key={f.id} className="msg" style={f.gift ? { background: "#ffb02055" } : undefined}>{f.text}</div>)}</div>
          </>
        )}
      </div>
      <div className="card" style={{ padding: 20, display: "grid", gap: 14, alignContent: "start" }}>
        <h1 className="section-title" style={{ margin: 0 }}><Radio color="var(--rose)" />{liveId ? "You're LIVE" : "Go LIVE"}</h1>
        {!liveId ? (
          <>
            <label><span className="label">Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What's your LIVE about?" /></label>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Your followers get notified. Viewers can comment, send likes and gifts — gifts turn into diamonds you can withdraw from your wallet.</p>
            <button className="btn btn-primary" disabled={!ready || !title.trim()} onClick={start} style={{ height: 50 }}><Radio size={18} />Start LIVE</button>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Share your LIVE: <code>{typeof window !== "undefined" ? `${location.origin}/live/${liveId}` : ""}</code></p>
            <button className="btn" onClick={() => { navigator.clipboard.writeText(`${location.origin}/live/${liveId}`); toast("Link copied"); }}>Copy link</button>
            <button className="btn btn-danger" onClick={end} style={{ height: 50 }}><Square size={16} />End LIVE</button>
          </>
        )}
      </div>
    </div>
  );
}
