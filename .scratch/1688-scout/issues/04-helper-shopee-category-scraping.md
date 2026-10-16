# 04: Helper: Shopee Category Scraping

**What to build:** Playwright function `extractProducts(page, maxPages, maxPerPage)` that, given a Shopee category URL and injected Shopee cookies, scrolls the page, paginates up to `maxPages` (default 3), extracts up to `maxPerPage` (default 30) products per page. Returns array of `{ title, imageUrl, priceVND, productUrl }`. Handles lazy-loaded images, SPA pagination, and dynamic selectors.

**Blocked by:** 02

**Status:** in-progress (live-category verification pending)

- [x] `playwright-helper/src/shopee/extractor.ts` — `extractProducts(page, categoryUrl, config)` function
- [x] Injects the handed-off Shopee cookies (ticket 03's `toPlaywrightCookies()`) before navigation — the caller (ticket 06) builds the context with the jars; the extractor works on a page inside it
- [x] Navigates to category URL, waits for `li[data-sqe="item"]` elements
- [x] Scrolls to trigger lazy image loads (intersect observer or scroll to bottom)
- [x] Extracts per product:
  - `title`: `aria-label` on product card or `.whitespace-normal.line-clamp-2`
  - `imageUrl`: `picture source[type="image/webp"]@srcset` (first) or `img[loading="lazy"]@src`
  - `priceVND`: `.text-shopee-primary.font-medium` text → parse number (remove dots, ₫)
  - `productUrl`: `a.contents@href` (absolute URL)
- [x] Pagination: detects "Next" button or URL `page=N` param, clicks/navigates up to `maxPages`
- [x] Stops after `maxPages * maxPerPage` products (max 90)
- [x] Returns `ShopeeCategoryProduct[]`
- [x] Handles missing elements gracefully (skips product, logs warning)

**Notes (divergences from the checklist, for the record):**
- `extractProducts` also takes `categoryUrl` so it can navigate 1-based `?page=N`; the ticket's
  `(page, config)` has no URL to navigate to.
- Price selector is `[class*="text-shopee-primary"][class*="font-medium"]` **filtered to the
  element whose text contains `₫`**, because the `-50%` discount badge shares both classes and
  comes first in the DOM. The ticket's bare `.text-shopee-primary.font-medium` would read `-50%`.
- Image: the first `img[src]` (the un-resized original) is preferred; the `source[srcset]` webp is
  the fallback. The card also contains an overlay `<picture>` after the main one.
- Pagination is URL-param only (`?page=N`, 1-based per the live site); no Next-button selector to
  keep guessing to a minimum. A page yielding only duplicates ends the walk.
- Parsing uses `linkedom` (new helper dependency) so it is unit-tested against a real card fixture
  with no browser. 15 new tests. The fixture's price-inner markup is reconstructed where the live
  paste was truncated at 4,000 chars; the parser reads the container, so that is irrelevant.
- Cookie injection lives in ticket 06's context creation, not in this module.