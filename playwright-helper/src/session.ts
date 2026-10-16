// 1688 session hand-off check.
//
// The helper owns no session: the extension hands over the seller's 1688
// cookie jar on every request. This module answers "is that jar still signed
// in?" by opening the 1688 image-search page once in a scan context — 1688
// bounces signed-out visitors to its login page, so a landing URL on
// login.1688.com / login.taobao.com means the session is dead.
//
// The Playwright context arrives through the ScanContextFactory seam so tests
// can exercise the whole path without launching a browser.
import type { ChromeCookie } from '../../src/core/types.js';
import {
  SESSION_CHECK_TIMEOUT_MS,
  SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL,
} from './constants.js';
import { createScanContext } from './browser.js';

const LOGIN_HOSTS = ['login.1688.com', 'login.taobao.com'] as const;

/** The slice of a Playwright page the session check needs. */
export interface SessionCheckPage {
  goto(
    url: string,
    options?: { waitUntil?: 'domcontentloaded'; timeout?: number },
  ): Promise<unknown>;
  url(): string;
}

/** The slice of a Playwright browser context the session check needs. */
export interface SessionCheckContext {
  newPage(): Promise<SessionCheckPage>;
  close(): Promise<void>;
}

/** Builds the context a session check (or a scan) runs in, from a cookie jar. */
export type ScanContextFactory = (cookies: ChromeCookie[]) => Promise<SessionCheckContext>;

/** Reports whether a handed-off 1688 cookie jar is still signed in. */
export type SignedInChecker = (cookies: ChromeCookie[]) => Promise<boolean>;

/** Whether a URL is one of 1688's sign-in pages (or a subdomain of one). */
export function isLoginUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return LOGIN_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

/**
 * Report whether the handed-off 1688 jar still signs the visitor in. Opens the
 * image-search page once and closes the context, whatever the outcome.
 */
export async function checkSignedIn(
  cookies: ChromeCookie[],
  createContext: ScanContextFactory = createScanContext,
): Promise<boolean> {
  const context = await createContext(cookies);
  try {
    const page = await context.newPage();
    await page.goto(SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: SESSION_CHECK_TIMEOUT_MS,
    });
    return !isLoginUrl(page.url());
  } finally {
    await context.close();
  }
}
