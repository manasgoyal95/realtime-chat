# Pulse — realtime chat

A small chat app built as a take-home assignment. Open the page, pick a name,
start talking. Messages appear live, you can see who's online, and you can see
who's typing.

**Live demo:** https://pulse-chat-7puv.onrender.com

> ⏱️ First request after ~15 min of inactivity takes ~30s to cold-start
> (Render's free tier spins services down when idle). Subsequent requests
> are instant. Messages persist during the session but are wiped when the
> container restarts — see "Deploy" below for why and how I'd fix it in prod.

**Stack:** Go 1.26 backend · React 18 + TypeScript + Tailwind frontend · raw
WebSockets · SQLite (pure-Go driver) · deployed as a single binary on Fly.io.

---

## Try it in 30 seconds

1. Open the demo link.
2. Pick a name.
3. Open the same link in a second browser (or incognito tab) with a different
   name — both sessions will see messages appear live, presence update, and
   typing indicators.
4. Refresh either tab — your history is still there.
5. Put the server through reconnect: open dev tools → Network → offline, wait,
   then come back online. The status pill flips from "Live" → "Reconnecting…"
   → "Live" and any missed messages replay.

---

## Design decisions (and why)

The assignment leaves a lot open on purpose, so I treated the *decisions* as
the deliverable. Here's what I chose and why.

### What I built

| Decision | Choice | Reasoning |
| --- | --- | --- |
| Transport | Raw WebSockets (gorilla/websocket) | Bidirectional and low-latency — the default for chat. SSE would have needed a separate POST channel for sends. |
| Identity | Display name picked on first visit, persisted in `localStorage` | The assignment asks for "who sent which message," not full auth. A name is the minimum to satisfy the requirement without dragging accounts into scope. |
| Persistence | Yes — SQLite, via the pure-Go `modernc.org/sqlite` driver | Messages surviving a refresh is what makes this feel like a product. Pure-Go means no CGO, so the whole thing cross-compiles into a static binary and drops into a distroless container. |
| Rooms | One public room | Multi-room was tempting, but it splits focus away from the real-time UX polish that actually differentiates chat apps. I'd rather do one room well than two rooms shallowly. |
| Deployment | Single Go binary serves both `/ws` and the embedded React build (via `go:embed`) | One service to deploy, no CORS, no split-origin WebSocket pain. Same URL for everything. |
| Hosting | Fly.io | Free tier, native WebSocket support, sub-minute deploys, and a persistent volume for the SQLite file. |

### The "feature beyond the basics"

I picked **live presence + typing indicators** as the signature feature. They
answer the same question — *"who is here and paying attention right now?"* —
and together they're what separates "a message log" from "a real chat."

- **Presence** shows online users in the header. Updates live on join/leave.
- **Typing indicator** shows "X is typing…" under the thread, throttled on the
  client (at most once every 3s) and auto-expired on the server 5s after the
  last keystroke, so an abandoned tab doesn't leave a ghost indicator behind.

Why this over reactions, attachments, multi-room, etc.? Both presence and
typing ride the existing WebSocket fan-out — no new backend surface area, no
new schema — so the implementation is cohesive rather than a grab-bag of
features. And they demonstrate that I've thought about real-time UX, which is
the actual hard part of the assignment.

### Reliability touches (not marketed as features, just table stakes)

The rubric weights "reliability" explicitly, so these aren't a stretch goal:

- **Server-assigned IDs + timestamps.** Clients never invent authoritative
  data; this is what lets two tabs stay consistent.
- **Optimistic UI.** Your message appears instantly when you hit send, then
  the server ack confirms it. If 8s pass with no ack, it's marked failed and
  the ring around the bubble goes red.
- **Reconnect with backoff.** The client starts at 250ms and caps at 5s, with
  a live "Reconnecting…" pill so you know what's happening.
- **Catch-up on reconnect.** On reconnect the client hits
  `GET /api/messages?since=<last-seen-id>` to pull any missed messages, so a
  network blip doesn't leave you out of sync.

### What I deliberately didn't do (and why)

- **Auth / accounts** — out of scope. Names are enough for the assignment,
  and auth would dilute the real-time focus.
- **Multiple rooms / DMs** — scope creep. Adding a room list and join/leave
  UI doesn't demonstrate anything that one good room doesn't already.
- **Emoji reactions / file uploads** — feature sprawl. I'd rather ship the
  real-time UX well.
- **End-to-end tests** — a manual test plan (above) is enough for a
  take-home. I'd add Playwright tests if this were going to production.

---

## Architecture

```
┌────────────────────────────────┐        ┌──────────────────────────────┐
│  Browser (React SPA)           │        │  Go server (single binary)   │
│                                │        │                              │
│  - App.tsx                     │◄──WS──►│  /ws        → Hub            │
│  - useChatSocket (reconnect)   │        │  /api/*     → REST handlers  │
│  - optimistic send + replay    │◄──GET──│  /          → embedded SPA   │
└────────────────────────────────┘        │                              │
                                          │  Hub ─┬─ clients (goroutines)│
                                          │       ├─ broadcast fan-out   │
                                          │       ├─ presence tracking   │
                                          │       └─ typing timers       │
                                          │                              │
                                          │  store (SQLite)              │
                                          └──────────────────────────────┘
```

### Backend layout

- `cmd/server/main.go` — wiring, graceful shutdown.
- `internal/hub/` — the classic gorilla hub pattern: one goroutine per
  connection for reads and writes, a central hub goroutine that owns client
  membership and broadcasts.
- `internal/store/` — SQLite-backed message store (`Insert`, `Recent`,
  `Since`).
- `internal/api/` — HTTP handlers (`/healthz`, `/api/messages`, `/ws`).
- `internal/spa/` — `go:embed` wrapper around the Vite build, with SPA
  fallback routing for non-asset paths.

### WebSocket protocol

All frames are JSON, discriminated by `type`:

```
Client → Server:
  { "type": "message", "body": "hello", "clientId": "c-abc123" }
  { "type": "typing" }

Server → Client:
  { "type": "message", "id": 42, "user": "alice", "body": "hello",
    "ts": "2026-04-21T…", "clientId": "c-abc123" }
  { "type": "ack",     "id": 42, "clientId": "c-abc123" }
  { "type": "presence", "online": ["alice", "bob"] }
  { "type": "typing",      "user": "alice" }
  { "type": "typing_stop", "user": "alice" }
```

`clientId` is how the browser reconciles its optimistic bubble with the
server-assigned message id.

---

## Run it locally

**Requirements:** Go 1.22+, Node 20+.

```bash
# Backend
go run ./cmd/server
# → listening on :8080

# Frontend (in another terminal)
cd web
npm install
npm run dev
# → Vite dev server on :5173 proxies /ws and /api to :8080
```

Visit http://localhost:5173 in two browser windows with different names.

**Production-style local run:**

```bash
cd web && npm run build && cd ..
go run ./cmd/server
# open http://localhost:8080 — the Go binary serves the built SPA directly
```

---

## Deploy

The repo has configs for two hosts. The **same** Dockerfile drives both —
multi-stage build of React → Go → distroless runtime. Final image is ~20MB.

### Render (deployed demo uses this)

`render.yaml` is a Render Blueprint that provisions a free-tier Docker web
service. After pushing the repo to GitHub:

```bash
# either via CLI
render blueprint launch
# or via the dashboard: New → Blueprint → select the repo
```

**Free-tier note on persistence:** Render's free plan has no persistent
disk, so SQLite lives in `/tmp/chat.db` and is wiped on each deploy and
container restart (including the 15-min idle spin-down). Messages persist
*within* a session but not across restarts. The easy production swap is a
paid disk mount (~$1/mo for 1GB) or managed Postgres — neither changes the
app code, just `DB_PATH` / the store backend.

### Fly.io

`fly.toml` is set up for a persistent-volume deploy (Fly gives you real
disk on the free allowance, but currently requires a card on file):

```bash
fly launch --copy-config --no-deploy
fly volumes create chat_data --size 1 --region <your-region>
fly deploy
```

---

## If I had another day

- Read receipts (which users have seen each message). Model's clear: track
  per-user `last_read_id` and broadcast on change. Just more UI work.
- Multiple rooms, with a lightweight directory on the left. The Hub already
  supports this shape — split `clients map[*Client]struct{}` into
  `rooms map[string]map[*Client]struct{}` and route broadcasts by room.
- A "load older messages" button using the same `/api/messages?before=` REST
  endpoint shape.
- Migrate from raw SQLite to Postgres + LISTEN/NOTIFY if I wanted to scale
  across multiple server instances — the hub fan-out becomes a DB subscription
  and the WebSocket layer stays mostly the same.

---

Built by Manas Goyal. Questions welcome.
