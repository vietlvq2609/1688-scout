// External-behaviour tests for the Shopee parser.
// Real card HTML captured from a live category page; no browser, no network.
import { describe, expect, it } from 'vitest';
import { parseShopeeProducts, parseVnd } from '../src/shopee/extractor.js';
import type { ShopeeCategoryProduct } from '../../src/core/types.js';

interface CardOptions {
  title?: string;
  /** Digits only, e.g. "159.000" or a range "159.000 - 299.000". */
  price?: string;
  href?: string;
  img?: string;
  withPrice?: boolean;
}

function card(options: CardOptions = {}): string {
  const title = options.title ?? 'Áo ba lỗ thun gân vải dày,form body tôn dáng(Mã 01)';
  const price = options.price ?? '159.000';
  const href = options.href ?? '/Áo-ba-lỗ-i.83496725.6939920023?extraParams=%7B%22x%22%3A1%7D';
  const img = options.img ?? 'https://down-vn.img.susercontent.com/file/2c1ca03f5dc42f316fdfaa1d5d327f95';
  const priceBlock =
    options.withPrice === false
      ? ''
      : `<div class="max-w-full flex-grow-1 flex-shrink-0 mr-[2px] truncate text-shopee-primary flex items-center font-medium">
           <span data-testid="a11y-label" aria-label="promotion price"></span>
           <div class="truncate flex items-baseline">
             <span class="font-medium mr-px text-xs/sp14">₫</span>
             <span class="truncate">${price}</span>
           </div>
         </div>`;

  return `<li class="col-xs-2-4 shopee-search-item-result__item" data-sqe="item">
    <div role="group" aria-label="Product card: ${title}" style="height: 100%;">
      <div class="shopee_ic" style="display: contents;">
        <div role="group" aria-label="Product card">
          <a class="contents" href="${href}">
            <div class="flex flex-col cursor-pointer h-full overflow-hidden bg-white">
              <div class="w-full relative z-0" style="padding-top: 100%;">
                <picture class="_displayContents_yazkc_21">
                  <source srcset="${img}@resize_w320_nl.webp 1x, ${img}@resize_w640_nl.webp 2x" type="image/webp">
                  <img width="320" loading="lazy" alt="${title}" src="${img}">
                </picture>
                <div class="text-shopee-primary font-medium bg-shopee-pink absolute">-50%</div>
              </div>
              <div class="p-2 flex-1 flex flex-col justify-between">
                <div class="whitespace-normal line-clamp-2 break-words">${title}</div>
                ${priceBlock}
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  </li>`;
}

function page(cards: string): string {
  return `<!doctype html><html><body><ul>${cards}</ul></body></html>`;
}

describe('parseVnd', () => {
  it.each([
    ['₫159.000', 159_000],
    ['₫1.234.567', 1_234_567],
    ['1.234.567 ₫', 1_234_567],
    ['159000', 159_000],
    ['₫159.000 - ₫299.000', 159_000],
  ])('parses %s', (text, expected) => {
    expect(parseVnd(text)).toBe(expected);
  });

  it.each([['', null], [null, null], ['₫', null], ['không có giá', null]])(
    'returns null for %s',
    (text, expected) => {
      expect(parseVnd(text)).toBe(expected);
    },
  );
});

describe('parseShopeeProducts', () => {
  it('returns an empty array when there are no cards', () => {
    expect(parseShopeeProducts(page(''), 30)).toEqual([]);
  });

  it('reads title, price, image and absolute product URL from a card', () => {
    const products = parseShopeeProducts(page(card()), 30);
    expect(products).toHaveLength(1);
    expect(products[0]).toEqual<ShopeeCategoryProduct>({
      title: 'Áo ba lỗ thun gân vải dày,form body tôn dáng(Mã 01)',
      imageUrl: 'https://down-vn.img.susercontent.com/file/2c1ca03f5dc42f316fdfaa1d5d327f95',
      priceVND: 159_000,
      productUrl:
        'https://shopee.vn/%C3%81o-ba-l%E1%BB%97-i.83496725.6939920023?extraParams=%7B%22x%22%3A1%7D',
    });
  });

  it('ignores the discount badge and reads the real price', () => {
    const [product] = parseShopeeProducts(page(card({ price: '159.000' })), 30);
    expect(product?.priceVND).toBe(159_000);
  });

  it('takes the lower bound of a price range', () => {
    const [product] = parseShopeeProducts(page(card({ price: '159.000 - 299.000' })), 30);
    expect(product?.priceVND).toBe(159_000);
  });

  it('skips a card with no price', () => {
    expect(parseShopeeProducts(page(card({ withPrice: false })), 30)).toEqual([]);
  });

  it('keeps at most `limit` products', () => {
    const html = page(card() + card({ href: '/b-i.1.2', title: 'B' }) + card({ href: '/c-i.3.4', title: 'C' }));
    expect(parseShopeeProducts(html, 2)).toHaveLength(2);
  });
});
