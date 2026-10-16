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

/** The cookie jars the extension hands to the helper, one per site. */
export interface SiteCookies {
  shopee: ChromeCookie[];
  sixteenEightEight: ChromeCookie[];
}

/** Request body for `POST /api/scan-category`. */
export interface ScanCategoryRequest {
  categoryUrl: string;
  config: ScanConfig;
  cookies: SiteCookies;
}

/** Request body for `POST /api/session-check`. */
export interface SessionCheckRequest {
  /** The 1688 cookie jar. */
  cookies: ChromeCookie[];
}

/** Payload of `POST /api/session-check`. */
export interface SessionCheckResponse {
  signedIn: boolean;
}

/** Payload of `GET /api/scan/:id/progress`. */
export interface ScanProgress {
  scanId: string;
  completed: number;
  total: number;
  currentTitle: string;
  status: "running" | "completed" | "error" | "stopped";
  errors: number;
  /**
   * Present when `status` is `error`: why the scan gave up. `AUTH_REQUIRED`
   * means the handed-off 1688 session died mid-scan.
   */
  error?: SearchError;
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

/** One 1688 offer returned for a product image, produced by the helper. */
export interface SixteenEightEightOffer {
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
