# SPEC: 1688 Scout — Core MVP

**Status:** Ready for Agent  
**Label:** `ready-for-agent`  
**Project:** 1688-scout

---

## Problem Statement

Shopee Vietnam sellers want to scan a category on Shopee, find matching products on 1688, and get a simple spreadsheet of viable import opportunities — all with one click.

---

## Solution

A Chrome Manifest V3 extension + local Node.js Playwright helper that:

1. **Verifies login**: Detects if user is logged into both `shopee.vn` and `1688.com`
2. **Category activation**: Shows "Quét danh mục" button on Shopee category pages
3. **Delegates to helper**: Sends category URL + auth cookies to local Playwright helper
4. **Helper scrapes**: Uses its own Playwright Chromium (not user's Chrome) with persisted 1688 session to:
   - Scroll category pages (max 3 pages, 30 products/page = 90 products)
   - Extract product images, prices, titles
   - Search each on 1688 by image (parallel, 5-10 concurrent)
   - Calculate landed cost: `1688_price_CNY × 3500 × 3`
   - Match: calculated price < Shopee price
5. **Outputs sheet**: Returns CSV/JSON data → extension downloads `matches.csv`

---

## User Stories

### Login Verification
1. As a seller, I want the extension to check if I'm logged into Shopee Vietnam, so I know category scanning will work.
2. As a seller, I want the extension to check if I'm logged into 1688 (via helper), so I know image search will work.
3. As a seller, I want a clear indicator: "Shopee: ✓ Đã đăng nhập" / "1688: ✓ Đã đăng nhập" or "Chưa đăng nhập" with action button.

### Category Research
4. As a seller, I want a "Quét danh mục" button on Shopee category pages (`shopee.vn/*/cat.*`, `shopee.vn/all_categories`), so I can start batch analysis.
5. As a seller, I want to configure: max pages (1-3, default 3), max products per page (default 30), CNY→VND rate (default 3500).
6. As a seller, I want a progress indicator during scanning: "Đang quét sản phẩm 15/90..." with percentage.
7. As a seller, I want the scan to run in the background (helper uses its own browser), so I can continue using Chrome.

### Results Output
8. As a seller, I want a CSV file downloaded automatically when scan completes: `1688-matches-<category>-<date>.csv`.
9. As a seller, I want the CSV to have columns: `STT`, `Shopee Title`, `Shopee Price (₫)`, `Shopee URL`, `1688 Title`, `1688 Price (¥)`, `1688 URL`, `Calculated Price (₫)`, `Match (Có/Không)`, `Shop Name`, `Shop Rating`, `MOQ`.
10. As a seller, I want only matched products (calculated < Shopee price) in the CSV, so I see opportunities immediately.
11. As a seller, I want errors logged but not stopping the scan, so one bad product doesn't ruin the batch.

### Error Handling
12. As a seller, I want "Vui lòng đăng nhập Shopee" with link if not logged into Shopee.
13. As a seller, I want "Vui lòng đăng nhập 1688" with button to open helper login if helper session expired.
14. As a seller, I want "Helper không chạy" with start guide if helper server not responding.
15. As a seller, I want "Lỗi quét danh mục" with retry button if category extraction fails.

---

## Implementation Decisions

### Architecture: Extension + Playwright Helper

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Content Script   │  │ Background SW    │  │ Popup / SidePanel│  │
│  │ - Detect category│  │ - Verify logins  │  │ - Login status   │  │
│  │ - Extract config │  │ - Call helper    │  │ - Config form    │  │
│  │ - Get cookies    │  │ - Download CSV   │  │ - Progress       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │            │
│           └─────────────────────┼─────────────────────┘            │
│                                 ▼                                   │
│                    HTTP/WS (localhost:3001)                         │
│                                 │                                   │
│                                 ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Playwright Helper (Node.js)                                 │   │
│  │ - Express server on localhost:3001                          │   │
│  │ - Own Chromium instance (headless for scan, headful login) │   │
│  │ - Persistent 1688 session (storageState)                   │   │
│  │ - Parallel 1688 searches (5-10 concurrent)                 │   │
│  │ - CSV generation                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── core/
│   ├── types.ts           # Shared types
│   ├── constants.ts       # Config defaults
│   └── errors.ts          # Error codes
├── features/
│   ├── shopee/            # Content script only
│   │   ├── extractor.ts   # Category page extraction
│   │   ├── detector.ts    # Login detection, page type
│   │   ├── injector.ts    # "Quét danh mục" button
│   │   └── selectors.ts   # Selector fallbacks
│   └── helper-client/     # Extension ↔ Helper communication
│       ├── client.ts      # HTTP client to helper
│       ├── types.ts       # Request/response types
│       └── index.ts
├── platform/
│   ├── messaging.ts       # chrome.runtime wrappers
│   ├── storage.ts         # chrome.storage wrappers
│   ├── tabs.ts            # chrome.tabs wrappers
│   └── download.ts        # CSV download
└── entry-points/
    ├── content.ts         # Content script bootstrap
    ├── background.ts      # Background SW bootstrap
    └── popup.tsx          # Popup UI (login status + config)
```

**No side panel, no results table, no single-product mode.**

### Login Verification

**Shopee**: Content script checks for user avatar / account menu in DOM.

**1688**: Background calls helper `/api/status` → returns `{ loggedIn: boolean }`. Helper maintains `1688-auth.json` (Playwright `storageState`).

### Category Extraction (Content Script)

- Target: `shopee.vn` category pages (URL patterns: `/cat.*`, `/all_categories`)
- Selector: `li[data-sqe="item"]` (product cards)
- Extract per product:
  - `title`: from `aria-label` or `.whitespace-normal.line-clamp-2`
  - `imageUrl`: from `picture source[type="image/webp"]` or `img[loading="lazy"]`
  - `priceVND`: from `.text-shopee-primary.font-medium`
  - `productUrl`: from `a.contents` href
- Pagination: Click "Next" button / URL param `page=2`, `page=3` (max 3 pages)
- Limit: First 30 products per page

### Helper Communication

**Extension → Helper (Background SW):**

```typescript
// Start scan
POST http://localhost:3001/api/scan-category
{
  categoryUrl: "https://shopee.vn/Thoi-Trang-Nam-cat.11035567",
  config: {
    maxPages: 3,
    maxProductsPerPage: 30,
    cnyVndRate: 3500,
    markupMultiplier: 3
  },
  shopeeCookies: [/* cookie objects */],
  helperAuth: "shared-secret" // optional, for local auth
}

// Helper response: { scanId: "uuid", status: "started" }

// Progress polling
GET http://localhost:3001/api/scan/:scanId/progress
→ { completed: 15, total: 90, currentTitle: "Áo thun...", status: "running" }

// Completion
GET http://localhost:3001/api/scan/:scanId/result
→ { csvBase64: "...", matches: 12, totalScanned: 90, errors: 3 }

// Download CSV in extension
```

**Helper Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/status` | `{ running: true, loggedIn: true, port: 3001 }` |
| `POST /api/login` | Opens headful browser for QR login |
| `POST /api/scan-category` | Starts batch scan, returns `scanId` |
| `GET /api/scan/:id/progress` | Progress for popup |
| `GET /api/scan/:id/result` | CSV + summary when done |
| `POST /api/scan/:id/stop` | Cancel running scan |

### Helper Internal Flow (Playwright)

```typescript
async function scanCategory(params) {
  // 1. Create browser context with saved 1688 session
  const context = await browser.newContext({ storageState: '1688-auth.json' });
  
  // 2. Open Shopee category page (with user's cookies injected)
  const page = await context.newPage();
  await page.context().addCookies(shopeeCookies);
  await page.goto(categoryUrl);
  
  // 3. Extract products (scroll, paginate up to maxPages)
  const products = await extractProducts(page, maxPages, maxPerPage);
  
  // 4. Parallel 1688 search (semaphore 5-10)
  const semaphore = new Semaphore(5);
  const results = await Promise.all(products.map(p => 
    semaphore.run(() => search1688(context, p.imageUrl))
  ));
  
  // 5. Calculate + filter matches
  const matches = results
    .map((r, i) => ({ ...r, shopee: products[i] }))
    .filter(r => r.bestMatch && r.bestMatch.priceCNY * cnyVndRate * markupMultiplier < r.shopee.priceVND)
    .map(r => ({
      stt: ...,
      shopeeTitle: r.shopee.title,
      shopeePrice: r.shopee.priceVND,
      shopeeUrl: r.shopee.productUrl,
      sixteenTitle: r.bestMatch.title,
      sixteenPriceCNY: r.bestMatch.priceCNY,
      sixteenUrl: r.bestMatch.productUrl,
      calculatedPriceVND: r.bestMatch.priceCNY * cnyVndRate * markupMultiplier,
      match: 'Có',
      shopName: r.bestMatch.shopName,
      shopRating: r.bestMatch.shopRating,
      moq: r.bestMatch.moq
    }));
  
  // 6. Generate CSV
  const csv = generateCSV(matches);
  return { csvBase64: Buffer.from(csv).toString('base64'), matches: matches.length };
}
```

### 1688 Search in Helper (Per Product)

```typescript
async function search1688(context, imageUrl) {
  const page = await context.newPage();
  
  // 1. Upload image to 1688 (handles sign, JSONP)
  const imageId = await uploadImage(page, imageUrl);
  
  // 2. Navigate to results page
  await page.goto(`https://air.1688.com/kapp/1688-search/pc-image-search/?tab=imageSearch&imageId=${imageId}&imageIdList=${imageId}`);
  
  // 3. Parse results (top 10)
  const results = await parseResults(page);
  
  await page.close();
  return results;
}
```

### CSV Output Format

```csv
STT,Shopee Title,Shopee Price (₫),Shopee URL,1688 Title,1688 Price (¥),1688 URL,Calculated Price (₫),Match,Shop Name,Shop Rating,MOQ
1,"Áo thun nam",150000,"https://shopee.vn/...","男装T恤 纯棉",25,"https://detail.1688.com/...",262500,"Có","Guangzhou Shop",4.8,10
2,"Quần jeans",300000,"https://shopee.vn/...","男士牛仔裤",45,"https://detail.1688.com/...",472500,"Có","Shenzhen Factory",4.9,50
```

---

## Domain Types (Shared)

```typescript
// core/types.ts

