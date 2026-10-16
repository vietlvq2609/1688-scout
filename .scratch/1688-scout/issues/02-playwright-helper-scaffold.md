# 02: Playwright Helper Scaffold

**What to build:** Standalone Node.js project (`playwright-helper/`) with Express + Playwright + TypeScript. Runs `pnpm start` → Express server on `localhost:3001` with `GET /api/status` returning `{ running: true, loggedIn: false, port: 3001, version: "1.0.0" }`.

**Blocked by:** None (can start immediately)

**Status:** done

**Delivered:** `9433adf` (merge `b62aff2`)

**Notes (divergences from the checklist, for the record):**
- pnpm, not npm — the repo uses pnpm everywhere.
- `src/constants.ts` and `src/auth.ts` were not on the checklist; `auth.ts` is pure fs + JSON (no browser, no network) so `/api/status` can report login state without launching Chromium.
- 13 vitest external-behaviour tests were added (ephemeral port + fetch, temp auth files). They never launch a browser and never touch the network.
- `loggedIn` is derived from "a valid `1688-auth.json` exists". Real session validation is ticket 03's job.
- `HELPER_PORT` and `HELPER_AUTH_FILE` env vars override the port and auth-file path.
- `tsconfig.json` sets `rootDir: ".."` so emit lands at `dist/playwright-helper/src/server.js`, which is what `pnpm start` runs.

- [x] `playwright-helper/package.json` — Dependencies: express, playwright, cors, uuid; dev: typescript, tsx, @types/node, @types/express
- [x] `playwright-helper/tsconfig.json` — ES2022, NodeNext, strict, `rootDir: ".."`
- [x] `playwright-helper/src/server.ts` — Express app, CORS, JSON body parser (10MB), JSON 404 + error handler that never leaks stack traces
- [x] `playwright-helper/src/routes/status.ts` — `GET /api/status` → `{ running: true, loggedIn, port, version }`
- [x] `playwright-helper/src/browser.ts` — Singleton `Browser` launcher (headless) + `createScanContext()` with persisted auth state and a desktop fingerprint
- [x] `playwright-helper/src/auth.ts` — `loadAuthState()` / `saveAuthState()` / `clearAuthState()` for `1688-auth.json` (Playwright storageState)
- [x] `pnpm dev` starts the server, `curl localhost:3001/api/status` returns the expected JSON
- [x] `pnpm build` compiles to `dist/`, `pnpm start` runs compiled JS
- [x] `.gitignore` excludes `1688-auth.json`, `node_modules`, `dist`
