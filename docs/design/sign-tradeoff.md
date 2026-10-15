# Trade-off: Reverse-Engineer `sign` vs Playwright Helper

**Context**: 1688 upload endpoint requires dynamic `sign` parameter (likely HMAC-SHA256 with secret key). Two paths forward.

---

## Option A: Reverse-Engineer `sign` (Pure Extension)

### How It Works
1. Inspect 1688's JS bundles → find `sign` generation code
2. Replicate algorithm in TypeScript (crypto.subtle for HMAC)
3. Generate `sign` per request in Service Worker

### Pros
| Benefit | Detail |
|---------|--------|
| **Self-contained** | Single `.crx`, installs in 1 click, works offline |
| **Distributable** | Chrome Web Store ready, no external deps |
| **Fast** | Direct API call, ~2-3s per search |
| **MV3 Compliant** | Runs entirely in Service Worker |
| **User-friendly** | Non-technical sellers just install and use |

### Cons
| Risk | Detail |
|------|--------|
| **Obfuscation** | 1688's JS is minified/obfuscated; `sign` logic may be in WASM or compiled |
| **Secret Key** | HMAC needs secret key — may be server-side only, not in client JS |
| **Breaks Silently** | 1688 rotates keys/algorithms → extension breaks without warning |
| **Time Investment** | Days to weeks of reverse-engineering; may be impossible |
| **Legal Gray Area** | Bypassing anti-bot measures; 1688 ToS may prohibit |

### Feasibility Check
```bash
# In DevTools Sources, search for:
# - "mtop" "sign" "appKey" "12574478"
# - "hmac" "sha256" "crypto"
# - "wv=" "x-sign" "x-mini-wua"
```
If you find client-side HMAC with exposed key → **doable**.  
If `sign` comes from server response or WASM → **likely impossible**.

---

## Option B: Playwright Helper (Local Node.js Process)

### Architecture
```
┌─────────────────┐     HTTP/WS      ┌──────────────────┐
│  Chrome MV3 Ext │ ◄──────────────► │  Node + Playwright │
│  (Side Panel)   │   localhost:3000 │  (Headless Chrome) │
└─────────────────┘                  └──────────────────┘
        │                                    │
        │ User clicks "Search"               │ 1. Launch browser
        │ Sends image blob                   │ 2. Login 1688 (once)
        ▼                                    │ 3. Upload image
   Show progress                         │ 4. Get results
                                         │ 5. Return JSON
```

### Pros
| Benefit | Detail |
|---------|--------|
| **Guaranteed Working** | Uses real browser → 1688 sees normal user |
| **No Reverse-Engineering** | Handles captcha, login, `sign`, cookies automatically |
| **Future-Proof** | Survives 1688 frontend changes |
| **Full Control** | Can scrape any page, handle complex flows |
| **Parallelizable** | Multiple browser contexts for batch (bypass rate limit) |

### Cons
| Drawback | Detail |
|----------|--------|
| **Not Distributable** | Users must: install Node → run `npm start` → keep terminal open |
| **Complex Setup** | Playwright install, browser binaries, port config, firewall |
| **Resource Heavy** | Full Chrome instance (~200MB RAM, CPU) |
| **Fragile UX** | Process crashes → extension hangs; updates break helper |
| **Not Web Store** | Can't publish to Chrome Web Store with external dependency |
| **Security** | Local server exposes API; need auth token |

### Distribution Reality
| User Type | Experience |
|-----------|------------|
| **You (Dev)** | `pnpm dev` → runs both; fine |
| **Technical Seller** | Clone repo → `pnpm install` → `pnpm start` → maybe works |
| **Non-Technical Seller** | **Impossible** — won't run terminal commands |

---

## Option C: Hybrid (Recommended for "Both Eventually")

### Phase 1: Playwright Helper (Personal Use Now)
- Build working solution fast
- Validate product-market fit
- Learn exact 1688 selectors/flows

