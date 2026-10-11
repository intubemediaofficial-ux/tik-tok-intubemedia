"use client";

import { useRef, useState } from "react";
import { Bookmark, Pause, Play } from "lucide-react";
import { api, toast } from "@/lib/client";

export function SoundActions({ id, audioUrl, favorited, loggedIn }: { id: string; audioUrl: string; favorited: boolean; loggedIn: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [fav, setFav] = useState(favorited);
  async function toggleFav() {
    if (!loggedIn) return (location.href = "/login");
    const d = await api<{ favorited: boolean }>(`/api/sounds/${id}`, { body: {} });
    setFav(d.favorited); toast(d.favorited ? "Added to favorite sounds" : "Removed from favorites");
  }
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <audio ref={audio} src={audioUrl} onEnded={() => setPlaying(false)} />
      <button className="btn btn-sm" onClick={() => { if (playing) audio.current?.pause(); else audio.current?.play(); setPlaying(!playing); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button>
      <button className="btn btn-sm" onClick={toggleFav} style={fav ? { borderColor: "var(--amber)", color: "#ffd27a" } : undefined}><Bookmark size={16} fill={fav ? "currentColor" : "none"} />{fav ? "Saved" : "Add to favorites"}</button>
    </div>
  );
}
