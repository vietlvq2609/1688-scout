# 06: Helper: Batch Scan Orchestration + CSV

**What to build:** Full scan orchestration in helper. `POST /api/scan-category` accepts category URL, config, Shopee cookies → returns `scanId`. Background job: extracts products (ticket 04), runs parallel 1688 searches (ticket 05, semaphore 5-10), calculates `priceCNY × 3500 × 3`, filters `calculated < shopeePrice`, generates CSV with 11 columns. `GET /api/scan/:id/progress` returns real-time progress. `GET /api/scan/:id/result` returns base64 CSV + summary. `POST /api/scan/:id/stop` cancels running scan.

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] `playwright-helper/src/scan/orchestrator.ts` — `ScanOrchestrator` class managing scan lifecycle
- [ ] `POST /api/scan-category`:
  - Validates request (categoryUrl, config, shopeeCookies)
  - Creates `scanId` (uuid), stores scan state in memory (Map)
  - Spawns async `runScan(scanId, params)` → returns `{ scanId, status: "started" }`
- [ ] `runScan(scanId, params)`:
  1. Creates browser context with 1688 auth + Shopee cookies
  2. Calls `extractProducts()` → up to 90 products
  3. For each product: `semaphore.run(() => search1688(context, product.imageUrl))` (max 5-10 concurrent)
  4. Updates progress: `completed`, `total`, `currentTitle`, `status`, `errors`
  5. On each result: calculates `calculatedPriceVND = priceCNY * cnyVndRate * markupMultiplier`
  6. Filters: keeps only where `calculatedPriceVND < shopeePriceVND`
  7. Maps to CSV rows: `STT, Shopee Title, Shopee Price, Shopee URL, 1688 Title, 1688 Price (¥), 1688 URL, Calculated Price (₫), Match, Shop Name, Shop Rating, MOQ`
  8. Generates CSV string, base64 encodes
  9. Stores final result, sets `status: "completed"`
- [ ] `GET /api/scan/:id/progress` → current progress object
- [ ] `GET /api/scan/:id/result` → `{ csvBase64, matches, totalScanned, errors, startedAt, completedAt }`
- [ ] `POST /api/scan/:id/stop` → sets `status: "stopped"`, orchestrator cancels pending searches, returns partial CSV
- [ ] CSV encoding: UTF-8 with BOM for Excel compatibility
- [ ] Error handling: failed 1688 searches increment `errors`, logged to console, scan continues
- [ ] Timeout: scan auto-stops after 30 min (`HELPER_SCAN_TIMEOUT_MS`)
- [ ] Integration test: mock Shopee products, mock 1688 search, verify CSV output