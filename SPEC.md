# SPEC: 1688 Scout — Core MVP

**Status:** Ready for Agent  
**Label:** `ready-for-agent`  
**Project:** 1688-scout

---

## Problem Statement

Shopee Vietnam sellers manually search 1688.com for matching products by uploading Shopee product images one by one. This is time-consuming, error-prone, and requires context-switching between tabs. The seller needs a way to find 1688 matches directly from the Shopee product page with a single click.

---

## Solution

A Chrome Manifest V3 extension that:
1. Detects Shopee product pages automatically
2. Injects a "Tìm trên 1688" button near the product title
3. On click: extracts the main product image, uploads it to 1688's image search via a background service worker
4. Parses 1688 results and displays them in a persistent side panel (React) with Vietnamese UI
5. User clicks "Mở trên 1688" to open the supplier page in a new tab and contact them manually

---

## User Stories

### Core Detection & Injection
1. As a Shopee seller, I want the extension to automatically detect when I'm on a product page, so that I don't have to manually activate it.
2. As a Shopee seller, I want a "Tìm trên 1688" button to appear near the product title, so that I can start a search with one click.
3. As a Shopee seller, I want the button to appear on both `shopee.vn` and `shopee.com.vn` product pages, so that it works regardless of which domain I use.
4. As a Shopee seller, I want the button to update when I navigate between products via Shopee's SPA routing, so that I don't need to refresh the page.

### Image Extraction & Upload
5. As a Shopee seller, I want the extension to extract the main product image automatically, so that I don't have to download and re-upload it.
6. As a Shopee seller, I want the image compressed before upload (800×800, JPEG 0.8), so that it meets 1688's size/format requirements.
7. As a Shopee seller, I want the upload to use my existing 1688 logged-in session, so that I don't need to log in separately.

### 1688 Search & Results
8. As a Shopee seller, I want the extension to call 1688's image search endpoint and return matched products, so that I see potential suppliers.
9. As a Shopee seller, I want each result to show: thumbnail, title, price (¥), MOQ, shop name, shop rating, and a link, so that I can evaluate suppliers at a glance.
10. As a Shopee seller, I want results limited to the top 20 matches, so that the list stays scannable.
11. As a Shopee seller, I want a "Xem thêm trên 1688" link when there are more results, so that I can browse the full list on 1688.

### Side Panel UI
12. As a Shopee seller, I want the side panel to open automatically when results are ready, so that I don't have to hunt for it.
13. As a Shopee seller, I want all UI text in Vietnamese, so that I can use the tool without translation.
14. As a Shopee seller, I want a loading state while searching, so that I know the request is in progress.
15. As a Shopee seller, I want an empty state when no matches are found ("Không tìm thấy sản phẩm tương tự"), so that I know the search completed but returned nothing.
16. As a Shopee seller, I want to click "Mở trên 1688" on any result to open that product in a new tab, so that I can contact the supplier.

### Error Handling
17. As a Shopee seller, I want to see "Vui lòng đăng nhập 1688" with a button to open 1688.com when my session expires, so that I can re-authenticate and retry.
18. As a Shopee seller, I want to see "Lỗi kết nối, vui lòng thử lại" when the network fails, so that I know it's a temporary issue.
19. As a Shopee seller, I want to see "Lỗi phân tích kết quả" when 1688's page structure changes, so that I know the tool needs an update.
20. As a Shopee seller, I want rapid clicks on the button to be debounced, so that I don't accidentally trigger multiple searches.

### Fallback & Resilience
21. As a Shopee seller, I want a fallback to open 1688's image search page with my image pre-filled when the API fails, so that I can still search manually.
22. As a Shopee seller, I want the extension to handle 1688's GBK/UTF-8 encoding issues gracefully, so that shop names and titles display correctly.

---

## Implementation Decisions

### Architecture: Pragmatic OOP with Feature Modules
- **Core module**: Shared domain types, error definitions, constants (CNY rate, max results, timeouts)
- **Feature modules** (isolated, single-responsibility):
  - `shopee`: Content script — product detection, image extraction, button injection
  - `sixteen-eight-eight`: Background service worker — 1688 API client, result parser, error mapping
  - `side-panel`: React UI — results table, state machine, Vietnamese copy
- **Platform module**: Thin wrappers around Chrome APIs (`chrome.runtime`, `chrome.tabs`, `chrome.sidePanel`, `chrome.storage`) — only as test seams
- **Entry points**: Bootstrap files for content script, background SW, side panel

