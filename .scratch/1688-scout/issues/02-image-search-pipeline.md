# 02: Image Search Pipeline

**What to build:** As a Shopee seller, I want the extension to extract the main product image automatically, compress it before upload, and use my existing 1688 logged-in session, so that I don't have to download and re-upload images or log in separately. When I click the "Tìm trên 1688" button, the extension should send the image to 1688's image search and return matched products.

**Blocked by:** 01: Foundation - Detection & Injection

**Status:** ready-for-agent

- [ ] Image extraction logic in Shopee feature to get main product image as Blob
- [ ] Image compression utility (800×800, JPEG 0.8) applied before upload
- [ ] Background service worker implements SEARCH_1688 message handler with Promise-based wrapper (30s timeout)
- [ ] SixteenEightEightApiClient constructs request to 1688 image search endpoint using existing browser session (via host_permissions)
- [ ] Rate limiting enforced (1 request per 2 seconds) in the API client
- [ ] ResultParser extracts structured data from 1688 HTML response (thumbnail, title, price, MOQ, shop name, rating, product URL)
- [ ] Background sends SEARCH_1688_RESULT with parsed results or typed SearchError
- [ ] Content script displays loading state while search is in progress