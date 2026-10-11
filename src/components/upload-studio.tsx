"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Columns2, Film, Images, Music2, Scissors, Square, Timer, Upload, X, RotateCcw, Sparkles, CalendarClock } from "lucide-react";
import { Toggle } from "@/components/ui";
import { SoundPicker, type PickedSound } from "@/components/sound-picker";
import { FILTERS, SPEED_OPTIONS } from "@/lib/filters";
import { toast } from "@/lib/client";

type Ref = { id: string; videoUrl: string; username: string; mode: "duet" | "stitch" } | null;

export function Studio({ refVideo, initialSound, initialCaption, maxSeconds }: { refVideo: Ref; initialSound: PickedSound | null; initialCaption: string; maxSeconds: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"video" | "photo">("video");
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [src, setSrc] = useState<string | null>(null);
  const [dur, setDur] = useState(0);
  const [trim, setTrim] = useState<[number, number]>([0, 0]);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState("none");
  const [cover, setCover] = useState(0);
  const [sound, setSound] = useState<PickedSound | null>(initialSound);
  const [origVol, setOrigVol] = useState(100);
  const [soundVol, setSoundVol] = useState(80);
  const [picker, setPicker] = useState(false);
  const [caption, setCaption] = useState(initialCaption);
  const [visibility, setVisibility] = useState("PUBLIC");
  const [allow, setAllow] = useState({ comments: true, duet: true, stitch: true, download: true });
  const [location, setLocation] = useState("");
  const [schedule, setSchedule] = useState("");
  const [stitchSec, setStitchSec] = useState(5);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [recording, setRecording] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recSec, setRecSec] = useState(0);
  const preview = useRef<HTMLVideoElement>(null);
  const cam = useRef<HTMLVideoElement>(null);
  const refEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => { if (audioEl.current) audioEl.current.volume = soundVol / 100; if (preview.current) preview.current.volume = origVol / 100; }, [soundVol, origVol]);

  function pick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast("Choose a video file");
    setFile(f); setSrc(URL.createObjectURL(f)); stopCam();
  }
  async function startCam() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 720, height: 1280 }, audio: true });
      if (cam.current) { cam.current.srcObject = stream.current; await cam.current.play(); }
      setCamOn(true);
    } catch { toast("Camera/microphone permission denied"); }
  }
  function stopCam() { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCamOn(false); }
  async function record() {
    if (!stream.current) return;
    for (let i = 3; i > 0; i--) { setCountdown(i); await new Promise((r) => setTimeout(r, 800)); }
    setCountdown(0);
    chunks.current = [];
    const type = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: r.mimeType || "video/webm" });
      pick(new File([blob], `recording.${blob.type.includes("mp4") ? "mp4" : "webm"}`, { type: blob.type }));
      setRecording(false);
    };
    rec.current = r; r.start(500); setRecording(true); setRecSec(0);
    if (refVideo && refEl.current && refVideo.mode === "duet") { refEl.current.currentTime = 0; refEl.current.play(); }
    if (sound && audioEl.current) { audioEl.current.currentTime = 0; audioEl.current.play(); }
  }
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSec((s) => { if (s + 1 >= Math.min(maxSeconds, 180)) rec.current?.stop(); return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [recording, maxSeconds]);
  function stopRec() { rec.current?.stop(); refEl.current?.pause(); audioEl.current?.pause(); }

  function onMeta() {
    const d = preview.current?.duration ?? 0;
    if (!Number.isFinite(d)) return;
    setDur(d); setTrim([0, Math.min(d, maxSeconds)]); setCover(0);
  }
  function syncAudio(play: boolean) {
    if (!audioEl.current || !sound) return;
    if (play) { audioEl.current.currentTime = Math.max(0, (preview.current?.currentTime ?? 0) - trim[0]); audioEl.current.play().catch(() => {}); } else audioEl.current.pause();
  }
  function onTime() {
    const el = preview.current;
    if (el && trim[1] > 0 && el.currentTime > trim[1]) { el.currentTime = trim[0]; syncAudio(true); }
  }

  async function submit(draft: boolean) {
    if (mode === "video" && !file) return toast("Record or upload a video first");
    if (mode === "photo" && !photos.length) return toast("Add at least one photo");
    setBusy(true); setPct(0);
    const fd = new FormData();
    fd.set("kind", mode === "video" ? "VIDEO" : "PHOTO");
    if (mode === "video") {
      fd.set("file", file!);
      fd.set("trimStart", String(trim[0])); fd.set("trimEnd", String(trim[1]));
      fd.set("speed", String(speed)); fd.set("filter", filter); fd.set("coverTime", String(cover));
      fd.set("originalVolume", String(origVol / 100)); fd.set("soundVolume", String(soundVol / 100));
      if (refVideo?.mode === "duet") fd.set("duetOfId", refVideo.id);
      if (refVideo?.mode === "stitch") { fd.set("stitchOfId", refVideo.id); fd.set("stitchSeconds", String(stitchSec)); }
    } else photos.forEach((p) => fd.append("images", p));
    if (sound) fd.set("soundId", sound.id);
    fd.set("caption", caption); fd.set("visibility", visibility); fd.set("location", location);
    fd.set("allowComments", String(allow.comments)); fd.set("allowDuet", String(allow.duet)); fd.set("allowStitch", String(allow.stitch)); fd.set("allowDownload", String(allow.download));
    if (draft) fd.set("draft", "true");
    if (schedule && !draft) fd.set("scheduledAt", new Date(schedule).toISOString());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setBusy(false);
      const d = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 400) return toast(d.error || "Upload failed");
      toast(draft ? "Saved to drafts" : schedule ? "Scheduled!" : mode === "video" ? "Uploaded! Processing your video…" : "Posted!");
      router.push(`/@me?tab=${draft || schedule || mode === "video" ? "drafts" : "videos"}`);
      router.refresh();
    };
    xhr.onerror = () => { setBusy(false); toast("Network error"); };
    xhr.send(fd);
  }

  const css = FILTERS[filter]?.css ?? "none";
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="page">
      <h1 className="section-title" style={{ fontSize: 26 }}><Sparkles color="var(--amber)" />Create {refVideo && <span className="chip on">{refVideo.mode === "duet" ? <Columns2 size={14} /> : <Scissors size={14} />}{refVideo.mode === "duet" ? "Duet" : "Stitch"} with @{refVideo.username}</span>}</h1>
      {!refVideo && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab ${mode === "video" ? "on" : ""}`} onClick={() => setMode("video")}><Film size={15} /> Video</button>
          <button className={`tab ${mode === "photo" ? "on" : ""}`} onClick={() => setMode("photo")}><Images size={15} /> Photo mode</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)", gap: 22 }} className="studio-grid">
        <div>
          {sound && <audio ref={audioEl} src={sound.audioUrl} />}
          {mode === "video" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {refVideo?.mode === "duet" && <video ref={refEl} src={refVideo.videoUrl} playsInline muted={!!src} style={{ width: "50%", aspectRatio: "9/16", objectFit: "cover", borderRadius: 18, background: "#000" }} />}
                <div style={{ position: "relative", flex: 1, aspectRatio: "9/16", borderRadius: 18, overflow: "hidden", background: "var(--panel-2)", border: "1px dashed #4a4470" }}>
                  {src ? (
                    <video ref={preview} src={src} playsInline controls={false} onLoadedMetadata={onMeta} onTimeUpdate={onTime} onPlay={() => syncAudio(true)} onPause={() => syncAudio(false)} onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())} style={{ width: "100%", height: "100%", objectFit: "cover", filter: css }} />
                  ) : (
                    <>
                      <video ref={cam} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", filter: css, display: camOn ? "block" : "none" }} />
                      {!camOn && (
                        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>
                          <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                            <div className="logo-mark" style={{ width: 64, height: 64 }}><Upload /></div>
                            <b>Upload or record</b>
                            <span className="muted" style={{ fontSize: 13 }}>MP4, MOV, WebM · up to {Math.round(maxSeconds / 60)} min · 500 MB</span>
                            <label className="btn btn-primary"><Upload size={16} />Select video<input type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} /></label>
                            <button className="btn" onClick={startCam}><Camera size={16} />Use camera</button>
                          </div>
                        </div>
                      )}
                      {countdown > 0 && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 90, fontWeight: 900 }}>{countdown}</div>}
                      {camOn && (
                        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, alignItems: "center" }}>
                          {recording && <span className="live-badge">● {fmt(recSec)}</span>}
                          {!recording ? <button onClick={record} aria-label="Record" style={{ width: 70, height: 70, borderRadius: 99, border: "5px solid #fff", background: "var(--rose)" }} /> : <button onClick={stopRec} aria-label="Stop" style={{ width: 70, height: 70, borderRadius: 99, border: "5px solid #fff", display: "grid", placeItems: "center" }}><Square fill="var(--rose)" color="var(--rose)" /></button>}
                          {!recording && <button className="btn btn-sm" onClick={stopCam}><X size={14} /></button>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {src && <button className="btn btn-sm" onClick={() => { setFile(null); setSrc(null); setDur(0); }}><RotateCcw size={14} />Choose another</button>}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <label className="card" style={{ aspectRatio: "9/16", display: "grid", placeItems: "center", textAlign: "center", cursor: "pointer", overflow: "hidden", position: "relative" }}>
                {photos[0] ? <img src={URL.createObjectURL(photos[0])} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: css }} /> : <span style={{ display: "grid", gap: 8, justifyItems: "center" }}><Images size={40} color="var(--amber)" /><b>Add photos</b><span className="muted" style={{ fontSize: 13 }}>Up to 35 photos, shown as a slideshow</span></span>}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 35))} />
              </label>
              {photos.length > 0 && <div className="row scroll-thin" style={{ overflowX: "auto", gap: 6 }}>{photos.map((p, i) => <div key={i} style={{ position: "relative" }}><img src={URL.createObjectURL(p)} alt="" style={{ width: 54, height: 72, objectFit: "cover", borderRadius: 8 }} /><button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: 2, right: 2, background: "#000a", borderRadius: 99 }}><X size={12} /></button></div>)}</div>}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
            <div className="row between"><b>Sound</b>{sound && <button className="muted" onClick={() => setSound(null)}><X size={16} /></button>}</div>
            <button className="btn" onClick={() => setPicker(true)} style={{ justifyContent: "flex-start" }}><Music2 size={17} />{sound ? `${sound.title} · ${sound.artist}` : "Add sound"}</button>
            {mode === "video" && sound && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label><span className="label">Original audio {origVol}%</span><input type="range" min={0} max={100} value={origVol} onChange={(e) => setOrigVol(+e.target.value)} style={{ width: "100%" }} /></label>
                <label><span className="label">Added sound {soundVol}%</span><input type="range" min={0} max={100} value={soundVol} onChange={(e) => setSoundVol(+e.target.value)} style={{ width: "100%" }} /></label>
              </div>
            )}
          </div>
          {(mode === "video" ? src : photos.length > 0) && (
            <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
              <b>Edit</b>
              <div><span className="label">Filters</span><div className="row scroll-thin" style={{ overflowX: "auto", gap: 8 }}>{Object.entries(FILTERS).map(([k, f]) => <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{f.label}</button>)}</div></div>
              {mode === "video" && (
                <>
                  <div><span className="label"><Timer size={13} /> Speed</span><div className="row">{SPEED_OPTIONS.map((s) => <button key={s} className={`chip ${speed === s ? "on" : ""}`} onClick={() => setSpeed(s)}>{s}x</button>)}</div></div>
                  {dur > 0 && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <span className="label"><Scissors size={13} /> Trim · {fmt(trim[0])} – {fmt(trim[1])} ({fmt(Math.max(0, trim[1] - trim[0]))})</span>
                      <input type="range" min={0} max={dur} step={0.1} value={trim[0]} onChange={(e) => { const v = Math.min(+e.target.value, trim[1] - 1); setTrim([v, trim[1]]); if (preview.current) preview.current.currentTime = v; }} />
                      <input type="range" min={0} max={dur} step={0.1} value={trim[1]} onChange={(e) => setTrim([trim[0], Math.max(+e.target.value, trim[0] + 1)])} />
                      <span className="label">Cover frame · {fmt(cover)}</span>
                      <input type="range" min={0} max={Math.max(0, trim[1] - trim[0])} step={0.1} value={cover} onChange={(e) => { setCover(+e.target.value); if (preview.current) preview.current.currentTime = trim[0] + +e.target.value; }} />
                    </div>
                  )}
                  {refVideo?.mode === "stitch" && <label><span className="label">Use first {stitchSec}s of @{refVideo.username}&apos;s video</span><input type="range" min={1} max={5} value={stitchSec} onChange={(e) => setStitchSec(+e.target.value)} style={{ width: "100%" }} /></label>}
                </>
              )}
            </div>
          )}
          <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
            <label><span className="label">Caption</span><textarea className="input" rows={3} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Describe your video… use #hashtags and @mentions" /></label>
            <div className="row"><span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>{caption.length}/2200</span></div>
            <label><span className="label">Location</span><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder="Add location" /></label>
            <label><span className="label">Who can watch</span>
              <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="PUBLIC">Everyone</option><option value="FRIENDS">Friends</option><option value="PRIVATE">Only me</option></select>
            </label>
            <div>
              <Toggle on={allow.comments} onChange={(v) => setAllow({ ...allow, comments: v })} label="Allow comments" />
              {mode === "video" && <><Toggle on={allow.duet} onChange={(v) => setAllow({ ...allow, duet: v })} label="Allow Duet" />
              <Toggle on={allow.stitch} onChange={(v) => setAllow({ ...allow, stitch: v })} label="Allow Stitch" />
              <Toggle on={allow.download} onChange={(v) => setAllow({ ...allow, download: v })} label="Allow downloads" /></>}
            </div>
            <label><span className="label"><CalendarClock size={13} /> Schedule (optional)</span><input type="datetime-local" className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} /></label>
          </div>
          {busy && <div className="card" style={{ padding: 12 }}><div className="row between" style={{ fontSize: 13, marginBottom: 6 }}><span>Uploading…</span><b>{pct}%</b></div><div style={{ height: 8, borderRadius: 9, background: "var(--panel-2)" }}><div style={{ height: "100%", width: `${pct}%`, background: "var(--grad)", borderRadius: 9 }} /></div></div>}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => submit(true)} style={{ flex: 1 }}>Save draft</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => submit(false)} style={{ flex: 2, height: 48 }}>{schedule ? "Schedule" : "Post"}</button>
          </div>
        </div>
      </div>
      {picker && <SoundPicker onPick={setSound} onClose={() => setPicker(false)} />}
    </div>
  );
}
