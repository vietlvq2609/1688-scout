# 03: Helper — Browser Session Hand-off

**What to build:** the helper stops owning logins. It receives the seller's cookies from the
extension, injects them into the Playwright context, and can say whether the handed-off 1688
session is still valid. This replaces the QR login flow, `1688-auth.json` and `src/auth.ts`.

**Blocked by:** 02

**Status:** in-progress (manual tests pending)

- [x] Delete `src/auth.ts` and the tests that covered it; drop `1688-auth.json` from `.gitignore`, and remove `loadAuthState` / `saveAuthState` / `clearAuthState`, `AUTH_FILE_PATH` and the `HELPER_AUTH_FILE` env var
- [x] `src/cookies.ts` — `toPlaywrightCookies(chromeCookies)` maps Chrome's cookie shape to Playwright's:
  - `sameSite`: `no_restriction` and `unspecified` → `None`, `lax` → `Lax`, `strict` → `Strict`
  - drop `hostOnly` and `session`; omit `expires` unless it is a finite number
  - keep `name`, `value`, `domain`, `path`, `secure`, `httpOnly`
- [x] `src/browser.ts` — `createScanContext(cookies)` injects the handed-off jars with `context.addCookies(...)`; no `storageState` anywhere in the codebase
- [x] Launch the installed Chrome (`channel: "chrome"`) instead of the bundled Chromium: the client already has Chrome, it removes the ~150 MB browser download from setup, and it narrows the fingerprint gap with the browser the sessions were created in
- [x] Keep the desktop fingerprint (UA, 1920×1080, `vi-VN`, `Asia/Ho_Chi_Minh`)
- [x] `POST /api/session-check` — `{ cookies }` (the 1688 jar) → `{ signedIn }`: open the 1688 image-search page in a scan context and report `false` when it lands on `login.1688.com` or `login.taobao.com`
- [x] `GET /api/status` → `{ running, port, version }`; the `signedIn` flag moves to the session check, because the helper no longer owns a session
- [x] Update the existing helper tests for the removed module; keep every test browser-free and network-free
- [ ] Manual test: with a signed-in Chrome, the exported cookies give `signedIn: true`; after clearing the 1688 cookies, `signedIn: false` with no exception thrown
- [ ] Manual test, the risk this design accepts (`docs/adr/0001-borrow-live-browser-sessions.md`): prove the injected session is not rejected as a bot — the image-search page must render results, not a verification slider. If it is rejected, stop and report: the fallback is a Playwright profile the seller signs into once, not a per-scan QR flow

**Notes (divergences from the checklist, for the record):**
- `src/session.ts` holds `isLoginUrl` / `checkSignedIn`. The Playwright context arrives through a
  narrow `ScanContextFactory` seam (`SessionCheckContext` = `newPage` + `close`), so the 33
  vitest tests stay browser-free and network-free and none of them touch this module's launch.
- `POST /api/session-check` validates that `cookies` is an array (400 `INVALID_REQUEST`
  otherwise) and takes an injectable `SignedInChecker` (`createApp({ checkSignedIn })`) so the
  route is tested with a fake.
- `SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL` and `SESSION_CHECK_TIMEOUT_MS` moved into
  `src/constants.ts`; `AUTH_FILE_PATH` and the `node:path` import are gone.
- `checkSignedIn` always closes the context it opened, including when navigation throws.
- Build still emits `dist/playwright-helper/src/server.js` (what `pnpm start` runs) plus an
  empty `dist/src/core/types.js` from the type-only import of the shared wire contract.
- Follow-up (`ticket/03b-session-check-target`): live recon showed the 1688 image-search page
  renders its upload UI even with no cookies, so the ticket's URL-redirect rule never fired and
  `signedIn` would always be true. `checkSignedIn` now opens `https://i.1688.com/` ("My
  Alibaba"), which redirects to `login.taobao.com` when signed out (confirmed with curl). The
  login-host rule is unchanged; only the probed URL moved.
