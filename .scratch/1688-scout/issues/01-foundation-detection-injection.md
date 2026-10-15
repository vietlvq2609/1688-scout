# 01: Foundation - Detection & Injection

**What to build:** As a Shopee seller, I want the extension to automatically detect when I'm on a product page and show a "Tìm trên 1688" button near the product title, so that I can start a search with one click without manual activation. The button should work on both shopee.vn and shopee.com.vn domains and update when navigating between products via Shopee's SPA routing.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Extension manifest generated via Plasmo with correct host permissions for Shopee and 1688 domains
- [ ] Platform wrappers for Chrome messaging, tabs, and sidePanel APIs implemented as test seams
- [ ] Content script detects Shopee product pages on both shopee.vn and shopee.com.vn using selector fallbacks
- [ ] "Tìm trên 1688" button injected near product title on detected pages
- [ ] Button updates when navigating between products via Shopee's SPA (popstate, pushState, DOM mutation observers)
- [ ] Clicking button shows a placeholder alert (to be replaced with search flow in later tickets)