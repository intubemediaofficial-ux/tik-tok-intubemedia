"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Gift, Heart, MessageCircle, Music2, Pause, Play, Plus, Share2, Volume2, VolumeX, Check, Repeat2 } from "lucide-react";
import { Avatar, RichText, UserName } from "@/components/ui";
import { CommentsSheet } from "@/components/comments-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { GiftSheet } from "@/components/gift-sheet";
import { api, ago, compactNum, toast } from "@/lib/client";
import type { VideoDTO } from "@/lib/videos";

let globalMuted = true;

export function VideoSlide({ video: initial, active, me, onHide }: { video: VideoDTO; active: boolean; me: string | null; onHide?: () => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(globalMuted);
  const [progress, setProgress] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [sheet, setSheet] = useState<"comments" | "share" | "gift" | null>(null);
  const [photo, setPhoto] = useState(0);
  const [expand, setExpand] = useState(false);
  const watch = useRef({ start: 0, total: 0, sent: false });
  const lastTap = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.muted = globalMuted;
      setMuted(globalMuted);
      el.play().then(() => setPaused(false)).catch(() => { el.muted = true; setMuted(true); el.play().catch(() => setPaused(true)); });
      watch.current.start = Date.now();
    } else {
      el.pause();
      if (watch.current.start) watch.current.total += Date.now() - watch.current.start;
      watch.current.start = 0;
    }
  }, [active]);

  useEffect(() => {
    if (!active || v.kind !== "PHOTO" || v.photoUrls.length < 2) return;
    const t = setInterval(() => setPhoto((p) => (p + 1) % v.photoUrls.length), 3500);
    return () => clearInterval(t);
  }, [active, v.kind, v.photoUrls.length]);

  useEffect(() => {
    if (!active || watch.current.sent) return;
    const t = setTimeout(() => {
      watch.current.sent = true;
      api(`/api/videos/${v.id}/view`, { body: { watchedMs: 2000, completed: false } }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [active, v.id]);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) { el.play(); setPaused(false); } else { el.pause(); setPaused(true); }
  }
  function toggleMute() {
    globalMuted = !globalMuted;
    setMuted(globalMuted);
    if (ref.current) ref.current.muted = globalMuted;
  }
  async function like(force?: boolean) {
    if (!me) return (location.href = "/login");
    if (force && v.viewer.liked) return;
    const optimistic = !v.viewer.liked;
    setV((x) => ({ ...x, viewer: { ...x.viewer, liked: optimistic }, counts: { ...x.counts, likes: x.counts.likes + (optimistic ? 1 : -1) } }));
    try {
      const d = await api<{ liked: boolean; count: number }>(`/api/videos/${v.id}/like`, { body: {} });
      setV((x) => ({ ...x, viewer: { ...x.viewer, liked: d.liked }, counts: { ...x.counts, likes: d.count } }));
    } catch (e) { toast((e as Error).message); }
  }
  async function fav() {
    if (!me) return (location.href = "/login");
    const d = await api<{ favorited: boolean; count: number }>(`/api/videos/${v.id}/favorite`, { body: {} });
    setV((x) => ({ ...x, viewer: { ...x.viewer, favorited: d.favorited }, counts: { ...x.counts, favorites: d.count } }));
    toast(d.favorited ? "Saved to Favorites" : "Removed from Favorites");
  }
  async function follow() {
    if (!me) return (location.href = "/login");
    const d = await api<{ state: string }>(`/api/follow/${v.author.username}`, { body: {} });
    setV((x) => ({ ...x, viewer: { ...x.viewer, following: d.state !== "none" } }));
    if (d.state === "requested") toast("Follow request sent");
  }
  function onTap(e: React.MouseEvent) {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (now - lastTap.current < 280) {
      const id = now;
      setHearts((h) => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 900);
      like(true);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setTimeout(() => { if (lastTap.current === now && v.kind === "VIDEO") togglePlay(); }, 290);
  }
  function seek(e: React.MouseEvent) {
    const el = ref.current;
    if (!el || !el.duration) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  }

  const rail = (
    <div className="rail">
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Link href={`/@${v.author.username}`}><Avatar src={v.author.avatarUrl} name={v.author.name} size={50} ring /></Link>
        {!v.viewer.isAuthor && (
          <button onClick={follow} aria-label="Follow" style={{ position: "absolute", left: "50%", bottom: -9, transform: "translateX(-50%)", width: 22, height: 22, borderRadius: 99, background: v.viewer.following ? "#fff" : "var(--rose)", color: v.viewer.following ? "var(--rose)" : "#fff", display: "grid", placeItems: "center" }}>
            {v.viewer.following ? <Check size={14} /> : <Plus size={14} />}
          </button>
        )}
      </div>
      <button className={`rail-btn ${v.viewer.liked ? "on" : ""}`} onClick={() => like()} aria-label="Like" aria-pressed={v.viewer.liked}><span className="ico"><Heart size={24} fill={v.viewer.liked ? "currentColor" : "none"} /></span>{compactNum(v.counts.likes)}</button>
      <button className="rail-btn" onClick={() => setSheet("comments")} aria-label="Comments"><span className="ico"><MessageCircle size={24} /></span>{compactNum(v.counts.comments)}</button>
      <button className={`rail-btn fav ${v.viewer.favorited ? "on" : ""}`} onClick={fav} aria-label="Save" aria-pressed={v.viewer.favorited}><span className="ico"><Bookmark size={24} fill={v.viewer.favorited ? "currentColor" : "none"} /></span>{compactNum(v.counts.favorites)}</button>
      {!v.viewer.isAuthor && <button className="rail-btn" onClick={() => (me ? setSheet("gift") : (location.href = "/login"))} aria-label="Send gift"><span className="ico" style={{ color: "var(--amber)" }}><Gift size={24} /></span>Gift</button>}
      <button className="rail-btn" onClick={() => setSheet("share")} aria-label="Share"><span className="ico"><Share2 size={24} /></span>{compactNum(v.counts.shares)}</button>
      {v.sound && (
        <Link href={`/sound/${v.sound.id}`} aria-label="Sound"><span className="spin-disc" style={{ backgroundImage: `url(${v.sound.coverUrl || v.author.avatarUrl || "/icon-192.png"})`, display: "block" }} /></Link>
      )}
    </div>
  );

  return (
    <section className="slide" data-id={v.id}>
      <div className="stage">
        {v.kind === "VIDEO" ? (
          <video
            ref={ref}
            src={v.videoUrl ?? undefined}
            poster={v.posterUrl ?? undefined}
            loop
            playsInline
            preload={active ? "auto" : "metadata"}
            onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
            onClick={onTap}
          />
        ) : (
          <div className="photo" onClick={onTap} style={{ position: "relative" }}>
            {v.photoUrls.map((u, i) => <img key={u} src={u} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: i === photo ? 1 : 0, transition: "opacity .5s" }} />)}
            {v.photoUrls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setPhoto((p) => (p - 1 + v.photoUrls.length) % v.photoUrls.length); }} aria-label="Previous photo" style={{ position: "absolute", left: 8, top: "50%", background: "#0006", borderRadius: 99, padding: 6 }}><ChevronLeft /></button>
                <button onClick={(e) => { e.stopPropagation(); setPhoto((p) => (p + 1) % v.photoUrls.length); }} aria-label="Next photo" style={{ position: "absolute", right: 8, top: "50%", background: "#0006", borderRadius: 99, padding: 6 }}><ChevronRight /></button>
                <div style={{ position: "absolute", top: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>{v.photoUrls.map((u, i) => <span key={u} style={{ width: i === photo ? 18 : 6, height: 6, borderRadius: 9, background: i === photo ? "#fff" : "#fff6", transition: ".2s" }} />)}</div>
              </>
            )}
          </div>
        )}
        {hearts.map((h) => <Heart key={h.id} className="big-heart" size={96} fill="currentColor" style={{ left: h.x, top: h.y }} />)}
        {paused && v.kind === "VIDEO" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><Play size={72} fill="#fff9" color="#fff9" /></div>}
        {v.kind === "VIDEO" && (
          <div style={{ position: "absolute", top: 70, right: 14, display: "flex", flexDirection: "column", gap: 8, zIndex: 3 }}>
            <button onClick={togglePlay} style={{ background: "#0006", borderRadius: 99, padding: 8 }} aria-label="Play/pause">{paused ? <Play size={18} /> : <Pause size={18} />}</button>
            <button onClick={toggleMute} style={{ background: "#0006", borderRadius: 99, padding: 8 }} aria-label="Mute">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          </div>
        )}
        <div className="overlay">
          {v.repostedBy && <div className="chip" style={{ marginBottom: 8, background: "#0007" }}><Repeat2 size={13} />{v.repostedBy} reposted</div>}
          <div className="row" style={{ gap: 8 }}>
            <UserName username={v.author.username} verified={v.author.isVerified} />
            <span className="muted" style={{ fontSize: 13 }}>· {ago(v.createdAt)}</span>
          </div>
          {(v.duetOf || v.stitchOf) && (
            <div style={{ fontSize: 13, marginTop: 4 }} className="muted">
              {v.duetOf && <Link href={`/v/${v.duetOf.id}`}>Duet with @{v.duetOf.username}</Link>}
              {v.stitchOf && <Link href={`/v/${v.stitchOf.id}`}>Stitched from @{v.stitchOf.username}</Link>}
            </div>
          )}
          {v.caption && (
            <div onClick={() => setExpand(!expand)} style={{ marginTop: 6, fontSize: 15, lineHeight: 1.4, cursor: "pointer", ...(expand ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
              <RichText text={v.caption} />
            </div>
          )}
          {v.sound && (
            <Link href={`/sound/${v.sound.id}`} className="row" style={{ gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600 }}>
              <Music2 size={14} /><span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 240 }}>{v.sound.title} · {v.sound.artist}</span>
            </Link>
          )}
        </div>
        {v.kind === "VIDEO" && <div className="progress" onClick={seek}><div style={{ width: `${progress * 100}%` }} /></div>}
      </div>
      {rail}
      {sheet === "comments" && <CommentsSheet videoId={v.id} me={me} onClose={() => setSheet(null)} onCount={(d) => setV((x) => ({ ...x, counts: { ...x.counts, comments: x.counts.comments + d } }))} />}
      {sheet === "share" && <ShareSheet video={v} me={me} onClose={() => setSheet(null)} onHide={onHide} onRepost={(r) => setV((x) => ({ ...x, viewer: { ...x.viewer, reposted: r } }))} />}
      {sheet === "gift" && <GiftSheet videoId={v.id} onClose={() => setSheet(null)} />}
    </section>
  );
}
