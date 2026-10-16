// Singleton Playwright Chrome launcher + scan context factory.
// The browser is launched lazily on the first getBrowser() call — never at
// import time and never in tests (tests never reach this module's launch).
import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';
import type { ChromeCookie } from '../../src/core/types.js';
import { toPlaywrightCookies } from './cookies.js';

// Realistic desktop fingerprint so 1688 does not trivially flag the bot.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browser: Browser | null = null;

/**
 * Get the shared headless browser instance, launching it on first use.
 * `channel: "chrome"` drives the seller's installed Chrome — the browser the
 * handed-off session jars were created in — and removes the ~150 MB
 * Playwright browser download from setup.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  }
  return browser;
}

/** Close the shared browser if one was launched (idempotent). */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Create a browser context carrying the handed-off cookie jar, with a
 * realistic desktop viewport/user agent. Used by every session check and scan.
 */
export async function createScanContext(
  cookies: ChromeCookie[],
): Promise<BrowserContext> {
  const activeBrowser = await getBrowser();
  const context = await activeBrowser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: DESKTOP_USER_AGENT,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });
  await context.addCookies(toPlaywrightCookies(cookies));
  return context;
}
