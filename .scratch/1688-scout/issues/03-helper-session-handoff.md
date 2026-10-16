# 03: Helper — Browser Session Hand-off

**What to build:** the helper stops owning logins. It receives the seller's cookies from the
extension, injects them into the Playwright context, and can say whether the handed-off 1688
session is still valid. This replaces the QR login flow, `1688-auth.json` and `src/auth.ts`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Delete `src/auth.ts` and the tests that covered it; drop `1688-auth.json` from `.gitignore`, and remove `loadAuthState` / `saveAuthState` / `clearAuthState`, `AUTH_FILE_PATH` and the `HELPER_AUTH_FILE` env var
- [ ] `src/cookies.ts` — `toPlaywrightCookies(chromeCookies)` maps Chrome's cookie shape to Playwright's:
  - `sameSite`: `no_restriction` and `unspecified` → `None`, `lax` → `Lax`, `strict` → `Strict`
  - drop `hostOnly` and `session`; omit `expires` unless it is a finite number
  - keep `name`, `value`, `domain`, `path`, `secure`, `httpOnly`
- [ ] `src/browser.ts` — `createScanContext(cookies)` injects the handed-off jars with `context.addCookies(...)`; no `storageState` anywhere in the codebase
- [ ] Launch the installed Chrome (`channel: "chrome"`) instead of the bundled Chromium: the client already has Chrome, it removes the ~150 MB browser download from setup, and it narrows the fingerprint gap with the browser the sessions were created in
- [ ] Keep the desktop fingerprint (UA, 1920×1080, `vi-VN`, `Asia/Ho_Chi_Minh`)
- [ ] `POST /api/session-check` — `{ cookies }` (the 1688 jar) → `{ loggedIn }`: open the 1688 image-search page in a scan context and report `false` when it lands on `login.1688.com` or `login.taobao.com`
- [ ] `GET /api/status` → `{ running, port, version }`; `loggedIn` moves to the session check, because the helper no longer owns a session
- [ ] Update the existing helper tests for the removed module; keep every test browser-free and network-free
- [ ] Manual test: with a signed-in Chrome, the exported cookies give `loggedIn: true`; after clearing the 1688 cookies, `loggedIn: false` with no exception thrown
- [ ] Manual test, the risk this design accepts (`docs/adr/0001-borrow-live-browser-sessions.md`): prove the injected session is not rejected as a bot — the image-search page must render results, not a verification slider. If it is rejected, stop and report: the fallback is a Playwright profile the seller signs into once, not a per-scan QR flow
