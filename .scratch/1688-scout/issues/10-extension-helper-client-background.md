# 10: Extension: Helper Client + Background Orchestration

**What to build:** Background service worker (`src/entry-points/background.ts`) with `HelperClient` that communicates with local helper. Handles: health check on startup, `START_CATEGORY_SCAN` message → calls helper `/api/scan-category` with category URL + config + Shopee cookies → polls `/api/scan/:id/progress` every 2s → forwards progress to popup → on complete, calls `/api/scan/:id/result` → downloads CSV via `chrome.downloads.download` → notifies popup. Handles errors: helper unreachable, 1688 not logged in, scan failed.

**Blocked by:** 01, 03, 06, 09

**Status:** ready-for-agent

- [ ] `src/features/helper-client/client.ts` — `HelperClient` class
  - `checkHealth(): Promise<HelperStatus>` — GET `/api/status`
  - `startScan(params): Promise<string>` — POST `/api/scan-category`, returns `scanId`
  - `pollProgress(scanId): AsyncGenerator<ScanProgress>` — polls every 2s
  - `getResult(scanId): Promise<ScanResult>` — GET `/api/scan/:id/result`
  - `stopScan(scanId): Promise<void>` — POST `/api/scan/:id/stop`
  - `login(): Promise<void>` — POST `/api/login`
- [ ] `src/features/helper-client/types.ts` — request/response types matching helper API
- [ ] `src/entry-points/background.ts` — message handlers:
  - `START_CATEGORY_SCAN` → validates Shopee login, gets cookies via `chrome.cookies.getAll`, calls client, manages polling loop
  - `STOP_SCAN` → client.stopScan()
  - `GET_HELPER_STATUS` → client.checkHealth()
- [ ] Progress messages to popup: `{ type: 'SCAN_PROGRESS', payload: ScanProgress }`
- [ ] Complete message: `{ type: 'SCAN_COMPLETE', payload: { csvBlob, filename } }`
- [ ] Error messages: `{ type: 'SCAN_ERROR', payload: { message, action } }`
- [ ] CSV download: `chrome.downloads.download({ url: blobUrl, filename: 'matches-<category>-<date>.csv' })`
- [ ] Shopee cookies: `chrome.cookies.getAll({ domain: 'shopee.vn' })` + `shopee.com.vn`
- [ ] Retry logic: 3 retries with backoff for network errors
- [ ] Timeout: 30s per helper request
- [ ] Test: start helper, run extension, click scan button → progress updates in popup → CSV downloads