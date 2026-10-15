# SPEC: 1688 Scout — Core MVP

**Status:** Ready for Agent  
**Label:** `ready-for-agent`  
**Project:** 1688-scout

---

## Problem Statement

Shopee Vietnam sellers manually search 1688.com for matching products by uploading Shopee product images one by one. This is time-consuming, error-prone, and requires context-switching between tabs. The seller needs a way to find 1688 matches directly from the Shopee product page with a single click, **and** batch-scan a category to evaluate import viability at scale.

---

## Solution

A Chrome Manifest V3 extension that provides two modes:

### Mode A: Single Product Search (Original MVP)
1. Detects Shopee product pages automatically
2. Injects a "Tìm trên 1688" button near the product title
3. On click: extracts the main product image, uploads it to 1688's image search via a background service worker
4. Parses 1688 results and displays them in a persistent side panel (React) with Vietnamese UI
5. User clicks "Mở trên 1688" to open the supplier page in a new tab and contact them manually

### Mode B: Category Batch Scan (New)
1. On Shopee category pages (`shopee.vn/*/cat.*` or `shopee.vn/all_categories`), side panel shows "Quét danh mục" button
2. User clicks → extracts first 30 products from current page, paginates up to 3 pages (max 90 products)
3. For each product: searches 1688 by image (sequential, rate-limited 1 req/2s)
4. Limits 1688 results to top 10 per product
5. Calculates landed cost: `1688_price_CNY × CNY_VND_RATE × 3`
6. Displays aggregated table: Shopee Image + Price | 1688 Link + Calculated Price | Match (calculated < Shopee price)
6. Pause/Resume/Stop controls with progress persistence

---

## User Stories

### Core Detection & Injection (Mode A)
1. As a Shopee seller, I want the extension to automatically detect when I'm on a product page, so that I don't have to manually activate it.
2. As a Shopee seller, I want a "Tìm trên 1688" button to appear near the product title, so that I can start a search with one click.
3. As a Shopee seller, I want the button to appear on both `shopee.vn` and `shopee.com.vn` product pages, so that it works regardless of which domain I use.
4. As a Shopee seller, I want the button to update when I navigate between products via Shopee's SPA routing, so that I don't need to refresh the page.

### Category Batch Scan (Mode B)
5. As a Shopee seller, I want to open the side panel on a category page and click "Quét danh mục", so that I can batch-scan products for import viability.
6. As a Shopee seller, I want the tool to extract the first 30 products from up to 3 category pages automatically, so that I don't have to click each product.
7. As a Shopee seller, I want to see a progress bar during batch scanning, so that I know how long it will take.
8. As a Shopee seller, I want to pause/resume/stop the batch at any time, so that I control the process.
9. As a Shopee seller, I want the batch to persist progress if I close the side panel, so that I can resume later.

### Image Extraction & Upload
10. As a Shopee seller, I want the extension to extract the main product image automatically, so that I don't have to download and re-upload it.
11. As a Shopee seller, I want the image compressed before upload (800×800, JPEG 0.8), so that it meets 1688's size/format requirements.
12. As a Shopee seller, I want the upload to use my existing 1688 logged-in session, so that I don't need to log in separately.

### 1688 Search & Results
13. As a Shopee seller, I want the extension to call 1688's two-step image search (upload → get imageId → fetch results page) and return matched products, so that I see potential suppliers.
14. As a Shopee seller, I want each result to show: thumbnail, title, price (¥), MOQ, shop name, shop rating, and a link, so that I can evaluate suppliers at a glance.
15. As a Shopee seller, I want single-product results limited to the top 20 matches, so that the list stays scannable.
16. As a Shopee seller, I want batch-scan 1688 results limited to top 10 per product, so that the aggregated table stays under ~900 rows.
17. As a Shopee seller, I want a "Xem thêm trên 1688" link when there are more results, so that I can browse the full list on 1688.

### Side Panel UI
18. As a Shopee seller, I want the side panel to open automatically when results are ready (Mode A), so that I don't have to hunt for it.
19. As a Shopee seller, I want all UI text in Vietnamese, so that I can use the tool without translation.
20. As a Shopee seller, I want a loading state while searching, so that I know the request is in progress.
21. As a Shopee seller, I want an empty state when no matches are found ("Không tìm thấy sản phẩm tương tự"), so that I know the search completed but returned nothing.
22. As a Shopee seller, I want to click "Mở trên 1688" on any result to open that product in a new tab, so that I can contact the supplier.
23. As a Shopee seller, I want batch results in a table with columns: Shopee Image, Shopee Price (₫), 1688 Product Link, 1688 Price (¥), Calculated Price (₫), Match (Yes/No), so that I can quickly evaluate viability.

