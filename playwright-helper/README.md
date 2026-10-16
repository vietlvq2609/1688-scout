# 1688 Scout Helper

Local Node.js helper (Express + Playwright) that does all Shopee / 1688
scraping for the 1688 Scout Chrome extension and produces the CSV. It runs on
the seller's own machine — it is **not** a backend server.

## Dành cho người bán (hướng dẫn nhanh)

1. **Cài Node.js 22** — tải tại <https://nodejs.org/> và cài như bình thường.
2. **Chạy helper** — nháy đúp `start-helper.bat`. Lần đầu nó tự cài đặt (vài
   phút). **Giữ cửa sổ này mở** trong lúc quét; đóng cửa sổ là helper dừng.
3. **Đăng nhập 1688 một lần** — mở <https://1688.com> trong Chrome và đăng nhập.
   Helper mượn phiên đăng nhập đó, không tự đăng nhập và không lưu mật khẩu.
4. **Cài tiện ích** — `chrome://extensions` → bật *Developer mode* → *Load
   unpacked* → chọn thư mục `dist/` của tiện ích.
5. **Quét** — mở một danh mục Shopee, bấm biểu tượng 1688 Scout, bấm
   **“Quét danh mục này”**. File CSV sẽ tự tải về khi xong.

### Xử lý sự cố

- **“Helper không chạy”** — chưa mở `start-helper.bat`, hoặc cửa sổ helper đã
  bị đóng. Mở lại và thử lại; helper dừng sẽ báo lỗi ngay chứ không treo. Mở
  `http://127.0.0.1:3001/api/status` trong Chrome để kiểm tra: đúng helper sẽ trả
  `{"running":true,...}`; nếu thấy JSON khác thì cổng 3001 đang bị ứng dụng khác
  chiếm.
- **Helper báo “Cổng 3001 đang được một ứng dụng khác sử dụng”** — tắt ứng dụng
  đang chiếm cổng 3001 rồi chạy lại. Nếu phải giữ ứng dụng đó, đặt
  `set HELPER_PORT=3002` trước khi chạy helper **và** đổi cổng trong tiện ích
  (`src/core/constants.ts`) rồi build lại.
- **“Chưa đăng nhập 1688”** — đăng nhập `1688.com` trong Chrome, rồi bấm
  **“Đăng nhập 1688”** trong tiện ích để mở trang đăng nhập.
- **CSV trống** — không sản phẩm nào có giá nhập thấp hơn giá Shopee, hoặc
  Shopee đang chặn đọc danh mục. Thử một danh mục khác và kiểm tra cửa sổ
  helper xem có dòng lỗi nào không.

## For developers

### Prerequisites

- Node.js 22+
- Google Chrome installed — the helper drives it via `channel: "chrome"`, so
  there is no bundled browser download.
- `pnpm` (enable with `corepack enable` if needed), then `pnpm install`.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the server from source with tsx watch (`src/server.ts`) |
| `pnpm build` | Compile to `dist/` (`tsc`) |
| `pnpm start` | Run the compiled server (`node dist/playwright-helper/src/server.js`) |
| `pnpm test` | Run vitest (no browser, no network) |
| `pnpm typecheck` | `tsc --noEmit` |
| `start-helper.bat` | Seller-facing launcher: checks Node/pnpm, installs, starts |

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HELPER_PORT` | `3001` | Port the helper listens on |

### Endpoints

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/status` | — | `{ running: true, port, version }` |
| `POST /api/session-check` | `{ cookies }` (the 1688 jar) | `{ signedIn }` |
| `POST /api/scan-category` | `{ categoryUrl, config, cookies }` | `{ scanId, status: "started" }` |
| `GET /api/scan/:id/progress` | — | `{ completed, total, currentTitle, status, errors }` |
| `GET /api/scan/:id/result` | — | `{ csvBase64, matches, totalScanned, errors, startedAt, completedAt }` |
| `POST /api/scan/:id/stop` | — | stops the scan, keeps the partial CSV |

CORS only allows `chrome-extension://<id>` origins, so a website the seller
visits cannot drive scans on `localhost:3001`.

### Sessions

The helper owns no session and stores none: no login route, no auth file, no
`storageState`. The extension reads the seller's Shopee and 1688 cookies from
Chrome and hands them over on every request; the helper injects them into a
Playwright context (`src/cookies.ts` → `src/browser.ts`). Recovery from an
expired 1688 session is the seller signing in at `login.1688.com` in their own
Chrome — see `docs/adr/0001-borrow-live-browser-sessions.md`.
