# How to Inspect 1688 Critical Unknowns

**Goal**: Capture the exact network requests for 1688 image search to reverse-engineer the upload endpoint.

---

## Prerequisites

1. **Chrome/Edge** with DevTools
2. **Logged into 1688.com** (use your seller account)
3. **Test image** ready (any product image, <5MB)

---

## Step 1: Capture Image Upload Request

### 1.1 Open DevTools Network Tab
```
F12 → Network tab
☑ Preserve log
☑ Disable cache (while DevTools open)
Filter: "Fetch/XHR" or "All"
```

### 1.2 Go to 1688 Image Search Page
```
https://air.1688.com/kapp/1688-search/pc-image-search/
```
Click the upload area → select your test image.

### 1.3 Find the Upload Request
Look for request to:
```
h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/
```

**Click it → inspect:**

#### Request Headers
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
Cookie: <your 1688 cookies>  ← CRITICAL: copy all
User-Agent: ...
Referer: https://air.1688.com/
Origin: https://air.1688.com
```

#### Query Parameters (URL)
```
jsv=2.7.2
appKey=12574478
t=1792035522838              ← timestamp (ms)
sign=7fe48f2155a0e94d...     ← SIGNATURE (dynamic!)
api=mtop.relationrecommend.wirelessrecommend.recommend
v=2.0
type=originaljson
timeout=20000
jsonpIncPrefix=reqTppId_32517_getOfferList  ← CALLBACK PREFIX
dataType=jsonp
```

#### Request Body (Form Data)
```
data: {"imageId":"","imageUrl":"","imgBase64":"...","scene":"imageSearch",...}
```
Or it might be a file upload:
```
file: <binary>
image: <binary>
```

> **Copy everything**: Full URL, all headers, full request body.

---

## Step 2: Capture the Response

### 2.1 Response Tab
Should look like:
```
reqTppId_32517_getOfferList({
  "api": "mtop.relationrecommend.wirelessrecommend.recommend",
  "data": {
    "result": [],
    "code": 200,
    "data": { "imageId": "1717708862630690786" },
    ...
  },
  "ret": ["SUCCESS::调用成功"],
  ...
})
```

**Note**: The callback prefix `reqTppId_32517_getOfferList` matches `jsonpIncPrefix` from request.

---

## Step 3: Capture Results Page Request

### 3.1 After Upload Completes
The page navigates or fetches results. Look for:
```
GET https://air.1688.com/kapp/1688-search/pc-image-search/?tab=imageSearch&imageId=1717708862630690786&imageIdList=1717708862630690786&spm=...
```

### 3.2 Inspect Response
- **If HTML**: Right-click → "Open in new tab" → save as HTML fixture
- **If XHR/JSON**: Check for API calls returning structured data

---

## Step 4: Extract Sign Generation Logic (Hardest Part)

### Option A: Search in Page Source
```
DevTools → Sources → Search (Ctrl+Shift+F) → "sign"
```
Look for JavaScript that generates `sign`. Usually HMAC-SHA1/256 with appKey secret.

### Option B: Search in Network Scripts
Filter Network by "JS" → look for files loaded from `g.alicdn.com` or `assets.1688.com` containing `mtop` or `sign`.

### Option C: Copy as cURL → Replay
```
Right-click request → Copy → Copy as cURL (bash)
```
Paste in terminal → modify `t` (timestamp) → see if it works.
- If it works with old `sign`: signature might be time-independent or long-lived
- If it fails: need to reverse-engineer algorithm

### Option D: Use Browser Extension
Install "EditThisCookie" → export cookies → use in headless script to test.

---

## Step 5: Capture Results Page HTML Selectors

### 5.1 Open Results Page Directly
```
https://air.1688.com/kapp/1688-search/pc-image-search/?tab=imageSearch&imageId=YOUR_IMAGE_ID&imageIdList=YOUR_IMAGE_ID
```

### 5.2 Inspect Product Cards
```
DevTools → Elements → Select element (Ctrl+Shift+C)
Click on a product card
```

**Find selectors for:**
```
✓ Product card container: .offer-card, .item-card, [data-offer-id]
✓ Thumbnail image: img.src or img.data-src
✓ Title: .title, .offer-title, a[title]
✓ Price (¥): .price, .offer-price, [data-price]
✓ MOQ: .moq, .min-order
✓ Shop name: .shop-name, .seller-name
✓ Shop rating: .rating, .score
✓ Product link: a.href (should go to detail.1688.com/offer/...)
```

### 5.3 Save HTML Fixture
```
Elements tab → Right-click <html> → Copy → Copy outerHTML
Save as: docs/fixtures/1688-results-success.html
```

Also save:
- Empty results page
- Auth redirect page (logout, then visit)
- Captcha page (if triggered)

---

## Step 6: Test in Service Worker Context

### 6.1 Create Test Script
```javascript
// test-1688.js - run in DevTools Console on 1688.com
async function testUpload() {
  const imageBlob = await fetch('test-image.jpg').then(r => r.blob());
  const formData = new FormData();
  formData.append('image', imageBlob, 'test.jpg');
  
  // Use captured URL with fresh timestamp
  const url = 'https://h5api.m.1688.com/h5/mtop.relationrecommend.wirelessrecommend.recommend/2.0/?...';
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',  // Critical for cookies
    headers: {
      // Don't set Content-Type - let browser set boundary
    }
  });
  
  const text = await response.text();
  console.log('Response:', text);
}
testUpload();
```

### 6.2 Test JSONP Parsing
```javascript
const jsonp = 'reqTppId_123_getOfferList({"data":{"imageId":"abc"}});';
const json = jsonp.slice(jsonp.indexOf('(')+1, jsonp.lastIndexOf(')'));
console.log(JSON.parse(json));
```

---

## Checklist for Implementation

| Item | Captured? | Notes |
|------|-----------|-------|
| Upload endpoint full URL | ☐ | |
| All query params (especially `sign`, `t`, `jsonpIncPrefix`) | ☐ | |
| Request headers (Cookie, Referer, Origin) | ☐ | |
| Request body structure (FormData fields) | ☐ | |
| `sign` generation method | ☐ | May need reverse-engineering |
| JSONP response format | ☐ | |
| Results page URL pattern | ☐ | |
| Results page HTML selectors | ☐ | Save fixture |
| Empty results HTML | ☐ | Save fixture |
| Auth redirect HTML | ☐ | Save fixture |
| Product detail page URL pattern | ☐ | For "Mở trên 1688" links |

---

## Quick Reference: DevTools Shortcuts

| Action | Shortcut |
|--------|----------|
| Open DevTools | F12 |
| Network tab | Ctrl+1 (or click) |
| Preserve log | Checkbox in Network |
| Disable cache | Checkbox in Network (gear icon) |
| Filter XHR | Ctrl+Alt+X |
| Search all sources | Ctrl+Shift+F |
| Select element | Ctrl+Shift+C |
| Copy as cURL | Right-click request → Copy |
| Save response | Right-click → Save response |

---

## Next Steps After Capture

1. Paste captured data into `docs/design/sixteen-eight-eight.md` → "Open Questions" section
2. Update `client.ts` with real endpoint, headers, body structure
3. Create HTML fixtures in `tests/fixtures/`
4. Implement `ResultParser` against fixtures
5. Test end-to-end in background SW

---

*Keep this guide handy. The `sign` parameter is typically the biggest blocker — if it's HMAC with a secret key, you may need to extract the algorithm from 1688's JS bundles or use a different approach (puppeteer, or fallback to manual search only).*