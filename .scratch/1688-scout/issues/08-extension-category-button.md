# 08: Extension: Category Page Detection + Button

**What to build:** Content script detects Shopee category pages (URL matches `/cat.*` or `/all_categories`), injects "Quét danh mục" button near page title/category header. Button click sends `{ type: 'START_CATEGORY_SCAN', payload: { categoryUrl, config } }` to background. Config read from `chrome.storage.sync` (user preferences).

**Blocked by:** 01, 07

**Status:** ready-for-agent

- [ ] `src/features/shopee/detector.ts` — `isCategoryPage(): boolean` (URL pattern match)
- [ ] `src/features/shopee/injector.ts` — `injectScanButton()` function
- [ ] Button placement: near category title (selector: `.page-title, .category-header, h1`) or fixed top-right
- [ ] Button style: primary Shopee color, Vietnamese text "Quét danh mục", loading spinner state
- [ ] Click handler: reads current config from `chrome.storage.sync` (defaults from constants), sends message to background
- [ ] `src/features/shopee/selectors.ts` — selector fallbacks for category title, product cards
- [ ] Re-injects on SPA navigation (same mechanism as ticket 07)
- [ ] Removes button on non-category pages
- [ ] Test: navigate to `shopee.vn/Thoi-Trang-Nam-cat.11035567` → button appears; click → message received in background