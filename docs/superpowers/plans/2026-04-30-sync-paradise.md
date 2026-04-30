# Sync Paradise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-global-room web app where any number of Google-authenticated users get their playback of the Gangsta's Paradise YouTube video synchronized within ~100ms, with a public spectator grid showing all participants' tiles overlaid with their names.

**Architecture:** One Node.js + TypeScript process serves both the React+Vite SPA (production: static; dev: Vite proxy) and a `/ws` WebSocket. All state is in process memory; the server is the only time authority. Clients measure clock offset via NTP-style ping/pong, schedule playback against `playAtServerMs`, and self-correct drift every 5 seconds. OAuth sessions live in a signed cookie; no database.

**Tech Stack:** Node.js 22, TypeScript 5, Express 5, `ws` 8, Vite 7, React 19, Zustand 5, `iron-session` (cookie signing), Vitest 3, Playwright. ESM throughout (`"type": "module"`).

**Spec:** `docs/superpowers/specs/2026-04-30-sync-paradise-design.md`. Read it first.

**Repo layout (target):**
```
sync-paradise/
├── package.json            # single root package; ESM
├── tsconfig.json           # base
├── tsconfig.server.json    # server build
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .gitignore
├── .env.example
├── shared/
│   └── protocol.ts         # WS message types (imported by both client + server)
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── styles.css
│       ├── api/{ws,auth}.ts
│       ├── state/room.ts
│       ├── components/{Countdown,Tile,ParticipantStrip,Grid,SyncIndicator}.tsx
│       ├── views/{Lobby,Player,PublicGrid}.tsx
│       └── player/youtube.ts
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── video.ts
│   │   ├── auth/{google,session}.ts
│   │   ├── ws/server.ts
│   │   └── room/{Room,participants,timers,drift}.ts
│   └── tests/
│       ├── unit/{participants,room,session,clockOffset,drift}.test.ts
│       └── integration/{ws,auth}.test.ts
└── e2e/
    └── sync.spec.ts
```

**Conventions:**
- All imports use ESM with explicit `.js` extensions for relative paths in TS server code (TypeScript ESM convention).
- Tests use Vitest. E2E uses Playwright.
- Every task ends with a commit. Commit messages follow `type: short summary` (e.g., `feat: add Room state machine`).
- TDD: write the failing test, watch it fail, implement, watch it pass, commit.

**Environment variables (final list):**
- `PORT` (default `3000`)
- `BASE_URL` (e.g., `http://localhost:3000`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` (32+ char random string)
- `COUNTDOWN_SECONDS` (default `10`)
- `COOLDOWN_SECONDS` (default `30`)
- `NODE_ENV` (`development` | `test` | `production`)

---

## Phase A — Scaffold

### Task 1: Initialize root package and tsconfig

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
coverage/
playwright-report/
test-results/
.DS_Store
```

- [ ] **Step 2: Create `.env.example`**

```
PORT=3000
BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
SESSION_SECRET=replace-with-32-char-random-string
COUNTDOWN_SECONDS=10
COOLDOWN_SECONDS=30
NODE_ENV=development
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "sync-paradise",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -n server,client -c blue,magenta \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch server/src/index.ts",
    "dev:client": "vite",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.server.json --noEmit"
  },
  "dependencies": {
    "express": "^5.0.0",
    "ws": "^8.18.0",
    "iron-session": "^8.0.4",
    "cookie": "^1.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.13",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0",
    "zustand": "^5.0.0",
    "@playwright/test": "^1.49.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals"],
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "include": ["client/src", "shared", "server/tests", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Install and verify**

Run:
```bash
npm install
```
Expected: completes without errors. `node_modules/` populated.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json tsconfig.json
git commit -m "chore: scaffold root package and tsconfig"
```

---

### Task 2: Scaffold the React+Vite client (hello world)

**Files:**
- Create: `vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/styles.css`

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:3000",
      "/me": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 2: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sync Paradise</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `client/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Create `client/src/App.tsx`**

```tsx
export function App() {
  return <h1>Sync Paradise</h1>;
}
```

- [ ] **Step 5: Create `client/src/styles.css`**

```css
:root {
  font-family: system-ui, -apple-system, sans-serif;
  color-scheme: dark;
}
body {
  margin: 0;
  background: #0c0c0e;
  color: #eee;
}
```

- [ ] **Step 6: Verify the dev client boots**

Run (in a second terminal):
```bash
npm run dev:client
```
Open `http://localhost:5173`. Expected: "Sync Paradise" heading visible. Stop the server (`Ctrl+C`).

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts client/
git commit -m "feat: scaffold React+Vite client"
```

---

### Task 3: Scaffold the Express + ws server (healthz only)

**Files:**
- Create: `tsconfig.server.json`
- Create: `server/src/index.ts`
- Create: `server/src/config.ts`

- [ ] **Step 1: Create `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist/server",
    "rootDir": "server/src",
    "noEmit": false,
    "types": ["node"]
  },
  "include": ["server/src", "shared"]
}
```

- [ ] **Step 2: Create `server/src/config.ts`**

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function int(name: string, defaultValue: number): number {
  const v = process.env[name];
  if (!v) return defaultValue;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got ${v}`);
  return n;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: int("PORT", 3000),
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-secret-32-chars-minimum-xxx",
  countdownSeconds: int("COUNTDOWN_SECONDS", 10),
  cooldownSeconds: int("COOLDOWN_SECONDS", 30),
};

export function assertProductionConfig(): void {
  if (config.nodeEnv !== "production") return;
  required("GOOGLE_CLIENT_ID");
  required("GOOGLE_CLIENT_SECRET");
  required("SESSION_SECRET");
  if (config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
}
```

- [ ] **Step 3: Create minimal `server/src/index.ts`**

```ts
import express from "express";
import { config, assertProductionConfig } from "./config.js";

assertProductionConfig();

const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

- [ ] **Step 4: Verify the server boots**

Run:
```bash
npm run dev:server
```
In another terminal:
```bash
curl -s http://localhost:3000/healthz
```
Expected: `{"ok":true}`. Stop the server.

- [ ] **Step 5: Verify both run concurrently**

Run:
```bash
npm run dev
```
Visit `http://localhost:5173` (heading visible) and `http://localhost:5173/healthz` (proxied — should return JSON). Stop with `Ctrl+C`.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.server.json server/
git commit -m "feat: scaffold Express server with healthz"
```

---

### Task 4: Wire Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `server/tests/unit/sanity.test.ts` (will be deleted in next task)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Create `server/tests/unit/sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 3: Run the test**

Run:
```bash
npm test
```
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts server/tests/unit/sanity.test.ts
git commit -m "chore: wire Vitest"
```

---

## Phase B — Shared types & small server modules

### Task 5: Define the shared WS protocol

**Files:**
- Create: `shared/protocol.ts`
- Create: `server/tests/unit/protocol.test.ts`
- Delete: `server/tests/unit/sanity.test.ts`

- [ ] **Step 1: Write the failing test**

`server/tests/unit/protocol.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  type ClientMessage,
  type ServerMessage,
  type RoomStateMessage,
  type Participant,
  ROOM_STATES,
} from "../../../shared/protocol.js";

describe("protocol", () => {
  it("ROOM_STATES contains exactly the four expected states", () => {
    expect([...ROOM_STATES].sort()).toEqual(["COOLDOWN", "COUNTDOWN", "LOBBY", "PLAYING"]);
  });

  it("a RoomStateMessage shape compiles and round-trips through JSON", () => {
    const p: Participant = { id: "u1", name: "Alice", picture: "https://x/y.jpg" };
    const msg: RoomStateMessage = {
      type: "room_state",
      state: "LOBBY",
      participants: [p],
      you: { ...p, role: "participant" },
      videoId: "fPO76Jlnz6c",
      playAtServerMs: null,
      endAtServerMs: null,
      cooldownEndsAtServerMs: null,
      serverNow: 1_700_000_000_000,
    };
    const round: ServerMessage = JSON.parse(JSON.stringify(msg));
    expect(round.type).toBe("room_state");
  });

  it("a ping ClientMessage compiles", () => {
    const m: ClientMessage = { type: "ping", t0: 123 };
    expect(m.type).toBe("ping");
  });
});
```

- [ ] **Step 2: Run the test (expected fail)**

Run:
```bash
npm test
```
Expected: FAIL with "Cannot find module '../../../shared/protocol.js'".

- [ ] **Step 3: Implement `shared/protocol.ts`**

```ts
export const ROOM_STATES = ["LOBBY", "COUNTDOWN", "PLAYING", "COOLDOWN"] as const;
export type RoomState = (typeof ROOM_STATES)[number];

export type Role = "participant" | "spectator";

export interface Participant {
  id: string;
  name: string;
  picture: string;
}

export interface You extends Participant {
  role: Role;
}

export interface PingMessage {
  type: "ping";
  t0: number;
}
export interface HelloMessage {
  type: "hello";
}
export type ClientMessage = PingMessage | HelloMessage;

export interface PongMessage {
  type: "pong";
  t0: number;
  t1: number;
}
export interface RoomStateMessage {
  type: "room_state";
  state: RoomState;
  participants: Participant[];
  you: You | null;
  videoId: string;
  playAtServerMs: number | null;
  endAtServerMs: number | null;
  cooldownEndsAtServerMs: number | null;
  serverNow: number;
}
export interface ParticipantsMessage {
  type: "participants";
  participants: Participant[];
}
export interface PlayheadMessage {
  type: "playhead";
  expectedSec: number;
  serverNow: number;
}
export type ServerMessage =
  | PongMessage
  | RoomStateMessage
  | ParticipantsMessage
  | PlayheadMessage;
```

- [ ] **Step 4: Delete the sanity test**

```bash
rm server/tests/unit/sanity.test.ts
```

- [ ] **Step 5: Run the tests**

Run:
```bash
npm test
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/ server/tests/unit/protocol.test.ts
git rm server/tests/unit/sanity.test.ts
git commit -m "feat: define WS protocol types"
```

---

### Task 6: Video constants

**Files:**
- Create: `server/src/video.ts`
- Create: `server/tests/unit/video.test.ts`

- [ ] **Step 1: Write the failing test**

`server/tests/unit/video.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { VIDEO_ID, VIDEO_DURATION_MS } from "../../src/video.js";

