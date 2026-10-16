// Chrome → Playwright cookie shape mapping for the handed-off session jars.
//
// The extension reads cookies with `chrome.cookies` and posts them to the
// helper verbatim, so the helper receives Chrome's shape. Playwright's
// `context.addCookies` accepts a different, smaller shape: `hostOnly` and
// `session` do not exist there, `sameSite` uses different spellings, and a
// session cookie is expressed by leaving `expires` out.
import type { ChromeCookie } from '../../src/core/types.js';

/** The cookie shape `context.addCookies` accepts (a subset of Playwright's). */
export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

const SAME_SITE: Record<NonNullable<ChromeCookie['sameSite']>, 'Strict' | 'Lax' | 'None'> = {
  no_restriction: 'None',
  unspecified: 'None',
  lax: 'Lax',
  strict: 'Strict',
};

/**
 * Map a Chrome cookie jar to Playwright's shape, dropping Chrome-only fields.
 * Cookies with no `sameSite` keep Playwright's default (Lax); an `expires`
 * that is not a finite number is omitted, which Playwright reads as a session
 * cookie.
 */
export function toPlaywrightCookies(cookies: ChromeCookie[]): PlaywrightCookie[] {
  return cookies.map((cookie) => {
    const mapped: PlaywrightCookie = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
    };
    if (cookie.sameSite) {
      mapped.sameSite = SAME_SITE[cookie.sameSite];
    }
    if (typeof cookie.expires === 'number' && Number.isFinite(cookie.expires)) {
      mapped.expires = cookie.expires;
    }
    return mapped;
  });
}