// Shopee category product (extracted from list page)
interface ShopeeCategoryProduct {
  title: string;
  imageUrl: string;
  priceVND: number;
  productUrl: string;
}

// Scan configuration
interface ScanConfig {
  maxPages: number;           // 1-3, default 3
  maxProductsPerPage: number; // default 30
  cnyVndRate: number;         // default 3500
  markupMultiplier: number;   // default 3
}

// Scan request to helper
interface ScanCategoryRequest {
  categoryUrl: string;
  config: ScanConfig;
  shopeeCookies: ChromeCookie[];
}

// Progress from helper
interface ScanProgress {
  scanId: string;
  completed: number;
  total: number;
  currentTitle: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  errors: number;
}

// Final result
interface ScanResult {
  scanId: string;
  csvBase64: string;      // Base64 encoded CSV
  matches: number;
  totalScanned: number;
  errors: number;
  startedAt: string;
  completedAt: string;
}

// 1688 result (from helper)
interface SixteenEightEightResult {
  thumbnailUrl: string;
  title: string;
  priceCNY: number;
  moq: number;
  shopName: string;
  shopRating: number;
  productUrl: string;
}

// Helper status
interface HelperStatus {
  running: boolean;
  loggedIn: boolean;
  port: number;
  version: string;
}

type SearchErrorType = 'NO_RESULTS' | 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'RATE_LIMITED';