describe("video constants", () => {
  it("uses Coolio's Gangsta's Paradise video id", () => {
    expect(VIDEO_ID).toBe("fPO76Jlnz6c");
  });

  it("VIDEO_DURATION_MS is 4 minutes 16 seconds (256000ms)", () => {
    expect(VIDEO_DURATION_MS).toBe(256_000);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement `server/src/video.ts`**

```ts
export const VIDEO_ID = "fPO76Jlnz6c";
export const VIDEO_DURATION_MS = 256_000;
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/video.ts server/tests/unit/video.test.ts
git commit -m "feat: add video constants"
```

---

### Task 7: Injectable timers module

**Files:**
- Create: `server/src/room/timers.ts`
- Create: `server/tests/unit/timers.test.ts`

This module wraps `setTimeout` so that production uses real time and tests can advance time deterministically. The Room takes a `Timers` instance in its constructor.

- [ ] **Step 1: Write failing test**

`server/tests/unit/timers.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { RealTimers, FakeTimers, type Timers } from "../../src/room/timers.js";

describe("Timers", () => {
  it("RealTimers.now() approximates Date.now()", () => {
    const t: Timers = new RealTimers();
    const before = Date.now();
    const v = t.now();
    const after = Date.now();
    expect(v).toBeGreaterThanOrEqual(before);
    expect(v).toBeLessThanOrEqual(after);
  });

  it("FakeTimers.now() returns the configured time", () => {
    const t = new FakeTimers(1_000);
    expect(t.now()).toBe(1_000);
  });

  it("FakeTimers.advance fires due timeouts in order", () => {
    const t = new FakeTimers(0);
    const calls: string[] = [];
    t.setTimeout(() => calls.push("a"), 10);
    t.setTimeout(() => calls.push("b"), 5);
    t.setTimeout(() => calls.push("c"), 20);
    t.advance(15);
    expect(calls).toEqual(["b", "a"]);
    expect(t.now()).toBe(15);
    t.advance(10);
    expect(calls).toEqual(["b", "a", "c"]);
  });

  it("FakeTimers.clearTimeout cancels a pending timeout", () => {
    const t = new FakeTimers(0);
    const fn = vi.fn();
    const handle = t.setTimeout(fn, 100);
    t.clearTimeout(handle);
    t.advance(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("FakeTimers.setInterval fires repeatedly", () => {
    const t = new FakeTimers(0);
    const calls: number[] = [];
    t.setInterval(() => calls.push(t.now()), 5);
    t.advance(17);
    expect(calls).toEqual([5, 10, 15]);
  });

  it("FakeTimers.clearInterval stops an interval", () => {
    const t = new FakeTimers(0);
    const fn = vi.fn();
    const h = t.setInterval(fn, 5);
    t.advance(10); // 2 calls
    t.clearInterval(h);
    t.advance(20);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement `server/src/room/timers.ts`**

```ts
export type TimerHandle = number;

export interface Timers {
  now(): number;
  setTimeout(cb: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(cb: () => void, periodMs: number): TimerHandle;
  clearInterval(handle: TimerHandle): void;
}

export class RealTimers implements Timers {
  now(): number {
    return Date.now();
  }
  setTimeout(cb: () => void, delayMs: number): TimerHandle {
    return setTimeout(cb, delayMs) as unknown as TimerHandle;
  }
  clearTimeout(handle: TimerHandle): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
  setInterval(cb: () => void, periodMs: number): TimerHandle {
    return setInterval(cb, periodMs) as unknown as TimerHandle;
  }
  clearInterval(handle: TimerHandle): void {
    clearInterval(handle as unknown as ReturnType<typeof setInterval>);
  }
}

interface ScheduledTimeout {
  id: TimerHandle;
  fireAt: number;
  cb: () => void;
  cancelled: boolean;
}
interface ScheduledInterval {
  id: TimerHandle;
  nextFire: number;
  period: number;
  cb: () => void;
  cancelled: boolean;
}

export class FakeTimers implements Timers {
  private current: number;
  private nextId = 1;
  private timeouts: ScheduledTimeout[] = [];
  private intervals: ScheduledInterval[] = [];

  constructor(start = 0) {
    this.current = start;
  }
  now(): number {
    return this.current;
  }
  setTimeout(cb: () => void, delayMs: number): TimerHandle {
    const id = this.nextId++;
    this.timeouts.push({ id, fireAt: this.current + delayMs, cb, cancelled: false });
    return id;
  }
  clearTimeout(handle: TimerHandle): void {
    const t = this.timeouts.find((x) => x.id === handle);
    if (t) t.cancelled = true;
  }
  setInterval(cb: () => void, periodMs: number): TimerHandle {
    if (periodMs <= 0) throw new Error("interval period must be > 0");
    const id = this.nextId++;
    this.intervals.push({ id, nextFire: this.current + periodMs, period: periodMs, cb, cancelled: false });
    return id;
  }
  clearInterval(handle: TimerHandle): void {
    const i = this.intervals.find((x) => x.id === handle);
    if (i) i.cancelled = true;
  }

  /** Advance time by deltaMs, firing every due timer in time order. */
  advance(deltaMs: number): void {
    const target = this.current + deltaMs;
    while (true) {
      const dueTimeout = this.timeouts
        .filter((t) => !t.cancelled && t.fireAt <= target)
        .sort((a, b) => a.fireAt - b.fireAt)[0];
      const dueInterval = this.intervals
        .filter((i) => !i.cancelled && i.nextFire <= target)
        .sort((a, b) => a.nextFire - b.nextFire)[0];

      const tTime = dueTimeout?.fireAt ?? Infinity;
      const iTime = dueInterval?.nextFire ?? Infinity;
      const earliest = Math.min(tTime, iTime);
      if (earliest === Infinity) break;

      this.current = earliest;
      if (tTime <= iTime && dueTimeout) {
        dueTimeout.cancelled = true;
        dueTimeout.cb();
      } else if (dueInterval) {
        dueInterval.cb();
        dueInterval.nextFire += dueInterval.period;
      }
    }
    this.current = target;
  }
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all timer tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/timers.ts server/tests/unit/timers.test.ts
git commit -m "feat: add injectable timers module"
```

---

### Task 8: Participants set (dedup by userId)

**Files:**
- Create: `server/src/room/participants.ts`
- Create: `server/tests/unit/participants.test.ts`

A user can have multiple WebSocket connections (multiple tabs). The participant set deduplicates by `userId`; the participant disappears only when the last socket closes.

- [ ] **Step 1: Write failing test**

`server/tests/unit/participants.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ParticipantSet } from "../../src/room/participants.js";

const alice = { id: "u-alice", name: "Alice", picture: "a.jpg" };
const bob = { id: "u-bob", name: "Bob", picture: "b.jpg" };

describe("ParticipantSet", () => {
  it("starts empty", () => {
    const s = new ParticipantSet();
    expect(s.list()).toEqual([]);
    expect(s.count()).toBe(0);
  });

  it("addSocket inserts a new participant on first socket", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    s.addSocket(sockA, alice);
    expect(s.count()).toBe(1);
    expect(s.list()).toEqual([alice]);
  });

  it("addSocket twice for same user keeps the participant once", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    expect(s.count()).toBe(1);
  });

  it("removeSocket only drops participant when last socket closes", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    s.removeSocket(sockA);
    expect(s.count()).toBe(1);
    s.removeSocket(sockB);
    expect(s.count()).toBe(0);
  });

  it("removeSocket of unknown socket is a no-op", () => {
    const s = new ParticipantSet();
    const sockX = {} as object;
    expect(() => s.removeSocket(sockX)).not.toThrow();
  });

  it("two distinct users coexist", () => {
    const s = new ParticipantSet();
    s.addSocket({} as object, alice);
    s.addSocket({} as object, bob);
    expect(s.count()).toBe(2);
    expect(s.list().map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });

  it("hasUser returns true while any socket for that user is present", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    s.addSocket(sockA, alice);
    expect(s.hasUser("u-alice")).toBe(true);
    s.removeSocket(sockA);
    expect(s.hasUser("u-alice")).toBe(false);
  });

  it("socketsForUser returns all sockets bound to a user", () => {
    const s = new ParticipantSet();
    const sockA = {} as object;
    const sockB = {} as object;
    s.addSocket(sockA, alice);
    s.addSocket(sockB, alice);
    const sockets = s.socketsForUser("u-alice");
    expect(sockets).toContain(sockA);
    expect(sockets).toContain(sockB);
    expect(sockets.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement `server/src/room/participants.ts`**

```ts
import type { Participant } from "../../../shared/protocol.js";

export class ParticipantSet {
  private byUser = new Map<string, { participant: Participant; sockets: Set<object> }>();
  private socketToUser = new Map<object, string>();

  addSocket(socket: object, participant: Participant): void {
    const existing = this.byUser.get(participant.id);
    if (existing) {
      existing.sockets.add(socket);
    } else {
      this.byUser.set(participant.id, { participant, sockets: new Set([socket]) });
    }
    this.socketToUser.set(socket, participant.id);
  }

  removeSocket(socket: object): void {
    const userId = this.socketToUser.get(socket);
    if (!userId) return;
    this.socketToUser.delete(socket);
    const entry = this.byUser.get(userId);
    if (!entry) return;
    entry.sockets.delete(socket);
    if (entry.sockets.size === 0) {
      this.byUser.delete(userId);
    }
  }

  list(): Participant[] {
    return [...this.byUser.values()].map((e) => e.participant);
  }

  count(): number {
    return this.byUser.size;
  }

  hasUser(userId: string): boolean {
    return this.byUser.has(userId);
  }

  socketsForUser(userId: string): object[] {
    const entry = this.byUser.get(userId);
    return entry ? [...entry.sockets] : [];
  }
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all participant tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/participants.ts server/tests/unit/participants.test.ts
git commit -m "feat: add ParticipantSet"
```

---

## Phase C — Room state machine (the core)

The Room is the heart of the server. It owns the state machine, schedules transitions via the injected `Timers`, holds the participant set, holds the pending-participant set (late joiners during PLAYING), and broadcasts. It does NOT touch sockets directly — it accepts socket-shaped objects and uses an injected `broadcast` callback so tests can capture messages.

### Task 9: Room — skeleton, lobby state, broadcast on join

**Files:**
- Create: `server/src/room/Room.ts`
- Create: `server/tests/unit/room.test.ts`

- [ ] **Step 1: Write failing test**

`server/tests/unit/room.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Room } from "../../src/room/Room.js";
import { FakeTimers } from "../../src/room/timers.js";
import type { ServerMessage, Participant } from "../../../shared/protocol.js";

const alice: Participant = { id: "u-alice", name: "Alice", picture: "a.jpg" };
const bob: Participant = { id: "u-bob", name: "Bob", picture: "b.jpg" };
const carol: Participant = { id: "u-carol", name: "Carol", picture: "c.jpg" };

interface CapturedSend {
  socket: object;
  msg: ServerMessage;
}

function makeRoom() {
  const timers = new FakeTimers(1_000_000);
  const sent: CapturedSend[] = [];
  const room = new Room({
    timers,
    countdownMs: 10_000,
    cooldownMs: 30_000,
    videoId: "fPO76Jlnz6c",
    videoDurationMs: 256_000,
    playheadIntervalMs: 5_000,
    send: (socket, msg) => sent.push({ socket, msg }),
  });
  return { room, timers, sent };
}

describe("Room: lobby & joins", () => {
  it("a new room is in LOBBY with no participants", () => {
    const { room } = makeRoom();
    const snap = room.snapshot();
    expect(snap.state).toBe("LOBBY");
    expect(snap.participants).toEqual([]);
  });

  it("on participant join, the joining socket receives a room_state with role=participant", () => {
    const { room, sent } = makeRoom();
    const sock = { id: 1 };
    room.onSocketJoin(sock, alice);
    const msg = sent.find((s) => s.socket === sock)?.msg;
    expect(msg).toBeDefined();
    expect(msg!.type).toBe("room_state");
    if (msg!.type !== "room_state") throw new Error("type narrowing");
    expect(msg.state).toBe("LOBBY");
    expect(msg.you).toEqual({ ...alice, role: "participant" });
    expect(msg.participants).toEqual([alice]);
  });

  it("on spectator join (user=null), the socket receives room_state with you=null and role spectator semantics", () => {
    const { room, sent } = makeRoom();
    const sock = { id: 1 };
    room.onSocketJoin(sock, null);
    const msg = sent.find((s) => s.socket === sock)?.msg;
    expect(msg!.type).toBe("room_state");
    if (msg!.type !== "room_state") throw new Error("type narrowing");
    expect(msg.you).toBeNull();
    expect(msg.participants).toEqual([]);
  });

  it("a single participant alone stays in LOBBY (does not start COUNTDOWN)", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    timers.advance(60_000);
    expect(room.snapshot().state).toBe("LOBBY");
  });

  it("two participants from same user (two tabs) does NOT start COUNTDOWN", () => {
    const { room } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, alice);
    expect(room.snapshot().state).toBe("LOBBY");
    expect(room.snapshot().participants).toEqual([alice]);
  });

  it("dropping a socket removes the participant if it was the last", () => {
    const { room } = makeRoom();
    const s1 = { id: 1 };
    room.onSocketJoin(s1, alice);
    expect(room.snapshot().participants).toEqual([alice]);
    room.onSocketLeave(s1);
    expect(room.snapshot().participants).toEqual([]);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Create `server/src/room/Room.ts`**

```ts
import type {
  RoomState,
  RoomStateMessage,
  ServerMessage,
  Participant,
  You,
  Role,
} from "../../../shared/protocol.js";
import type { Timers, TimerHandle } from "./timers.js";
import { ParticipantSet } from "./participants.js";

export interface RoomOptions {
  timers: Timers;
  countdownMs: number;
  cooldownMs: number;
  videoId: string;
  videoDurationMs: number;
  playheadIntervalMs: number;
  send: (socket: object, msg: ServerMessage) => void;
}

interface SocketRecord {
  user: Participant | null; // null = spectator
  /** True iff this socket belongs to a user logged in mid-PLAYING (held until COOLDOWN). */
  pending: boolean;
}

export class Room {
  private state: RoomState = "LOBBY";
  private participants = new ParticipantSet();
  private sockets = new Map<object, SocketRecord>();
  /** Pending users (logged in during PLAYING) keyed by userId; promoted on COOLDOWN. */
  private pendingUsers = new Map<string, Participant>();

  private playAtServerMs: number | null = null;
  private endAtServerMs: number | null = null;
  private cooldownEndsAtServerMs: number | null = null;

  private countdownTimer: TimerHandle | null = null;
  private endTimer: TimerHandle | null = null;
  private cooldownTimer: TimerHandle | null = null;
  private playheadInterval: TimerHandle | null = null;

  constructor(private readonly opts: RoomOptions) {}

  snapshot() {
    return {
      state: this.state,
      participants: this.participants.list(),
      playAtServerMs: this.playAtServerMs,
      endAtServerMs: this.endAtServerMs,
      cooldownEndsAtServerMs: this.cooldownEndsAtServerMs,
    };
  }

  onSocketJoin(socket: object, user: Participant | null): void {
    const pending = user !== null && this.state === "PLAYING";
    if (user && !pending) {
      this.participants.addSocket(socket, user);
    } else if (user && pending) {
      this.pendingUsers.set(user.id, user);
    }
    this.sockets.set(socket, { user, pending });
    this.sendStateTo(socket);
    // Triggers handled in later tasks: COUNTDOWN start, etc.
    this.maybeStartCountdown();
  }

  onSocketLeave(socket: object): void {
    const rec = this.sockets.get(socket);
    if (!rec) return;
    this.sockets.delete(socket);
    if (rec.user && !rec.pending) {
      this.participants.removeSocket(socket);
    } else if (rec.user && rec.pending) {
      // If no other pending sockets exist for this user, drop the pending entry.
      const stillPending = [...this.sockets.values()].some(
        (r) => r.user?.id === rec.user!.id && r.pending,
      );
      if (!stillPending) this.pendingUsers.delete(rec.user.id);
    }
    // Re-evaluate state after a leave.
    this.maybeCancelCountdown();
    this.maybeEndPlayingDueToEmpty();
  }

  // ---- private helpers (some are stubs for later tasks) ----

  private sendStateTo(socket: object): void {
    const rec = this.sockets.get(socket);
    const role: Role = rec?.user && !rec.pending ? "participant" : "spectator";
    const you: You | null = rec?.user ? { ...rec.user, role } : null;
    const msg: RoomStateMessage = {
      type: "room_state",
      state: this.state,
      participants: this.participants.list(),
      you,
      videoId: this.opts.videoId,
      playAtServerMs: this.playAtServerMs,
      endAtServerMs: this.endAtServerMs,
      cooldownEndsAtServerMs: this.cooldownEndsAtServerMs,
      serverNow: this.opts.timers.now(),
    };
    this.opts.send(socket, msg);
  }

  private broadcastState(): void {
    for (const socket of this.sockets.keys()) this.sendStateTo(socket);
  }

  private maybeStartCountdown(): void {
    if (this.state !== "LOBBY") return;
    if (this.participants.count() < 2) return;
    this.transitionToCountdown();
  }

  private maybeCancelCountdown(): void {
    if (this.state !== "COUNTDOWN") return;
    if (this.participants.count() >= 2) return;
    this.transitionToLobby();
  }

  private maybeEndPlayingDueToEmpty(): void {
    if (this.state !== "PLAYING") return;
    if (this.participants.count() > 0) return;
    this.transitionToCooldown();
  }

  // Transitions filled in by later tasks. Provide stubs that the next task will replace.
  private transitionToCountdown(): void {
    // Implemented in Task 10
    this.state = "COUNTDOWN";
    this.broadcastState();
  }
  private transitionToLobby(): void {
    // Implemented later
    this.state = "LOBBY";
    this.playAtServerMs = null;
    this.broadcastState();
  }
  private transitionToCooldown(): void {
    // Implemented later
    this.state = "COOLDOWN";
    this.broadcastState();
  }
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: 6 Room tests pass (plus existing tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/room/Room.ts server/tests/unit/room.test.ts
git commit -m "feat: Room skeleton with LOBBY behavior and broadcasts"
```

---

### Task 10: Room — COUNTDOWN start with playAtServerMs

**Files:**
- Modify: `server/src/room/Room.ts`
- Modify: `server/tests/unit/room.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: COUNTDOWN start", () => {
  it("two distinct participants triggers COUNTDOWN with playAtServerMs = now+countdown", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    sent.length = 0;
    room.onSocketJoin({ id: 2 }, bob);
    const snap = room.snapshot();
    expect(snap.state).toBe("COUNTDOWN");
    expect(snap.playAtServerMs).toBe(timers.now() + 10_000);
    // Both sockets received a COUNTDOWN room_state.
    const countdowns = sent.filter(
      (s) => s.msg.type === "room_state" && s.msg.state === "COUNTDOWN",
    );
    expect(countdowns.length).toBeGreaterThanOrEqual(2);
  });

  it("a third participant joining during COUNTDOWN does not reset playAtServerMs", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    const original = room.snapshot().playAtServerMs!;
    timers.advance(2_000);
    room.onSocketJoin({ id: 3 }, carol);
    expect(room.snapshot().state).toBe("COUNTDOWN");
    expect(room.snapshot().playAtServerMs).toBe(original);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: 2 new tests fail (`playAtServerMs` is null in snapshot).

- [ ] **Step 3: Replace `transitionToCountdown` body**

In `server/src/room/Room.ts`, replace the existing `transitionToCountdown` method:
```ts
  private transitionToCountdown(): void {
    this.state = "COUNTDOWN";
    this.playAtServerMs = this.opts.timers.now() + this.opts.countdownMs;
    this.endAtServerMs = null;
    this.cooldownEndsAtServerMs = null;
    this.countdownTimer = this.opts.timers.setTimeout(
      () => this.transitionToPlaying(),
      this.opts.countdownMs,
    );
    this.broadcastState();
  }
```

Also add a placeholder method that later tasks will flesh out:
```ts
  private transitionToPlaying(): void {
    // Implemented in Task 12
    this.state = "PLAYING";
    this.broadcastState();
  }
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all Room tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/Room.ts server/tests/unit/room.test.ts
git commit -m "feat: Room transitions LOBBY -> COUNTDOWN on 2+ participants"
```

---

### Task 11: Room — COUNTDOWN cancellation when participants drop below 2

**Files:**
- Modify: `server/src/room/Room.ts`
- Modify: `server/tests/unit/room.test.ts`

- [ ] **Step 1: Add failing test**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: COUNTDOWN cancellation", () => {
  it("if a participant disconnects during COUNTDOWN and count drops to 1, returns to LOBBY", () => {
    const { room } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    expect(room.snapshot().state).toBe("COUNTDOWN");
    room.onSocketLeave(s2);
    expect(room.snapshot().state).toBe("LOBBY");
    expect(room.snapshot().playAtServerMs).toBeNull();
  });

  it("the cancelled COUNTDOWN does not later trigger PLAYING when its timer would have fired", () => {
    const { room, timers } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    room.onSocketLeave(s2);
    timers.advance(20_000);
    expect(room.snapshot().state).toBe("LOBBY");
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: at least one fails (timer fires after cancellation).

- [ ] **Step 3: Update `transitionToLobby` to clear timers**

Replace `transitionToLobby` in `server/src/room/Room.ts`:
```ts
  private transitionToLobby(): void {
    this.state = "LOBBY";
    this.playAtServerMs = null;
    this.endAtServerMs = null;
    this.cooldownEndsAtServerMs = null;
    if (this.countdownTimer !== null) {
      this.opts.timers.clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.endTimer !== null) {
      this.opts.timers.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    if (this.cooldownTimer !== null) {
      this.opts.timers.clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    if (this.playheadInterval !== null) {
      this.opts.timers.clearInterval(this.playheadInterval);
      this.playheadInterval = null;
    }
    this.broadcastState();
    // If somehow there are still 2+ participants (e.g., COOLDOWN -> LOBBY with people), fire countdown.
    this.maybeStartCountdown();
  }
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/Room.ts server/tests/unit/room.test.ts
git commit -m "feat: Room cancels COUNTDOWN when participants drop below 2"
```

---

### Task 12: Room — COUNTDOWN expiry transitions to PLAYING

**Files:**
- Modify: `server/src/room/Room.ts`
- Modify: `server/tests/unit/room.test.ts`

- [ ] **Step 1: Add failing test**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: COUNTDOWN -> PLAYING", () => {
  it("after countdownMs elapses, room is PLAYING with endAtServerMs = playAt + duration", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    const playAt = room.snapshot().playAtServerMs!;
    timers.advance(10_000);
    const snap = room.snapshot();
    expect(snap.state).toBe("PLAYING");
    expect(snap.endAtServerMs).toBe(playAt + 256_000);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: fail (endAtServerMs is null because transitionToPlaying is the stub).

- [ ] **Step 3: Replace `transitionToPlaying`**

In `server/src/room/Room.ts`, replace the placeholder `transitionToPlaying`:
```ts
  private transitionToPlaying(): void {
    if (this.state !== "COUNTDOWN" || this.playAtServerMs === null) return;
    this.state = "PLAYING";
    this.endAtServerMs = this.playAtServerMs + this.opts.videoDurationMs;
    this.countdownTimer = null;
    const remaining = this.endAtServerMs - this.opts.timers.now();
    this.endTimer = this.opts.timers.setTimeout(
      () => this.transitionToCooldown(),
      Math.max(0, remaining),
    );
    this.playheadInterval = this.opts.timers.setInterval(() => {
      const expectedSec = (this.opts.timers.now() - this.playAtServerMs!) / 1000;
      const serverNow = this.opts.timers.now();
      for (const socket of this.sockets.keys()) {
        this.opts.send(socket, { type: "playhead", expectedSec, serverNow });
      }
    }, this.opts.playheadIntervalMs);
    this.broadcastState();
  }
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/Room.ts server/tests/unit/room.test.ts
git commit -m "feat: Room transitions COUNTDOWN -> PLAYING with end timer"
```

---

### Task 13: Room — verify playhead broadcast cadence

**Files:**
- Modify: `server/tests/unit/room.test.ts`

The implementation already exists from Task 12; this task adds an explicit test to lock the cadence in.

- [ ] **Step 1: Add test**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: playhead broadcast", () => {
  it("emits a playhead message every 5 seconds during PLAYING", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // -> PLAYING
    sent.length = 0;
    timers.advance(5_000);
    const heads1 = sent.filter((s) => s.msg.type === "playhead");
    expect(heads1.length).toBe(2); // one per socket
    expect((heads1[0].msg as { expectedSec: number }).expectedSec).toBeCloseTo(5, 5);
    timers.advance(5_000);
    const heads2 = sent.filter((s) => s.msg.type === "playhead");
    expect(heads2.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run (expected pass — implementation already in Task 12)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/unit/room.test.ts
git commit -m "test: lock in 5s playhead broadcast cadence"
```

---

### Task 14: Room — PLAYING -> COOLDOWN on end timer or empty room

**Files:**
- Modify: `server/src/room/Room.ts`
- Modify: `server/tests/unit/room.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: PLAYING -> COOLDOWN", () => {
  it("at endAtServerMs, transitions to COOLDOWN with cooldownEndsAtServerMs set", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    timers.advance(256_000); // end of video
    const snap = room.snapshot();
    expect(snap.state).toBe("COOLDOWN");
    expect(snap.cooldownEndsAtServerMs).toBe(timers.now() + 30_000);
    expect(snap.playAtServerMs).toBeNull();
    expect(snap.endAtServerMs).toBeNull();
  });

  it("if all participants leave during PLAYING, transitions to COOLDOWN", () => {
    const { room, timers } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    timers.advance(10_000); // PLAYING
    room.onSocketLeave(s1);
    room.onSocketLeave(s2);
    expect(room.snapshot().state).toBe("COOLDOWN");
  });

  it("playhead interval is cleared when leaving PLAYING", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    timers.advance(256_000); // video ends -> COOLDOWN
    sent.length = 0;
    timers.advance(10_000);
    const heads = sent.filter((s) => s.msg.type === "playhead");
    expect(heads.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: fail (transitionToCooldown is still a stub).

- [ ] **Step 3: Replace `transitionToCooldown`**

In `server/src/room/Room.ts`:
```ts
  private transitionToCooldown(): void {
    this.state = "COOLDOWN";
    this.cooldownEndsAtServerMs = this.opts.timers.now() + this.opts.cooldownMs;
    this.playAtServerMs = null;
    this.endAtServerMs = null;

    if (this.endTimer !== null) {
      this.opts.timers.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    if (this.playheadInterval !== null) {
      this.opts.timers.clearInterval(this.playheadInterval);
      this.playheadInterval = null;
    }

    // Promote pending users to participants now.
    for (const [, user] of this.pendingUsers) {
      // Find their sockets and re-attach to participant set.
      for (const [socket, rec] of this.sockets) {
        if (rec.user?.id === user.id && rec.pending) {
          this.participants.addSocket(socket, user);
          rec.pending = false;
        }
      }
    }
    this.pendingUsers.clear();

    this.cooldownTimer = this.opts.timers.setTimeout(
      () => this.transitionFromCooldownToLobby(),
      this.opts.cooldownMs,
    );
    this.broadcastState();
  }

  private transitionFromCooldownToLobby(): void {
    this.cooldownTimer = null;
    this.state = "LOBBY";
    this.cooldownEndsAtServerMs = null;
    this.broadcastState();
    // Auto-resume if 2+ participants are still here.
    this.maybeStartCountdown();
  }
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all Room tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/room/Room.ts server/tests/unit/room.test.ts
git commit -m "feat: Room transitions PLAYING -> COOLDOWN and auto-loops"
```

---

### Task 15: Room — late joiner during PLAYING is held and promoted on COOLDOWN

**Files:**
- Modify: `server/tests/unit/room.test.ts`

(The pending-promotion logic was added in Task 14; this task verifies it.)

- [ ] **Step 1: Add tests**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: late joiner during PLAYING", () => {
  it("a logged-in user joining during PLAYING is reported as spectator and not in participants", () => {
    const { room, timers, sent } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    sent.length = 0;
    const carolSocket = { id: 3 };
    room.onSocketJoin(carolSocket, carol);
    const carolMsg = sent.find((s) => s.socket === carolSocket)?.msg;
    expect(carolMsg!.type).toBe("room_state");
    if (carolMsg!.type !== "room_state") throw new Error("type narrowing");
    expect(carolMsg.you?.role).toBe("spectator");
    expect(carolMsg.participants.map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });

  it("on COOLDOWN entry, a previously-pending user becomes a participant", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    room.onSocketJoin({ id: 3 }, carol);
    timers.advance(256_000); // -> COOLDOWN
    expect(room.snapshot().state).toBe("COOLDOWN");
    expect(room.snapshot().participants.map((p) => p.id).sort()).toEqual([
      "u-alice",
      "u-bob",
      "u-carol",
    ]);
  });

  it("if pending user disconnects before COOLDOWN, they do not become a participant", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000);
    const carolSocket = { id: 3 };
    room.onSocketJoin(carolSocket, carol);
    room.onSocketLeave(carolSocket);
    timers.advance(256_000);
    expect(room.snapshot().participants.map((p) => p.id).sort()).toEqual(["u-alice", "u-bob"]);
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/unit/room.test.ts
git commit -m "test: verify pending-participant promotion on COOLDOWN"
```

---

### Task 16: Room — COOLDOWN expiry returns to LOBBY, auto-fires next COUNTDOWN

**Files:**
- Modify: `server/tests/unit/room.test.ts`

(Implementation already exists from Task 14.)

- [ ] **Step 1: Add tests**

Append to `server/tests/unit/room.test.ts`:
```ts
describe("Room: COOLDOWN -> LOBBY auto-loop", () => {
  it("after cooldownMs, returns to LOBBY", () => {
    const { room, timers } = makeRoom();
    const s1 = { id: 1 };
    const s2 = { id: 2 };
    room.onSocketJoin(s1, alice);
    room.onSocketJoin(s2, bob);
    timers.advance(10_000);
    room.onSocketLeave(s1);
    room.onSocketLeave(s2);
    expect(room.snapshot().state).toBe("COOLDOWN");
    timers.advance(30_000);
    expect(room.snapshot().state).toBe("LOBBY");
  });

  it("if 2+ participants remain after COOLDOWN, COUNTDOWN auto-fires", () => {
    const { room, timers } = makeRoom();
    room.onSocketJoin({ id: 1 }, alice);
    room.onSocketJoin({ id: 2 }, bob);
    timers.advance(10_000); // PLAYING
    timers.advance(256_000); // COOLDOWN
    expect(room.snapshot().state).toBe("COOLDOWN");
    timers.advance(30_000); // back to LOBBY, then COUNTDOWN
    expect(room.snapshot().state).toBe("COUNTDOWN");
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/unit/room.test.ts
git commit -m "test: verify COOLDOWN auto-loop"
```

---

## Phase D — Sessions, OAuth, WS plumbing

### Task 17: Session module (signed cookies via iron-session)

**Files:**
- Create: `server/src/auth/session.ts`
- Create: `server/tests/unit/session.test.ts`

We use `iron-session` for sealing/unsealing the session payload. The wrapper exposes `seal(user)` returning a cookie value string, and `unseal(cookieValue)` returning the user or `null`.

- [ ] **Step 1: Write failing test**

`server/tests/unit/session.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sealSession, unsealSession, COOKIE_NAME } from "../../src/auth/session.js";

const SECRET = "0123456789abcdef0123456789abcdef"; // 32 chars

describe("session", () => {
  it("COOKIE_NAME is __Host-session", () => {
    expect(COOKIE_NAME).toBe("__Host-session");
  });

  it("seals and unseals a user round-trip", async () => {
    const user = { id: "u-1", name: "Alice", picture: "p.jpg" };
    const cookie = await sealSession(user, SECRET);
    expect(typeof cookie).toBe("string");
    expect(cookie.length).toBeGreaterThan(20);
    const round = await unsealSession(cookie, SECRET);
    expect(round).toEqual(user);
  });

  it("returns null for tampered cookie", async () => {
    const user = { id: "u-1", name: "Alice", picture: "p.jpg" };
    const cookie = await sealSession(user, SECRET);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("a") ? "b" : "a");
    const result = await unsealSession(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for empty cookie", async () => {
    expect(await unsealSession("", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement `server/src/auth/session.ts`**

```ts
import { sealData, unsealData } from "iron-session";
import type { Participant } from "../../../shared/protocol.js";

export const COOKIE_NAME = "__Host-session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function sealSession(user: Participant, secret: string): Promise<string> {
  return await sealData(user, { password: secret, ttl: TTL_SECONDS });
}

export async function unsealSession(
  cookieValue: string,
  secret: string,
): Promise<Participant | null> {
  if (!cookieValue) return null;
  try {
    const data = (await unsealData(cookieValue, { password: secret, ttl: TTL_SECONDS })) as Participant;
    if (!data || typeof data.id !== "string") return null;
    return data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/auth/session.ts server/tests/unit/session.test.ts
git commit -m "feat: signed-cookie session module"
```

---

### Task 18: Google OAuth handlers

**Files:**
- Create: `server/src/auth/google.ts`
- Create: `server/tests/integration/auth.test.ts`

OAuth flow:
1. `GET /auth/google` → generate `state` + PKCE `code_verifier`, store both in short-lived cookies, redirect to Google.
2. Google redirects back to `GET /auth/google/callback?code=…&state=…`.
3. Server verifies `state`, exchanges `code` for tokens with PKCE, fetches userinfo, sets session cookie, redirects to `/`.

We test against a stubbed Google token + userinfo endpoint by injecting a `fetch` function.

- [ ] **Step 1: Write failing test**

`server/tests/integration/auth.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import { mountGoogleAuth } from "../../src/auth/google.js";
import { COOKIE_NAME, unsealSession } from "../../src/auth/session.js";

interface Server {
  app: express.Express;
  server: http.Server;
  port: number;
  fetchCalls: { url: string; init?: RequestInit }[];
}

async function makeServer(): Promise<Server> {
  const app = express();
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    fetchCalls.push({ url, init });
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({ access_token: "fake-access", id_token: "fake-id", token_type: "Bearer" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
      return new Response(
        JSON.stringify({ sub: "google-1234", name: "Alice Tester", picture: "https://x/y.png" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };
  mountGoogleAuth(app, {
    clientId: "fake-client",
    clientSecret: "fake-secret",
    baseUrl: "http://localhost:0",
    sessionSecret: "0123456789abcdef0123456789abcdef",
    fetchImpl: fakeFetch,
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ app, server, port, fetchCalls });
    });
  });
}

describe("Google OAuth", () => {
  let s: Server;
  beforeAll(async () => {
    s = await makeServer();
  });
  afterAll(() => {
    s.server.close();
  });

  it("GET /auth/google redirects to accounts.google.com with state and PKCE", async () => {
    const res = await fetch(`http://localhost:${s.port}/auth/google`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc).toContain("code_challenge=");
    expect(loc).toContain("state=");
    const setCookies = res.headers.getSetCookie?.() ?? [];
    expect(setCookies.some((c) => c.startsWith("oauth_state="))).toBe(true);
    expect(setCookies.some((c) => c.startsWith("oauth_pkce="))).toBe(true);
  });

  it("GET /auth/google/callback exchanges code, sets session cookie, redirects /", async () => {
    // First, hit /auth/google to get state + pkce cookies and the redirect URL.
    const startRes = await fetch(`http://localhost:${s.port}/auth/google`, { redirect: "manual" });
    const setCookies = startRes.headers.getSetCookie?.() ?? [];
    const stateCookie = setCookies.find((c) => c.startsWith("oauth_state="))!;
    const pkceCookie = setCookies.find((c) => c.startsWith("oauth_pkce="))!;
    const stateValue = decodeURIComponent(stateCookie.split(";")[0].split("=")[1]);

    const cookieHeader = `${stateCookie.split(";")[0]}; ${pkceCookie.split(";")[0]}`;
    const cbRes = await fetch(
      `http://localhost:${s.port}/auth/google/callback?code=fake-code&state=${stateValue}`,
      { redirect: "manual", headers: { cookie: cookieHeader } },
    );
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get("location")).toBe("/");
    const cbCookies = cbRes.headers.getSetCookie?.() ?? [];
    const sessionCookie = cbCookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    const sealed = sessionCookie!.split(";")[0].split("=").slice(1).join("=");
    const decoded = decodeURIComponent(sealed);
    const user = await unsealSession(decoded, "0123456789abcdef0123456789abcdef");
    expect(user).toEqual({ id: "google-1234", name: "Alice Tester", picture: "https://x/y.png" });
  });

  it("GET /auth/google/callback rejects mismatched state", async () => {
    const res = await fetch(`http://localhost:${s.port}/auth/google/callback?code=x&state=wrong`, {
      redirect: "manual",
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implement `server/src/auth/google.ts`**

```ts
import express from "express";
import crypto from "node:crypto";
import { sealSession, COOKIE_NAME } from "./session.js";

export interface GoogleAuthOptions {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  sessionSecret: string;
  fetchImpl?: typeof fetch;
}

const SCOPE = "openid email profile";
const STATE_COOKIE = "oauth_state";
const PKCE_COOKIE = "oauth_pkce";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}
function pkceChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}
function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((s) => {
      const [k, ...rest] = s.trim().split("=");
      return [k, decodeURIComponent(rest.join("="))];
    }),
  );
}

export function mountGoogleAuth(app: express.Express, opts: GoogleAuthOptions): void {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = (maxAgeSec: number) =>
    `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isProd ? "; Secure" : ""}`;
  const sessionFlags = isProd
    ? `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`
    : `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;

  app.get("/auth/google", (_req, res) => {
    const state = randomString(16);
    const verifier = randomString(32);
    const challenge = pkceChallenge(verifier);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", opts.clientId);
    url.searchParams.set("redirect_uri", `${opts.baseUrl}/auth/google/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.setHeader("Set-Cookie", [
      `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieFlags(600)}`,
      `${PKCE_COOKIE}=${encodeURIComponent(verifier)}; ${cookieFlags(600)}`,
    ]);
    res.redirect(302, url.toString());
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const stateCookie = cookies[STATE_COOKIE];
      const verifier = cookies[PKCE_COOKIE];
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!stateCookie || !verifier || !code || !state || state !== stateCookie) {
        res.status(400).send("OAuth state mismatch");
        return;
      }
      const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: `${opts.baseUrl}/auth/google/callback`,
        }).toString(),
      });
      if (!tokenRes.ok) {
        res.status(502).send("Token exchange failed");
        return;
      }
      const token = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetchImpl("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!userRes.ok) {
        res.status(502).send("Userinfo failed");
        return;
      }
      const user = (await userRes.json()) as { sub: string; name: string; picture: string };
      const sealed = await sealSession(
        { id: user.sub, name: user.name, picture: user.picture },
        opts.sessionSecret,
      );
      res.setHeader("Set-Cookie", [
        `${COOKIE_NAME}=${encodeURIComponent(sealed)}; ${sessionFlags}`,
        // clear OAuth scratch cookies
        `${STATE_COOKIE}=; ${cookieFlags(0)}`,
        `${PKCE_COOKIE}=; ${cookieFlags(0)}`,
      ]);
      res.redirect(302, "/");
    } catch (err) {
      console.error("[oauth] callback error", err);
      res.status(500).send("OAuth callback error");
    }
  });

  app.post("/auth/logout", (_req, res) => {
    const cleared = isProd
      ? `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
      : `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    res.setHeader("Set-Cookie", cleared);
    res.status(204).end();
  });
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all OAuth tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/auth/google.ts server/tests/integration/auth.test.ts
git commit -m "feat: Google OAuth handlers with PKCE"
```

---

### Task 19: WS server with cookie auth and Room dispatch

**Files:**
- Create: `server/src/ws/server.ts`
- Create: `server/tests/integration/ws.test.ts`

The WS server attaches to an HTTP server, parses the session cookie on upgrade, and creates one `Room` instance shared across the process. Per-socket: it sends a `room_state` immediately and forwards `ping` messages to a pong reply.

- [ ] **Step 1: Write failing test**

`server/tests/integration/ws.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import WebSocket from "ws";
import { mountWs } from "../../src/ws/server.js";
import { sealSession } from "../../src/auth/session.js";
import type { ServerMessage } from "../../../shared/protocol.js";

const SECRET = "0123456789abcdef0123456789abcdef";

interface TestServer {
  port: number;
  close: () => void;
}

async function start(): Promise<TestServer> {
  const app = express();
  const server = http.createServer(app);
  mountWs(server, {
    sessionSecret: SECRET,
    countdownMs: 10_000,
    cooldownMs: 30_000,
    playheadIntervalMs: 5_000,
    videoId: "fPO76Jlnz6c",
    videoDurationMs: 256_000,
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ port, close: () => server.close() });
    });
  });
}

function connect(port: number, cookie?: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const messages: ServerMessage[] = [];
    ws.on("message", (data) => {
      messages.push(JSON.parse(data.toString()) as ServerMessage);
    });
    ws.on("open", () => resolve({ ws, messages }));
    ws.on("error", reject);
  });
}

async function waitFor<T>(check: () => T | undefined, timeoutMs = 1000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = check();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("waitFor timed out");
}

describe("WS server", () => {
  let srv: TestServer;
  beforeAll(async () => { srv = await start(); });
  afterAll(() => { srv.close(); });

  it("anonymous client receives room_state with you=null on connect", async () => {
    const { ws, messages } = await connect(srv.port);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    const msg = messages.find((m) => m.type === "room_state")!;
    if (msg.type !== "room_state") throw new Error("narrowing");
    expect(msg.you).toBeNull();
    ws.close();
  });

  it("authed client (sealed cookie) receives room_state with role=participant", async () => {
    const cookieValue = await sealSession(
      { id: "u-1", name: "Alice", picture: "p.jpg" },
      SECRET,
    );
    const cookieHeader = `__Host-session=${encodeURIComponent(cookieValue)}`;
    const { ws, messages } = await connect(srv.port, cookieHeader);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    const msg = messages.find((m) => m.type === "room_state")!;
    if (msg.type !== "room_state") throw new Error("narrowing");
    expect(msg.you?.role).toBe("participant");
    expect(msg.you?.id).toBe("u-1");
    ws.close();
  });

  it("ping is answered with pong containing t0 and t1", async () => {
    const { ws, messages } = await connect(srv.port);
    await waitFor(() => messages.find((m) => m.type === "room_state"));
    ws.send(JSON.stringify({ type: "ping", t0: 12345 }));
    const pong = await waitFor(() => messages.find((m) => m.type === "pong"));
    if (pong.type !== "pong") throw new Error("narrowing");
    expect(pong.t0).toBe(12345);
    expect(typeof pong.t1).toBe("number");
    ws.close();
  });

  it("two authed clients trigger COUNTDOWN broadcast", async () => {
    const aliceCookie = `__Host-session=${encodeURIComponent(
      await sealSession({ id: "u-a", name: "Alice", picture: "" }, SECRET),
    )}`;
    const bobCookie = `__Host-session=${encodeURIComponent(
      await sealSession({ id: "u-b", name: "Bob", picture: "" }, SECRET),
    )}`;
    const a = await connect(srv.port, aliceCookie);
    const b = await connect(srv.port, bobCookie);
    const aCountdown = await waitFor(() =>
      a.messages.find((m) => m.type === "room_state" && m.state === "COUNTDOWN"),
    );
    const bCountdown = await waitFor(() =>
      b.messages.find((m) => m.type === "room_state" && m.state === "COUNTDOWN"),
    );
    if (aCountdown.type !== "room_state" || bCountdown.type !== "room_state") {
      throw new Error("narrowing");
    }
    expect(aCountdown.playAtServerMs).toBe(bCountdown.playAtServerMs);
    a.ws.close();
    b.ws.close();
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement `server/src/ws/server.ts`**

```ts
import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import { Room } from "../room/Room.js";
import { RealTimers } from "../room/timers.js";
import { unsealSession, COOKIE_NAME } from "../auth/session.js";
import type { ClientMessage, ServerMessage, Participant } from "../../../shared/protocol.js";

export interface MountWsOptions {
  sessionSecret: string;
  countdownMs: number;
  cooldownMs: number;
  playheadIntervalMs: number;
  videoId: string;
  videoDurationMs: number;
}

function parseCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function mountWs(server: HttpServer, opts: MountWsOptions): { room: Room } {
  const wss = new WebSocketServer({ noServer: true });
  const timers = new RealTimers();
  const sockToWs = new Map<object, WebSocket>();

  const room = new Room({
    timers,
    countdownMs: opts.countdownMs,
    cooldownMs: opts.cooldownMs,
    videoId: opts.videoId,
    videoDurationMs: opts.videoDurationMs,
    playheadIntervalMs: opts.playheadIntervalMs,
    send: (socket, msg) => {
      const ws = sockToWs.get(socket);
      if (!ws || ws.readyState !== ws.OPEN) return;
      try { ws.send(JSON.stringify(msg)); } catch { /* dead socket */ }
    },
  });

  server.on("upgrade", async (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    const cookieValue = parseCookieHeader(req.headers.cookie, COOKIE_NAME);
    let user: Participant | null = null;
    if (cookieValue) {
      user = await unsealSession(cookieValue, opts.sessionSecret);
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const key: object = {};
      sockToWs.set(key, ws);
      room.onSocketJoin(key, user);
      ws.on("message", (data) => {
        let msg: ClientMessage;
        try { msg = JSON.parse(data.toString()) as ClientMessage; } catch { return; }
        if (msg.type === "ping") {
          const pong: ServerMessage = { type: "pong", t0: msg.t0, t1: timers.now() };
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(pong));
        }
        // hello is currently a no-op; reserved for future use
      });
      ws.on("close", () => {
        room.onSocketLeave(key);
        sockToWs.delete(key);
      });
      ws.on("error", () => {
        room.onSocketLeave(key);
        sockToWs.delete(key);
      });
    });
  });

  return { room };
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all WS tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/ws/server.ts server/tests/integration/ws.test.ts
git commit -m "feat: WS server with cookie auth and Room dispatch"
```

---

### Task 20: Wire `index.ts`, `/me`, `/auth/test-login`, static assets

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Replace `server/src/index.ts`**

```ts
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, assertProductionConfig } from "./config.js";
import { mountGoogleAuth } from "./auth/google.js";
import { COOKIE_NAME, sealSession, unsealSession } from "./auth/session.js";
import { mountWs } from "./ws/server.js";
import { VIDEO_ID, VIDEO_DURATION_MS } from "./video.js";

assertProductionConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/me", async (req, res) => {
  const cookieHeader = req.headers.cookie ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) {
    res.json(null);
    return;
  }
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  const user = await unsealSession(value, config.sessionSecret);
  res.json(user);
});

mountGoogleAuth(app, {
  clientId: config.googleClientId,
  clientSecret: config.googleClientSecret,
  baseUrl: config.baseUrl,
  sessionSecret: config.sessionSecret,
});

if (config.nodeEnv === "test") {
  app.get("/auth/test-login", async (req, res) => {
    const name = typeof req.query.name === "string" ? req.query.name : "Tester";
    const id = typeof req.query.id === "string" ? req.query.id : `t-${Math.random().toString(36).slice(2, 8)}`;
    const sealed = await sealSession(
      { id, name, picture: "https://placehold.co/64x64" },
      config.sessionSecret,
    );
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(sealed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    );
    res.redirect(302, "/");
  });
  console.log("[server] WARNING: /auth/test-login mounted (NODE_ENV=test)");
} else {
  app.use("/auth/test-login", (_req, res) => {
    res.status(404).send("not found");
  });
}

// Static client (in production builds)
const clientDist = path.resolve(__dirname, "../client");
app.use(express.static(clientDist));
app.get(/^\/(?!auth|me|healthz|ws).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = http.createServer(app);
mountWs(server, {
  sessionSecret: config.sessionSecret,
  countdownMs: config.countdownSeconds * 1000,
  cooldownMs: config.cooldownSeconds * 1000,
  playheadIntervalMs: 5_000,
  videoId: VIDEO_ID,
  videoDurationMs: VIDEO_DURATION_MS,
});

server.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

- [ ] **Step 2: Verify dev still runs**

```bash
npm run dev
```
Hit `http://localhost:5173/me` (proxied) → should return `null`. Hit `/healthz` → `{ok:true}`. Stop.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: wire WS, OAuth, /me, /auth/test-login, static client"
```

---

## Phase E — Client core

### Task 21: WS client with reconnect + clock offset measurement

**Files:**
- Create: `client/src/api/ws.ts`
- Create: `server/tests/unit/clockOffset.test.ts` (pure function lives in client; we lift the math out for testing)
- Create: `client/src/api/clockOffset.ts`

We extract the offset-median math into its own module so it can be unit-tested in Node (Vitest) without a browser.

- [ ] **Step 1: Write failing test for offset math**

`server/tests/unit/clockOffset.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { OffsetEstimator } from "../../../client/src/api/clockOffset.js";

describe("OffsetEstimator", () => {
  it("starts with offset 0", () => {
    const e = new OffsetEstimator();
    expect(e.offsetMs()).toBe(0);
  });

  it("a single sample yields its computed offset", () => {
    // Server clock is ahead of client by 1000ms.
    // t0 = 100, t1 = 1150 (server received at 1150 = 100+1000+50 latency one-way)
    // But server replies with the same t1 we used as a midpoint estimate.
    const e = new OffsetEstimator(1);
    e.addSample(100, 1150, 200); // rtt = 100, midpoint = 150 (client), offset = 1150 - 150 = 1000
    expect(e.offsetMs()).toBe(1000);
  });

  it("median rejects an outlier", () => {
    const e = new OffsetEstimator(5);
    // 5 samples; 4 cluster around offset 1000ms, 1 is an outlier 5000ms.
    e.addSample(100, 1150, 200); // 1000
    e.addSample(110, 1160, 210); // 1000
    e.addSample(120, 1170, 220); // 1000
    e.addSample(130, 5180, 230); // outlier ~5000
    e.addSample(140, 1190, 240); // 1000
    expect(e.offsetMs()).toBe(1000);
  });

  it("keeps only the most recent N samples", () => {
    const e = new OffsetEstimator(3);
    e.addSample(0, 1000, 100);   // 950
    e.addSample(0, 2000, 100);   // 1950
    e.addSample(0, 3000, 100);   // 2950
    e.addSample(0, 4000, 100);   // 3950
    // Median of last 3: 1950, 2950, 3950 -> 2950
    expect(e.offsetMs()).toBe(2950);
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Implement `client/src/api/clockOffset.ts`**

```ts
export class OffsetEstimator {
  private samples: number[] = [];
  constructor(private readonly capacity = 5) {}

  addSample(t0: number, t1: number, t2: number): void {
    const rtt = t2 - t0;
    const offset = t1 - (t0 + rtt / 2);
    this.samples.push(offset);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  offsetMs(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Implement `client/src/api/ws.ts`**

```ts
import type { ClientMessage, ServerMessage } from "../../../shared/protocol.js";
import { OffsetEstimator } from "./clockOffset.js";

export interface SyncWsOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  onOffsetChange?: (offsetMs: number) => void;
}

export class SyncWs {
  private ws: WebSocket | null = null;
  private estimator = new OffsetEstimator(5);
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(private readonly opts: SyncWsOptions) {
    this.connect();
  }

  offsetMs(): number {
    return this.estimator.offsetMs();
  }

  close(): void {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private connect(): void {
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    ws.onopen = () => {
      this.startPings();
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(ev.data) as ServerMessage; } catch { return; }
      if (msg.type === "pong") {
        const t2 = Date.now();
        this.estimator.addSample(msg.t0, msg.t1, t2);
        this.opts.onOffsetChange?.(this.estimator.offsetMs());
        return;
      }
      this.opts.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (this.closed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    };
    ws.onerror = () => { /* onclose will follow */ };
  }

  private startPings(): void {
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), 30_000);
  }

  private sendPing(): void {
    const msg: ClientMessage = { type: "ping", t0: Date.now() };
    this.ws?.send(JSON.stringify(msg));
  }
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add client/src/api/clockOffset.ts client/src/api/ws.ts server/tests/unit/clockOffset.test.ts
git commit -m "feat: client WS with NTP-style clock offset"
```

---

### Task 22: Drift correction policy (pure function, unit tested)

**Files:**
- Create: `client/src/player/drift.ts`
- Create: `server/tests/unit/drift.test.ts`

- [ ] **Step 1: Write failing test**

`server/tests/unit/drift.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { decideDriftAction } from "../../../client/src/player/drift.js";

describe("decideDriftAction", () => {
  it("returns 'none' when within 50ms", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.04 })).toEqual({ kind: "none" });
  });

  it("returns 'rate-up' when slightly behind", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 9.7 })).toEqual({ kind: "rate", rate: 1.05 });
  });

  it("returns 'rate-down' when slightly ahead", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 10.3 })).toEqual({ kind: "rate", rate: 0.95 });
  });

  it("returns 'seek' when more than 0.5s off", () => {
    expect(decideDriftAction({ expectedSec: 10, currentSec: 8.5 })).toEqual({ kind: "seek", toSec: 10 });
    expect(decideDriftAction({ expectedSec: 10, currentSec: 11.6 })).toEqual({ kind: "seek", toSec: 10 });
  });
});
```

- [ ] **Step 2: Run (expected fail)**

```bash
npm test
```

- [ ] **Step 3: Implement `client/src/player/drift.ts`**

```ts
export type DriftAction =
  | { kind: "none" }
  | { kind: "rate"; rate: number }
  | { kind: "seek"; toSec: number };

export function decideDriftAction(args: { expectedSec: number; currentSec: number }): DriftAction {
  const delta = args.currentSec - args.expectedSec;
  const abs = Math.abs(delta);
  if (abs <= 0.05) return { kind: "none" };
  if (abs > 0.5) return { kind: "seek", toSec: args.expectedSec };
  return { kind: "rate", rate: delta < 0 ? 1.05 : 0.95 };
}
```

- [ ] **Step 4: Run (expected pass)**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add client/src/player/drift.ts server/tests/unit/drift.test.ts
git commit -m "feat: drift correction policy"
```

---

### Task 23: YouTube IFrame player wrapper

**Files:**
- Create: `client/src/player/youtube.ts`

This module wraps the YouTube IFrame Player API. It loads the global script once, exposes a `createSyncedPlayer` factory, and uses the drift policy from Task 22.

The IFrame API has a global side-effect: a script tag at `https://www.youtube.com/iframe_api` calls `window.onYouTubeIframeAPIReady()` when loaded. We wrap this in a single-shot promise.

This module is hard to test without a browser; we trust manual + E2E testing here. Keep it small and focused.

- [ ] **Step 1: Implement `client/src/player/youtube.ts`**

```ts
import { decideDriftAction } from "./drift.js";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: YTPlayerConfig,
      ) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerConfig {
  videoId: string;
  width?: number | string;
  height?: number | string;
  playerVars?: Record<string, number | string>;
  events?: { onReady?: (e: { target: YTPlayer }) => void };
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
}

let apiReadyPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiReadyPromise;
}

export interface SyncedPlayerOptions {
  container: HTMLElement;
  videoId: string;
  muted: boolean;
  getOffsetMs: () => number;
}

export interface SyncedPlayer {
  scheduleStart(playAtServerMs: number): void;
  correctDrift(expectedSec: number): void;
  setMuted(muted: boolean): void;
  currentTime(): number;
  dispose(): void;
}

export async function createSyncedPlayer(opts: SyncedPlayerOptions): Promise<SyncedPlayer> {
  await loadApi();
  let player: YTPlayer;
  await new Promise<void>((resolve) => {
    player = new window.YT!.Player(opts.container, {
      videoId: opts.videoId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0 },
      events: { onReady: () => resolve() },
    });
  });
  if (opts.muted) player!.mute();
  let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;
  let rateRevertTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    scheduleStart(playAtServerMs) {
      const now = Date.now();
      const delay = Math.max(0, playAtServerMs - opts.getOffsetMs() - now);
      if (scheduledTimeout) clearTimeout(scheduledTimeout);
      // Pre-buffer at T-2s; play at T.
      const preDelay = Math.max(0, delay - 2000);
      scheduledTimeout = setTimeout(() => {
        player.seekTo(0, true);
        scheduledTimeout = setTimeout(() => {
          if (!opts.muted) player.unMute();
          player.playVideo();
        }, Math.max(0, playAtServerMs - opts.getOffsetMs() - Date.now()));
      }, preDelay);
    },
    correctDrift(expectedSec) {
      const action = decideDriftAction({ expectedSec, currentSec: player.getCurrentTime() });
      if (action.kind === "none") return;
      if (action.kind === "seek") { player.seekTo(action.toSec, true); return; }
      // rate
      try { player.setPlaybackRate(action.rate); }
      catch { player.seekTo(expectedSec, true); return; }
      if (rateRevertTimeout) clearTimeout(rateRevertTimeout);
      rateRevertTimeout = setTimeout(() => {
        try { player.setPlaybackRate(1); } catch { /* ignore */ }
      }, 3000);
    },
    setMuted(muted) {
      if (muted) player.mute(); else player.unMute();
    },
    currentTime() { return player.getCurrentTime(); },
    dispose() {
      if (scheduledTimeout) clearTimeout(scheduledTimeout);
      if (rateRevertTimeout) clearTimeout(rateRevertTimeout);
      try { player.destroy(); } catch { /* ignore */ }
    },
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add client/src/player/youtube.ts
git commit -m "feat: YouTube IFrame player wrapper with drift correction"
```

---

### Task 24: Zustand room store

**Files:**
- Create: `client/src/state/room.ts`

- [ ] **Step 1: Implement `client/src/state/room.ts`**

```ts
import { create } from "zustand";
import type { RoomState, Participant, You } from "../../../shared/protocol.js";

interface RoomStore {
  connected: boolean;
  state: RoomState;
  participants: Participant[];
  you: You | null;
  videoId: string;
  playAtServerMs: number | null;
  endAtServerMs: number | null;
  cooldownEndsAtServerMs: number | null;
  offsetMs: number;
  setConnected: (v: boolean) => void;
  setOffset: (v: number) => void;
  applyRoomState: (s: {
    state: RoomState;
    participants: Participant[];
    you: You | null;
    videoId: string;
    playAtServerMs: number | null;
    endAtServerMs: number | null;
    cooldownEndsAtServerMs: number | null;
  }) => void;
  applyParticipants: (p: Participant[]) => void;
}

export const useRoom = create<RoomStore>((set) => ({
  connected: false,
  state: "LOBBY",
  participants: [],
  you: null,
  videoId: "fPO76Jlnz6c",
  playAtServerMs: null,
  endAtServerMs: null,
  cooldownEndsAtServerMs: null,
  offsetMs: 0,
  setConnected: (v) => set({ connected: v }),
  setOffset: (v) => set({ offsetMs: v }),
  applyRoomState: (s) => set({
    state: s.state,
    participants: s.participants,
    you: s.you,
    videoId: s.videoId,
    playAtServerMs: s.playAtServerMs,
    endAtServerMs: s.endAtServerMs,
    cooldownEndsAtServerMs: s.cooldownEndsAtServerMs,
  }),
  applyParticipants: (p) => set({ participants: p }),
}));
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add client/src/state/room.ts
git commit -m "feat: zustand room store"
```

---

### Task 25: Auth probe + Countdown component

**Files:**
- Create: `client/src/api/auth.ts`
- Create: `client/src/components/Countdown.tsx`

- [ ] **Step 1: Implement `client/src/api/auth.ts`**

```ts
import type { Participant } from "../../../shared/protocol.js";

export async function fetchMe(): Promise<Participant | null> {
  const res = await fetch("/me", { credentials: "same-origin" });
  if (!res.ok) return null;
  return (await res.json()) as Participant | null;
}

export function googleLoginUrl(): string {
  return "/auth/google";
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
}
```

- [ ] **Step 2: Implement `client/src/components/Countdown.tsx`**

```tsx
import { useEffect, useState } from "react";

export function Countdown(props: { targetServerMs: number; offsetMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, props.targetServerMs - (now + props.offsetMs));
  const seconds = Math.ceil(remainingMs / 1000);
  return <div className="countdown">{seconds.toString().padStart(2, "0")}</div>;
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add client/src/api/auth.ts client/src/components/Countdown.tsx
git commit -m "feat: auth probe and Countdown component"
```

---

### Task 26: Tile and SyncIndicator components

**Files:**
- Create: `client/src/components/Tile.tsx`
- Create: `client/src/components/SyncIndicator.tsx`

- [ ] **Step 1: Implement `client/src/components/Tile.tsx`**

```tsx
import { useEffect, useRef } from "react";
import type { Participant } from "../../../shared/protocol.js";
import { createSyncedPlayer, type SyncedPlayer } from "../player/youtube.js";

export interface TileProps {
  participant: Participant;
  videoId: string;
  muted: boolean;
  playAtServerMs: number | null;
  expectedSec: number | null;
  getOffsetMs: () => number;
  showLabel?: boolean;
}

export function Tile(props: TileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SyncedPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    createSyncedPlayer({
      container: containerRef.current,
      videoId: props.videoId,
      muted: props.muted,
      getOffsetMs: props.getOffsetMs,
    }).then((p) => {
      if (cancelled) { p.dispose(); return; }
      playerRef.current = p;
      if (props.playAtServerMs !== null) p.scheduleStart(props.playAtServerMs);
    });
    return () => {
      cancelled = true;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.videoId]);

  useEffect(() => {
    if (props.playAtServerMs !== null) playerRef.current?.scheduleStart(props.playAtServerMs);
  }, [props.playAtServerMs]);

  useEffect(() => {
    playerRef.current?.setMuted(props.muted);
  }, [props.muted]);

  useEffect(() => {
    if (props.expectedSec !== null) playerRef.current?.correctDrift(props.expectedSec);
  }, [props.expectedSec]);

  return (
    <div className="tile">
      <div ref={containerRef} className="tile-player" />
      {props.showLabel !== false && (
        <div className="tile-label">
          <img src={props.participant.picture} alt="" />
          <span>{props.participant.name}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `client/src/components/SyncIndicator.tsx`**

```tsx
export function SyncIndicator(props: { offsetMs: number }) {
  const sign = props.offsetMs >= 0 ? "+" : "−";
  const abs = Math.abs(Math.round(props.offsetMs));
  return <div className="sync-indicator">synced {sign}{abs}ms</div>;
}
```

- [ ] **Step 3: Add minimal CSS to `client/src/styles.css`**

Append to `client/src/styles.css`:
```css
.countdown { font-size: 6rem; font-weight: 700; text-align: center; letter-spacing: 0.1em; }
.tile { position: relative; aspect-ratio: 16/9; background: #000; }
.tile-player { width: 100%; height: 100%; }
.tile-label { position: absolute; bottom: 0; left: 0; right: 0; padding: 0.5rem; background: rgba(0,0,0,0.5); display: flex; align-items: center; gap: 0.5rem; }
.tile-label img { width: 24px; height: 24px; border-radius: 50%; }
.sync-indicator { position: absolute; top: 0.5rem; right: 0.5rem; font-size: 0.75rem; opacity: 0.6; }
.lobby { padding: 2rem; max-width: 640px; margin: 0 auto; text-align: center; }
.lobby-grid { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.lobby-grid img { width: 48px; height: 48px; border-radius: 50%; }
.player-view { display: grid; grid-template-columns: 70% 30%; height: 100vh; }
.player-strip { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; overflow-y: auto; }
.public-grid { display: grid; gap: 0.5rem; padding: 0.5rem; min-height: 100vh; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.public-grid .tile-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 0.5rem; background: #1a1a20; }
.public-grid .tile-empty img { width: 64px; height: 64px; border-radius: 50%; }
.unmute-all { position: fixed; right: 1rem; bottom: 1rem; padding: 0.5rem 1rem; background: #2a2a30; color: #eee; border: 1px solid #444; border-radius: 999px; cursor: pointer; }
@media (max-width: 800px) {
  .player-view { grid-template-columns: 1fr; grid-template-rows: 60% 40%; }
  .player-strip { flex-direction: row; }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Tile.tsx client/src/components/SyncIndicator.tsx client/src/styles.css
git commit -m "feat: Tile and SyncIndicator components + base styles"
```

---

### Task 27: Lobby, Player, PublicGrid views

**Files:**
- Create: `client/src/views/Lobby.tsx`
- Create: `client/src/views/Player.tsx`
- Create: `client/src/views/PublicGrid.tsx`

- [ ] **Step 1: Implement `client/src/views/Lobby.tsx`**

```tsx
import { useRoom } from "../state/room.js";
import { Countdown } from "../components/Countdown.js";
import { googleLoginUrl, logout } from "../api/auth.js";

export function Lobby() {
  const { state, participants, you, playAtServerMs, cooldownEndsAtServerMs, offsetMs } = useRoom();
  if (!you) {
    return (
      <div className="lobby">
        <h1>Sync Paradise</h1>
        <p>Sign in to join the next sync of <i>Gangsta's Paradise</i>.</p>
        <a href={googleLoginUrl()}><button>Sign in with Google</button></a>
        <p style={{ marginTop: "2rem" }}><a href="/grid">Just want to watch? See the public grid →</a></p>
      </div>
    );
  }
  return (
    <div className="lobby">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Hi, {you.name}</span>
        <button onClick={logout}>Logout</button>
      </header>
      <h1>Sync Paradise</h1>
      {state === "LOBBY" && (
        <p>Waiting for someone else to join… ({participants.length}/2)</p>
      )}
      {state === "COUNTDOWN" && playAtServerMs !== null && (
        <>
          <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} />
          <p>Get ready.</p>
        </>
      )}
      {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
        <>
          <Countdown targetServerMs={cooldownEndsAtServerMs} offsetMs={offsetMs} />
          <p>Next round shortly. Stay or come back.</p>
        </>
      )}
      <div className="lobby-grid">
        {participants.map((p) => (
          <div key={p.id} title={p.name}>
            <img src={p.picture} alt={p.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `client/src/views/Player.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { SyncIndicator } from "../components/SyncIndicator.js";

export function Player(props: { getOffsetMs: () => number }) {
  const { participants, you, videoId, playAtServerMs, offsetMs } = useRoom();
  const [expectedSec, setExpectedSec] = useState<number | null>(null);
  // Listen on the underlying WS via a global event-target hack? Simpler: poll the playhead
  // value via useRoom subscriptions when we add it to the store. For now we tick locally.
  useEffect(() => {
    if (!playAtServerMs) return;
    const id = setInterval(() => {
      const expected = (Date.now() + offsetMs - playAtServerMs) / 1000;
      setExpectedSec(expected);
    }, 5000);
    return () => clearInterval(id);
  }, [playAtServerMs, offsetMs]);

  if (!you) return null;
  const others = participants.filter((p) => p.id !== you.id);
  const me = participants.find((p) => p.id === you.id) ?? you;
  return (
    <div className="player-view">
      <div style={{ position: "relative" }}>
        <Tile
          participant={me}
          videoId={videoId}
          muted={false}
          playAtServerMs={playAtServerMs}
          expectedSec={expectedSec}
          getOffsetMs={props.getOffsetMs}
          showLabel={false}
        />
        <SyncIndicator offsetMs={offsetMs} />
      </div>
      <div className="player-strip">
        {others.map((p) => (
          <Tile
            key={p.id}
            participant={p}
            videoId={videoId}
            muted={true}
            playAtServerMs={playAtServerMs}
            expectedSec={expectedSec}
            getOffsetMs={props.getOffsetMs}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `client/src/views/PublicGrid.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useRoom } from "../state/room.js";
import { Tile } from "../components/Tile.js";
import { Countdown } from "../components/Countdown.js";

export function PublicGrid(props: { getOffsetMs: () => number }) {
  const { state, participants, videoId, playAtServerMs, cooldownEndsAtServerMs, offsetMs } = useRoom();
  const [allUnmuted, setAllUnmuted] = useState(false);
  const [expectedSec, setExpectedSec] = useState<number | null>(null);
  useEffect(() => {
    if (state !== "PLAYING" || !playAtServerMs) return;
    const id = setInterval(() => {
      setExpectedSec((Date.now() + offsetMs - playAtServerMs) / 1000);
    }, 5000);
    return () => clearInterval(id);
  }, [state, playAtServerMs, offsetMs]);

  return (
    <div className="public-grid">
      {participants.length === 0 && (
        <div className="tile tile-empty">
          <p>No one's here yet.</p>
          <a href="/">Sign in →</a>
        </div>
      )}
      {participants.map((p) =>
        state === "PLAYING" && playAtServerMs !== null ? (
          <Tile
            key={p.id}
            participant={p}
            videoId={videoId}
            muted={!allUnmuted}
            playAtServerMs={playAtServerMs}
            expectedSec={expectedSec}
            getOffsetMs={props.getOffsetMs}
          />
        ) : (
          <div key={p.id} className="tile tile-empty">
            <img src={p.picture} alt={p.name} />
            <strong>{p.name}</strong>
            {state === "LOBBY" && <span>Waiting</span>}
            {state === "COUNTDOWN" && playAtServerMs !== null && (
              <span>Get ready — <Countdown targetServerMs={playAtServerMs} offsetMs={offsetMs} /></span>
            )}
            {state === "COOLDOWN" && cooldownEndsAtServerMs !== null && (
              <span>Up next — <Countdown targetServerMs={cooldownEndsAtServerMs} offsetMs={offsetMs} /></span>
            )}
          </div>
        ),
      )}
      <button className="unmute-all" onClick={() => setAllUnmuted((v) => !v)}>
        {allUnmuted ? "🔊 Mute all" : "🔇 Unmute all"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add client/src/views/
git commit -m "feat: Lobby, Player, PublicGrid views"
```

---

### Task 28: App routing + WS bootstrap

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Replace `client/src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useRoom } from "./state/room.js";
import { SyncWs } from "./api/ws.js";
import { fetchMe } from "./api/auth.js";
import { Lobby } from "./views/Lobby.js";
import { Player } from "./views/Player.js";
import { PublicGrid } from "./views/PublicGrid.js";

export function App() {
  const route = window.location.pathname.startsWith("/grid") ? "grid" : "main";
  const { state, applyRoomState, applyParticipants, setOffset, setConnected, you } = useRoom();
  const [meChecked, setMeChecked] = useState(false);
  const [ws, setWs] = useState<SyncWs | null>(null);

  useEffect(() => {
    fetchMe().then(() => setMeChecked(true));
  }, []);

  useEffect(() => {
    if (!meChecked) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;
    const sock = new SyncWs({
      url,
      onMessage: (msg) => {
        if (msg.type === "room_state") {
          applyRoomState(msg);
          setConnected(true);
        } else if (msg.type === "participants") {
          applyParticipants(msg.participants);
        }
        // playhead messages are handled per-tile via the local 5s timer; we could add a hook here.
      },
      onOffsetChange: setOffset,
    });
    setWs(sock);
    return () => sock.close();
  }, [meChecked, applyRoomState, applyParticipants, setConnected, setOffset]);

  const getOffsetMs = useMemo(() => () => ws?.offsetMs() ?? 0, [ws]);

  if (!meChecked) return null;
  if (route === "grid") return <PublicGrid getOffsetMs={getOffsetMs} />;
  if (state === "PLAYING" && you) return <Player getOffsetMs={getOffsetMs} />;
  return <Lobby />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Build the client to verify Vite is happy**

```bash
npm run build:client
```
Expected: completes without errors. `dist/client/` populated.

- [ ] **Step 4: Manual smoke**

```bash
NODE_ENV=test npm run dev
```
Open `http://localhost:5173/auth/test-login?name=Alice` (will redirect to `/`). Open another browser context (incognito) at `http://localhost:5173/auth/test-login?name=Bob`. You should see countdown begin in both, then a YouTube video play. Open `http://localhost:5173/grid` to see the public grid.

Stop with Ctrl+C. (If anything's broken, fix before committing.)

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: App routing and WS bootstrap"
```

---

## Phase F — End-to-end test

### Task 29: Playwright E2E for two-context sync

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/sync.spec.ts`
- Modify: `package.json` (already has `e2e` script — verify)

- [ ] **Step 1: Install Playwright browsers**

```bash
npx playwright install chromium
```
Expected: downloads Chromium.

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run build && NODE_ENV=test PORT=3000 SESSION_SECRET=0123456789abcdef0123456789abcdef BASE_URL=http://localhost:3000 GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x COUNTDOWN_SECONDS=3 COOLDOWN_SECONDS=3 npm start",
    url: "http://localhost:3000/healthz",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Create `e2e/sync.spec.ts`**

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, name: string) {
  await page.goto(`/auth/test-login?name=${encodeURIComponent(name)}&id=u-${name.toLowerCase()}`);
  await expect(page).toHaveURL("/");
}

test("two participants countdown and play in sync within 200ms", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();

  await login(aPage, "Alice");
  await login(bPage, "Bob");

  // Wait for countdown to render in at least one page (state=COUNTDOWN).
  await expect(aPage.locator(".countdown")).toBeVisible({ timeout: 10_000 });
  await expect(bPage.locator(".countdown")).toBeVisible({ timeout: 10_000 });

  // Wait for the YouTube IFrame iframe to appear in both (player view).
  await aPage.waitForSelector("iframe[src*='youtube.com/embed/fPO76Jlnz6c']", { timeout: 30_000 });
  await bPage.waitForSelector("iframe[src*='youtube.com/embed/fPO76Jlnz6c']", { timeout: 30_000 });

  // Give playback a couple seconds to start, then read getCurrentTime() from both YT players.
  await aPage.waitForTimeout(3_000);

  async function currentTime(page: Page): Promise<number> {
    const frame = page.frame({ url: /youtube\.com\/embed\/fPO76Jlnz6c/ });
    if (!frame) throw new Error("no youtube iframe");
    // The IFrame player API isn't directly accessible from the parent in Playwright.
    // Instead, read the host page's `playerRef` exposed by Tile if we add a debug hook.
    // Simpler: use evaluate on the parent page to call into the YT API via the global YT object.
    return await page.evaluate(() => {
      // The player is stored in window.__lastPlayer for E2E only (added in next task hook).
      const p = (window as unknown as { __lastPlayer?: { getCurrentTime: () => number } }).__lastPlayer;
      return p ? p.getCurrentTime() : -1;
    });
  }

  const ta = await currentTime(aPage);
  const tb = await currentTime(bPage);
  expect(ta).toBeGreaterThan(0);
  expect(tb).toBeGreaterThan(0);
  expect(Math.abs(ta - tb)).toBeLessThan(0.2); // within 200ms

  await aCtx.close();
  await bCtx.close();
});

test("public grid (no login) shows participants' tiles with names", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const gCtx = await browser.newContext();
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();
  const gPage = await gCtx.newPage();

  await login(aPage, "Alice");
  await login(bPage, "Bob");
  await gPage.goto("/grid");
  await expect(gPage.locator("text=Alice")).toBeVisible({ timeout: 10_000 });
  await expect(gPage.locator("text=Bob")).toBeVisible({ timeout: 10_000 });

  await aCtx.close();
  await bCtx.close();
  await gCtx.close();
});
```

- [ ] **Step 4: Add the E2E debug hook in `Tile.tsx`**

Modify `client/src/components/Tile.tsx`. In the `.then((p) => …)` callback, after `playerRef.current = p;` add:
```ts
      if (!props.muted && import.meta.env.MODE !== "production") {
        (window as unknown as { __lastPlayer?: typeof p }).__lastPlayer = p;
      }
```
This exposes the unmuted (primary) player to E2E tests in non-production builds.

- [ ] **Step 5: Run E2E**

```bash
npm run e2e
```
Expected: both tests pass. (Note: this builds the app and runs a real server; can take 90s.)

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/ client/src/components/Tile.tsx
git commit -m "test: Playwright E2E for two-context sync and public grid"
```

---

## Phase G — Polish for shipping

### Task 30: README and final smoke

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Sync Paradise

A web app that synchronizes Coolio's "Gangsta's Paradise" YouTube video across everyone signed in, plus a public grid that shows all participants' tiles with their names overlaid.

Spec: `docs/superpowers/specs/2026-04-30-sync-paradise-design.md`
Plan: `docs/superpowers/plans/2026-04-30-sync-paradise.md`

## Local development

```bash
npm install
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET (32+ chars)
npm run dev
```
Visit `http://localhost:5173`.

For OAuth-free local testing, run with `NODE_ENV=test` and use `/auth/test-login?name=Alice`.

## Tests

```bash
npm test       # unit + integration (Vitest)
npm run e2e    # Playwright (builds + boots a real server)
npm run typecheck
```

## Production

```bash
npm run build
npm start
```

Required environment variables (see `.env.example`).
```

- [ ] **Step 2: Run all tests and typecheck**

```bash
npm run typecheck && npm test && npm run e2e
```
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-review notes (after writing the plan)

- **Spec coverage:**
  - §3 architecture → Tasks 1, 3, 20.
  - §4 state machine → Tasks 9–16.
  - §5 sync protocol → Tasks 21 (offset), 22 (drift), 23 (player), 12 (server playAtServerMs), 13 (playhead), 19 (pong).
  - §6 frontend views → Tasks 25–28.
  - §7 server modules → Tasks 6, 7, 8, 17, 18, 19, 20.
  - §8 testing → Tasks 4, 9–16 (unit), 18, 19 (integration), 29 (E2E).
  - §9 dev/build → Tasks 1, 3, 20, 30.
- **Type consistency:** `Participant`, `RoomState`, `ServerMessage`, `ClientMessage`, `You`, `Role` are defined in Task 5 (`shared/protocol.ts`) and used identically in every later task. `Timers`, `RealTimers`, `FakeTimers`, `TimerHandle` defined in Task 7. `Room` constructor signature defined in Task 9 and unchanged in Tasks 10–16. `SyncedPlayer` interface defined in Task 23 and consumed by Task 26.
- **Known scope choice:** the spec calls out `participants` delta messages (§7.2). The implementation in Tasks 9–16 broadcasts a full `room_state` on every transition, which is functionally correct (the client's store overwrites). A delta-only optimization is intentionally out of scope for v1; the client store's `applyParticipants` is wired so deltas can be added later without changes elsewhere.
