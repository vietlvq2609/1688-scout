# 02: Playwright Helper Scaffold

**What to build:** Standalone Node.js project (`playwright-helper/`) with Express + Playwright + TypeScript. Runs `npm start` → Express server on `localhost:3001` with `GET /api/status` returning `{ running: true, loggedIn: false, port: 3001, version: "1.0.0" }`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `playwright-helper/package.json` — Dependencies: express, playwright, cors, uuid; dev: typescript, tsx, @types/node, @types/express
- [ ] `playwright-helper/tsconfig.json` — ES2022, NodeNext, strict
- [ ] `playwright-helper/src/server.ts` — Express app, CORS, JSON body parser (10MB), error handler
- [ ] `playwright-helper/src/routes/status.ts` — `GET /api/status` → `{ running: true, loggedIn: false, port: 3001, version }`
- [ ] `playwright-helper/src/browser.ts` — Singleton `Browser` launcher (headless), context factory
- [ ] `playwright-helper/src/auth.ts` — `loadAuthState()` / `saveAuthState()` for `1688-auth.json` (Playwright storageState)
- [ ] `npm run dev` starts server, `curl localhost:3001/api/status` returns expected JSON
- [ ] `npm run build` compiles to `dist/`, `npm start` runs compiled JS
- [ ] `.gitignore` excludes `1688-auth.json`, `node_modules`, `dist`