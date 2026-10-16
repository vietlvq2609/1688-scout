// Helper-local runtime configuration.
// Values are read once from the environment with safe defaults; no side
// effects beyond that env read (nothing here touches Chrome or the network).

/** Port the helper listens on (env HELPER_PORT overrides). */
export const PORT: number = Number(process.env.HELPER_PORT ?? 3001);

/**
 * Interface the helper binds. Explicit IPv4 loopback, not `::`: Chrome
 * resolves `localhost` to `127.0.0.1`, and binding `::` alone can silently
 * succeed while another process owns IPv4, leaving the extension unable to
 * reach the helper.
 */
export const HOST = '127.0.0.1';

/** Helper version reported by GET /api/status. */
export const VERSION = '1.0.0';

/** Maximum accepted JSON request body size (image uploads). */
export const PLAINTEXT_BODY_LIMIT = '10mb';

/**
 * The 1688 image-search entry page. Signed-out visitors are bounced to the
 * login page, which is what the session check looks for.
 */
export const SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL =
  'https://air.1688.com/kapp/1688-search/pc-image-search/';

/**
 * A 1688 page that actually enforces sign-in. The image-search page renders
 * its upload UI even without a session (verified live), so the session check
 * opens "My Alibaba" instead: signed out it redirects to login.taobao.com.
 */
export const SIXTEEN_EIGHT_EIGHT_SESSION_CHECK_URL = 'https://i.1688.com/';

/** How long the session check waits for that page before giving up. */
export const SESSION_CHECK_TIMEOUT_MS = 30_000;

/** Concurrent 1688 searches within one scan. */
export const PARALLEL_CONTEXTS = 5;

/** 1688 offers parsed per search (the first is the best match). */
export const MAX_RESULTS_PER_SEARCH = 10;

/** Auto-stop a scan that has run this long (30 minutes). */
export const SCAN_TIMEOUT_MS = 30 * 60 * 1000;

/** Error body shape used by every helper HTTP error response. */
export function httpErrorPayload(code: string, message: string): {
  error: { code: string; message: string };
} {
  return { error: { code, message } };
}
