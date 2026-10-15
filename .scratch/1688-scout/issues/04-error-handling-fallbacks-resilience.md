# 04: Error Handling, Fallbacks & Resilience

**What to build:** As a Shopee seller, I want the extension to handle errors gracefully and provide fallback options, so that I can still search manually when automated search fails and know what went wrong. I want to see clear error messages for common issues (login required, network problems, parsing failures), have a fallback to manual 1688 search, avoid accidental multiple searches, and handle encoding issues correctly.

**Blocked by:** 03: Results Display & Side Panel UI

**Status:** ready-for-agent

- [ ] Error classification in sixteen-eight-eight feature: AUTH_REQUIRED (302/captcha), NETWORK_ERROR, PARSE_ERROR, RATE_LIMITED, NO_RESULTS
- [ ] Side panel displays appropriate error states: "Vui lòng đăng nhập 1688" with login button for AUTH_REQUIRED, "Lỗi kết nối, vui lòng thử lại" for NETWORK_ERROR, "Lỗi phân tích kết quả" for PARSE_ERROR
- [ ] Fallback to manual 1688 image search URL when API fails (pre-fills extracted image)
- [ ] Button clicks debounced to prevent multiple rapid searches
- [ ] Content script handles Shopee SPA navigation without requiring page refresh
- [ ] Selector configurations include fallback arrays (data-testid → aria-label → class patterns → meta tags) for robustness
- [ ] SixteenEightEightApiClient handles GBK/UTF-8 encoding issues in shop names and titles
- [ ] Service worker lifecycle management: idempotent requests, handling missing responses gracefully