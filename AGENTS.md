# 1688 Scout — Agent Context

## What this is
Chrome MV3 extension (minimal UI) + a local Node/Playwright helper. A Shopee VN seller
clicks the extension on a category page and gets a CSV of the products whose landed 1688
cost (`priceCNY × 3500 × 3`) beats the Shopee price. Read `SPEC.md` before changing
behaviour — it is the source of truth.

## Stack
| Part | Tech |
|---|---|
| Extension (`/`) | Vanilla HTML + CSS + TypeScript, compiled by `tsc` to `dist/`. Dev-only dep: `chrome-types`. No framework, no bundler, no content scripts, no tests |
| Helper (`playwright-helper/`) | Node 22 + Express + Playwright + TypeScript, vitest for its existing tests |
| Package manager | pnpm (two independent projects, two installs) |

## Where things live
- `manifest.json`, `popup.html`, `style.css`, `assets/` — static, copied into `dist/` by `scripts/copy-static.mjs`.
- `src/core/` — wire contract, constants, Vietnamese copy. Pure TS: no `chrome.*`, no DOM, Node-safe (the helper may `import type` from here; its tsconfig `rootDir: '..'` exists for exactly that).
- `src/background.ts` — service worker; owns all state and every helper HTTP call.
- `src/popup.ts` — display and user actions only.
- `.scratch/1688-scout/` — the plan: `README.md` is the live board, `issues/NN-*.md` are the tickets.

## Critical rules
- **No framework, no bundler, no tests in the extension.** `tsc` + `chrome-types` is the whole toolchain. Do not add React, Plasmo, vitest, or a dev server.
- **`chrome.*` only in `src/background.ts` and `src/popup.ts`** — never in `src/core/`.
- **Popup is the only UI surface.** No content scripts, no in-page buttons. The helper does every bit of Shopee and 1688 scraping; the extension never parses their HTML.
- **No backend.** The helper is a local process on the seller's machine, not a hosted service.
- **Constants, not settings.** Scan parameters live in `src/core/constants.ts`; there is no config UI.
- **MV3 service workers die.** Keep scan state in `chrome.storage.session` and drive progress from the background worker, never from the popup.

## Gotchas
- `URL.createObjectURL` does **not** exist in a service worker — download the CSV with a `data:text/csv;base64,…` URL.
- `chrome.runtime` messaging is JSON only — never send a Blob or ArrayBuffer; pass base64 strings.
- The helper tsconfig sets `rootDir: '..'` so emit lands at `dist/playwright-helper/src/server.js`, which is what `pnpm start` runs. Keep it.
- Existing helper tests deliberately never launch a browser and never touch the network. Keep them that way.
- The previous Plasmo/React attempt is archived on branch `archive/ticket-01-plasmo-wip`. Do not merge it.

## Conventions
- Branch `ticket/<NN>-<slug>` off `integration/1688-scout-mvp`, then merge with
  `merge: ticket NN — <title>`.
- Conventional Commits, with a `Refs .scratch/1688-scout/issues/NN-*.md` footer.
- A ticket is done when its boxes are ticked, `**Status:** done`, and `**Delivered:** <sha>` is set.
