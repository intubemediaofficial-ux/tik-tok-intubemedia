"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { VideoSlide } from "@/components/video-slide";
import { StoriesBar } from "@/components/stories-bar";
import type { VideoDTO } from "@/lib/videos";

export function Feed({ kind, initial, me, single = false }: { kind: "foryou" | "following" | "friends"; initial: VideoDTO[]; me: string | null; single?: boolean }) {
  const [videos, setVideos] = useState(initial);
  const [active, setActive] = useState(initial[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(single);
  const box = useRef<HTMLDivElement>(null);

  const more = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?kind=${kind}&exclude=${videos.map((v) => v.id).join(",")}`);
      const d = (await res.json()) as { videos: VideoDTO[] };
      const fresh = d.videos.filter((v) => !videos.some((x) => x.id === v.id));
      if (!fresh.length) setDone(true);
      setVideos((vs) => [...vs, ...fresh]);
    } finally { setLoading(false); }
  }, [kind, videos, loading, done]);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive((e.target as HTMLElement).dataset.id ?? "");
    }, { root, threshold: [0.6] });
    root.querySelectorAll(".slide").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [videos]);

  useEffect(() => {
    const idx = videos.findIndex((v) => v.id === active);
    if (idx >= videos.length - 3) more();
  }, [active, videos, more]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        box.current?.scrollBy({ top: (e.key === "ArrowDown" ? 1 : -1) * window.innerHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {!single && (
        <div className="feed-top">
          <Link href="/following" className={kind === "following" ? "on" : ""}>Following</Link>
          <Link href="/friends" className={kind === "friends" ? "on" : ""}>Friends</Link>
          <Link href="/" className={kind === "foryou" ? "on" : ""}>For You</Link>
          <Link href="/search" style={{ display: "grid", placeItems: "center" }} aria-label="Search"><Search size={16} /></Link>
        </div>
      )}
      <div className="feed" ref={box}>
        {!single && me && kind !== "friends" && <StoriesBar />}
        {videos.map((v) => <VideoSlide key={v.id} video={v} active={v.id === active} me={me} onHide={() => setVideos((vs) => vs.filter((x) => x.id !== v.id))} />)}
        {(done || videos.length === 0) && (
          <section className="slide">
            <div style={{ textAlign: "center", display: "grid", justifyItems: "center", gap: 12, padding: 30 }}>
              <div className="logo-mark" style={{ width: 70, height: 70, fontSize: 32 }}><Sparkles /></div>
              <div className="brand" style={{ fontSize: 24 }}>{videos.length ? "You're all caught up" : kind === "foryou" ? "No videos yet" : kind === "friends" ? "No videos from friends yet" : "Follow creators to fill this feed"}</div>
              <p className="muted" style={{ maxWidth: 340 }}>{kind === "foryou" ? "Be the first to post something amazing." : "Discover creators on Explore and follow them to see their videos here."}</p>
              <div className="row"><Link href="/explore" className="btn">Explore</Link>{me && <Link href="/upload" className="btn btn-primary">Create video</Link>}</div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
