// External-behaviour tests for the 1688 image-search parser.
// Real result-card HTML captured from a live signed-in search; no browser,
// no network.
import { describe, expect, it } from 'vitest';
import { parseOffers } from '../src/sixteen-eight-eight/search.js';
import type { SixteenEightEightOffer } from '../../src/core/types.js';

interface CardOptions {
  renderKey?: string | null;
  title?: string;
  number?: string;
  unit?: string;
  moq?: number;
  img?: string;
  withPrice?: boolean;
  report?: string;
}

const DEFAULT_REPORT =
  'serverTrackId@abc^sp_expo_data@object_id@778567215311^price@358^object_type@offer';

function card(options: CardOptions = {}): string {
  const renderKey = options.renderKey === undefined ? '1_0_normal_b2b-2211613164233392b0_778567215311' : options.renderKey;
  const title = options.title ?? 'Soundcore Sound Wide Space One Roaming S1 Headset A3035';
  const number = options.number ?? '358';
  const unit = options.unit ?? '.0';
  const moq = options.moq ?? 1;
  const img = options.img ?? 'https://cbu01.alicdn.com/img/ibank/O1CN015EeYBJ_!!2211613164233-0-cib.jpg_460x460q100.jpg_.webp';
  const report = options.report ?? DEFAULT_REPORT;

  const priceBlock =
    options.withPrice === false
      ? ''
      : `<div class="priceCardWrap--orhlDz5d">
           <div class="priceWrap--pzZ2H9Gr">
             <span class="symbol--q4D0Qvt2">¥</span>
             <span class="number--LhFO51hh">${number}</span>
             <span class="unit--dbY5r9kc">${unit}</span>
           </div>
           <span class="overseasPrice--TUpKZka4"><span class="overseasPriceSymbol--YizQLtnJ">≈</span><span>₫1,443,769</span></span>
         </div>`;

  const renderKeyAttr = renderKey === null ? '' : ` data-renderkey="${renderKey}"`;

  return `<div${renderKeyAttr} data-index="0"
      class="searchOfferWrapper--St2OXxYo cardui-normal searchOfferItem--DhDmrkAF major-offer"
      data-tracker="offer" data-aplus-report="${report}">
    <div class="pictureWrap--p9JL8f_g">
      <img src="${img}" class="mainImg--fOXYkbMJ">
    </div>
    <div class="titleWrap--qtR_CDUH"><span class="offerTitle--QbH5NmTQ">${title}</span></div>
    ${priceBlock}
    <div class="overseasTagInfoWrap--rL5dy4Wb">
      <div class="overseasBeginQuantityWrap--qhGHRxR0">MOQ ${moq}</div>
    </div>
    <div class="overseasSellerInfoWrap--Ogg4pSJ1">
      <div class="overseasSellerWrap--L4zIo46S">
        <img src="https://gw.alicdn.com/imgextra/badge.png" alt="" class="overseasSellerIcon--WkZhQ3qb">
      </div>
    </div>
    <div class="offerHoverWrapper--TGvlnbUw">
      <div class="offerCpvCenter--AtJ30knv">
        <div class="titleWrap--qtR_CDUH"><span class="offerTitle--QbH5NmTQ">${title}</span></div>
        ${priceBlock}
      </div>
    </div>
  </div>`;
}

function page(cards: string): string {
  return `<!doctype html><html><body><div class="offerListContainer--HSE2rU5a">${cards}</div></body></html>`;
}

describe('parseOffers', () => {
  it('returns an empty array when there are no cards', () => {
    expect(parseOffers(page(''), 10)).toEqual([]);
  });

  it('reads offer id, title, ¥ price, MOQ, image and detail URL', () => {
    const offers = parseOffers(page(card()), 10);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toEqual<SixteenEightEightOffer>({
      thumbnailUrl:
        'https://cbu01.alicdn.com/img/ibank/O1CN015EeYBJ_!!2211613164233-0-cib.jpg_460x460q100.jpg_.webp',
      title: 'Soundcore Sound Wide Space One Roaming S1 Headset A3035',
      priceCNY: 358,
      moq: 1,
      shopName: '',
      shopRating: 0,
      productUrl: 'https://detail.1688.com/offer/778567215311.html',
    });
  });

  it('reads a decimal price split across number and unit spans', () => {
    const [offer] = parseOffers(page(card({ number: '12', unit: '.00' })), 10);
    expect(offer?.priceCNY).toBe(12);
  });

  it('ignores the overseas ₫ approximation next to the ¥ price', () => {
    const [offer] = parseOffers(page(card()), 10);
    expect(offer?.priceCNY).toBe(358);
    expect(offer?.priceCNY).not.toBe(1_443_769);
  });

  it('falls back to data-aplus-report for the offer id and the price', () => {
    const [offer] = parseOffers(
      page(card({ renderKey: null, withPrice: false, report: DEFAULT_REPORT })),
      10,
    );
    expect(offer?.productUrl).toBe('https://detail.1688.com/offer/778567215311.html');
    expect(offer?.priceCNY).toBe(358);
  });

  it('skips a card with no title', () => {
    expect(parseOffers(page(card({ title: '' })), 10)).toEqual([]);
  });

  it('skips a card with no price at all', () => {
    expect(
      parseOffers(page(card({ withPrice: false, report: 'object_id@778567215311' })), 10),
    ).toEqual([]);
  });

  it('keeps at most `limit` offers', () => {
    const html = page(card() + card() + card());
    expect(parseOffers(html, 2)).toHaveLength(2);
  });
});
