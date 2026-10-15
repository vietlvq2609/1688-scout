# 05: Helper: 1688 Image Search via UI Automation

**What to build:** Playwright function `search1688(context, imageUrl)` that uses UI automation (NOT direct API) to search 1688 by image. Opens `https://air.1688.com/kapp/1688-search/pc-image-search/`, uploads image via file input / drag-drop (downloads image from `imageUrl` first), waits for results page to load, parses top 10 result cards from DOM. Returns `SixteenEightEightResult[]` with `title, priceCNY, moq, shopName, shopRating, productUrl, thumbnailUrl`.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] `playwright-helper/src/sixteen-eight-eight/search.ts` — `search1688(context, imageUrl)` function
- [ ] Downloads image from `imageUrl` to temp file (or uses buffer)
- [ ] Creates new page in authenticated context (has `1688-auth.json` session)
- [ ] Navigates to `https://air.1688.com/kapp/1688-search/pc-image-search/`
- [ ] Uploads image:
  - Finds file input (`input[type="file"]`) or drop zone
  - `page.setInputFiles('input[type="file"]', tempImagePath)` or drag-drop simulation
- [ ] Waits for results: URL changes to include `imageId` OR result cards appear
- [ ] Parses result cards (selector TBD from live inspection):
  - `title`: product title element
  - `priceCNY`: price element (¥XX.XX) → parse float
  - `moq`: minimum order quantity element
  - `shopName`: shop name element
  - `shopRating`: rating element (parse float)
  - `productUrl`: link to `detail.1688.com/offer/...`
  - `thumbnailUrl`: product image src
- [ ] Returns top 10 results as `SixteenEightEightResult[]`
- [ ] Handles empty results (no cards found) → returns `[]`
- [ ] Handles captcha/login redirect → throws `AUTH_REQUIRED` error
- [ ] Closes page after extraction
- [ ] Manual test: run with valid 1688 session, search known product image, verify results structure