# 03: Results Display & Side Panel UI

**What to build:** As a Shopee seller, I want the extension to show search results in a persistent side panel with Vietnamese UI, so that I can evaluate suppliers at a glance. The side panel should open automatically when results are ready, show loading state while searching, display results with thumbnail, title, price (¥), MOQ, shop name, rating, and a link to open the supplier page, and show an empty state when no matches are found.

**Blocked by:** 02: Image Search Pipeline

**Status:** ready-for-agent

- [ ] SidePanel state machine implemented with states: idle, loading, results(data), error, empty
- [ ] React side panel entrypoint bootstrap registered via chrome.sidePanel.setOptions
- [ ] ResultsTable component renders SixteenEightEightResult[] with thumbnail, title, price (¥), MOQ, shop name, shop rating, and "Mở trên 1688" link
- [ ] Clicking "Mở trên 1688" opens supplier product URL in new tab via platform.tabs.create
- [ ] LoadingState shows while search is in progress
- [ ] EmptyState shows "Không tìm thấy sản phẩm tương tự" when no results returned
- [ ] All UI text in Vietnamese (buttons, labels, messages, table headers)
- [ ] Side panel opens automatically when results are ready (state transition to results/empty/error)