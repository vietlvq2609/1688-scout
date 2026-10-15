# 04: Helper: Shopee Category Scraping

**What to build:** Playwright function `extractProducts(page, maxPages, maxPerPage)` that, given a Shopee category URL and injected Shopee cookies, scrolls the page, paginates up to `maxPages` (default 3), extracts up to `maxPerPage` (default 30) products per page. Returns array of `{ title, imageUrl, priceVND, productUrl }`. Handles lazy-loaded images, SPA pagination, and dynamic selectors.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `playwright-helper/src/shopee/extractor.ts` — `extractProducts(page, config)` function
- [ ] Injects Shopee cookies via `context.addCookies(shopeeCookies)` before navigation
- [ ] Navigates to category URL, waits for `li[data-sqe="item"]` elements
- [ ] Scrolls to trigger lazy image loads (intersect observer or scroll to bottom)
- [ ] Extracts per product:
  - `title`: `aria-label` on product card or `.whitespace-normal.line-clamp-2`
  - `imageUrl`: `picture source[type="image/webp"]@srcset` (first) or `img[loading="lazy"]@src`
  - `priceVND`: `.text-shopee-primary.font-medium` text → parse number (remove dots, ₫)
  - `productUrl`: `a.contents@href` (absolute URL)
- [ ] Pagination: detects "Next" button or URL `page=N` param, clicks/navigates up to `maxPages`
- [ ] Stops after `maxPages * maxPerPage` products (max 90)
- [ ] Returns `ShopeeCategoryProduct[]`
- [ ] Unit test with saved HTML fixture (category page) — extracts expected fields
- [ ] Handles missing elements gracefully (skips product, logs warning)