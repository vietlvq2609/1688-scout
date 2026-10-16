# 07: Extension — Popup + Background + Scan Flow

**What to build:** all of the extension's behaviour, in two files plus markup. No content scripts, no framework.

- **Popup** (`popup.html` + `style.css` + `src/popup.ts`): helper status, 1688 login status, the active tab's category URL, a **"Quét danh mục này"** button, live progress with a "Dừng" button, a completion state with "Tải CSV", and Vietnamese error states.
- **Background** (`src/background.ts`): reads Shopee cookies, starts the scan, polls progress every 2 seconds, downloads the CSV, and keeps the scan alive when the popup closes.

**Blocked by:** 01, 06

**Status:** ready-for-agent

- [ ] `src/helperClient.ts` — thin fetch client on `CONSTANTS.HELPER_BASE_URL`: `checkHealth()`, `login()`, `startScan(params)`, `getProgress(scanId)`, `getResult(scanId)`, `stopScan(scanId)`; 30s timeout per request; typed with `src/core/types.ts`
- [ ] `src/background.ts`:
  - [ ] `START_SCAN` — reads the popup-supplied category URL, collects cookies via `chrome.cookies.getAll()` for `shopee.vn` + `shopee.com.vn`, rejects with `SHOPEE_NOT_LOGGED_IN` when there are none, POSTs to `/api/scan-category`, and stores `{ scanId, status, categoryUrl }` in `chrome.storage.session`
  - [ ] polls `/api/scan/:id/progress` every 2s while a scan is running; each poll keeps the service worker alive, and the popup re-attaches from `chrome.storage.session`
  - [ ] on `completed` / `stopped` — GETs `/api/scan/:id/result`, builds a `data:text/csv;base64,…` URL (no `URL.createObjectURL` in a service worker), calls `chrome.downloads.download({ filename: 'matches-<category>-<date>.csv' })`, persists the summary
  - [ ] `GET_HELPER_STATUS` → `checkHealth()`; `LOGIN_1688` → `login()`; `STOP_SCAN` → `stopScan()`
  - [ ] surfaces helper errors as `{ code, message }` using `src/core/errors.ts`
- [ ] `src/popup.ts` — on open: statuses, URL, and button state; disables the button and explains why when the active tab is not a Shopee category, the helper is unreachable, or 1688 is not logged in; renders progress and the completion state; sends `START_SCAN` / `STOP_SCAN` / `LOGIN_1688`
- [ ] Vietnamese copy lives in `src/core/errors.ts` and the popup; no hardcoded strings scattered around
- [ ] Constraints respected: no framework, no bundler, no content script, no tests
- [ ] Manual test: helper running, 1688 logged in, open a Shopee category → click the icon → progress updates → CSV downloads → close and reopen the popup mid-scan and confirm it re-attaches
