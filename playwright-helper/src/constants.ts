// Helper-local runtime configuration.
// Values are read once from the environment with safe defaults; no side
// effects beyond that env read (nothing here touches Chrome or the network).
import path from 'node:path';

/** Port the helper listens on (env HELPER_PORT overrides). */
export const PORT: number = Number(process.env.HELPER_PORT ?? 3001);

/** Helper version reported by GET /api/status. */
export const VERSION = '1.0.0';

/**
 * Location of the persisted 1688 Playwright storageState file
 * (env HELPER_AUTH_FILE overrides; defaults to <cwd>/1688-auth.json so it
 * lives next to where the helper is run from, never inside the repo when
 * HELPER_AUTH_FILE points elsewhere).
 */
export const AUTH_FILE_PATH: string = process.env.HELPER_AUTH_FILE
  ? path.resolve(process.env.HELPER_AUTH_FILE)
  : path.resolve(process.cwd(), '1688-auth.json');

/** Maximum accepted JSON request body size (image uploads). */
export const PLAINTEXT_BODY_LIMIT = '10mb';

/** Error body shape used by every helper HTTP error response. */
export function httpErrorPayload(code: string, message: string): {
  error: { code: string; message: string };
} {
  return { error: { code, message } };
}
