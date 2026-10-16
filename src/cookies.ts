// Collects the seller's cookie jars out of Chrome for hand-off to the helper.
//
// `chrome.cookies` only exposes cookies for domains the extension holds host
// permissions for (the manifest grants shopee.vn / shopee.com.vn / 1688.com).
// Chrome's cookie shape differs from the wire contract in one field:
// `expirationDate` here is `expires` there.

import { CONSTANTS } from "./core/constants.js";
import type { ChromeCookie, SiteCookies } from "./core/types.js";

function toChromeCookie(cookie: chrome.cookies.Cookie): ChromeCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    hostOnly: cookie.hostOnly,
    expires: cookie.expirationDate,
  };
}

/** Read the Shopee and 1688 jars from the seller's Chrome. */
export async function collectSiteCookies(): Promise<SiteCookies> {
  const [shopeeVn, shopeeComVn, sixteenEightEight] = await Promise.all([
    chrome.cookies.getAll({ domain: "shopee.vn" }),
    chrome.cookies.getAll({ domain: "shopee.com.vn" }),
    chrome.cookies.getAll({ domain: "1688.com" }),
  ]);

  return {
    shopee: [...shopeeVn, ...shopeeComVn].map(toChromeCookie),
    sixteenEightEight: sixteenEightEight.map(toChromeCookie),
  };
}

/** True when the active tab looks like a Shopee page. */
export function isShopeeUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "shopee.vn" || hostname.endsWith(".shopee.vn")
      || hostname === "shopee.com.vn" || hostname.endsWith(".shopee.com.vn");
  } catch {
    return false;
  }
}

/** True when the active tab is a Shopee category page a scan can start from. */
export function isCategoryPage(url: string | null): boolean {
  if (!isShopeeUrl(url)) return false;
  return CONSTANTS.SHOPEE_CATEGORY_URL_MARKERS.some((marker) => url.includes(marker));
}
