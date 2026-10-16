# 07: Extension — Popup + Background + Scan Flow

**What to build:** all of the extension's behaviour, in two files plus markup. No content scripts, no framework.

- **Popup** (`popup.html` + `style.css` + `src/popup.ts`): helper status, 1688 session status, the active tab's category URL, a **"Quét danh mục này"** button, live progress with a "Dừng" button, a completion state with "Tải CSV", and Vietnamese error states.
- **Background** (`src/background.ts`): hands both cookie jars to the helper, starts the scan, polls progress every 2 seconds, downloads the CSV, and keeps the scan alive when the popup closes.

**Blocked by:** 01, 06

**Status:** in-progress (manual tests pending)

- [x] `manifest.json` — add `*://1688.com/*` and `*://*.1688.com/*` to `host_permissions`; `chrome.cookies` cannot read the 1688 jar without them
- [x] `src/helperClient.ts` — thin fetch client on `CONSTANTS.HELPER_BASE_URL`: `checkHealth()`, `checkSession(cookies)`, `startScan(params)`, `getProgress(scanId)`, `getResult(scanId)`, `stopScan(scanId)`; 30s timeout per request; typed from `src/core/types.ts`
- [x] `src/cookies.ts` — `collectSiteCookies()`: `chrome.cookies.getAll()` for `shopee.vn` + `shopee.com.vn` and for `1688.com`, mapped to the `ChromeCookie` shape the helper expects
- [x] `src/background.ts`:
  - [x] `GET_POPUP_STATE` → helper health + 1688 session check (`checkSession(await collectSiteCookies().sixteenEightEight)`), plus both jars' presence
  - [x] `START_SCAN` — reads the popup-supplied category URL, collects both jars, refuses with `SHOPEE_NOT_SIGNED_IN` when the Shopee jar is empty, POSTs `{ categoryUrl, config, cookies }` to `/api/scan-category`, and stores `{ scanId, status, categoryUrl }` in `chrome.storage.session`
  - [x] polls `/api/scan/:id/progress` every 2s while a scan is running; each poll keeps the service worker alive, and the popup re-attaches from `chrome.storage.session`
  - [x] on `completed` / `stopped` / `error` — GETs `/api/scan/:id/result`, builds a `data:text/csv;base64,…` URL (no `URL.createObjectURL` in a service worker), calls `chrome.downloads.download({ filename: 'matches-<category>-<date>.csv' })`, and persists the summary
  - [x] on `error` with `AUTH_REQUIRED` — surfaces "session 1688 đã hết hạn, hãy đăng nhập lại" and still offers the partial CSV
  - [x] `STOP_SCAN` → `stopScan()`; `OPEN_1688_LOGIN` → `chrome.tabs.create({ url: 'https://login.1688.com' })`
  - [x] surfaces helper failures as `{ code, message }` from `src/core/errors.ts`
- [x] `src/popup.ts` — on open: helper status, 1688 session status, active tab URL and button state; disables the button with a Vietnamese reason when the tab is not a Shopee category, the helper is unreachable, or 1688 is not signed in; renders progress and the completion state; sends `START_SCAN` / `STOP_SCAN` / `OPEN_1688_LOGIN`
- [x] Vietnamese copy lives in `src/core/errors.ts` and the popup; no strings scattered around
- [x] Constraints respected: no framework, no bundler, no content script, no tests
- [ ] Manual test: helper running, signed into 1688 in Chrome, open a Shopee category → click the icon → progress → CSV downloads; reopen the popup mid-scan to confirm it re-attaches
- [ ] Manual test: sign out of 1688 in Chrome → popup shows the session as dead and the scan refuses to start instead of failing halfway

**Notes (divergences from the checklist, for the record):**
- The worker holds one `GET_POPUP_STATE` message that returns helper + both sessions +
  active-tab classification + scan state in a single round trip, instead of separate
  `GET_HELPER_STATUS` / `GET_1688_SESSION` messages; the popup re-attaches by subscribing to
  `chrome.storage.session.onChanged` rather than re-polling the helper.
- `src/core/messages.ts` was added for the popup↔worker message contracts and the
  `chrome.storage.session` scan shape (Node-safe, like the rest of `src/core`).
- `ScanProgress` gained an optional `error?: SearchError` so a mid-scan `AUTH_REQUIRED`
  reaches the popup; ticket 06's helper must populate it.
- `expirationDate` (Chrome) is mapped to `expires` (wire contract) in `src/cookies.ts`;
  the ticket 03 mapping then drops it when not finite.
