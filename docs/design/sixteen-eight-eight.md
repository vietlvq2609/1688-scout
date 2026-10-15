# Technical Design: features/sixteen-eight-eight

**Status:** Draft  
**Module:** `features/sixteen-eight-eight/`  
**Dependencies:** `core/types.ts`, `core/errors.ts`, `core/constants.ts`, `platform/messaging.ts`

---

## Overview

This module handles all 1688.com integration logic. It runs in the **background service worker** and exposes two capabilities:
1. **Single search**: Upload one image → parse results → return `SixteenEightEightResult[]`
2. **Batch search**: Queue multiple single searches with rate limiting, pause/resume/stop, progress reporting

---

## Public API (Barrel Export: `index.ts`)

```typescript
// features/sixteen-eight-eight/index.ts
export { SixteenEightEightApiClient } from './client';
export { ResultParser } from './parser';
export { BatchQueueManager } from './batch';
export { buildFallbackUrl } from './fallback';
export { classifyError, SearchErrorType } from './errors';
export type { SearchError, SixteenEightEightResult } from './types';
```

---

## 1. SixteenEightEightApiClient (`client.ts`)

### Responsibilities
- Execute the two-step 1688 image search flow
- Handle JSONP response parsing
- Enforce rate limiting (1 request per 2 seconds)
- Manage request timeout (30s)
- Return typed results or classified errors

### Two-Step Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ search(imageBlob: Blob): Promise<SearchResponse>                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Upload Image                                            │
│ POST h5api.m.1688.com/h5/mtop.relationrecommend...              │
│ Content-Type: multipart/form-data                               │
│ Body: { image: <file>, ...other params }                        │
│ Response: JSONP → strip callback → { imageId: string }         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Fetch Results Page                                      │
│ GET air.1688.com/kapp/1688-search/pc-image-search/              │
│   ?tab=imageSearch&imageId={imageId}&imageIdList={imageId}     │
│ Response: HTML page                                             │
│ Parse: ResultParser.parse(html) → SixteenEightEightResult[]    │
└─────────────────────────────────────────────────────────────────┘
```

### Class Interface

```typescript
class SixteenEightEightApiClient {
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 2000;
  private readonly TIMEOUT_MS = 30000;

  async search(imageBlob: Blob): Promise<SearchResponse>
  
  private async uploadImage(imageBlob: Blob): Promise<string> // returns imageId
  private async fetchResultsPage(imageId: string): Promise<string> // returns HTML
  private parseJsonp(responseText: string): any
  private enforceRateLimit(): Promise<void>
}
```

### Upload Request Details

**Endpoint**: `https://h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/`

**Query Parameters** (from network inspection):
```
jsv=2.7.2
appKey=12574478
t=<timestamp>
sign=<signature>          // Dynamic, needs investigation
api=mtop.relationrecommend.wirelessrecommend.recommend
v=2.0
type=originaljson
timeout=20000
jsonpIncPrefix=reqTppId_<random>_getOfferList  // Callback prefix
dataType=jsonp
```

**Request Body** (multipart/form-data):
```
data: { ... }  // JSON stringified, exact structure TBD from network tab
```

**Critical Unknowns** (need live inspection):
- `sign` generation algorithm (likely HMAC with appKey secret)
- `data` payload structure
- Whether `t` (timestamp) and `sign` can be reused or must be generated per request

### JSONP Handling

```typescript
private parseJsonp(text: string): any {
  // Response format: reqTppId_32517_getOfferList({...})
  const prefix = 'reqTppId_'; // Actually dynamic from jsonpIncPrefix
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start === -1 || end === -1) throw new Error('Invalid JSONP');
  const json = text.slice(start + 1, end);
  return JSON.parse(json);
}
```

> **Note**: The callback prefix (`jsonpIncPrefix`) is sent in the request URL. We must extract it from the response or generate a matching one.

---

## 2. ResultParser (`parser.ts`)

### Responsibilities
- Parse HTML from `air.1688.com/kapp/1688-search/pc-image-search/`
- Extract structured `SixteenEightEightResult[]`
- Handle empty results, auth redirects, captcha, malformed HTML
- **No network calls** — pure function, easily testable with fixtures

