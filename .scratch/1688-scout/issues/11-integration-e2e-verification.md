# 11: End-to-End Verification

**What to build:** verification that the whole flow works, as a manual checklist. Every acceptance criterion in `SPEC.md` passes.

**Blocked by:** 04, 05, 06, 07

**Status:** ready-for-agent

## Setup

- [ ] Helper running (`pnpm dev` in `playwright-helper/`), signed into 1688 in Chrome, and `/api/session-check` returns `signedIn: true` for the handed-off cookies
- [ ] Extension built (`pnpm build`) and loaded unpacked from `dist/` in Chrome (developer mode)

## Test case 1 — Status

- [ ] Open a Shopee category while logged in → popup shows Shopee 🟢 and a launchable scan
- [ ] Helper running + 1688 signed in → popup shows 1688 🟢
- [ ] Stop the helper → popup shows "Helper không chạy" with a start hint
- [ ] Sign out of 1688 in Chrome → the popup shows the 1688 session as dead and the scan refuses to start; "Đăng nhập 1688" opens `login.1688.com` in a tab, and after signing in there a scan works with no helper restart

## Test case 2 — Scan

- [ ] Open `shopee.vn/Thoi-Trang-Nam-cat.11035567` (or any category), click the extension icon
- [ ] Click "Quét danh mục này" → progress starts counting, no browser window appears
- [ ] Progress bar and "Đang quét X/Y" update every ~2s
- [ ] Close the popup mid-scan, reopen it → the scan is still running and the popup re-attaches
- [ ] On completion the popup shows "Hoàn tất! Tìm thấy N sản phẩm" and the CSV has been downloaded

## Test case 3 — CSV content

- [ ] Open the CSV in Excel/Sheets: headers match SPEC.md exactly, in order
- [ ] Every row satisfies `Landed Cost (₫) < Shopee Price (₫)`
- [ ] Vietnamese characters render correctly (UTF-8 with BOM)
- [ ] URLs are clickable and point at the right products

## Test case 4 — Failure handling

- [ ] Press "Dừng" mid-scan → a partial CSV is downloaded with a correct scanned count
- [ ] Kill the helper mid-scan → the popup shows a clear error and can retry after restart
- [ ] Sign out of 1688 in Chrome mid-scan → the scan aborts with `AUTH_REQUIRED` instead of grinding through the remaining products, reports the reason, and still offers the partial CSV
- [ ] Point the extension at a category with fewer than 30 products → completes without error
- [ ] A product with a missing image or price is skipped, counted as an error, and does not stop the scan

## Test case 5 — Performance

- [ ] A 90-product category completes within the 30-minute timeout (target: well under it)
- [ ] Helper memory stays reasonable across a full scan
