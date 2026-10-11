import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { hash } from "@node-rs/argon2";
import { db } from "../src/lib/db";
import { bootstrap } from "../src/lib/bootstrap";
import { datedPath, probe } from "../src/lib/media";
import { linkHashtagsAndMentions } from "../src/lib/videos";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const ff = process.env.FFMPEG_PATH || "ffmpeg";

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(ff, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err))));
  });
}

const USERS = [
  { username: "riya.dance", name: "Riya Sharma", bio: "Dance is my language 💃 | Jaipur", colors: ["#ff3d7f", "#7c5cff"] },
  { username: "chef.kabir", name: "Kabir Kitchen", bio: "60-second desi recipes 🍛", colors: ["#ffb020", "#ff5a36"] },
  { username: "travel.with.anu", name: "Anu Travels", bio: "Exploring Incredible India ✈️", colors: ["#20c997", "#3b82f6"] },
  { username: "comedy.raju", name: "Raju Comedy", bio: "Hasna mana hai 😂", colors: ["#f59e0b", "#ef4444"] },
  { username: "fit.with.neha", name: "Neha Fitness", bio: "Home workouts | No gym needed 💪", colors: ["#22d3ee", "#a855f7"] },
  { username: "bainsla.beats", name: "Bainsla Beats", bio: "Original music & covers 🎵", colors: ["#7c5cff", "#ec4899"] },
  { username: "tech.tara", name: "Tara Tech", bio: "Phone tips & gadgets 📱", colors: ["#0ea5e9", "#10b981"] },
  { username: "art.by.meera", name: "Meera Arts", bio: "Mehndi & sketch art 🎨", colors: ["#e11d48", "#f97316"] },
];

const SOUNDS = [
  { title: "Thirak Anthem", artist: "Bainsla Beats", expr: "0.25*sin(2*PI*(220+40*floor(mod(t*2,4)))*t)*(0.6+0.4*sin(2*PI*2*t))" },
  { title: "Desi Groove", artist: "Intube Music", expr: "0.22*sin(2*PI*(330+55*floor(mod(t*4,3)))*t)+0.12*sin(2*PI*110*t)*gte(mod(t,0.5),0.25)" },
  { title: "Chill Sunset", artist: "Lo-Fi Lane", expr: "0.2*sin(2*PI*262*t)*(0.5+0.5*sin(2*PI*0.5*t))+0.15*sin(2*PI*392*t)" },
  { title: "Workout Pump", artist: "Fit Mix", expr: "0.3*sin(2*PI*(150+50*floor(mod(t*8,2)))*t)*gte(mod(t,0.25),0.08)" },
  { title: "Funny Bones", artist: "Comedy Kit", expr: "0.25*sin(2*PI*(440+200*sin(2*PI*3*t))*t)" },
];

const VIDEOS: [string, string, number][] = [
  ["riya.dance", "Naya step try kiya 🔥 #dance #trending #thirak", 0],
  ["riya.dance", "Garba practice before Navratri 💃 #garba #dance", 1],
  ["chef.kabir", "5 minute Maggi hack 🍜 #food #recipe #hack", 2],
  ["chef.kabir", "Street style pani puri at home #food #streetfood", 1],
  ["travel.with.anu", "Sunrise at Nahargarh Fort 🌅 #travel #jaipur", 2],
  ["travel.with.anu", "Hidden waterfall in Meghalaya 💧 #travel #nature", 2],
  ["comedy.raju", "When mummy says 'bas 5 minute' 😂 #comedy #relatable", 4],
  ["comedy.raju", "Exam ke ek din pehle 📚 #comedy #students", 4],
  ["fit.with.neha", "10 min fat burn, no equipment #fitness #workout", 3],
  ["fit.with.neha", "Morning stretch routine 🧘 #fitness #yoga", 2],
  ["bainsla.beats", "New original out now 🎵 #music #original @riya.dance", 0],
  ["bainsla.beats", "Dhol beat challenge — duet karo! #music #challenge", 1],
  ["tech.tara", "3 hidden Android settings 📱 #tech #tips", 2],
  ["tech.tara", "Best budget phone 2026? #tech #review", 1],
  ["art.by.meera", "Bridal mehndi in fast motion ✨ #art #mehndi", 2],
  ["art.by.meera", "Sketching my followers — comment karo! #art #sketch", 0],
];

const COMMENTS = ["Wow 🔥🔥", "Kya baat hai!", "Ye toh next level hai 😍", "Part 2 please 🙏", "Mast bhai 👌", "Hahaha 😂😂", "Tutorial chahiye!", "Love this ❤️"];

function avatarSvg(name: string, [a, b]: string[]) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="320" fill="url(#g)"/><text x="160" y="200" font-family="DejaVu Sans" font-weight="bold" font-size="130" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
}

const esc = (s: string) => s.replace(/[^\p{L}\p{N} .!?-]/gu, "").trim().slice(0, 48);

