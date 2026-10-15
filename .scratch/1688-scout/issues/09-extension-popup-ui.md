# 09: Extension: Popup UI

**What to build:** React popup (`src/entry-points/popup.tsx`) showing: Shopee login status (from storage), 1688 login status (from helper `/api/status`), config form (max pages, products/page, CNY→VND rate, multiplier), "Quét danh mục" primary button, progress bar during scan, download link on complete, error states with action buttons.

**Blocked by:** 01, 07

**Status:** ready-for-agent

- [ ] `src/features/popup/Popup.tsx` — main component
- [ ] `src/features/popup/LoginStatus.tsx` — shows 🟢/🔴 Shopee + 1688, "Đăng nhập 1688" button calls helper `/api/login`
- [ ] `src/features/popup/ConfigForm.tsx` — number inputs with validation (pages 1-3, products 10-50, rate 1000-5000, multiplier 1-5), saves to `chrome.storage.sync`
- [ ] `src/features/popup/ScanProgress.tsx` — progress bar, "X/Y sản phẩm", current title, "Dừng" button
- [ ] `src/features/popup/ScanResult.tsx` — "Hoàn tất! Tìm thấy N matches", download link (blob URL), "Quét lại" button
- [ ] `src/features/popup/ErrorState.tsx` — "Helper không chạy" (link to guide), "Chưa đăng nhập 1688", "Lỗi quét danh mục" with retry
- [ ] Background → popup messaging: `chrome.runtime.onMessage` for progress updates, scan complete, errors
- [ ] Popup polls helper `/api/status` on mount (every 10s) for 1688 login status
- [ ] Vietnamese UI strings in `src/features/popup/copy.ts`
- [ ] Responsive: fits in 360px popup width
- [ ] Test: open popup → shows correct login states; start scan → progress updates; complete → CSV downloads