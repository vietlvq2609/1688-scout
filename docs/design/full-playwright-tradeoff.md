# Trade-off: Full Playwright (Both Shopee + 1688) vs Extension + Helper

**Question**: What if we use Playwright for **everything** — Shopee category scraping + 1688 image search — and skip the Chrome extension entirely?

---

## Architecture Comparison

### Current Plan: Extension + Playwright Helper (Hybrid)
```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Content     │  │ Side Panel  │  │ Background SW       │  │
│  │ Script      │  │ (React)     │  │                     │  │
│  │ - Detect    │  │ - UI        │  │ - Rate limit        │  │
│  │   product   │  │ - Progress  │  │ - Queue management  │  │
│  │ - Extract   │  │ - Results   │  │ - Calculator        │  │
│  │   image     │  │ - Calculator│  │ - Messaging         │  │
│  │ - Inject    │  │             │  │                     │  │
│  │   button    │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │            │
│         └────────────────┴──────────────────────┘            │
│                          │                                     │
│              HTTP/WS (localhost)                              │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Playwright Helper (Node.js)                             │  │
│  │ - 1688 login + upload + parse                           │  │
│  │ - Parallel batch contexts                               │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Full Playwright: No Extension, Just Node.js CLI/Server
```
┌─────────────────────────────────────────────────────────────┐
│  Node.js Application (Playwright)                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Shopee Flow                                             │ │
│  │ - Launch browser → login Shopee                         │ │
│  │ - Navigate to category page                             │ │
│  │ - Paginate (3 pages)                                    │ │
│  │ - Extract 30 products/page (image, price, title, URL)   │ │
│  │ - Handle SPA, lazy-load, infinite scroll                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1688 Flow                                               │ │
│  │ - For each product: upload image → get results          │ │
│  │ - Parallel contexts (5-10 concurrent)                   │ │
│  │ - Parse results, apply calculator                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                    │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Output                                                  │ │
│  │ - CSV/JSON/Excel report                                 │ │
│  │ - OR simple HTTP API for future frontend                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Problems with Full Playwright Approach

### 1. Shopee-Specific Challenges

| Challenge | Detail | Mitigation Effort |
|-----------|--------|-------------------|
| **Login & Session** | Shopee Vietnam has SMS/OTP login, captcha, device fingerprinting | Need persistent `storageState`; re-login on expiry |
| **SPA Navigation** | Category pages use infinite scroll / virtual list; `pushState` navigation | Must wait for network idle, scroll to trigger load |
| **Lazy Images** | Images load on scroll (`loading="lazy"`, `data-src`) | Must scroll each item into view |
| **Dynamic Selectors** | Hashed CSS classes (`.shopee_ic`, `_image_yazkc_11`) | Use `data-sqe`, `aria-label`, structural selectors |
| **Anti-Bot** | Shopee detects headless: `navigator.webdriver`, canvas fingerprint | Stealth plugins, residential proxies, behavior simulation |
| **Rate Limiting** | Category API calls limited; IP ban risk | Delays, proxy rotation |
| **Vietnamese Locale** | Content in Vietnamese; encoding issues | Force UTF-8, handle diacritics |

**Code Complexity**: ~300-500 lines just for robust Shopee category extraction.

### 2. 1688-Specific Challenges (Already Known)

| Challenge | Detail |
|-----------|--------|
| **`sign` Parameter** | Dynamic signature per request |
| **Captcha/Slider** | Frequent on automated access |
| **GBK Encoding** | Shop names, titles in GBK |
| **Session Management** | Cookies expire, need re-login |
| **Results Parsing** | HTML structure changes |

### 3. Combined: Dual-Site Automation = 2× Fragility

```typescript
// Full Playwright script structure
async function main() {
  // 1. SHOPEE: Login + Category Scrape
  const shopeeBrowser = await chromium.launch({ headless: false }); // Headless often blocked
  const shopeeContext = await shopeeBrowser.newContext({ storageState: 'shopee-auth.json' });
  const shopeePage = await shopeeContext.newPage();
  
  await shopeePage.goto('https://shopee.vn/all_categories');
  // ... navigate to target category
  // ... scroll 3 pages, wait for lazy images
  // ... extract 90 products: { imageUrl, price, title, url }
  
  // 2. 1688: Login + Batch Search
  const sixteenContext = await shopeeBrowser.newContext({ storageState: '1688-auth.json' });
  
  // Parallel processing with semaphore
  const semaphore = new Semaphore(5); // 5 concurrent
  const results = await Promise.all(products.map(p => 
    semaphore.run(() => search1688(sixteenContext, p))
  ));
  
  // 3. Calculate + Output
  generateReport(results);
}
```

