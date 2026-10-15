# 03: Helper: 1688 Login + Session

**What to build:** Playwright-driven 1688 login flow. `POST /api/login` opens headful Chromium, navigates to `login.1688.com`, waits for QR code scan (via 1688 mobile app) or credential entry, detects successful login (redirect to 1688.com + user avatar visible), saves `storageState` to `1688-auth.json`. Subsequent `GET /api/status` returns `loggedIn: true`. Session persists across restarts.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `POST /api/login` endpoint in `playwright-helper/src/routes/login.ts`
- [ ] Launches headful browser context (no storageState initially)
- [ ] Navigates to `https://login.1688.com/`, waits for login completion (max 2 min)
- [ ] Detects success: URL matches `https://www.1688.com/**` AND `.member-info` or `.user-name` visible
- [ ] On success: `context.storageState({ path: '1688-auth.json' })`, returns `{ success: true }`
- [ ] On timeout/error: returns `{ success: false, error: "Login timeout" }`, closes browser
- [ ] `GET /api/status` reads `1688-auth.json` if exists, validates by checking a lightweight 1688 request, returns `loggedIn: true/false`
- [ ] `1688-auth.json` gitignored, created at runtime
- [ ] Manual test: run helper, call `/api/login`, scan QR with 1688 app, verify `/api/status` shows `loggedIn: true`, restart helper, verify session persists