### 1688 Integration Isolation
All 1688-specific knowledge lives in `features/sixteen-eight-eight/`:
- Reverse-engineered endpoint URL, headers, request format (multipart/form-data or base64 JSON)
- Response parsing (HTML scraping selectors for thumbnail, title, price, MOQ, shop, rating)
- Cookie handling (uses browser's existing 1688 session via `host_permissions`)
- Rate limiting (1 request per 2 seconds)
- Error classification: `NO_RESULTS`, `AUTH_REQUIRED` (302/captcha), `NETWORK_ERROR`, `PARSE_ERROR`, `RATE_LIMITED`
- Fallback URL construction for manual search

### Shopee DOM Strategy
- All selectors centralized in one configuration object with fallback arrays (data-testid → aria-label → class patterns → meta tags)
- Content script re-runs detection on SPA navigation (`popstate`, `pushState`, DOM mutation)
- Main image only for MVP (gallery images deferred)

### Messaging Contract (Content ↔ Background)
```
Request:  { type: 'SEARCH_1688'; payload: { imageBlob: Blob; sourceUrl: string } }
Response: { type: 'SEARCH_1688_RESULT'; payload: { results: SixteenEightEightResult[] } | { error: SearchError } }
```
- Promise-based wrapper with 30s timeout
- Background processes sequentially (rate limit enforcement)

### Side Panel State Machine
```
idle → loading → results(results[])
           → error(SearchError)
           → empty
```
- State persists while panel open; replaced on new search
- Closing panel mid-search doesn't cancel request; results show on reopen

### Domain Types (Shared)
```typescript
interface ShopeeProduct { title, mainImageUrl, priceVND, productUrl }
interface SearchRequest { imageBlob, sourceUrl }
interface SixteenEightEightResult { thumbnailUrl, title, priceCNY, moq, shopName, shopRating, productUrl }
type SearchErrorType = 'NO_RESULTS' | 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'RATE_LIMITED'
interface SearchResponse { results: SixteenEightEightResult[]; error?: { type: SearchErrorType; message: string } }
type SidePanelState = { status: 'idle' | 'loading' } | { status: 'results'; data: SixteenEightEightResult[] } | { status: 'error'; error } | { status: 'empty' }
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
| `SixteenEightEightApiClient` | Given mocked 1688 responses → returns parsed `SixteenEightEightResult[]` or typed `SearchError`; respects rate limit |
| `ResultParser` | Given 1688 HTML fixtures (success, empty, auth redirect, captcha, malformed) → correct output |
| `SidePanel` (React) | Given `SidePanelState` → renders correct UI (loading, results table, error, empty); clicking "Mở trên 1688" opens tab |
| `Messaging` | Content→background request/response round-trip; timeout handling; debounce |

### Test Fixtures Needed
- Shopee product page HTML snapshots (multiple variants for selector fallbacks)
- 1688 image search response HTML (results, empty, login redirect, captcha)
- 1688 product detail page HTML (for future expansion hook)

### Prior Art
- None (greenfield project). Establish patterns in first feature (`sixteen-eight-eight`).

---

## Out of Scope (Explicitly Not in MVP)

- Price/landed-cost calculator
- Qualification rules / filters / sorting
- Search history, favorites, export
- Formula editor for margins
- Multi-image batch upload (gallery images)
- Settings page (CNY→VND rate, max results, image count hardcoded)
- Backend / cloud sync / user accounts
- 1688 price monitoring / alerts
- Competitor analysis on Shopee
- AI product recommendations
- Internationalization beyond Vietnamese
- Automated test suite (manual QA checklist in CONTEXT.md Section 9)
- CI/CD pipeline

---

## Further Notes

### Blocking Dependencies (Resolve Before Build)
1. **1688 image search endpoint** — Network tab inspection needed: URL, method, headers, form field names, response format
2. **1688 result page selectors** — HTML structure for thumbnail, title, price, MOQ, shop name, rating
3. **Shopee product selectors** — Title, main image, price selectors (test across multiple product pages)

### Risk Mitigations Built In
- 1688 endpoint changes → isolated in one feature folder; fallback to manual search
- Shopee DOM breaks → fallback selector arrays; structured logging for quick patch
- 1688 captcha → treated as `AUTH_REQUIRED`; fallback URL opens pre-filled search
- Service worker lifecycle → idempotent requests; content script handles missing response

### Expansion Hooks (Designed In, Not Built)
- `SearchRequest.images: Blob[]` — array for future multi-image
- `SixteenEightEightResult` already has all fields needed for calculator
- Domain types serializable for future storage/backend sync
- `features/calculator/`, `features/history/`, `features/settings/` can be added without touching core

### Acceptance Criteria (from CONTEXT.md Section 9)
All 8 manual QA scenarios must pass:
- Happy path, no results, auth expired, network offline, SPA navigation, rapid clicks, large image, Vietnamese UI verification

---

*Generated from CONTEXT.md using to-spec skill. Ready for technical design on `features/sixteen-eight-eight/` once blocking dependencies resolved.*