### Landed Cost Calculator (Batch Mode Only)
24. As a Shopee seller, I want a simple calculator: `Calculated Price = 1688_Price_CNY × CNY_VND_RATE × 3`, so that I can see if the product is viable after all costs.
25. As a Shopee seller, I want "Match" highlighted when Calculated Price < Shopee Price, so that I can spot opportunities instantly.
26. As a Shopee seller, I want the CNY→VND rate configurable (default 3500), so that I can update it when exchange rates change.

### Error Handling
27. As a Shopee seller, I want to see "Vui lòng đăng nhập 1688" with a button to open 1688.com when my session expires, so that I can re-authenticate and retry.
28. As a Shopee seller, I want to see "Lỗi kết nối, vui lòng thử lại" when the network fails, so that I know it's a temporary issue.
29. As a Shopee seller, I want to see "Lỗi phân tích kết quả" when 1688's page structure changes, so that I know the tool needs an update.
30. As a Shopee seller, I want rapid clicks on the button to be debounced, so that I don't accidentally trigger multiple searches.
31. As a Shopee seller, I want individual product failures in batch mode to be logged but not stop the batch, so that one bad image doesn't ruin the scan.

### Fallback & Resilience
32. As a Shopee seller, I want a fallback to open 1688's image search page with my image pre-filled when the API fails, so that I can still search manually.
33. As a Shopee seller, I want the extension to handle 1688's GBK/UTF-8 encoding issues gracefully, so that shop names and titles display correctly.

---

## Implementation Decisions

### Architecture: Pragmatic OOP with Feature Modules
- **Core module**: Shared domain types, error definitions, constants (CNY rate, max results, timeouts, image compression, batch limits)
- **Feature modules** (isolated, single-responsibility):
  - `shopee`: Content script — product detection, image extraction, button injection, **category page extraction**
  - `sixteen-eight-eight`: Background service worker — 1688 API client, result parser, error mapping, **batch queue manager**
  - `side-panel`: React UI — results table, state machine, Vietnamese copy, **batch progress UI, calculator**
- **Platform module**: Thin wrappers around Chrome APIs (`chrome.runtime`, `chrome.tabs`, `chrome.sidePanel`, `chrome.storage`) — only as test seams
- **Entry points**: Bootstrap files for content script, background SW, side panel

### 1688 Integration Isolation
All 1688-specific knowledge lives in `features/sixteen-eight-eight/`:
- **Two-step flow**:
  1. **Upload**: POST to `https://h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/` with multipart/form-data → returns JSONP with `imageId`
  2. **Results**: Fetch `https://air.1688.com/kapp/1688-search/pc-image-search/?tab=imageSearch&imageId={imageId}&imageIdList={imageId}` → parse HTML for results (primary); fallback to finding JSON API on page
