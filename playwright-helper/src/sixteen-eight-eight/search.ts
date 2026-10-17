// 1688 image search via UI automation.
//
// The image-search page is a two-step flow. Uploading a file does NOT search:
// 1688 renders a preview plus a "search for images" button, and the search only
// happens when that button is clicked. The click navigates to
// `?tab=imageSearch&imageId=…`, and only that result page mounts offer cards.
//
// Selectors come from a live page: the upload control is `#img-search-upload`,
// the button is `[data-tracker="pasteImagePreview"][data-scene="search"]`, the
// card wrapper is `[data-tracker="offer"]` (hashed class suffixes change between
// builds), the offer id is the last `_` segment of `data-renderkey`, and the ¥
// price is `[class*="priceWrap"] [class*="number"]` + `[class*="unit"]`. The
// sibling `[class*="overseasPrice"]` is 1688's own ₫ approximation and is ignored.
//
// Do not treat the mere presence of `baxia` as a block: it is 1688's SDK and is
// embedded in every page. Only an active challenge element counts.
import type { BrowserContext, Page } from 'playwright';
import { parseHTML } from 'linkedom';
import type { SixteenEightEightOffer } from '../../../src/core/types.js';
import { SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL } from '../constants.js';
import { ScanSearchError } from '../errors.js';
import { isLoginUrl } from '../session.js';

const OFFER_CARD_SELECTOR = '[data-tracker="offer"]';
const MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 45_000;

/**
 * The upload control. 1688 gives it the stable id `img-search-upload` and the
 * `image-file-reader-wrapper` class; the page has exactly one file input.
 */
const IMAGE_INPUT_SELECTOR = 'input#img-search-upload, input.image-file-reader-wrapper';

/**
 * Uploading only stages the image. This button starts the search and navigates
 * to the result URL; `data-scene="search"` distinguishes it from the preview.
 */
const IMAGE_SEARCH_BUTTON_SELECTOR = '[data-tracker="pasteImagePreview"][data-scene="search"]';

/** `tab` query value present only on the result page. */
const RESULTS_TAB = 'imageSearch';

/**
 * Markers of an *active* verification challenge. Deliberately does not test for
 * `baxia` alone: that string is on every page, so matching it would turn every
 * no-cards outcome into a false "blocked" verdict.
 */
const BLOCK_MARKERS = /nc_1_wrapper|punish|x5sec|滑动验证|验证码/i;

interface ImageFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** Search 1688 for one product image; returns up to the top 10 offers. */
export async function search1688(
  context: BrowserContext,
  imageUrl: string,
): Promise<SixteenEightEightOffer[]> {
  const image = await downloadImage(imageUrl);
  const page = await context.newPage();
  try {
    await page.goto(SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL, {
      waitUntil: 'domcontentloaded',
      timeout: SEARCH_TIMEOUT_MS,
    });
    if (isLoginUrl(page.url())) throw new ScanSearchError('AUTH_REQUIRED');

    const input = page.locator(IMAGE_INPUT_SELECTOR).first();
    await input.setInputFiles({ name: image.name, mimeType: image.mimeType, buffer: image.buffer });

    // Uploading does not search by itself. Wait for the preview's search button
    // and click it; that click navigates to `?tab=imageSearch&imageId=…`.
    await page
      .locator(IMAGE_SEARCH_BUTTON_SELECTOR)
      .first()
      .click({ timeout: SEARCH_TIMEOUT_MS });

    await waitForResults(page);
    return parseOffers(await page.content(), MAX_RESULTS);
  } finally {
    await page.close();
  }
}

/** Parse the top `limit` offers out of a rendered image-search page. */
export function parseOffers(html: string, limit: number): SixteenEightEightOffer[] {
  const { document } = parseHTML(html);
  const cards = [...document.querySelectorAll(OFFER_CARD_SELECTOR)];
  const offers: SixteenEightEightOffer[] = [];

  for (const card of cards) {
    if (offers.length >= limit) break;
    const offer = readOffer(card);
    if (offer) {
      offers.push(offer);
    } else {
      console.warn('[1688-scout-helper] bo qua the 1688 khong doc duoc');
    }
  }

  return offers;
}

