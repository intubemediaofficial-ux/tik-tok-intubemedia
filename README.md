# Thirak — short-video social app by Intube Media

TikTok-style short-video platform (web + installable PWA) with its own look.

## Features
- For You / Following / Friends feeds, full-screen vertical player, double-tap like, mute, progress, keyboard nav
- Upload or record in-browser: trim, speed, filters, cover frame, sounds + volume mix, photo posts, drafts, scheduling, visibility & permissions
- Duet, Stitch, Sounds library, hashtags, mentions, search & Explore, watermarked downloads, embeds
- Likes, threaded comments (pin/like/report), favorites, reposts, share sheet, "not interested"
- Profiles, follow / follow requests, private accounts, blocking, followers/following lists
- Stories (24h) with viewers & likes, Inbox activity, realtime DMs (images, video shares, typing, seen)
- LIVE streaming (browser camera → ffmpeg HLS) with chat, likes, gifts
- Coins / diamonds wallet, gifts, Razorpay or manual UPI recharge, diamond withdrawals
- Creator Studio analytics, Settings, full Admin panel (users, videos, comments, reports, LIVE, sounds, payments, withdrawals, gifts, settings, broadcast)

## Stack
Next.js 16, React 19, TypeScript, Prisma + PostgreSQL, Tailwind v4, ffmpeg/ffprobe, sharp, SSE realtime.

## Local setup
```bash
cp .env.example .env        # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SITE_URL
npm install
npm run db:push
npm run seed                # admin user, gifts, coin packages, settings
npm run seed:demo           # optional demo users/videos (password Demo@12345)
npm run dev                 # http://localhost:3340
```

Checks: `npm run lint && npm run typecheck && npm run test && npm run build`.

## Production
Run `npm run build && npm start` under PM2 behind nginx (proxy to 127.0.0.1:3340, `proxy_buffering off` for `/api/events` and `/api/live/*/events`, `client_max_body_size 300m`). Set `SITE_URL` to the public https URL. Media and LIVE segments live in `DATA_DIR`.
