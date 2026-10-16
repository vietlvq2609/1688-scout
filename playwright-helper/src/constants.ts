// Helper-local runtime configuration.
// Values are read once from the environment with safe defaults; no side
// effects beyond that env read (nothing here touches Chrome or the network).

/** Port the helper listens on (env HELPER_PORT overrides). */
export const PORT: number = Number(process.env.HELPER_PORT ?? 3001);

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

/** How long the session check waits for that page before giving up. */
export const SESSION_CHECK_TIMEOUT_MS = 30_000;

/** Error body shape used by every helper HTTP error response. */
export function httpErrorPayload(code: string, message: string): {
  error: { code: string; message: string };
} {
  return { error: { code, message } };
}
