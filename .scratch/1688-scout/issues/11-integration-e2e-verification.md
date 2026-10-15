# 11: Integration + E2E Verification

**What to build:** End-to-end verification that the full flow works. Manual test script + checklist. All acceptance criteria from SPEC.md pass.

**Blocked by:** 04, 06, 08, 10

**Status:** ready-for-agent

- [ ] Helper running (`npm start` in `playwright-helper/`), 1688 logged in (`/api/status` → `loggedIn: true`)
- [ ] Extension loaded in Chrome (developer mode), Plasmo dev server running
- [ ] Test case 1 — Login check:
  - Open Shopee.vn logged in → popup shows 🟢 Shopee
  - Helper running + 1688 logged in → popup shows 🟢 1688
  - Logout Shopee → popup shows 🔴 Shopee + "Vui lòng đăng nhập Shopee"
  - Stop helper → popup shows "Helper không chạy" + guide link
- [ ] Test case 2 — Category scan:
  - Navigate to `shopee.vn/Thoi-Trang-Nam-cat.11035567` (or any category)
  - "Quét danh mục" button appears near category title
  - Open popup, set config (pages=2, products/page=10, rate=3500, multiplier=3)
  - Click "Quét danh mục" in popup (or page button)
  - Popup shows progress: "Đang quét: X/Y", progress bar updates every 2s
  - No browser window opens (helper runs headless)
  - Scan completes → popup shows "Hoàn tất! Tìm thấy N matches"
  - CSV downloads automatically: `matches-thoi-trang-nam-2025-01-15.csv`
- [ ] Test case 3 — CSV content:
  - Open CSV in Excel/Sheets
  - Headers: `STT, Shopee Title, Shopee Price (₫), Shopee URL, 1688 Title, 1688 Price (¥), 1688 URL, Calculated Price (₫), Match, Shop Name, Shop Rating, MOQ`
  - All rows have `Match = "Có"` (calculated < Shopee price)
  - Data types correct: prices as numbers, URLs clickable
  - Vietnamese characters display correctly (UTF-8 with BOM)
- [ ] Test case 4 — Error handling:
  - Stop scan mid-way → partial CSV downloads, shows scanned count
  - Helper crashes → popup shows error, "Thử lại" works after restart
  - 1688 session expired → helper `/api/status` returns `loggedIn: false` → popup shows "Đăng nhập 1688" → click opens headful browser for QR → after login, scan works
- [ ] Test case 5 — Edge cases:
  - Category with < 30 products/page → handles gracefully
  - Product with missing image/price → skipped, error counted, scan continues
  - Network timeout → retry works, eventually fails gracefully
  - Large category (90 products) → completes within 30 min timeout
- [ ] Performance: 90 products, 5 parallel → completes ~3-5 min
- [ ] Document any known issues / follow-up tickets