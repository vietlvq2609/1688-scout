// 1688 image search via UI automation.
//
// Drives the real image-search page in a scan context (the handed-off 1688
// session), uploads the product image downloaded from Shopee, waits for the
// result cards, and parses the top offers.
//
// Selectors come from a live result page: the card wrapper carries
// `data-tracker="offer"` (hashed class suffixes change between builds), the
// offer id is the last `_` segment of `data-renderkey`, and the ¥ price is
// `[class*="priceWrap"] [class*="number"]` + `[class*="unit"]`. The sibling
// `[class*="overseasPrice"]` is 1688's own ₫ approximation and is ignored.
import type { BrowserContext, Page } from 'playwright';
import { parseHTML } from 'linkedom';
import type { SixteenEightEightOffer } from '../../../src/core/types.js';
import { SIXTEEN_EIGHT_EIGHT_IMAGE_SEARCH_URL } from '../constants.js';
import { ScanSearchError } from '../errors.js';
import { isLoginUrl } from '../session.js';

const OFFER_CARD_SELECTOR = '[data-tracker="offer"]';
const MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 45_000;
const BLOCK_MARKERS = /nc_1_wrapper|baxia|punish|x5sec|滑动验证|验证码/i;

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

    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({ name: image.name, mimeType: image.mimeType, buffer: image.buffer });

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
  try {
    await page.waitForSelector(OFFER_CARD_SELECTOR, { timeout: SEARCH_TIMEOUT_MS });
  } catch {
    // No cards: either the session was rejected (verification slider) or the
    // image genuinely has no matches. Distinguish and let the caller decide.
    if (isLoginUrl(page.url()) || BLOCK_MARKERS.test(await page.content())) {
      throw new ScanSearchError('AUTH_REQUIRED');
    }
  }
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
