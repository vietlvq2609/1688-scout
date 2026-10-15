# 1688 Scout Helper

Standalone local Node.js helper (Express + Playwright) that does all 1688 /
Shopee scraping and CSV generation for the 1688 Scout Chrome extension. It runs
on the seller's own machine — it is **not** a backend server.

## Prerequisites

- Node.js 22+
- Inside this directory: `pnpm install`
  (browsers are not downloaded by tests; if `pnpm install` wants to fetch a
  browser, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install` works too)
- Chromium for Playwright (manual runs only): `npx playwright install chromium`

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the server from source with tsx watch (`src/server.ts`) |
| `pnpm build` | Compile to `dist/` (`tsc`) |
| `pnpm start` | Run the compiled server (`node dist/playwright-helper/src/server.js`) |
| `pnpm test` | Run vitest (no browser, no network) |
| `pnpm typecheck` | `tsc --noEmit` |

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HELPER_PORT` | `3001` | Port the helper listens on |
| `HELPER_AUTH_FILE` | `<cwd>/1688-auth.json` | Path of the persisted 1688 session |

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/status` | `{ running: true, loggedIn: <boolean>, port, version }` |

More endpoints (`/api/login`, scan routes) arrive with later tickets.

## 1688 session

The helper keeps its own 1688 login in `1688-auth.json` (a Playwright
`storageState` file) in the directory the helper is run from. It is gitignored
and never committed. `GET /api/status` reports `loggedIn: false` until a valid
auth file exists (the QR-login flow that creates it lands in a later ticket).