### Class Interface

```typescript
class ResultParser {
  parse(html: string): ParseResult
}

interface ParseResult {
  results: SixteenEightEightResult[];
  // For batch: we may want to know if there are more results
  hasMore?: boolean;
  // For error classification
  errorType?: SearchErrorType; // PARSE_ERROR, AUTH_REQUIRED, NO_RESULTS
}
```

### HTML Structure Assumptions (Need Verification)

Based on typical 1688 search results page, selectors needed:

```typescript
const SELECTORS = {
  // Container for each product card
  productCard: '.offer-list-row, .item-card, [data-offer-id]',
  
  // Within each card
  thumbnail: 'img[src*="1688.com"], img[data-src*="1688.com"]',
  title: '.title, .offer-title, a[title]',
  priceCNY: '.price, .offer-price, [data-price]',
  moq: '.moq, .min-order, [data-moq]',
  shopName: '.shop-name, .seller-name, [data-shop]',
  shopRating: '.rating, .shop-rating, [data-rating]',
  productLink: 'a[href*="detail.1688.com"], a[href*="offer.1688.com"]'
};
```

### Parsing Logic

```typescript
parse(html: string): ParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Check for auth redirect / captcha
  if (doc.querySelector('form[action*="login"]', '[id*="captcha"]')) {
    return { results: [], errorType: 'AUTH_REQUIRED' };
  }
  
  // Check for empty results
  const emptyMsg = doc.querySelector('.no-result, .empty-tip');
  if (emptyMsg) {
    return { results: [], errorType: 'NO_RESULTS' };
  }
  
  const cards = doc.querySelectorAll(SELECTORS.productCard);
  const results: SixteenEightEightResult[] = [];
  
  for (const card of cards) {
    const result = this.extractFromCard(card);
    if (result) results.push(result);
  }
  
  return { 
    results: results.slice(0, MAX_RESULTS), // 20 single, 10 batch
    hasMore: results.length > MAX_RESULTS
  };
}

private extractFromCard(card: Element): SixteenEightEightResult | null {
  // Extract each field with fallbacks
  // Handle GBK/UTF-8: if text contains mojibake, try decoding as GBK
  // Return null if critical fields missing (title, price, link)
}
```

### GBK/UTF-8 Handling

```typescript
private decodeText(text: string): string {
  // If text contains replacement chars (�) or mojibake patterns
  if (/[\uFFFD]/.test(text) || /[涓婂竷]/.test(text)) {
    try {
      // In SW: use TextDecoder with 'gbk' if available
      // Fallback: return original
    } catch { /* ignore */ }
  }
  return text;
}
```

---

## 3. BatchQueueManager (`batch.ts`)

### Responsibilities
- Queue multiple `SearchRequest` items
- Process sequentially with rate limiting (delegates to `SixteenEightEightApiClient`)
- Emit progress events
- Support pause/resume/stop
- Persist progress to `chrome.storage.session` for panel-close resilience
- Collect partial results on stop/error

### State Machine

```
IDLE
  │ start(items[])
  ▼
RUNNING ──pause──▶ PAUSED
  │                  │ resume
  │ stop             ▼
  ▼                RUNNING
COMPLETE        error/stop
  │
  ▼
IDLE
```

### Class Interface

```typescript
interface BatchQueueManager {
  // Control
  start(items: BatchItem[]): void;
  pause(): void;
  resume(): void;
  stop(): void;
  
  // State access
  getState(): BatchState;
  getProgress(): BatchProgress;
  getResults(): BatchResultItem[];
  
  // Persistence
  saveProgress(): Promise<void>;
  loadProgress(): Promise<void>;
  
  // Events (via platform messaging)
  onProgress: (progress: BatchProgress) => void;
  onComplete: (results: BatchResultItem[]) => void;
  onError: (error: SearchError, partial: BatchResultItem[]) => void;
}

interface BatchItem {
  imageBlob: Blob;
  sourceUrl: string;
  shopeePrice: number;
  shopeeImageUrl: string;
  shopeeTitle: string;
}

interface BatchState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopped';
  items: BatchItem[];
  currentIndex: number;
  partialResults: BatchResultItem[];
  error?: SearchError;
}
```