- **JSONP handling**: `fetch()` → text → strip `jsonpIncPrefix` callback wrapper → `JSON.parse()`
- Response parsing (HTML scraping selectors for thumbnail, title, price, MOQ, shop, rating)
- Cookie handling (uses browser's existing 1688 session via `host_permissions`)
- Rate limiting (1 request per 2 seconds, enforced in `SixteenEightEightApiClient`)
- Error classification: `NO_RESULTS`, `AUTH_REQUIRED` (302/captcha), `NETWORK_ERROR`, `PARSE_ERROR`, `RATE_LIMITED`
- Fallback URL construction for manual search

### Shopee DOM Strategy
- All selectors centralized in one configuration object with fallback arrays (data-testid → aria-label → class patterns → meta tags)
- Content script re-runs detection on SPA navigation (`popstate`, `pushState`, DOM mutation)
- **Product page**: Main image only for MVP
- **Category page**: Extract first 30 product cards per page (selector: `li[data-sqe="item"]`), up to 3 pages via pagination
- Selectors from live inspection:
  - Title: `[data-testid="a11y-label"]` (aria-label) → `.whitespace-normal.line-clamp-2` → `[aria-label^="Product card:"]`
  - Main image: `picture source[type="image/webp"]` → `img[loading="lazy"]` → `picture img`
  - Price: `.text-shopee-primary.font-medium` → `[aria-label="promotion price"]`
  - List item: `li[data-sqe="item"]`

### Messaging Contract (Content ↔ Background)
```
Request (Single):  
  { type: 'SEARCH_1688'; payload: { imageBlob: Blob; sourceUrl: string } }

Request (Batch):  
  { type: 'SEARCH_1688_BATCH'; payload: { items: { imageBlob: Blob; sourceUrl: string; shopeePrice: number; shopeeImageUrl: string }[] } }

Response:  
  { type: 'SEARCH_1688_RESULT'; payload: { results: SixteenEightEightResult[] } | { error: SearchError } }
  { type: 'SEARCH_1688_BATCH_PROGRESS'; payload: { completed: number; total: number; currentItem: string } }
  { type: 'SEARCH_1688_BATCH_RESULT'; payload: { batchResults: BatchResultItem[] } }
```
- Promise-based wrapper with 30s timeout per request
- Background processes sequentially (rate limit enforcement)
- Batch queue in background SW with pause/resume/stop control

### Side Panel State Machine
```
Mode A (Single):
  idle → loading → results(results[])
           → error(SearchError)
           → empty

Mode B (Batch):
  idle → batch-config → batch-running(progress, partialResults[])
           → batch-paused(partialResults[])
           → batch-complete(finalResults[])
           → batch-error(error, partialResults[])
```
- State persists in `chrome.storage.session` while panel open; survives panel close/reopen
- Closing panel mid-search doesn't cancel request; results show on reopen
- Batch progress persisted to resume after panel close

### Domain Types (Shared)
```typescript
// core/types.ts
interface ShopeeProduct {
  title: string;
  mainImageUrl: string;
  priceVND: number;
  productUrl: string;
}

interface ShopeeCategoryProduct {
  title: string;
  mainImageUrl: string;
  priceVND: number;
  productUrl: string;
  imageBlob?: Blob; // populated after extraction
}

interface SearchRequest {
  imageBlob: Blob;
  sourceUrl: string;
}

interface BatchSearchRequest {
  items: ShopeeCategoryProduct[];
}

interface SixteenEightEightResult {
  thumbnailUrl: string;
  title: string;
  priceCNY: number;
  moq: number;
  shopName: string;
  shopRating: number;
  productUrl: string;
}

interface BatchResultItem {
  shopeeProduct: ShopeeCategoryProduct;
  matches: SixteenEightEightResult[];
  bestMatch?: SixteenEightEightResult; // lowest price
  calculatedPriceVND?: number; // priceCNY * CNY_RATE * 3
  isMatch?: boolean; // calculatedPriceVND < shopeePriceVND
}

type SearchErrorType = 
  | 'NO_RESULTS' 
  | 'AUTH_REQUIRED' 
  | 'NETWORK_ERROR' 
  | 'PARSE_ERROR' 
  | 'RATE_LIMITED';

interface SearchError {
  type: SearchErrorType;
  message: string; // Vietnamese
}

interface SearchResponse {
  results: SixteenEightEightResult[];
  error?: SearchError;
}

interface BatchProgress {
  completed: number;
  total: number;
  currentItemTitle: string;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  partialResults: BatchResultItem[];
}

type SidePanelState = 
  | { status: 'idle'; mode: 'single' | 'batch' }
  | { status: 'loading'; mode: 'single' }
  | { status: 'results'; mode: 'single'; data: SixteenEightEightResult[] }
  | { status: 'error'; mode: 'single'; error: SearchError }
  | { status: 'empty'; mode: 'single' }
  | { status: 'batch-config'; mode: 'batch' }
  | { status: 'batch-running'; mode: 'batch'; progress: BatchProgress }
  | { status: 'batch-paused'; mode: 'batch'; progress: BatchProgress }
  | { status: 'batch-complete'; mode: 'batch'; results: BatchResultItem[] }
  | { status: 'batch-error'; mode: 'batch'; error: SearchError; progress: BatchProgress };
```

### Constants (core/constants.ts)
```typescript
export const CONSTANTS = {
  // Image
  IMAGE_MAX_DIMENSION: 800,
  IMAGE_QUALITY: 0.8,
  IMAGE_FORMAT: 'image/jpeg',
  
  // 1688
  MAX_RESULTS_SINGLE: 20,
  MAX_RESULTS_BATCH: 10,
  RATE_LIMIT_MS: 2000,
  REQUEST_TIMEOUT_MS: 30000,
  
  // Batch
  BATCH_MAX_PRODUCTS_PER_PAGE: 30,
  BATCH_MAX_PAGES: 3,
  BATCH_MAX_TOTAL_PRODUCTS: 90,
  
  // Calculator
  DEFAULT_CNY_VND_RATE: 3500,
  MARKUP_MULTIPLIER: 3, // triple the converted price
  
  // 1688 Endpoints
  UPLOAD_ENDPOINT: 'https://h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/',
  RESULTS_PAGE_BASE: 'https://air.1688.com/kapp/1688-search/pc-image-search/',
};
```

### Distribution
- Build outputs `.crx` + one-click install script (`.bat`/`.sh`)
- Video walkthrough for non-technical user
- Chrome Web Store deferred to post-MVP

---

## Testing Decisions

### What Makes a Good Test
- Test **external behavior only**: inputs → outputs, side effects (UI render, network calls, storage writes)
- No testing of private methods, internal state, or implementation details
- Prefer integration-style tests over unit tests (extension contexts are inherently integrated)

### Modules to Test
| Module | Test Focus |
|--------|------------|
| `ShopeeProductExtractor` | Given HTML fixture → returns correct `ShopeeProduct` or null; handles missing elements gracefully |
| `ShopeeCategoryExtractor` | Given category page HTML → returns up to 30 `ShopeeCategoryProduct` items; handles pagination |
| `SixteenEightEightApiClient` | Given mocked 1688 responses → returns parsed `SixteenEightEightResult[]` or typed `SearchError`; respects rate limit; handles JSONP |
| `ResultParser` | Given 1688 HTML fixtures (results, empty, auth redirect, captcha, malformed) → correct output |
| `BatchQueueManager` | Sequential processing, pause/resume/stop, progress emission, partial results on stop |
| `Calculator` | Given priceCNY, rate, multiplier → correct VND; match detection |
| `SidePanel` (React) | Given `SidePanelState` → renders correct UI (loading, results table, error, empty, batch progress); clicking "Mở trên 1688" opens tab; pause/resume/stop work |
| `Messaging` | Content→background request/response round-trip; timeout handling; debounce; batch progress messages |

### Test Fixtures Needed
- Shopee product page HTML snapshots (multiple variants for selector fallbacks)
- Shopee category page HTML snapshots (with pagination)
- 1688 image upload JSONP response (success, error)
- 1688 results page HTML (results, empty, login redirect, captcha)
- 1688 product detail page HTML (for future expansion hook)

### Prior Art
- None (greenfield project). Establish patterns in first feature (`sixteen-eight-eight`).

---

## Out of Scope (Explicitly Not in MVP)

- Full formula editor for margins (only fixed `×3` multiplier)
- Search history, favorites, export
- Settings page (CNY→VND rate configurable in side panel only, no separate settings page)
- Backend / cloud sync / user accounts
- 1688 price monitoring / alerts
- Competitor analysis on Shopee (beyond category page prices)
- AI product recommendations
- Internationalization beyond Vietnamese
- Automated test suite (manual QA checklist in CONTEXT.md Section 9)
- CI/CD pipeline
- Multi-image batch upload (gallery images) — single image per product only

---

## Further Notes

### Blocking Dependencies (Resolve Before Build)
1. **1688 image search upload endpoint** — Confirmed: `h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/` with JSONP response
2. **1688 results page structure** — Need HTML inspection of `air.1688.com/kapp/1688-search/pc-image-search/` for selectors
3. **Shopee product selectors** — Confirmed from live inspection (see Shopee DOM Strategy)
4. **Shopee category page selectors** — Need verification for pagination and product card extraction

### Risk Mitigations Built In
- 1688 endpoint changes → isolated in one feature folder; fallback to manual search
- Shopee DOM breaks → fallback selector arrays; structured logging for quick patch
- 1688 captcha → treated as `AUTH_REQUIRED`; fallback URL opens pre-filled search
- Service worker lifecycle → idempotent requests; content script handles missing response
- Batch resilience → individual failures logged, batch continues; progress persisted

### Expansion Hooks (Designed In, Not Built)
- `SearchRequest.images: Blob[]` — array for future multi-image
- `SixteenEightEightResult` already has all fields needed for advanced calculator
- Domain types serializable for future storage/backend sync
- `features/calculator/` (advanced), `features/history/`, `features/settings/` can be added without touching core
- Batch queue manager extensible for other batch operations

### Acceptance Criteria (from CONTEXT.md Section 9 + Batch)
All manual QA scenarios must pass:

**Mode A (Single Product):**
- Happy path: product page → click button → side panel opens → results show → click "Mở trên 1688" → new tab
- No results: "Không tìm thấy sản phẩm tương tự"
- Auth expired: "Vui lòng đăng nhập 1688" + button to 1688.com
- Network offline: "Lỗi kết nối, vui lòng thử lại"
- SPA navigation: button updates without refresh
- Rapid clicks: debounced, only one search
- Large image: compressed to 800×800 JPEG 0.8
- Vietnamese UI verification: all text in Vietnamese

**Mode B (Category Batch):**
- Category page → open side panel → click "Quét danh mục" → progress bar shows
- Extracts 30 products/page × 3 pages = up to 90 products
- Sequential 1688 searches (1 per 2s), ~3 min for 90 products
- Pause/Resume/Stop work; progress persists if panel closed
- Results table: Shopee Image, Shopee Price, 1688 Link, 1688 Price (¥), Calculated Price (₫), Match
- Calculated Price = 1688_Price_CNY × 3500 × 3
- Match = Calculated Price < Shopee Price (highlighted)
- Individual failures don't stop batch; logged in console

---

*Generated from CONTEXT.md using to-spec skill. Ready for technical design on `features/sixteen-eight-eight/` once blocking dependencies resolved.*