async function downloadImage(url: string): Promise<ImageFile> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch {
    throw new ScanSearchError('NETWORK_ERROR');
  }
  if (!response.ok) throw new ScanSearchError('NETWORK_ERROR');

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const extension = mimeType.split('/')[1]?.replace('+xml', '') ?? 'jpg';
  return {
    name: `product.${extension}`,
    mimeType,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

async function waitForResults(page: Page): Promise<void> {
  // Wait for the click to reach the result page. Until then the page is still
  // showing the pre-search placeholder, and any "no cards" reading is
  // meaningless.
  try {
    await page.waitForURL(
      (url) => url.searchParams.get('tab') === RESULTS_TAB || isLoginUrl(url.toString()),
      { timeout: SEARCH_TIMEOUT_MS },
    );
  } catch {
    throw new ScanSearchError('PARSE_ERROR');
  }
  if (isLoginUrl(page.url())) throw new ScanSearchError('AUTH_REQUIRED');

  try {
    await page.waitForSelector(OFFER_CARD_SELECTOR, { timeout: SEARCH_TIMEOUT_MS });
    return;
  } catch {
    // No cards on the result page: distinguish the reasons instead of calling
    // everything "not signed in".
  }

  // A populated result page with no offers: a real zero-result search, counted
  // per product and never a reason to abort the scan.
  if ((await page.locator('[data-tracker="zero"]').count()) > 0) {
    throw new ScanSearchError('NO_RESULTS');
  }

  // An active slider / verification challenge: slow down, keep scanning.
  const challenge = await page
    .locator(
      '#nc_1_wrapper, .nc-container, iframe[src*="baxia"], iframe[src*="nocaptcha"], iframe[src*="punish"]',
    )
    .count();
  if (challenge > 0 || BLOCK_MARKERS.test(await page.content())) {
    throw new ScanSearchError('RATE_LIMITED');
  }

  throw new ScanSearchError('PARSE_ERROR');
}

function readOffer(card: Element): SixteenEightEightOffer | null {
  const offerId = readOfferId(card);
  const title = card.querySelector('[class*="offerTitle"]')?.textContent?.trim();
  const priceCNY = readPrice(card);
  const thumbnailUrl =
    card.querySelector('img[class*="mainImg"]')?.getAttribute('src')?.trim()
    ?? card.querySelector('img[src]')?.getAttribute('src')?.trim();

  if (!offerId || !title || priceCNY === null || !thumbnailUrl) return null;

  return {
    thumbnailUrl,
    title,
    priceCNY,
    moq: readMoq(card),
    // The image-search card exposes only a seller badge image, no shop name
    // and no rating; ticket 05 leaves both empty for the MVP.
    shopName: '',
    shopRating: 0,
    productUrl: `https://detail.1688.com/offer/${offerId}.html`,
  };
}

function readOfferId(card: Element): string | null {
  const fromRenderKey = card.getAttribute('data-renderkey')?.split('_').pop();
  if (fromRenderKey && /^\d+$/.test(fromRenderKey)) return fromRenderKey;

  const report = card.getAttribute('data-aplus-report') ?? '';
  return report.match(/object_id@(\d+)/)?.[1] ?? null;
}

function readPrice(card: Element): number | null {
  const priceWrap = card.querySelector('[class*="priceWrap"]');
  if (priceWrap) {
    const number = priceWrap.querySelector('[class*="number"]')?.textContent?.trim() ?? '';
    const unit = priceWrap.querySelector('[class*="unit"]')?.textContent?.trim() ?? '';
    const parsed = Number.parseFloat(`${number}${unit}`);
    if (Number.isFinite(parsed)) return parsed;
  }

  const fallback = (card.getAttribute('data-aplus-report') ?? '').match(/price@([\d.]+)/)?.[1];
  return fallback ? Number.parseFloat(fallback) : null;
}

function readMoq(card: Element): number {
  const text = card.querySelector('[class*="overseasBeginQuantityWrap"]')?.textContent ?? '';
  const match = text.match(/(\d+)/);
  return match?.[1] ? Number(match[1]) : 1;
}
