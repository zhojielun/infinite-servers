# AGENTS.md

## Project overview

Server fleet monitoring dashboard. Two packages:
- `server/` — Hono + better-sqlite3 backend (TypeScript, ESM)
- `web/` — React + Vite frontend (JSX, no TypeScript)

## Commands

```bash
npm run setup        # install deps in root + server + web
npm run init         # create server/data/ dir + default config/servers JSON
npm run dev          # start backend (tsx watch, port 8000)
npm run build        # compile server/ → server/dist/
npm run build:web    # build web/ → root dist/
```

Single package dev:
```bash
cd server && npm run dev       # backend only (tsx watch src/index.ts)
cd web && npm run dev          # frontend only (Vite dev server, proxies API to localhost:8000)
cd server && npm run typecheck # tsc --noEmit
```

Production start: `npm run start` → `cd server && npm start` → `node dist/index.js`

**Order matters for full build**: `npm run build:web` first (frontend → root `dist/`), then `npm run build` (backend tsc → `server/dist/`). Backend serves static files from root `dist/` at runtime.

## Architecture

- Server entry: `server/src/index.ts` — Hono app, SQLite init, route mounting, cron start
- Routes: `server/src/routes/` — one file per endpoint (login, push, status, etc.)
- Config: `server/src/config.ts` — reads `server/data/config.json`, `servers.json`, `server_settings.json`; encrypts auth tokens with AES-256-GCM
- DB: `server/src/db.ts` — SQLite queries; tables created inline in `index.ts`
- Frontend entry: `web/src/dashboard.jsx`, `web/src/detail.jsx`, `web/src/settings.jsx`
- API layer: `web/src/api.js` — fetches from backend, handles auth tokens in localStorage

## Key quirks

- **Web build output goes to root `dist/`**, not `web/dist/`. Vite config: `outDir: '../dist'`. Backend serves static files from `../../dist` relative to server src.
- **Three HTML entry points**: `index.html` (dashboard), `detail.html`, `login.html` — all in `web/`
- **No test suite, no linter, no formatter** configured in this repo
- **No TypeScript in frontend** — `web/` uses plain `.js`/`.jsx`
- **Server typecheck only**: `cd server && npx tsc --noEmit`
- **Data directory** defaults to `server/data/`, configurable via `DATA_DIR` env var
- **Auth tokens** stored encrypted in `server/data/auth_tokens.json` (AES-256-GCM, key in `.encryption_key`)
- **Config files are read synchronously** on every request (no caching layer)
- **`server/data/` is gitignored** — never commit secrets or runtime state
- **Frontend dev proxy**: Vite proxies API paths (`/servers`, `/status`, `/history`, etc.) to `API_TARGET` (default `http://localhost:8000`)
- **Cloudflare deployment**: web package supports `npm run deploy:worker` (Wrangler) and `npm run deploy:pages` (Cloudflare Pages)

## Environment

```
PORT=8000
HOST=0.0.0.0
DATA_DIR=./data       # relative to server/
```

## Adding a new API route

1. Create `server/src/routes/<name>.ts`
2. Export a default Hono router
3. Mount in `server/src/index.ts` with `app.route("/", newRoute)`
