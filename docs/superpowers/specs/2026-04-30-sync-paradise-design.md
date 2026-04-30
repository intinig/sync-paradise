# Sync Paradise — Design Spec

**Date:** 2026-04-30
**Status:** Approved (brainstorming complete; ready for implementation plan)

## 1. Background & goals

Since 2008 the user and a friend have manually tried to sync the [Gangsta's Paradise music video](https://www.youtube.com/watch?v=fPO76Jlnz6c) on YouTube at the same time. This app automates the sync.

**Core experience:**
1. Anyone signs in with Google.
2. As soon as 2+ people are signed in, a countdown begins.
3. When the countdown hits zero, every participant's video starts playing in sync (~100ms tolerance).
4. When the video ends, a 30-second cooldown precedes the next auto-countdown.
5. A public page (`/grid`, no login) shows every participant's video tile with their name overlaid.

**Audience:** single global, public room. Designed to handle popularity spikes without architectural changes (still one room).

## 2. Non-goals (explicit scope cuts)

- No multi-room support. One global room.
- No persistence of session history (no DB).
- No mobile native apps; the web UI is responsive.
- No moderation tools (kick/ban/mute-other).
- No analytics/telemetry beyond stdout logs.
- No internationalization.
- No frame-perfect sync. ~100ms target.
- No fallback player if YouTube ever disallows IFrame embed for this video.
- Video is hardcoded to Gangsta's Paradise (one constant).

## 3. Architecture overview

- Single Node.js + TypeScript process holds all state.
- Express serves the React+Vite SPA and OAuth routes; the same process upgrades to WebSocket at `/ws`.
- No database. OAuth sessions live in a signed cookie (stateless on the server). Room state lives in process memory.
- Hosting: a small VM-style platform with native WebSocket support (Fly.io, Railway, or Render). One container, one port.

```
Browser ──HTTP──▶ Express (SPA shell, /auth/*, /healthz)
   │
   └──WS /ws─────▶ Room (state machine, in memory)
                    │
                    ├── participants (logged-in users with ≥1 socket)
                    └── spectators (anonymous + late-joiners)
```

## 4. Room state machine

A single global `Room` instance. States:

```
LOBBY        ── 2+ participants present ──▶  COUNTDOWN
COUNTDOWN    ── participants drop below 2 ──▶ LOBBY
COUNTDOWN    ── timer reaches 0 ──▶            PLAYING
PLAYING      ── server end-time reached
                OR all participants gone ──▶  COOLDOWN
COOLDOWN     ── 30s elapsed ──▶                LOBBY
```

**Participant** = a logged-in user with at least one open WebSocket. Multiple tabs from the same `userId` count as one participant. **Spectator** = an anonymous WS connection on `/grid`. Spectators don't count toward the 2-participant threshold.

**Late-joiner rule:** logging in during LOBBY/COUNTDOWN/COOLDOWN makes the user a participant immediately. Logging in during PLAYING holds them as a "pending participant" — server-side bookkeeping only. On the wire, the server reports `you.role = "spectator"` for that user (so the client renders the public grid), and remembers their `userId` and session info. When the room transitions to COOLDOWN, the server promotes every pending user to participant and broadcasts a fresh `room_state`. The wire protocol therefore has only two roles: `participant` and `spectator`.

**Server restart:** all state is wiped; clients reconnect via WS, derive state from the first `room_state` message, and the room starts fresh in LOBBY.

## 5. Sync protocol (authoritative server time)

The server is the only time authority. Clients never use their own clocks for scheduling.

### 5.1 Per-client clock offset (NTP-style)

On WS connect, and every 30s thereafter, the client runs one round trip:

```
t0 = clientNow                                  // record before send
client → server: { type: "ping", t0 }
server → client: { type: "pong", t0, t1: serverNow }
t2 = clientNow                                  // record on receive
rtt    = t2 - t0
offset = t1 - (t0 + rtt / 2)                    // server time minus client time
```

The client keeps the **median** offset of the last 5 samples (rejects spikes from network jitter). Then `serverNow ≈ clientNow + offset`. To schedule something at server time `T`, the client waits until `clientNow >= T − offset`.

Target accuracy: ±50ms typical, well under the 100ms tolerance.

### 5.2 Countdown → play

When the room transitions to COUNTDOWN, the server picks `playAtServerMs = serverNow + COUNTDOWN_SECONDS*1000` (default 10s) and broadcasts:

```ts
{ type: "room_state",
  state: "COUNTDOWN",
  playAtServerMs,
  videoId: "fPO76Jlnz6c",
  ... }
```

Each client renders a live countdown derived from `playAtServerMs − (clientNow + offset)` and pre-loads the YouTube IFrame player.

At T−2s the client calls `player.seekTo(0)` and `player.mute()` (if needed). At T (in server time, computed locally as `T − offset`) the client calls `player.unMute()` (if it should be audible) and `player.playVideo()`.

### 5.3 Drift correction

Every 5s during PLAYING, the server broadcasts:

```ts
{ type: "playhead",
  expectedSec: (serverNow - playAtServerMs) / 1000,
  serverNow }
```

Each client compares to `player.getCurrentTime()`:

- `|delta| > 0.5s` → `player.seekTo(expectedSec)` (visible jump, but rare).
- otherwise → soft-correct via `setPlaybackRate(0.95 or 1.05)` for a few seconds, then back to 1.0.

If the player reports the requested rate isn't supported, fall back to `seekTo`.

### 5.4 Video end

The server holds the canonical end time: `endAtServerMs = playAtServerMs + VIDEO_DURATION_MS`, where `VIDEO_DURATION_MS` is a hardcoded constant for Gangsta's Paradise (~241,000 ms; verify exact value before shipping). When `serverNow` crosses `endAtServerMs`, the room transitions to COOLDOWN. The server does NOT trust per-client `onStateChange === ENDED` events.

### 5.5 Browser autoplay policy

The user clicked "Login with Google" recently → that's a user gesture in most browsers, sufficient for unmuted IFrame playback. If the gesture has expired (e.g., long COOLDOWN, hot reload), the lobby shows a one-tap "Tap to enable audio" overlay during COUNTDOWN.

## 6. Frontend (React + Vite + TypeScript)

Three views; route + auth state determines which one renders.

### 6.1 View A — Lobby (logged in; LOBBY/COUNTDOWN/COOLDOWN)

- Header: avatar, name, Logout.
- Centered status panel:
  - LOBBY (1 participant): "Waiting for someone else to join…" + count.
  - COUNTDOWN: large ticking number derived from `playAtServerMs`. Subtitle: "Get ready."
  - COOLDOWN: "Next round in 00:23. Stay or come back."
- "Who's here" row: avatars + names of all current participants, including yourself.

### 6.2 View B — Player (logged in; PLAYING)

- Main area (~70%): the user's own YouTube IFrame, audio on, full quality.
- Sidebar/strip (~30%): live IFrames for every other participant, muted, synced. Display name overlaid bottom-left, avatar top-left.
- Top-right: small "synced ±42ms" indicator (hidden on mobile).
- On video end, fades to View A in COOLDOWN.

### 6.3 View C — Public grid (`/grid`, no login)

- Responsive CSS grid sized to participant count (1, 2×1, 2×2, 3×3, …).
- Each tile: a YouTube IFrame, muted by default; participant's display name on a translucent strip bottom-center; avatar in a corner.
- When the room is not PLAYING, tiles show participants' avatars on a colored background plus a status pill ("Waiting", "Get ready — 00:07", "Up next — 00:23"). The page is always interesting to look at.
- Corner button: "Tap to unmute all". Per-tile click toggles that tile's audio.
- Footer link: "Want to join? → /".

### 6.4 Component layout

```
src/
  api/
    ws.ts              // WS client, reconnect, message types, clock-offset measurement
    auth.ts            // /auth/google redirect helpers; GET /me probe
  state/
    room.ts            // Zustand store: room state, participants, offset
  components/
    Countdown.tsx      // pure: takes playAtServerMs + offset; renders ticking number
    Tile.tsx           // pure: takes participant + {muted, primary}; renders YT IFrame + overlay
    ParticipantStrip.tsx
    Grid.tsx           // CSS grid for /grid
    SyncIndicator.tsx
  views/
    Lobby.tsx
    Player.tsx
    PublicGrid.tsx
  player/
    youtube.ts         // wraps the IFrame Player API: load, seekTo, play, drift-correct
  App.tsx              // routes between views
```

`player/youtube.ts` is the single touchpoint for the IFrame API. Its public surface is `createSyncedPlayer({ videoId, getOffset })` plus methods `scheduleStart(playAtServerMs)`, `correctDrift(expectedSec)`, `setMuted(bool)`, `dispose()`. Sync logic stays out of view components.

## 7. Server (Node.js + Express + ws)

### 7.1 HTTP routes

- `GET /` — SPA shell (serves built assets).
- `GET /grid` — same SPA shell; client routes to PublicGrid.
- `GET /auth/google` — redirect to Google OAuth (Authorization Code with PKCE).
- `GET /auth/google/callback` — exchanges code, sets session cookie, redirects to `/`.
- `GET /me` — returns `{ id, name, picture } | null` based on cookie. Used by the SPA to decide between login and lobby.
- `POST /auth/logout` — clears cookie, returns 204.
- `GET /healthz` — `{ ok: true, state, participantCount }`.
- `GET /auth/test-login?name=…` — **only when `NODE_ENV === "test"`**, sets a stub session cookie. Refuses to mount otherwise; startup-time assertion guards this boundary.

### 7.2 WebSocket protocol (`/ws`)

The server reads the session cookie on the upgrade request. Logged in → participant. Anonymous → spectator.

Client → server:

```ts
{ type: "ping", t0: number }
{ type: "hello", role?: "participant" | "spectator" }   // optional; server infers from cookie
```

Server → client:

```ts
{ type: "pong", t0: number, t1: number }
{ type: "room_state",                                   // sent on connect + every transition
  state: "LOBBY" | "COUNTDOWN" | "PLAYING" | "COOLDOWN",
  participants: Array<{ id: string, name: string, picture: string }>,
  you: { id, name, picture, role: "participant" | "spectator" } | null,
  videoId: "fPO76Jlnz6c",
  playAtServerMs: number | null,                        // set in COUNTDOWN/PLAYING
  endAtServerMs: number | null,                         // set in PLAYING
  cooldownEndsAtServerMs: number | null,                // set in COOLDOWN
  serverNow: number }
{ type: "participants", participants: [...] }           // delta on join/leave
{ type: "playhead", expectedSec: number, serverNow: number }   // every 5s during PLAYING
```

The client never drives state; the server runs the room.

### 7.3 Module breakdown

```
server/
  index.ts             // boots Express + ws, mounts routes, owns process lifecycle
  config.ts            // env: PORT, GOOGLE_CLIENT_ID/SECRET, SESSION_SECRET, BASE_URL,
                       //      COUNTDOWN_SECONDS, COOLDOWN_SECONDS
  auth/
    google.ts          // OAuth 2.0 (Authorization Code + PKCE) handlers
    session.ts         // signed-cookie encode/decode (iron-session or jose)
  ws/
    server.ts          // upgrades HTTP → WS, parses session cookie, dispatches to Room
    protocol.ts        // shared message types (also imported by client)
  room/
    Room.ts            // single Room instance: state machine + transitions + broadcasts
    participants.ts    // participant set, dedup by userId across sockets
    timers.ts          // injectable wrapper over setTimeout/setInterval for tests
  video.ts             // VIDEO_ID, VIDEO_DURATION_MS constants
```

`Room` public surface:

```ts
class Room {
  onSocketJoin(socket, user: User | null): void
  onSocketLeave(socket): void
  // private: tick(), transition(state), broadcast(msg)
}
```

`Room` owns timers for COUNTDOWN expiry, PLAYING end, COOLDOWN expiry, and the 5s playhead broadcast. All timers go through `timers.ts` so unit tests can fast-forward.

### 7.4 Auth specifics

- Scopes: `openid email profile` only. No YouTube scopes.
- Session cookie: `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`; signed with a 32-byte `SESSION_SECRET` from env. Body: `{ id, name, picture, iat }`. 30-day expiry.
- CSRF: OAuth `state` parameter (random nonce in a short-lived cookie) protects the callback. `SameSite=Lax` covers `POST /auth/logout`. No other state-changing endpoints exist.

### 7.5 Concurrency

Single Node process, single event loop → no locking needed. All state mutations go through `Room` methods. Broadcasts are best-effort `socket.send()` with try/catch; dead sockets are pruned on the next tick.

### 7.6 Operations

- Logs (stdout): state transitions, participant join/leave, errors. No PII beyond Google `name` (the user already chose to display it). Retention = whatever the host platform provides.
- Health check: `GET /healthz`.
- Graceful shutdown: on SIGTERM, broadcast a final `room_state` (LOBBY) with a "server restarting" hint, close sockets, exit. Clients reconnect to the new process.

## 8. Testing

Three layers, all in CI.

### 8.1 Unit tests (Vitest)

- `Room` state machine: drive socket-join/leave events with a fake clock; assert state transitions and broadcast payloads. Required cases:
  - 1 → 2 participants triggers COUNTDOWN with correct `playAtServerMs`.
  - Drop to 1 during COUNTDOWN cancels back to LOBBY.
  - COUNTDOWN timer expiry transitions to PLAYING.
  - Late-joiner during PLAYING is held; promoted on COOLDOWN.
  - PLAYING `endAtServerMs` reached → COOLDOWN.
  - COOLDOWN expiry → LOBBY → if 2+ still present, COUNTDOWN re-fires.
  - All participants leave during PLAYING → COOLDOWN.
- Clock offset math: given a sequence of `(t0, t1, clientNow)` samples, median-of-5 offset matches expected within ±5ms; outliers are rejected.
- Drift correction picks `seek` for `|delta| > 0.5s`, `rate-nudge` otherwise; falls back to `seek` if rate is rejected.
- Cookie session encode/decode round-trip; signature rejection on tampered payload.

### 8.2 Integration tests (Vitest + real ephemeral HTTP+WS server)

- 2 spectators (no cookie) connect → both receive `room_state` with `you.role === "spectator"`. No COUNTDOWN.
- 2 participants (valid signed cookies) connect → COUNTDOWN starts; both sockets receive matching `playAtServerMs`. Add a 3rd participant → still COUNTDOWN; `participants` delta broadcast. Disconnect one → if count drops to 1, room cancels back to LOBBY; assert.
- OAuth callback handler against a stubbed Google token endpoint: cookie set on response, redirect to `/`.

### 8.3 End-to-end (Playwright, headless Chromium)

- Two browser contexts log in via `/auth/test-login?name=Alice` and `/auth/test-login?name=Bob`. Both land on `/`. COUNTDOWN appears within 1s of the second login. Wait until PLAYING. Both contexts' YouTube IFrames report state PLAYING; their `getCurrentTime()` values agree within 200ms (looser than 100ms target — E2E adds noise).
- A third context on `/grid` (no login) sees both Alice's and Bob's tiles with names overlaid.
- Audio is not asserted (Playwright can't reliably observe it).

## 9. Dev experience & build

- `npm run dev`: `concurrently` runs Vite (5173) and Node server (3000). Vite proxies `/api`, `/auth`, `/ws` to 3000.
- `.env.example` checked in; `.env` in `.gitignore`. Required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `BASE_URL`. Optional: `PORT`, `COUNTDOWN_SECONDS` (default 10), `COOLDOWN_SECONDS` (default 30).
- `/auth/test-login` mounts only when `NODE_ENV === "test"`; startup-time assertion refuses other environments.
- ESLint + Prettier with sensible defaults. `tsc --noEmit` in CI.
- Single Dockerfile: build frontend with Vite, copy assets into the Node image, Express serves them statically. One container, one port; WebSocket upgrade works on Fly/Railway/Render natively.
- No CDN; YouTube serves the video, we don't proxy it.

## 10. Open / verify before implementation

- Confirm exact `VIDEO_DURATION_MS` for the canonical Gangsta's Paradise upload (`fPO76Jlnz6c`). The spec assumes ~241,000 ms; we'll measure once and pin.
- Confirm the chosen host (Fly.io vs Railway vs Render) — affects only the Dockerfile / deploy config; spec is portable.