interface SearchError {
  type: SearchErrorType;
  message: string; // Vietnamese
}
```

---

## Constants

```typescript
// core/constants.ts
export const CONSTANTS = {
  // Scan defaults
  DEFAULT_MAX_PAGES: 3,
  DEFAULT_MAX_PRODUCTS_PER_PAGE: 30,
  DEFAULT_CNY_VND_RATE: 3500,
  DEFAULT_MARKUP_MULTIPLIER: 3,
  
  // Helper
  HELPER_BASE_URL: 'http://localhost:3001',
  HELPER_HEALTH_CHECK_MS: 5000,
  HELPER_SCAN_TIMEOUT_MS: 30 * 60 * 1000, // 30 min max
  
  // 1688 (used by helper)
  MAX_RESULTS_PER_SEARCH: 10,
  PARALLEL_CONTEXTS: 5,
  
  // Shopee selectors
  SHOPEE_CATEGORY_URL_PATTERNS: [
    '*://*.shopee.vn/*/cat.*',
    '*://*.shopee.vn/all_categories*',
    '*://*.shopee.com.vn/*/cat.*',
    '*://*.shopee.com.vn/all_categories*'
  ],
  PRODUCT_CARD_SELECTOR: 'li[data-sqe="item"]',
  MAX_PAGES: 3,
};
```

---

## UI: Popup Only (No Side Panel)

```
┌─────────────────────────────────────┐
│  1688 Scout                    [×]  │
├─────────────────────────────────────┤
│  🟢 Shopee: Đã đăng nhập            │
│  🟢 1688: Đã đăng nhập (Helper)     │
│                                     │
│  [ Cấu hình quét ]                  │
│  ┌─────────────────────────────┐   │
│  │ Trang tối đa: [3] ▼         │   │
│  │ Sản phẩm/trang: [30] ▼      │   │
│  │ Tỷ giá CNY→VND: [3500]      │   │
│  │ Hệ số nhân: [3]             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Quét danh mục này ]  ← Primary  │
│                                     │
│  Helper: 🟢 Đang chạy (localhost:3001)│
│  [ Mở Helper ] [ Đăng nhập 1688 ]   │
└─────────────────────────────────────┘
```

**During Scan:**
```
┌─────────────────────────────────────┐
│  1688 Scout                         │
├─────────────────────────────────────┤
│  🔄 Đang quét: 15/90 (17%)          │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░  │
│  Đang xử lý: "Áo thun nam cotton"   │
│                                     │
│  [ Tạm dừng ] [ Dừng ]              │
└─────────────────────────────────────┘
```

**Complete:**
```
┌─────────────────────────────────────┐
│  1688 Scout                         │
├─────────────────────────────────────┤
│  ✅ Hoàn tất! Tìm thấy 12 matches   │
│  📥 matches-2025-01-15.csv đã tải  │
│                                     │
│  [ Xem file ] [ Quét lại ]          │
└─────────────────────────────────────┘
```

---

## Testing Decisions

| Module | Test Focus |
|--------|------------|
| `ShopeeCategoryExtractor` | Given category HTML → returns up to 30 products/page; handles pagination |
| `ShopeeLoginDetector` | Given HTML → returns loggedIn boolean |
| `HelperClient` | Calls helper endpoints; handles timeout, retry, progress polling |
| `CSVGenerator` | Given matches → valid CSV with correct columns |
| `Popup` | Shows login status, config, progress, download button |

**Fixtures needed:**
- Shopee category page HTML (3 variants)
- Shopee login/logout HTML
- Helper API responses (status, progress, result, error)

---

## Out of Scope

- Single product search (product page button)
- Side panel / results table in extension
- "Mở trên 1688" links in UI
- Pause/resume/stop in extension (only stop via helper API)
- Advanced calculator (fixed `×3` multiplier)
- Settings page (config in popup only)
- History, favorites, export beyond CSV
- Backend / cloud / accounts
- Multi-image, gallery images
- CI/CD, automated tests

---

## Blocking Dependencies

1. **1688 upload endpoint** — `h5api.m.1688.com/...` with JSONP (helper side)
2. **1688 results page selectors** — HTML inspection for thumbnail, title, price, MOQ, shop, rating
3. **Shopee category selectors** — `li[data-sqe="item"]`, pagination, product fields
4. **Helper `sign` generation** — Verify Playwright can handle 1688 upload
5. **Helper QR login flow** — Test 1688 mobile app QR login persistence

---

## Acceptance Criteria

1. **Login check**: Popup shows ✓/✗ for Shopee + 1688 correctly
2. **Category page**: "Quét danh mục" button appears on `shopee.vn/*/cat.*`
3. **Config**: User can set pages (1-3), products/page, rate, multiplier
4. **Scan start**: Click button → helper receives request → returns `scanId`
5. **Progress**: Popup updates every 2s with completed/total/current
6. **Helper runs headless**: No browser window visible during scan
7. **CSV download**: On complete, `matches-<date>.csv` downloads automatically
8. **CSV content**: Only matched products (calculated < Shopee price), correct columns
9. **Errors**: Failed products logged in helper console, not in CSV, scan continues
10. **Helper not running**: Popup shows "Helper không chạy" + start guide link
11. **1688 session expired**: Helper `/api/status` returns `loggedIn: false` → popup shows "Đăng nhập 1688" button → opens headful browser for QR login
12. **Stop scan**: Click "Dừng" → helper cancels → partial CSV downloaded

---

*Simplified spec for: Extension (login check + category trigger) + Playwright Helper (all scraping + CSV output).*