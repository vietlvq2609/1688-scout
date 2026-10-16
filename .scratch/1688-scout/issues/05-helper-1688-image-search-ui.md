# 05: Helper — 1688 Image Search via UI Automation

**What to build:** Playwright function `search1688(context, imageUrl)` that drives the 1688 image-search UI (NOT a reverse-engineered API). Opens `https://air.1688.com/kapp/1688-search/pc-image-search/`, uploads the image (downloading it from `imageUrl` first), waits for results, and parses the top 10 cards. Returns `SixteenEightEightOffer[]` with `title, priceCNY, moq, shopName, shopRating, productUrl, thumbnailUrl`.

**Blocked by:** 02, 03

**Status:** in-progress (live-image verification pending)

- [x] `playwright-helper/src/sixteen-eight-eight/search.ts` — `search1688(context, imageUrl)` function
- [x] Downloads the image from `imageUrl` to a temp file (or keeps a buffer)
- [x] Creates a page in a context carrying the handed-off 1688 session (ticket 03)
- [x] Navigates to `https://air.1688.com/kapp/1688-search/pc-image-search/`
- [x] Uploads the image:
  - finds the file input (`input[type="file"]`) or the drop zone
  - `page.setInputFiles(...)`, or `page.on("filechooser")` + `chooser.setFiles(...)`
- [x] Waits for results: URL gains `imageId` OR result cards appear
- [x] Parses result cards (final selectors confirmed against the live page):
  - `title`: product title element
  - `priceCNY`: price element (¥XX.XX) → parse float
  - `moq`: minimum order quantity element
  - `shopName`: shop name element
  - `shopRating`: rating element → parse float
  - `productUrl`: link to `detail.1688.com/offer/...`
  - `thumbnailUrl`: product image src
- [x] Returns the top 10 offers as `SixteenEightEightOffer[]`; returns `[]` when no cards are found
- [x] Throws `AUTH_REQUIRED` when the page redirects to `login.1688.com` / `login.taobao.com`, or when a verification slider blocks the results
- [x] Closes the page after extraction
- [ ] Manual test: with a valid handed-off session, search a known product image and inspect the parsed structure

**Notes (divergences from the checklist, for the record):**
- **`shopName` and `shopRating` are always empty/0.** The live result card has no shop name and no
  rating — only a seller badge `<img class="overseasSellerIcon">` and "100+ sold". The user chose
  to leave the columns empty for the MVP rather than visit each offer's detail page.
- **`productUrl` is constructed**, `https://detail.1688.com/offer/<id>.html`; the cards have no
  `<a href>` (`offerLinkCount` was 0). The id comes from the last `_` segment of
  `data-renderkey` (`1_0_normal_b2b-<sellerId>_<offerId>`), falling back to `object_id@…` in
  `data-aplus-report`. The detail URL format was confirmed to return 200.
- `priceCNY` is `[class*="priceWrap"] [class*="number"]` + `[class*="unit"]` (e.g. `358` + `.0`),
  falling back to `price@…` in `data-aplus-report`. The adjacent `[class*="overseasPrice"]` is
  1688's own ₫ conversion (~4,033 ₫/¥) and is deliberately ignored.
- Selectors use stable hooks (`data-tracker="offer"`, `[class*="…"]` prefixes) because 1688's
  CSS-in-JS class suffixes change between builds. Parsing is pure via `linkedom`; 8 tests against
  the live card HTML.
- `src/errors.ts` adds `ScanSearchError`, carrying the shared `SearchErrorType`.
