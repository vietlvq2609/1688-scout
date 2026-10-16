# 08: Helper — Local Delivery to the Client

**What to build:** make the helper something a non-technical seller can start on their own Windows machine, without a terminal tutorial. There is no login step in the helper any more (see `docs/adr/0001-borrow-live-browser-sessions.md`): the only account work is signing into 1688 in Chrome, which the seller does at most once.

**Blocked by:** 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] `playwright-helper/start-helper.bat` — double-click script that checks for Node, runs `pnpm install` on first run, starts the server, prints the localhost URL, and pauses on error so the window stays readable
- [ ] No `npx playwright install chromium` step: the helper launches the installed Chrome (`channel: "chrome"`), which the seller must have anyway to run the extension
- [ ] `playwright-helper/README.md` — the seller's guide, in order:
  1. install Node.js
  2. double-click `start-helper.bat` and leave the window open
  3. sign in to `1688.com` in Chrome (once)
  4. load the extension, open a Shopee category, click the icon
  5. short troubleshooting list: "helper không chạy", "chưa đăng nhập 1688", empty CSV
- [ ] Lock the helper down: replace the `cors()` wildcard with an explicit origin allow-list (the extension origin) so an arbitrary website the seller visits cannot drive scans on `localhost:3001`
- [ ] Confirm a stopped helper fails fast and clearly instead of hanging, and that `GET /api/status` gives the popup what it needs for the "Helper không chạy" state
- [ ] Manual test on a clean Windows machine or a fresh user account: install → start → sign into 1688 in Chrome → scan a small category → CSV opens in Excel with correct Vietnamese characters