### Processing Loop

```typescript
private async processQueue(): Promise<void> {
  this.state.status = 'running';
  
  for (let i = this.state.currentIndex; i < this.state.items.length; i++) {
    if (this.state.status !== 'running') break; // paused/stopped
    
    const item = this.state.items[i];
    this.state.currentIndex = i;
    
    // Emit progress
    this.emitProgress({
      completed: i,
      total: this.state.items.length,
      currentItemTitle: item.shopeeTitle,
      status: 'running',
      partialResults: this.state.partialResults
    });
    
    try {
      const response = await this.apiClient.search(item.imageBlob);
      
      if (response.error) {
        // Log but continue
        console.warn(`Batch item ${i} failed:`, response.error);
        this.state.partialResults.push({
          shopeeProduct: item,
          matches: [],
          error: response.error
        });
      } else {
        // Apply calculator for batch mode
        const bestMatch = response.results[0]; // lowest price (assumed sorted)
        const calculatedPrice = bestMatch 
          ? bestMatch.priceCNY * CNY_VND_RATE * MARKUP_MULTIPLIER
          : undefined;
        
        this.state.partialResults.push({
          shopeeProduct: item,
          matches: response.results.slice(0, MAX_RESULTS_BATCH), // 10
          bestMatch,
          calculatedPriceVND: calculatedPrice,
          isMatch: calculatedPrice !== undefined && calculatedPrice < item.shopeePrice
        });
      }
    } catch (err) {
      // Network/timeout error - log and continue
      this.state.partialResults.push({
        shopeeProduct: item,
        matches: [],
        error: { type: 'NETWORK_ERROR', message: 'Lỗi kết nối, vui lòng thử lại' }
      });
    }
    
    // Persist after each item
    await this.saveProgress();
  }
  
  // Completed or stopped
  if (this.state.status === 'running') {
    this.state.status = 'completed';
    this.emitComplete(this.state.partialResults);
  }
  await this.saveProgress();
}
```

### Persistence Schema (chrome.storage.session)

```typescript
interface PersistedBatchState {
  version: 1;
  status: BatchState['status'];
  items: BatchItem[]; // Without blobs (store image URLs, re-fetch on resume)
  currentIndex: number;
  partialResults: BatchResultItem[];
  error?: SearchError;
  timestamp: number;
}
```

> **Blob Handling**: Blobs cannot be stored. On `start()`, store `sourceUrl` + `shopeeImageUrl`. On `resume()`, re-fetch image from `shopeeImageUrl` → `Blob`.

---

## 4. Error Classification (`errors.ts`)

### Error Types

```typescript
export type SearchErrorType = 
  | 'NO_RESULTS'       // 1688 returned empty results
  | 'AUTH_REQUIRED'    // 302 to login, captcha, session expired
  | 'NETWORK_ERROR'    // fetch failed, timeout, offline
  | 'PARSE_ERROR'      // HTML structure changed, JSONP malformed
  | 'RATE_LIMITED';    // 429 or 1688 rate limit page

export interface SearchError {
  type: SearchErrorType;
  message: string; // Vietnamese user-facing message
  originalError?: Error; // For debugging
}
```

### Classification Logic

```typescript
export function classifyError(error: unknown, context?: { 
  responseStatus?: number; 
  responseText?: string;
  responseUrl?: string;
}): SearchError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { type: 'NETWORK_ERROR', message: 'Lỗi kết nối, vui lòng thử lại', originalError: error };
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return { type: 'NETWORK_ERROR', message: 'Yêu cầu quá thời gian, vui lòng thử lại', originalError: error };
  }
  
  // HTTP status based
  if (context?.responseStatus === 429) {
    return { type: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng đợi', originalError: error as Error };
  }
  if (context?.responseStatus === 302 && context.responseUrl?.includes('login')) {
    return { type: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập 1688', originalError: error as Error };
  }
  
  // Response content based
  if (context?.responseText) {
    const text = context.responseText;
    if (text.includes('captcha') || text.includes('验证码')) {
      return { type: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập 1688', originalError: error as Error };
    }
    if (text.includes('没有找到') || text.includes('Không tìm thấy')) {
      return { type: 'NO_RESULTS', message: 'Không tìm thấy sản phẩm tương tự', originalError: error as Error };
    }
  }
  
  // Parse errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return { type: 'PARSE_ERROR', message: 'Lỗi phân tích kết quả', originalError: error };
  }
  
  // Default
  return { type: 'NETWORK_ERROR', message: 'Lỗi không xác định, vui lòng thử lại', originalError: error as Error };
}
```

