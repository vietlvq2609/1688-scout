// CORS policy for the helper.
//
// The helper listens on localhost and drives the seller's signed-in sessions,
// so a wildcard would let any website the seller visits start scans. Only
// Chrome extension origins may call it; the extension id is 32 chars [a-p].
// Requests with no Origin header (curl, same-origin) are allowed.
import type { CorsOptions } from 'cors';

const EXTENSION_ID = /^[a-p]{32}$/;

/** True when an Origin header names a Chrome extension page. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return url.protocol === 'chrome-extension:' && EXTENSION_ID.test(url.host);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
};
