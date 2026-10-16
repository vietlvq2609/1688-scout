# 1688 Scout Helper

Standalone local Node.js helper (Express + Playwright) that does all 1688 /
Shopee scraping and CSV generation for the 1688 Scout Chrome extension. It runs
on the seller's own machine — it is **not** a backend server.

## Prerequisites

- Node.js 22+
- Google Chrome installed — the helper drives the seller's own Chrome
  (`channel: "chrome"`), which is where the handed-off sessions live, and needs
  no bundled browser download.
- Inside this directory: `pnpm install`

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

## Endpoints

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/status` | — | `{ running: true, port, version }` |
| `POST /api/session-check` | `{ cookies }` (the 1688 jar) | `{ signedIn }` |

More endpoints (scan routes) arrive with later tickets.

## Sessions

The helper owns no session and stores none: there is no login route, no auth
file, and no `storageState`. The extension reads the seller's Shopee and 1688
cookies from Chrome and hands them over on every request; the helper injects
them into a Playwright context (`src/cookies.ts` → `src/browser.ts`).

`POST /api/session-check` opens the 1688 image-search page with the handed-off
1688 jar and reports `signedIn: false` when 1688 redirects to
`login.1688.com` / `login.taobao.com`. Recovery is the seller signing in at
`login.1688.com` in their own Chrome — see
`docs/adr/0001-borrow-live-browser-sessions.md`.
