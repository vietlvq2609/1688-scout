// Shared constants for the extension (and, for the scan limits, the helper).
// Pure data: no `chrome.*`, no DOM, no side effects.

import type { ScanConfig } from "./types.js";

export const CONSTANTS = {
  // Scan limits — fixed for the MVP, deliberately not user-configurable.
  DEFAULT_MAX_PAGES: 3,
  DEFAULT_MAX_PRODUCTS_PER_PAGE: 30,
  DEFAULT_CNY_VND_RATE: 3500,
  DEFAULT_MARKUP_MULTIPLIER: 3,
  MAX_RESULTS_PER_SEARCH: 10,
  PARALLEL_CONTEXTS: 5,

  // Local helper process.
  HELPER_BASE_URL: "http://localhost:3001",
  HELPER_REQUEST_TIMEOUT_MS: 30_000,
  HELPER_HEALTH_CHECK_MS: 5_000,
  HELPER_SCAN_TIMEOUT_MS: 30 * 60 * 1000,
  HELPER_ENDPOINTS: {
    STATUS: "/api/status",
    LOGIN: "/api/login",
    SCAN_CATEGORY: "/api/scan-category",
    SCAN_PROGRESS: (scanId: string) => `/api/scan/${scanId}/progress`,
    SCAN_RESULT: (scanId: string) => `/api/scan/${scanId}/result`,
    SCAN_STOP: (scanId: string) => `/api/scan/${scanId}/stop`,
  },

  // Shopee — used to collect cookies and to tell whether the active tab is a
  // category page worth scanning.
  SHOPEE_COOKIE_DOMAINS: ["shopee.vn", "shopee.com.vn"],
  SHOPEE_CATEGORY_URL_MARKERS: ["-cat.", "/cat.", "all_categories"],

  // How often the background worker asks the helper for progress.
  SCAN_POLL_MS: 2_000,

  // chrome.storage.session key holding the in-flight scan, so the popup can
  // re-attach after it has been closed and reopened.
  STORAGE_KEYS: {
    SCAN_STATE: "scanState",
  },
} as const;

/** Default scan configuration built from the constants above. */
export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  maxPages: CONSTANTS.DEFAULT_MAX_PAGES,
  maxProductsPerPage: CONSTANTS.DEFAULT_MAX_PRODUCTS_PER_PAGE,
  cnyVndRate: CONSTANTS.DEFAULT_CNY_VND_RATE,
  markupMultiplier: CONSTANTS.DEFAULT_MARKUP_MULTIPLIER,
};
