# 08: Helper — Local Delivery to the Client

**What to build:** make the helper something a non-technical seller can start on their own Windows machine, without a terminal tutorial.

**Blocked by:** 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] `playwright-helper/start-helper.bat` — double-click script that checks for Node, runs `pnpm install` + `npx playwright install chromium` on first run, starts the server, and prints the localhost URL; pauses on error so the window stays readable
- [ ] `playwright-helper/README.md` — five-step guide for the seller: install Node, double-click `start-helper.bat`, scan the 1688 QR when asked, keep the window open, run the scan from the extension; plus a short troubleshooting list
- [ ] Lock the helper down: replace the `cors()` wildcard with an explicit origin allow-list (the extension origin and the local pages) so an arbitrary website the seller visits cannot drive scans on `localhost:3001`
- [ ] Confirm `GET /api/status` gives the popup everything it needs for the "Helper không chạy" state, and that a stopped helper produces a fast, clear failure instead of a hang
- [ ] Manual test on a clean Windows machine or a fresh user account: install → start → 1688 QR login → scan a small category → CSV opens in Excel with correct Vietnamese characters