---

## 5. Fallback URL Builder (`fallback.ts`)

### Responsibilities
- Construct manual search URL when API fails
- Include `imageId` if available, otherwise generic image search page

```typescript
export function buildFallbackUrl(imageId?: string): string {
  const base = 'https://air.1688.com/kapp/1688-search/pc-image-search/';
  const params = new URLSearchParams({
    tab: 'imageSearch',
    spm: 'a26352.b28411319/2508.imagesearch.upload'
  });
  if (imageId) {
    params.set('imageId', imageId);
    params.set('imageIdList', imageId);
  }
  return `${base}?${params.toString()}`;
}
```

---

## 6. Domain Types (`types.ts`)

```typescript
// Re-exports from core/types.ts + batch-specific
export interface SixteenEightEightResult {
  thumbnailUrl: string;
  title: string;
  priceCNY: number;
  moq: number;
  shopName: string;
  shopRating: number;
  productUrl: string;
}

export interface SearchResponse {
  results: SixteenEightEightResult[];
  error?: SearchError;
}

export interface BatchItem {
  imageBlob: Blob;
  sourceUrl: string;
  shopeePrice: number;
  shopeeImageUrl: string;
  shopeeTitle: string;
}

export interface BatchResultItem {
  shopeeProduct: BatchItem;
  matches: SixteenEightEightResult[];
  bestMatch?: SixteenEightEightResult;
  calculatedPriceVND?: number;
  isMatch?: boolean;
  error?: SearchError;
}

export interface BatchProgress {
  completed: number;
  total: number;
  currentItemTitle: string;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  partialResults: BatchResultItem[];
}
```

---

## 7. Integration Points

### Background Entry Point (`entry-points/background.ts`)

```typescript
import { SixteenEightEightApiClient, BatchQueueManager } from 'features/sixteen-eight-eight';
import { onMessage, sendResponse } from 'platform/messaging';

const apiClient = new SixteenEightEightApiClient();
const batchManager = new BatchQueueManager(apiClient);

// Wire up batch progress to side panel
batchManager.onProgress = (progress) => {
  broadcastToSidePanel({ type: 'SEARCH_1688_BATCH_PROGRESS', payload: progress });
};
batchManager.onComplete = (results) => {
  broadcastToSidePanel({ type: 'SEARCH_1688_BATCH_RESULT', payload: { batchResults: results } });
};
batchManager.onError = (error, partial) => {
  broadcastToSidePanel({ type: 'SEARCH_1688_BATCH_RESULT', payload: { batchResults: partial, error } });
};

// Message handlers
onMessage('SEARCH_1688', async (msg) => {
  const response = await apiClient.search(msg.payload.imageBlob);
  sendResponse(msg, { type: 'SEARCH_1688_RESULT', payload: response });
});

onMessage('SEARCH_1688_BATCH', async (msg) => {
  batchManager.start(msg.payload.items);
  // Immediate acknowledgment
  sendResponse(msg, { type: 'SEARCH_1688_BATCH_ACK', payload: { started: true } });
});

onMessage('BATCH_PAUSE', () => batchManager.pause());
onMessage('BATCH_RESUME', () => batchManager.resume());
onMessage('BATCH_STOP', () => batchManager.stop());
onMessage('BATCH_GET_STATE', (msg) => {
  sendResponse(msg, { 
    type: 'BATCH_STATE', 
    payload: batchManager.getState() 
  });
});

// On SW startup: restore batch if persisted
batchManager.loadProgress().then(state => {
  if (state.status === 'running' || state.status === 'paused') {
    batchManager.resume(); // or stay paused
  }
});
```

