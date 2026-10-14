# 1688 Scout — Agent Context Pack

**Project:** Chrome Extension (MV3) for Shopee Vietnam sellers to find products on 1688.com  
**User:** Solo dev, AI-assisted | Non-technical Vietnamese client  
**Status:** Pre-build — need 1688 endpoint + Shopee selectors

---

## Core Problem
Shopee seller sees product → wants same on 1688 → currently manual image search. Extension automates: click button → side panel shows 1688 matches.

---

## MVP Scope (Only These 8 Features)

| # | Feature |
|---|---------|
| 1 | Detect Shopee product page (`shopee.vn`/`shopee.com.vn`/product/) |
| 2 | Extract main product image |
| 3 | Inject "Tìm trên 1688" button near title |
| 4 | Upload image to 1688 image search (via background SW) |
| 5 | Parse results: thumb, title, price(¥), MOQ, shop, rating, link |
| 6 | Side panel (React): results table, Vietnamese UI |
| 7 | Use existing 1688 cookies (no login flow) |
| 8 | Error toasts: "Không tìm thấy", "Đăng nhập 1688", "Lỗi kết nối" |

**Explicitly NOT in MVP:** calculator, history, settings, multi-image, backend, price conversion.

---

## Architecture: Pragmatic OOP + Feature Modules

```
src/
├── core/                    # Shared: types, errors, constants
├── features/
│   ├── shopee/              # Content script: extract + inject button
│   ├── sixteen-eight-eight/ # Background: 1688 API client, parser
│   └── side-panel/          # React UI
├── platform/                # Chrome API wrappers (messaging, storage)
└── entry-points/            # content.ts, background.ts, sidepanel.tsx
```

**Key principle:** All 1688 knowledge in `features/sixteen-eight-eight/` — isolated for when endpoint breaks.

---

## Critical Constraints

| Constraint | Implication |
|------------|-------------|
| No public 1688 API | Reverse-engineer internal endpoint; will break |
| 1688 anti-bot/captcha | Automated requests may fail; need manual fallback |
| 1688 session expires often | Detect 302→login; show "Đăng nhập 1688" button |
| Shopee DOM unstable | Hashed classes; multiple fallback selectors needed |
| CORS blocks direct calls | Must use service worker for 1688 requests |
| MV3 service worker | No persistent BG; wakes on events, dies after 30s idle |
| Single image (MVP) | Lower match rate; main image only |
| Non-technical user | Distribute via `.crx` or "Load unpacked" + video |

---

## Domain Types (Shared Vocabulary)

```typescript
// core/types.ts
interface ShopeeProduct {
  title: string;
  mainImageUrl: string;
  priceVND: number;
  productUrl: string;
}

interface SearchRequest {
  imageBlob: Blob;      // main image only (MVP)
  sourceUrl: string;
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

type SearchErrorType = 
  | 'NO_RESULTS' 
  | 'AUTH_REQUIRED' 
  | 'NETWORK_ERROR' 
  | 'PARSE_ERROR' 
  | 'RATE_LIMITED';

interface SearchResponse {
  results: SixteenEightEightResult[];
  error?: { type: SearchErrorType; message: string }; // Vietnamese
}

type SidePanelState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; data: SixteenEightEightResult[] }
  | { status: 'error'; error: SearchResponse['error'] }
  | { status: 'empty' };
```

---

## User Journey (Happy Path)

```
Shopee product page
  → Auto-detect → Inject "Tìm trên 1688" button
  → User clicks → Extract main image
  → Background: upload to 1688 image search
  → Parse results → Open side panel with table
  → User clicks "Mở trên 1688" → New tab with 1688 product
  → User contacts supplier manually
```

**Success:** ≥1 relevant result within 15s of click.

---

## Edge Cases (Must Handle)

| Scenario | Behavior |
|----------|----------|
| Non-product Shopee page | Silent; no button |
| SPA navigation on Shopee | Re-detect, update button |
| 0 results from 1688 | "Không tìm thấy sản phẩm tương tự" |
| 50+ results | Show top 20; "Xem thêm trên 1688" link |
| 302 redirect to login | Show "Vui lòng đăng nhập 1688" + button to 1688.com |
| Captcha | Treat as auth error |
| Image >5MB | Compress to 800×800 JPEG 0.8 |
| Rapid double-click | Debounce; ignore 2nd |
| Panel closed mid-search | Request continues; shows on reopen |
| 1688 HTML changes | Graceful parse fail → "Lỗi phân tích" + manual fallback |
| GBK/UTF-8 encoding | Force GBK decode fallback |

---

## Open Questions (Block Technical Design)

1. **1688 image search endpoint** — URL, method, headers, form fields (multipart? base64?)
2. **1688 result page structure** — HTML selectors for thumb, title, price, MOQ, shop, rating
3. **Shopee product selectors** — Title, main image, price (need live inspection)
4. CNY→VND rate source (MVP: show ¥ only)
5. Distribution method (`.crx` vs unpacked vs Web Store)
6. Max results (default 20)
7. Image compression params (800×800, 0.8 OK?)

---

## Risk Register

| Risk | Likelihood | Impact | MVP Mitigation |
|------|------------|--------|----------------|
| 1688 endpoint changes | High | Critical | Isolate in `features/sixteen-eight-eight/`; manual fallback |
| Shopee DOM breaks | High | High | Fallback selectors in one file; log failures |
| 1688 captcha blocks all | Medium | Critical | Fallback: open 1688 search page with image pre-filled |
| SW dies mid-request | Low | Medium | Idempotent; content handles missing response |
| User can't install | Medium | High | `.crx` + install video + docs |
| Vietnamese encoding | Medium | Medium | GBK fallback; test with real data |

---

## Next Actions (Priority Order)

1. **Reverse-engineer 1688** — Network tab: image search request/response
2. **Audit Shopee DOM** — Selectors for title, main image, price
3. **Technical design: `features/sixteen-eight-eight/`** — Client, parser, error mapping
4. **Technical design: `features/shopee/`** — Extractor, injector, selector strategy
5. **Scaffold project** — Plasmo + React + TypeScript + Vietnamese i18n
6. **Build & test end-to-end**