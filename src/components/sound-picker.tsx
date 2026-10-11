"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Music2, Pause, Play, Search } from "lucide-react";
import { Sheet } from "@/components/ui";
import { api } from "@/lib/client";

export type PickedSound = { id: string; title: string; artist: string; audioUrl: string; coverUrl: string | null };
type S = PickedSound & { uses: number; favorited: boolean; durationSec: number | null };

export function SoundPicker({ onPick, onClose }: { onPick: (s: PickedSound) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"discover" | "favorites">("discover");
  const [q, setQ] = useState("");
  const [sounds, setSounds] = useState<S[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const t = setTimeout(() => api<{ sounds: S[] }>(`/api/sounds?tab=${tab}&q=${encodeURIComponent(q)}`).then((d) => setSounds(d.sounds)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [tab, q]);
  function preview(s: S) {
    if (!audio.current) return;
    if (playing === s.id) { audio.current.pause(); setPlaying(null); return; }
    audio.current.src = s.audioUrl; audio.current.play(); setPlaying(s.id);
  }
  return (
    <Sheet title="Add sound" onClose={onClose}>
      <audio ref={audio} onEnded={() => setPlaying(null)} />
      <div style={{ position: "relative", marginBottom: 10 }}><Search size={17} className="muted" style={{ position: "absolute", left: 12, top: 14 }} /><input className="input" style={{ paddingLeft: 38 }} placeholder="Search sounds" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={`tab ${tab === "discover" ? "on" : ""}`} onClick={() => setTab("discover")}>Discover</button>
        <button className={`tab ${tab === "favorites" ? "on" : ""}`} onClick={() => setTab("favorites")}><Bookmark size={14} /> Favorites</button>
      </div>
      {sounds.length === 0 && <div className="muted" style={{ padding: 20, textAlign: "center" }}>No sounds found</div>}
      {sounds.map((s) => (
        <div key={s.id} className="row" style={{ padding: "8px 0" }}>
          <button onClick={() => preview(s)} className="avatar" style={{ width: 48, height: 48, borderRadius: 12, backgroundImage: s.coverUrl ? `url(${s.coverUrl})` : undefined, backgroundSize: "cover" }} aria-label="Preview">
            <span style={{ background: "#0007", borderRadius: 99, padding: 4, display: "grid", color: "#fff" }}>{playing === s.id ? <Pause size={16} /> : s.coverUrl ? <Play size={16} /> : <Music2 size={16} />}</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</b><span className="muted" style={{ fontSize: 13 }}>{s.artist} · {s.uses} videos</span></div>
          <button className="btn btn-sm btn-primary" onClick={() => { audio.current?.pause(); onPick(s); onClose(); }}>Use</button>
        </div>
      ))}
    </Sheet>
  );
}
