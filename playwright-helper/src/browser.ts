// Singleton Playwright Chromium launcher + scan context factory.
// The browser is launched lazily on the first getBrowser() call — never at
// import time and never in tests (tests do not import this module).
import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';
import { loadAuthState } from './auth.js';

// Realistic desktop fingerprint so 1688 does not trivially flag the bot.
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browser: Browser | null = null;

/** Get the shared headless Chromium instance, launching it on first use. */
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
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
 * Create a browser context carrying the persisted 1688 auth state (when one
 * exists) with a realistic desktop viewport/user agent. Used by every scan.
 */
export async function createScanContext(): Promise<BrowserContext> {
  const activeBrowser = await getBrowser();
  const authState = await loadAuthState();
  return activeBrowser.newContext({
    ...(authState ? { storageState: authState } : {}),
    viewport: { width: 1920, height: 1080 },
    userAgent: DESKTOP_USER_AGENT,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });
}