### Phase 2: Reverse-Engineer in Background
- Use helper's working requests as reference
- Attempt `sign` extraction with real traffic captures
- If successful → migrate to pure extension

### Phase 3: Pure Extension (Distribution)
- Remove Playwright dependency
- Publish `.crx` / Web Store

---

## Decision Matrix

| Criterion | Pure Extension (A) | Playwright Helper (B) | Hybrid (C) |
|-----------|-------------------|----------------------|------------|
| **Time to Working** | Weeks (uncertain) | **Days** | Days + Weeks |
| **Distribution Ready** | ✅ Yes | ❌ No | ✅ Eventually |
| **Maintenance Burden** | Medium (breaks on 1688 change) | High (Node + browser updates) | Medium |
| **Batch Performance** | Slow (1 req/2s) | **Fast (parallel contexts)** | Medium |
| **Non-Technical User** | ✅ 1-click install | ❌ Impossible | ✅ v2+ |
| **Captcha Handling** | Manual fallback only | **Auto (human-in-loop)** | Manual fallback |
| **Legal Risk** | Higher (bypass) | Lower (real browser) | Medium |

---

## My Recommendation: **Hybrid (C)**

### Start with Playwright Helper Because:
1. **Unblocks you immediately** — working batch search in hours, not weeks
2. **Validates the product** — do sellers actually want this?
3. **Generates training data** — capture real requests/responses for later RE
4. **Parallel batch** — 90 products in ~1 min vs 3 min (sequential)

### Implementation Sketch

```typescript
// platform/playwright-client.ts (in extension)
class PlaywrightClient {
  private baseUrl = 'http://localhost:3001'; // Helper server
  
  async search(imageBlob: Blob): Promise<SearchResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob);
    
    const res = await fetch(`${this.baseUrl}/api/search`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }
  
  async batchSearch(items: BatchItem[]): Promise<BatchResultItem[]> {
    const res = await fetch(`${this.baseUrl}/api/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(i => ({
        imageUrl: i.shopeeImageUrl,  // Send URL, helper fetches
        shopeePrice: i.shopeePrice,
        shopeeTitle: i.shopeeTitle
      })) })
    });
    return res.json();
  }
}
```

```typescript
// playwright-helper/server.ts (Node.js, separate repo/folder)
import { chromium } from 'playwright';
import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

let browser: Browser;
let page: Page;

async function init() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: '1688-auth.json' // Saved cookies
  });
  page = await context.newPage();
  
  // Pre-login
  await page.goto('https://1688.com');
  // ... handle login if needed
}

app.post('/api/search', async (req, res) => {
  // Upload image via page, wait for results, parse, return JSON
});

app.post('/api/batch', async (req, res) => {
  // Process array with multiple pages/contexts
});

app.listen(3001, init);
```

---

## What You Need to Decide Now

| Question | Your Call |
|----------|-----------|
| **Can you spend 2-3 days trying RE first?** | If yes → try Option A for 3 days, fallback to B |
| **Is "working now" more important than "distributable later"?** | If yes → Option B |
| **Do you have a non-technical test user?** | If yes → they need Option A eventually |

---

## Quick Test: Is `sign` Reversible? (30 min)

```bash
# 1. Capture 3 upload requests with different timestamps
# 2. Compare: same sign? → static (easy)
#    Different but predictable? → time-based HMAC (doable)
#    Completely different? → server-generated (hard)

# 3. In DevTools Console on 1688.com:
#    Search for "sign" in all loaded scripts
#    Look for: crypto.subtle, hmac, sha256, appKey
```

**If you find the algorithm in 30 min → go Option A.**  
**If not → go Option B (Hybrid).**

---

## Next Step

Want me to:
1. **Help you run the 30-min RE test** (check DevTools now)?
2. **Scaffold the Playwright helper** (Node + Express + Playwright)?
3. **Proceed with Shopee side design** while you decide?

The helper can be a separate folder (`playwright-helper/`) — won't pollute the extension code.