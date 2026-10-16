# SPEC: 1688 Scout — MVP

**Goal:** ship to the client fast. A Shopee Vietnam seller scans a category and gets a
spreadsheet of the products that are worth importing from 1688.

One sentence: **for each product in a Shopee category, find the matched 1688 product and
keep it only if `1688_price_CNY × 3500 × 3 < Shopee_price_VND`.**

---

## Problem

Shopee VN sellers currently image-search 1688 by hand, one product at a time, to guess
whether an item is worth importing. Doing this for a whole category takes hours.

## Solution

Two pieces, both on the seller's own machine. No backend, no accounts, no cloud.

| Piece | What it is | What it does |
|---|---|---|
| **Extension** | Chrome MV3, vanilla HTML + CSS + TypeScript | Reads the seller's Shopee and 1688 sessions and the current category URL, starts a scan, shows progress, downloads the CSV |
| **Helper** | Local Node process, Express + Playwright | Scrapes the Shopee category and image-searches each product on 1688 using the sessions handed off by the extension, applies the formula, returns the CSV |

### Why the extension cannot do it alone

- A Chrome extension cannot run Playwright: no Node runtime, no `child_process`, no
  filesystem, no raw sockets in an MV3 service worker.
- 1688's image-search upload needs a dynamic `sign` parameter. Reverse-engineering it is
  days of work and breaks silently. Driving the real 1688 UI with Playwright, using a
  logged-in session, is the path that reliably works — so we pay the cost of a local
  helper process instead.

---

## Sessions

Every site the helper browses is signed in as the seller. Both sessions are **handed off**
from the seller's own Chrome: the extension reads the cookies and sends them with each
request. The helper never signs in, never stores a session, and never owns a login.

This matters most for 1688, which only exposes image search to a signed-in visitor and
whose session expires in roughly half an hour. Because the seller's browser keeps that
session alive, a scan always starts from a live one, and a dead session is detected before
the scan begins rather than halfway through. The seller's recovery path is to sign in at
`login.1688.com` in their own browser. See `docs/adr/0001-borrow-live-browser-sessions.md`.

---

## Flow

1. Seller opens a Shopee category page and clicks the extension icon.
2. Popup shows helper status, 1688 session status, and **"Quét danh mục này"** (uses the
   active tab's URL — there is no button injected into the page).
3. Extension sends `{ categoryUrl, config, cookies }` to `POST /api/scan-category`
   and receives a `scanId`.
4. Helper extracts up to 90 products from the category, then for each product opens
   1688 image search (5 concurrent), parses the top results, and keeps the first result
   that satisfies the formula.
5. Extension polls progress every 2 seconds, then downloads
   `matches-<category>-<date>.csv`.

---

## Fixed values (no settings UI)

| Constant | Value |
|---|---|
| Max category pages | 3 |
| Products per page | 30 |
| CNY → VND rate | 3500 |
| Markup multiplier | 3 |
| 1688 results parsed per product | top 10 (best match = first) |
| Concurrent 1688 searches | 5 |
| Helper port | 3001 |
| Scan timeout | 30 minutes |

---

## CSV output

UTF-8 **with BOM** (Excel-friendly), matched rows only:

```
STT,Shopee Title,Shopee Price (₫),Shopee URL,1688 Title,1688 Price (¥),1688 URL,Landed Cost (₫),Match,Shop Name,Shop Rating,MOQ
```

---

## Helper HTTP API

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/status` | — | `{ running, port, version }` |
| `POST /api/session-check` | `{ cookies }` (1688 jar) | `{ signedIn }` — validates the handed-off session against 1688 |
| `POST /api/scan-category` | `{ categoryUrl, config, cookies }` | `{ scanId, status: "started" }` |
| `GET /api/scan/:id/progress` | — | `{ completed, total, currentTitle, status, errors }` |
| `GET /api/scan/:id/result` | — | `{ csvBase64, matches, totalScanned, errors, startedAt, completedAt }` |
| `POST /api/scan/:id/stop` | — | cancels the scan, keeps the partial result |

`status` is one of `running | completed | error | stopped`.

The helper holds no session of its own: no auth file, no login endpoint. If a search hits a
login redirect mid-scan the scan is aborted with `error`, the reason is reported as
`AUTH_REQUIRED`, and the partial CSV is kept.

---

## Acceptance criteria

1. Popup shows the Shopee session, helper reachability and the 1688 session state correctly.
2. "Quét danh mục này" starts a scan from the current category tab.
3. No browser window is visible while scanning (helper is headless).
4. Progress updates while scanning; the scan survives the popup being closed.
5. On completion the CSV downloads automatically and contains only matched rows with the
   columns above.
6. Helper not running → clear Vietnamese message with a start hint.
7. 1688 session expired or missing → the popup shows it before the scan starts, and
   **"Đăng nhập 1688"** opens `login.1688.com` in a normal tab so the seller can sign in
   in the browser they already use.
8. Stopping mid-scan downloads a partial CSV.
9. A product that fails to search never stops the scan; errors are counted and logged.
10. Whole scan of 90 products finishes inside the 30-minute timeout.

---

## Out of scope

Content scripts or any button injected into Shopee pages, React or any UI framework,
config UI, single-product-page search, side panel, history, favourites, calculator,
backend or cloud, multi-image search, the helper owning its own login (no QR flow, no
persisted auth file), automated tests, CI.
