# 07: Extension: Shopee Login Detection

**What to build:** Content script runs on `shopee.vn` and `shopee.com.vn`, detects if user is logged in by checking for account menu / user avatar in DOM. Sends `{ type: 'SHOPEE_LOGIN_STATUS', payload: { loggedIn: boolean } }` to background via `chrome.runtime.sendMessage`. Runs on page load and on SPA navigation.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `src/features/shopee/detector.ts` — `detectLogin(): boolean` function
- [ ] Selectors for logged-in state (fallback array):
  - User avatar: `.shopee-avatar, [data-sqe="account-menu"], .navbar__account`
  - Account dropdown trigger
  - Any element indicating authenticated user
- [ ] `src/features/shopee/index.ts` — content script entry
- [ ] Runs at `document_idle`, on `location` change (MutationObserver or `popstate`/`pushState` wrapper)
- [ ] Sends message to background: `chrome.runtime.sendMessage({ type: 'SHOPEE_LOGIN_STATUS', payload: { loggedIn } })`
- [ ] Background (`src/entry-points/background.ts`) listens, stores latest status in `chrome.storage.session`
- [ ] Test: load Shopee logged in → message sent with `true`; logout → message sent with `false`
- [ ] No UI injection yet — only detection and messaging