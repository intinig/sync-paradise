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
