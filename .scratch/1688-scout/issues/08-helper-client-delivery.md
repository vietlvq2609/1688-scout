# 08: Helper — Local Delivery to the Client

**What to build:** make the helper something a non-technical seller can start on their own Windows machine, without a terminal tutorial. There is no login step in the helper any more (see `docs/adr/0001-borrow-live-browser-sessions.md`): the only account work is signing into 1688 in Chrome, which the seller does at most once.

**Blocked by:** 03, 04, 05, 06

**Status:** in-progress (manual test pending; scan routes documented ahead of tickets 04–06)

- [x] `playwright-helper/start-helper.bat` — double-click script that checks for Node, runs `pnpm install` on first run, starts the server, prints the localhost URL, and pauses on error so the window stays readable
- [x] No `npx playwright install chromium` step: the helper launches the installed Chrome (`channel: "chrome"`), which the seller must have anyway to run the extension
- [x] `playwright-helper/README.md` — the seller's guide, in order:
  1. install Node.js
  2. double-click `start-helper.bat` and leave the window open
  3. sign in to `1688.com` in Chrome (once)
  4. load the extension, open a Shopee category, click the icon
  5. short troubleshooting list: "helper không chạy", "chưa đăng nhập 1688", empty CSV
- [x] Lock the helper down: replace the `cors()` wildcard with an explicit origin allow-list (the extension origin) so an arbitrary website the seller visits cannot drive scans on `localhost:3001`
- [x] Confirm a stopped helper fails fast and clearly instead of hanging, and that `GET /api/status` gives the popup what it needs for the "Helper không chạy" state
- [ ] Manual test on a clean Windows machine or a fresh user account: install → start → sign into 1688 in Chrome → scan a small category → CSV opens in Excel with correct Vietnamese characters

**Notes (divergences from the checklist, for the record):**
- The extension id is only assigned when the unpacked extension is loaded, so the allow-list is
  `chrome-extension://<32 chars [a-p]>` rather than one pinned id (pinning would need a manifest
  `key`, which is a later packaging decision). Websites (`https://…`) and plain `http://` origins
  are rejected; requests with no `Origin` header (curl) are allowed. `src/cors.ts` + 9 tests.
- `start-helper.bat` also checks for `pnpm` and prints the `corepack enable` hint, because Node
  does not ship pnpm.
- A stopped helper fails immediately: the popup's `checkHealth()` gets `ECONNREFUSED`, which
  `src/helperClient.ts` maps to `HELPER_UNREACHABLE` and the popup renders as "Helper không chạy".
- The scan endpoints are listed in the README now even though 04–06 are still open; the guide
  lands with this ticket so sellers have one document.