---

## 8. Test Strategy

### Fixtures Needed
| Fixture | Description |
|---------|-------------|
| `upload-success.jsonp` | JSONP response with imageId |
| `upload-auth-required.jsonp` | JSONP with error code for auth |
| `results-page-success.html` | Full HTML with 20+ product cards |
| `results-page-empty.html` | HTML with "no results" message |
| `results-page-auth.html` | HTML with login redirect/captcha |
| `results-page-malformed.html` | Broken HTML for parse error test |

### Test Cases (External Behavior)

| Test | Input | Expected Output |
|------|-------|-----------------|
| `apiClient.search()` happy path | Valid imageBlob | `{ results: [...] }` |
| `apiClient.search()` auth expired | Mock 302/captcha | `{ error: { type: 'AUTH_REQUIRED' } }` |
| `apiClient.search()` network fail | Mock fetch reject | `{ error: { type: 'NETWORK_ERROR' } }` |
| `apiClient.search()` rate limited | Mock 429 | `{ error: { type: 'RATE_LIMITED' } }` |
| `parser.parse()` success | results-page-success.html | 20 `SixteenEightEightResult` |
| `parser.parse()` empty | results-page-empty.html | `{ results: [], errorType: 'NO_RESULTS' }` |
| `parser.parse()` auth redirect | results-page-auth.html | `{ results: [], errorType: 'AUTH_REQUIRED' }` |
| `parser.parse()` GBK text | HTML with mojibake | Decoded Vietnamese/Chinese text |
| `batchManager.start()` 3 items | 3 BatchItems | Processes sequentially, emits progress |
| `batchManager.pause()` mid-run | Running batch | Stops at current item, persists state |
| `batchManager.resume()` after pause | Paused batch | Continues from currentIndex |
| `batchManager.stop()` | Running batch | Status=stopped, returns partial results |
| `batchManager.loadProgress()` after SW restart | Persisted state | Restores queue, continues or waits |

---

## 9. Open Questions (Block Implementation)

| Question | Impact | Resolution |
|----------|--------|------------|
| `sign` parameter generation for upload endpoint | Cannot make upload requests without it | Need network tab inspection of working request; may need to reverse-engineer or copy from browser |
| `data` payload structure for upload | Request body unknown | Same as above |
| `jsonpIncPrefix` handling | Callback prefix is dynamic | Extract from request URL we construct, or parse from response |
| Results page HTML selectors | Parsing will fail if wrong | Need live inspection of `air.1688.com/kapp/1688-search/pc-image-search/` |
| Does 1688 sort results by price asc? | `bestMatch` assumption | Verify on results page; if not, sort client-side |
| Session cookie behavior in SW | `fetch` with `credentials: 'include'` should work | Test with logged-in 1688 session |

---

## 10. File Structure (Target)

```
src/features/sixteen-eight-eight/
├── client.ts          # SixteenEightEightApiClient
├── parser.ts          # ResultParser
├── batch.ts           # BatchQueueManager
├── errors.ts          # classifyError, SearchErrorType
├── fallback.ts        # buildFallbackUrl
├── types.ts           # Feature-specific types (re-exports core + batch)
└── index.ts           # Barrel export
```

---

## 11. Implementation Order

1. **`types.ts`** — Domain types (no deps)
2. **`errors.ts`** — Error classification (no deps)
3. **`fallback.ts`** — URL builder (no deps)
4. **`parser.ts`** — ResultParser (needs HTML fixtures, pure function)
5. **`client.ts`** — ApiClient (needs upload endpoint details, uses parser)
6. **`batch.ts`** — BatchQueueManager (uses client, parser, platform/storage)
7. **`index.ts`** — Barrel export
8. **Integration** — Wire into `entry-points/background.ts`

---

*This design focuses on pure logic. Platform concerns (chrome.runtime, chrome.storage, messaging) are injected via `platform/` wrappers for testability.*