async function main() {
  await bootstrap();
  if (await db.video.count({ where: { author: { username: "riya.dance" } } })) {
    console.log("demo already seeded");
    return;
  }
  const passwordHash = await hash("Demo@12345");
  const users = new Map<string, { id: string; colors: string[] }>();
  for (const u of USERS) {
    const out = datedPath("webp");
    await mkdir(path.dirname(out.absolute), { recursive: true });
    await sharp(Buffer.from(avatarSvg(u.name, u.colors))).webp().toFile(out.absolute);
    const row = await db.user.upsert({ where: { username: u.username }, update: { avatarUrl: out.url }, create: { username: u.username, name: u.name, bio: u.bio, email: `${u.username.replace(/\./g, "")}@demo.thirak.app`, passwordHash, avatarUrl: out.url, isVerified: ["bainsla.beats", "chef.kabir"].includes(u.username), coins: 500 } });
    users.set(u.username, { id: row.id, colors: u.colors });
  }
  const sounds: { id: string; path: string }[] = [];
  for (const [i, s] of SOUNDS.entries()) {
    const out = datedPath("m4a");
    await mkdir(path.dirname(out.absolute), { recursive: true });
    await run(["-f", "lavfi", "-i", `aevalsrc=${s.expr.replace(/,/g, "\\,")}:s=44100:d=30`, "-c:a", "aac", "-b:a", "128k", out.absolute]);
    const cover = datedPath("webp");
    await sharp(Buffer.from(avatarSvg(s.title, [USERS[i].colors[1], USERS[i].colors[0]]))).webp().toFile(cover.absolute);
    const row = await db.sound.create({ data: { title: s.title, artist: s.artist, audioUrl: out.url, coverUrl: cover.url, durationSec: 30, featured: true, creatorId: users.get("bainsla.beats")!.id } });
    sounds.push({ id: row.id, path: out.absolute });
  }
  const videoIds: string[] = [];
  for (const [i, [username, caption, soundIdx]] of VIDEOS.entries()) {
    const u = users.get(username)!;
    const mp4 = datedPath("mp4");
    const poster = datedPath("jpg");
    await mkdir(path.dirname(mp4.absolute), { recursive: true });
    const words = esc(caption.split("#")[0]).split(/\s+/).filter(Boolean);
    const lines: string[] = [""];
    for (const w of words) { if ((lines[lines.length - 1] + " " + w).trim().length > 16 && lines.length < 3) lines.push(w); else lines[lines.length - 1] = `${lines[lines.length - 1]} ${w}`.trim(); }
    const [c0, c1] = u.colors;
    const vf = [
      ...lines.map((l, k) => `drawtext=fontfile=${FONT}:text='${l}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h/2)-200+${k * 70}:shadowcolor=black@0.5:shadowx=3:shadowy=3`),
      `drawtext=fontfile=${FONT}:text='@${username}':fontcolor=white@0.85:fontsize=34:x=(w-text_w)/2:y=(h/2)+30`,
      `drawtext=fontfile=${FONT}:text='THIRAK':fontcolor=white@0.35:fontsize=90:x=(w-text_w)/2:y=h-260+20*sin(t*3)`,
      `drawbox=x=0:y=ih-12:w=iw*t/8:h=12:color=white@0.6:t=fill`,
    ].join(",");
    await run([
      "-f", "lavfi", "-i", `gradients=s=720x1280:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=720:y1=1280:speed=0.03:d=8:r=30`,
      "-i", sounds[soundIdx].path,
      "-filter_complex", `[0:v]${vf},format=yuv420p[v]`, "-map", "[v]", "-map", "1:a", "-t", "8",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mp4.absolute,
    ]);
    await run(["-ss", "2", "-i", mp4.absolute, "-frames:v", "1", "-q:v", "4", poster.absolute]);
    const meta = await probe(mp4.absolute);
    const published = new Date(Date.now() - (VIDEOS.length - i) * 3 * 3600 * 1000);
    const v = await db.video.create({ data: { authorId: u.id, caption, videoUrl: mp4.url, posterUrl: poster.url, width: meta.width, height: meta.height, durationSec: meta.duration, soundId: sounds[soundIdx].id, status: "READY", publishedAt: published, createdAt: published, viewsCount: 200 + ((i * 7919) % 5000), sharesCount: (i * 13) % 90, featured: i % 5 === 0 } });
    await linkHashtagsAndMentions(v.id, caption, u.id, username);
    videoIds.push(v.id);
    process.stdout.write(".");
  }
  const ids = [...users.values()].map((u) => u.id);
  for (const [a, follower] of ids.entries()) {
    for (const [b, following] of ids.entries()) {
      if (a !== b && (a + b) % 3 !== 0) await db.follow.create({ data: { followerId: follower, followingId: following, status: "ACCEPTED" } });
    }
  }
  for (const [i, vid] of videoIds.entries()) {
    for (const [j, uid] of ids.entries()) {
      if ((i + j) % 2 === 0) await db.like.create({ data: { userId: uid, videoId: vid } }).catch(() => null);
      if ((i + j) % 4 === 1) await db.comment.create({ data: { videoId: vid, authorId: uid, body: COMMENTS[(i + j) % COMMENTS.length] } });
    }
  }
  console.log(`\ndemo ok: ${users.size} users, ${sounds.length} sounds, ${videoIds.length} videos (password Demo@12345)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); process.exit(); });
