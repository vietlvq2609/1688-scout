// Shopee category extraction.
//
// Two layers: `parseShopeeProducts` is pure (HTML string in, products out,
// tested against a real card fixture), and `extractProducts` drives Playwright
// to paginate and scroll the category, then hands the rendered HTML to it.
//
// Selectors are grounded in the live card observed on 2026-xx: the card is
// `li[data-sqe="item"]`, the title carries `line-clamp-2`, the price sits in a
// `text-shopee-primary font-medium` container whose text includes `₫` (the
// discount badge shares those classes but has no `₫`, so it is skipped), and
// the main image is the first `img` in the card.
import type { Page } from 'playwright';
import { parseHTML } from 'linkedom';
import type { ShopeeCategoryProduct } from '../../../src/core/types.js';

export const SHOPEE_CARD_SELECTOR = 'li[data-sqe="item"], [data-testid="item-card"]';

const SHOPEE_ORIGIN = 'https://shopee.vn';
const NAV_TIMEOUT_MS = 45_000;
const SCROLL_STEP_PX = 600;
const MAX_SCROLL_STEPS = 40;

export interface ExtractProductsConfig {
  maxPages: number;
  maxProductsPerPage: number;
}

/** Parse one rendered Shopee category page, keeping at most `limit` products. */
export function parseShopeeProducts(html: string, limit: number): ShopeeCategoryProduct[] {
  const { document } = parseHTML(html);
  const cards = [...document.querySelectorAll(SHOPEE_CARD_SELECTOR)];
  const products: ShopeeCategoryProduct[] = [];

  for (const card of cards) {
    if (products.length >= limit) break;
    const product = readCard(card);
    if (product) {
      products.push(product);
    } else {
      console.warn('[1688-scout-helper] bo qua the Shopee khong doc duoc');
    }
  }

  return products;
}

/**
 * Walk up to `config.maxPages` (1-based `page` param) Shopee category pages,
 * scrolling each to force lazy images, and return up to
 * `maxPages × maxProductsPerPage` unique products.
 */
export async function extractProducts(
  page: Page,
  categoryUrl: string,
  config: ExtractProductsConfig,
): Promise<ShopeeCategoryProduct[]> {
  const limit = config.maxPages * config.maxProductsPerPage;
  const products: ShopeeCategoryProduct[] = [];
  const seen = new Set<string>();

  for (let pageNumber = 1; pageNumber <= config.maxPages; pageNumber += 1) {
    await page.goto(withPageParam(categoryUrl, pageNumber), {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });

    if (!(await waitForCards(page))) break;
    await autoScroll(page);

    const pageProducts = parseShopeeProducts(await page.content(), config.maxProductsPerPage);
    let added = 0;
    for (const product of pageProducts) {
      if (seen.has(product.productUrl)) continue;
      seen.add(product.productUrl);
      products.push(product);
      added += 1;
      if (products.length >= limit) return products;
    }

    // A page with only duplicates means pagination has run out.
    if (added === 0) break;
  }

  return products;
}

function withPageParam(categoryUrl: string, pageNumber: number): string {
  const url = new URL(categoryUrl);
  if (pageNumber === 1) return url.toString();
  url.searchParams.set('page', String(pageNumber));
  return url.toString();
}

async function waitForCards(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(SHOPEE_CARD_SELECTOR, { timeout: NAV_TIMEOUT_MS });
    return true;
  } catch {
    console.warn('[1688-scout-helper] khong tim thay the san pham Shopee');
    return false;
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(
    async ({ step, maxSteps }: { step: number; maxSteps: number }) => {
      await new Promise<void>((resolve) => {
        let distance = 0;
        let steps = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          distance += step;
          steps += 1;
          if (distance >= document.body.scrollHeight || steps >= maxSteps) {
            clearInterval(timer);
            resolve();
          }
        }, 120);
      });
    },
    { step: SCROLL_STEP_PX, maxSteps: MAX_SCROLL_STEPS },
  );
  await page.waitForTimeout(700);
}

function readCard(card: Element): ShopeeCategoryProduct | null {
  const title = readTitle(card);
  const imageUrl = readImage(card);
  const priceVND = readPrice(card);
  const href = card.querySelector('a[href]')?.getAttribute('href');

  if (!title || !imageUrl || priceVND === null || !href) return null;

  return {
    title,
    imageUrl,
    priceVND,
    productUrl: new URL(href, SHOPEE_ORIGIN).toString(),
  };
}

function readTitle(card: Element): string | null {
  const title = card.querySelector('[class*="line-clamp-2"]')?.textContent?.trim();
  if (title) return title;

  const label = card.querySelector('[aria-label^="Product card"]')?.getAttribute('aria-label');
  return label ? label.replace(/^Product card:\s*/i, '').trim() : null;
}

function readImage(card: Element): string | null {
  const img = card.querySelector('img');
  const src = img?.getAttribute('src')?.trim();
  if (src) return src;

  const srcset =
    card.querySelector('source[srcset]')?.getAttribute('srcset') ?? img?.getAttribute('srcset');
  return firstSrcsetUrl(srcset);
}

function firstSrcsetUrl(srcset: string | null | undefined): string | null {
  if (!srcset) return null;
  const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function readPrice(card: Element): number | null {
  // Both the price and the discount badge use `text-shopee-primary font-medium`;
  // only the price carries the currency symbol.
  const candidates = [
    ...card.querySelectorAll('[class*="text-shopee-primary"][class*="font-medium"]'),
  ];
  const priceElement = candidates.find((element) => (element.textContent ?? '').includes('₫'));
  return priceElement ? parseVnd(priceElement.textContent) : null;
}

/** Parse a Vietnamese VND string ("₫159.000", "1.234.567 ₫") to a number. */
export function parseVnd(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/\u00a0/g, ' ').match(/(\d[\d.,]*)/);
  const raw = match?.[1];
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits === '' ? null : Number(digits);
}
