# 06: Helper — Batch Scan Orchestration + CSV

**What to build:** full scan orchestration in the helper. `POST /api/scan-category` accepts a category URL, config and the handed-off cookie jars → returns `scanId`. In the background it extracts products (ticket 04), runs parallel 1688 searches (ticket 05, semaphore 5), calculates `priceCNY × 3500 × 3`, filters `landedCost < shopeePrice`, and generates the CSV. `GET /api/scan/:id/progress` returns live progress. `GET /api/scan/:id/result` returns base64 CSV + summary. `POST /api/scan/:id/stop` cancels a running scan.

**Blocked by:** 03, 04, 05

**Status:** in-progress (real-scan verification pending)

- [x] `playwright-helper/src/scan/orchestrator.ts` — `ScanOrchestrator` class managing scan lifecycle; state in an in-memory `Map` keyed by `scanId`
- [x] `POST /api/scan-category` — validates `{ categoryUrl, config, cookies }`, creates a `scanId`, spawns `runScan()` in the background, returns `{ scanId, status: "started" }`
- [x] `runScan(scanId, params)`:
  1. creates one browser context carrying both handed-off jars (ticket 03)
  2. calls `extractProducts()` → up to 90 products
  3. for each product: `semaphore.run(() => search1688(context, product.imageUrl))` with `PARALLEL_CONTEXTS = 5`
  4. updates progress: `completed`, `total`, `currentTitle`, `status`, `errors`
  5. computes `calculatedPriceVND = priceCNY × cnyVndRate × markupMultiplier` on the first 1688 result
  6. keeps only rows where `calculatedPriceVND < shopeePriceVND`
  7. maps rows to `STT, Shopee Title, Shopee Price (₫), Shopee URL, 1688 Title, 1688 Price (¥), 1688 URL, Landed Cost (₫), Match, Shop Name, Shop Rating, MOQ`
  8. generates the CSV string and base64-encodes it
  9. stores the final result, sets `status: "completed"`
- [x] `GET /api/scan/:id/progress` → current progress object
- [x] `GET /api/scan/:id/result` → `{ csvBase64, matches, totalScanned, errors, startedAt, completedAt }`
- [x] `POST /api/scan/:id/stop` → sets `status: "stopped"`, cancels pending searches, keeps the partial CSV
- [x] CSV is UTF-8 **with BOM** so Excel renders Vietnamese correctly
- [x] A failed 1688 search increments `errors`, logs to the helper console, and never stops the scan
- [x] If a search reports `AUTH_REQUIRED` (the handed-off 1688 session died mid-scan), abort the scan immediately, set `status: "error"` with that reason, and keep the partial CSV — do not keep searching the remaining products against a dead session
- [x] Auto-stop after 30 minutes (`HELPER_SCAN_TIMEOUT_MS`)
- [ ] Manual verification: run a real scan against a small category and inspect the CSV

**Notes (divergences from the checklist, for the record):**
- `ScanDependencies` (`createScanContext`, `extractProducts`, `search1688`) is injected, so the
  state machine is tested with fakes and no browser; `ScanService` is the seam the routes depend on.
- The worker is a private `run(record, params)` (the ticket's `runScan(scanId, params)`); the routes
  call `start`/`progress`/`result`/`stop` through `ScanService`.
- Both jars are merged into one context (`[...shopee, ...sixteenEightEight]`), because
  `createScanContext` takes one array.
- `ScanProgress` now carries the optional `error` added in ticket 07, so the popup sees
  `AUTH_REQUIRED`. The auto-stop on the 30-minute timeout lands as `status: "stopped"` (partial CSV
  kept), not `error`.
- Confirmed CSV choices: `Match` is `✓`, VND columns are plain rounded integers, ¥ is at most 2
  trimmed decimals, and `Shop Name` / `Shop Rating` are empty (the card has no shop data).
- 9 new orchestrator/CSV tests and 9 new scan-route tests; 74 helper tests total.