**Problems**:
- **Two separate login flows** to maintain
- **Two different anti-bot systems** to bypass
- **One crash = entire batch lost** (no incremental UI)
- **No user interaction** during run (can't pause/inspect)

---

## Resource Comparison

| Resource | Extension + Helper | Full Playwright |
|----------|-------------------|-----------------|
| **Memory** | Extension: ~50MB + Helper: ~200MB | Single Node: ~400-600MB (2 browser contexts) |
| **CPU** | Low (extension idle mostly) | High (2 browsers rendering) |
| **Disk** | Minimal | Playwright browsers (~500MB) + auth states |
| **Startup Time** | Instant (extension always ready) | 10-30s (launch browsers, restore sessions) |

---

## Distribution & UX Comparison

| Aspect | Extension + Helper | Full Playwright (CLI) |
|--------|-------------------|----------------------|
| **Install** | 1-click `.crx` | `git clone` → `pnpm install` → `npx playwright install` |
| **Run** | Click button in browser | Terminal: `pnpm run batch --category=...` |
| **Progress UI** | Side panel with pause/resume | Console logs / log file |
| **Results View** | Interactive table, click to open | CSV → open in Excel |
| **Error Recovery** | Retry single item, continue | Re-run entire script |
| **Non-Technical User** | ✅ Works | ❌ Cannot use |
| **Schedule/Cron** | Manual only | ✅ Easy (cron job) |
| **Headless Server** | No (needs user browser) | ✅ Yes (VPS/Docker) |

---

## Maintenance Burden

| Factor | Extension + Helper | Full Playwright |
|--------|-------------------|-----------------|
| **Shopee DOM Changes** | Fix in content script (hot reload) | Fix in Node script (redeploy) |
| **1688 DOM Changes** | Fix in helper parser | Fix in Node script |
| **Browser Updates** | Chrome auto-updates | Playwright version lock; test on update |
| **Dependency Updates** | Plasmo/React only | Playwright, Express, Node, browsers |
| **Debugging** | DevTools in browser | Node inspector + browser CDP |

---

## When Full Playwright Makes Sense

✅ **Use Full Playwright If**:
- You only need **scheduled batch reports** (daily/weekly CSV)
- Running on a **server/VPS** (no user interaction)
- **Technical user** who can manage Node.js
- Need **parallel 1688 searches** (bypass 2s rate limit)
- Want to **avoid Chrome Web Store review**

❌ **Avoid Full Playwright If**:
- **Non-technical sellers** must use it
- Need **interactive UI** (pause, inspect, click "Mở trên 1688")
- Want **instant feedback** on product page
- Plan to **distribute widely**
- Need **side-by-side comparison** (Shopee + 1688 visible together)

---

## Hybrid Compromise: Playwright for 1688 Only (Current Plan)

This keeps the **best of both**:

| Shopee Side (Extension) | 1688 Side (Playwright Helper) |
|------------------------|-------------------------------|
| ✅ Instant detection on product page | ✅ Handles `sign`, captcha, login |
| ✅ SPA navigation handling | ✅ Parallel batch contexts |
| ✅ User's logged-in session | ✅ Real browser = no anti-bot |
| ✅ Interactive side panel | ✅ Fast batch (5-10 concurrent) |
| ✅ Distributable `.crx` | ❌ Local helper needed |

---

## What If You Want Full Playwright Later?

The current architecture **supports migration**:

```typescript
// platform/search-client.ts (abstraction)
interface SearchClient {
  search(imageBlob: Blob): Promise<SearchResponse>;
  batchSearch(items: BatchItem[]): Promise<BatchResultItem[]>;
}

// Implementation 1: Extension + Helper (current)
class HybridSearchClient implements SearchClient { ... }

// Implementation 2: Full Playwright (future)
class FullPlaywrightClient implements SearchClient {
  async search(imageBlob: Blob) { /* call local Playwright API */ }
  async batchSearch(items) { /* call local Playwright API */ }
}

// Side panel uses SearchClient interface — swap implementation
```

---

## Recommendation

**Stick with Extension + Playwright Helper for 1688 only.**

Reasons:
1. **Shopee in extension works well** — content scripts handle SPA, lazy images, user session naturally
2. **1688 is the hard part** — `sign`, captcha, GBK, rate limits → Playwright solves these
3. **Distribution path preserved** — can migrate 1688 to pure extension later if `sign` is cracked
4. **UX for sellers** — they stay in Shopee, click button, see results in side panel

**Only go Full Playwright if**: You pivot to "scheduled report generator for yourself" and abandon the interactive seller tool.

---

## Next Step

Want me to:
1. **Scaffold the Playwright helper** for 1688 only (`playwright-helper/`)?
2. **Design the Shopee content script** (extractor, injector, category pagination)?
3. **Build the side panel state machine** (batch progress UI, calculator display)?

The helper can be built independently — won't block extension development.