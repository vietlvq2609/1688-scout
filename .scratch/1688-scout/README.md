# 1688 Scout — Ticket Board

Source of truth: [`../../SPEC.md`](../../SPEC.md). Status values:
`ready-for-agent` · `in-progress` · `blocked` · `done`.

| # | Ticket | Status | Blocked by |
|---|---|---|---|
| 01 | [Minimal extension scaffold + core types](issues/01-project-scaffold-core-types.md) | **done** (`8f9356a`) | — |
| 02 | [Playwright helper scaffold](issues/02-playwright-helper-scaffold.md) | **done** (`9433adf`) | — |
| 03 | [Helper: browser session hand-off](issues/03-helper-session-handoff.md) | in-progress (manual tests pending) | 02 |
| 04 | [Helper: Shopee category scraping](issues/04-helper-shopee-category-scraping.md) | in-progress (live check pending) | 02 |
| 05 | [Helper: 1688 image search (UI automation)](issues/05-helper-1688-image-search-ui.md) | in-progress (live-image check pending) | 02, 03 |
| 06 | [Helper: scan orchestration + CSV](issues/06-helper-batch-scan-csv.md) | in-progress (real-scan check pending) | 03, 04, 05 |
| 07 | [Extension: popup + background + scan flow](issues/07-extension-popup-background.md) | in-progress (manual tests pending) | 01, 06 |
| 08 | [Helper: local delivery to the client](issues/08-helper-client-delivery.md) | ready-for-agent | 03, 04, 05, 06 |
| 11 | [End-to-end verification](issues/11-integration-e2e-verification.md) | ready-for-agent | 04, 05, 06, 07 |

Tickets 01–08 are the build order; ticket 11 is the manual acceptance pass. There is no
ticket 09 or 10 — they were removed with the side-panel design.

## Suggested order for fastest delivery

`01 → 03 → 05 → 04 → 06 → 07 → 08 → 11` — 01 and 02 are done; **next up is 03**.

Ticket 05 is the riskiest link in the chain (can 1688's image-search UI really be driven
headlessly?); do it early so a failure surfaces before the extension is built. Once ticket
06 passes with `curl`, the client-visible value already exists and ticket 07 is only a
wrapper.

## How to run

Extension (repo root):

```bash
pnpm install
pnpm build            # → dist/
pnpm typecheck
# chrome://extensions → Developer mode → Load unpacked → dist/
```

Helper:

```bash
cd playwright-helper
pnpm install
pnpm dev                            # http://localhost:3001 (launches your installed Chrome)
pnpm test                           # existing helper tests
```

Sign in to `1688.com` in Chrome before scanning: the helper borrows that session instead of
owning a login of its own.

## Conventions

- Branch `ticket/<NN>-<slug>` off `integration/1688-scout-mvp`; merge with
  `merge: ticket NN — <title>`.
- Commit subject `feat|fix|chore|docs(scope): …`, footer
  `Refs .scratch/1688-scout/issues/NN-*.md`.
- A ticket is done when its boxes are ticked, `**Status:** done`, and `**Delivered:** <sha>`
  is set.

## Handover notes

- `archive/ticket-01-plasmo-wip` holds the abandoned Plasmo + React + vitest attempt at
  ticket 01. It is not merged and should not be.
- Sessions are **handed off** from the seller's Chrome for both Shopee and 1688; the helper
  owns no login and keeps no auth file. Read `docs/adr/0001-borrow-live-browser-sessions.md`
  before changing anything about authentication, and `GLOSSARY.md` for the vocabulary
  (session vs login, scan vs search, match vs offer).
- The helper's tsconfig uses `rootDir: '..'` deliberately: `dist/playwright-helper/src/server.js`
  is what `pnpm start` runs, and the same setting is what will let the helper
  `import type` the extension's `src/core/types.ts` contract later.
- Older design documents (side panel, direct 1688 API, `SEARCH_1688` messaging) were
  deleted during the replan; they remain in git history if ever needed.
