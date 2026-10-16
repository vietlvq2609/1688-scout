// The wire contract between the extension and the local helper.
//
// Keep this file Node-safe: no `chrome.*`, no DOM, no imports. The helper
// compiles it with its own Node tsconfig (that is why that tsconfig sets
// `rootDir: ".."`), so anything browser-only here would break its build.

/** A product extracted from a Shopee category listing page. */
export interface ShopeeCategoryProduct {
  title: string;
  imageUrl: string;
  priceVND: number;
  productUrl: string;
}

/**
 * Scan configuration. The values are fixed in `constants.ts`; there is no
 * settings UI in the MVP.
 */
export interface ScanConfig {
  /** Category pages to walk. Default 3. */
  maxPages: number;
  /** Products read per page. Default 30. */
  maxProductsPerPage: number;
  /** CNY → VND exchange rate. Default 3500. */
  cnyVndRate: number;
  /** Markup applied to the landed cost. Default 3. */
  markupMultiplier: number;
}

/**
 * Cookie handed to the helper. Field names follow `chrome.cookies`, not
 * Playwright's, because the extension reads them straight out of Chrome.
 */
export interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: "no_restriction" | "lax" | "strict" | "unspecified";
  hostOnly?: boolean;
  expires?: number;
}

/** Request body for `POST /api/scan-category`. */
export interface ScanCategoryRequest {
  categoryUrl: string;
  config: ScanConfig;
  shopeeCookies: ChromeCookie[];
}

/** Payload of `GET /api/scan/:id/progress`. */
export interface ScanProgress {
  scanId: string;
  completed: number;
  total: number;
  currentTitle: string;
  status: "running" | "completed" | "error" | "stopped";
  errors: number;
}

/** Payload of `GET /api/scan/:id/result`. */
export interface ScanResult {
  scanId: string;
  /** Base64-encoded CSV. */
  csvBase64: string;
  matches: number;
  totalScanned: number;
  errors: number;
  startedAt: string;
  completedAt: string;
}

/** One 1688 image-search match for a product, produced by the helper. */
export interface SixteenEightEightResult {
  thumbnailUrl: string;
  title: string;
  priceCNY: number;
  moq: number;
  shopName: string;
  shopRating: number;
  productUrl: string;
}

/** Payload of `GET /api/status`. */
export interface HelperStatus {
  running: boolean;
  loggedIn: boolean;
  port: number;
  version: string;
}

export type SearchErrorType =
  | "NO_RESULTS"
  | "AUTH_REQUIRED"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED";

export interface SearchError {
  type: SearchErrorType;
  /** Vietnamese, shown to the user verbatim. */
  message: string;
}
