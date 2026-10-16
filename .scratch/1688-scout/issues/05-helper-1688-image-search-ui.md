# 05: Helper — 1688 Image Search via UI Automation

**What to build:** Playwright function `search1688(context, imageUrl)` that drives the 1688 image-search UI (NOT a reverse-engineered API). Opens `https://air.1688.com/kapp/1688-search/pc-image-search/`, uploads the image (downloading it from `imageUrl` first), waits for results, and parses the top 10 cards. Returns `SixteenEightEightResult[]` with `title, priceCNY, moq, shopName, shopRating, productUrl, thumbnailUrl`.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] `playwright-helper/src/sixteen-eight-eight/search.ts` — `search1688(context, imageUrl)` function
- [ ] Downloads the image from `imageUrl` to a temp file (or keeps a buffer)
- [ ] Creates a page in a context carrying the handed-off 1688 session (ticket 03)
- [ ] Navigates to `https://air.1688.com/kapp/1688-search/pc-image-search/`
- [ ] Uploads the image:
  - finds the file input (`input[type="file"]`) or the drop zone
  - `page.setInputFiles(...)`, or `page.on("filechooser")` + `chooser.setFiles(...)`
- [ ] Waits for results: URL gains `imageId` OR result cards appear
- [ ] Parses result cards (final selectors confirmed against the live page):
  - `title`: product title element
  - `priceCNY`: price element (¥XX.XX) → parse float
  - `moq`: minimum order quantity element
  - `shopName`: shop name element
  - `shopRating`: rating element → parse float
  - `productUrl`: link to `detail.1688.com/offer/...`
  - `thumbnailUrl`: product image src
- [ ] Returns the top 10 results as `SixteenEightEightResult[]`; returns `[]` when no cards are found
- [ ] Throws `AUTH_REQUIRED` when the page redirects to `login.1688.com` / `login.taobao.com`, or when a verification slider blocks the results
- [ ] Closes the page after extraction
- [ ] Manual test: with a valid handed-off session, search a known product image and inspect the parsed structure
