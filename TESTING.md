# Testing Reference

## Philosophy
- **Test external behavior only**: inputs → outputs, side effects (UI render, network calls, storage writes)
- **No testing of private methods, internal state, or implementation details**
- **Prefer integration-style tests** over unit tests (extension contexts are inherently integrated)
- **Fixtures from real HTML**: Capture actual Shopee/1688 page HTML for selector testing

## Test Patterns

### 1. ShopeeProductExtractor (features/shopee/)
```typescript
// Given: HTML fixture (multiple variants for selector fallbacks)
// When: extractor.extract(html)
// Then: returns ShopeeProduct with correct title, mainImageUrl, priceVND, productUrl
//       or null for non-product pages
```

### 2. SixteenEightEightApiClient (features/sixteen-eight-eight/)
```typescript
// Given: Mocked 1688 responses (success, empty, 302 login, captcha, malformed)
// When: client.search(imageBlob)
// Then: returns parsed SixteenEightEightResult[] or typed SearchError
//       respects rate limit (1 req/2s)
```

### 3. ResultParser (features/sixteen-eight-eight/)
```typescript
// Given: 1688 HTML fixtures (results, empty, auth redirect, captcha, malformed)
// When: parser.parse(html)
// Then: correct SixteenEightEightResult[] or SearchErrorType
```

### 4. SidePanel React Components (features/side-panel/)
```typescript
// Given: SidePanelState (idle, loading, results[], error, empty)
// When: render <SidePanel state={state} />
// Then: correct UI renders (loading spinner, results table, error message, empty state)
//       clicking "Mở trên 1688" calls platform.tabs.create with correct URL
```

### 5. Messaging (platform/messaging.ts)
```typescript
// Given: Content script sends SEARCH_1688 request
// When: Background SW responds with SEARCH_1688_RESULT
// Then: Round-trip succeeds within 30s timeout
//       Debounce: rapid clicks → only first request sent
```

## Fixtures Needed
- `test/fixtures/shopee/` — Product page HTML snapshots (multiple variants for selector fallbacks)
- `test/fixtures/sixteen-eight-eight/` — Image search response HTML (results, empty, login redirect, captcha, malformed)
- `test/fixtures/sixteen-eight-eight/product-detail.html` — For future expansion hook

## Commands
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Update snapshots
pnpm test:update
```

## Test Utilities
- `createMockMessagePort()` — For testing messaging
- `createMockChromeAPI()` — For testing platform wrappers
- `loadFixture(path)` — Load HTML fixture as string
- `createImageBlob(width, height)` — Generate test image Blob