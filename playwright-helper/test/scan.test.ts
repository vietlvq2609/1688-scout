// External-behaviour tests for scan orchestration and the CSV.
// The scrapers and the browser context are injected fakes: no browser, no
// network.
import { describe, expect, it } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { CSV_HEADERS, ScanOrchestrator, buildCsv } from '../src/scan/orchestrator.js';
import type { CsvRow, ScanDependencies, ScanService } from '../src/scan/orchestrator.js';
import { ScanSearchError } from '../src/errors.js';
import type {
  ScanConfig,
  ShopeeCategoryProduct,
  SiteCookies,
  SixteenEightEightOffer,
} from '../../src/core/types.js';

const CONFIG: ScanConfig = {
  maxPages: 1,
  maxProductsPerPage: 30,
  cnyVndRate: 3500,
  markupMultiplier: 3,
};
const COOKIES: SiteCookies = { shopee: [], sixteenEightEight: [] };

function product(overrides: Partial<ShopeeCategoryProduct> = {}): ShopeeCategoryProduct {
  return {
    title: 'Áo thun',
    imageUrl: 'https://img.example/1',
    priceVND: 1_000_000,
    productUrl: 'https://shopee.vn/i.1',
    ...overrides,
  };
}

function offer(overrides: Partial<SixteenEightEightOffer> = {}): SixteenEightEightOffer {
  return {
    thumbnailUrl: 'https://1688.example/img.jpg',
    title: '1688 offer',
    priceCNY: 10,
    moq: 1,
    shopName: '',
    shopRating: 0,
    productUrl: 'https://detail.1688.com/offer/1.html',
    ...overrides,
  };
}

function fakeContext(): BrowserContext {
  const page = { close: async () => {} } as unknown as Page;
  return {
    newPage: async () => page,
    close: async () => {},
  } as unknown as BrowserContext;
}

function dependencies(overrides: Partial<ScanDependencies> = {}): ScanDependencies {
  return {
    createScanContext: async () => fakeContext(),
    extractProducts: async () => [],
    search1688: async () => [],
    ...overrides,
  };
}

async function waitForSettled(service: ScanService, scanId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const progress = service.progress(scanId);
    if (progress && progress.status !== 'running') return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('scan did not settle');
}

async function runScan(
  products: ShopeeCategoryProduct[],
  search: ScanDependencies['search1688'],
): Promise<{ service: ScanService; scanId: string }> {
  const service = new ScanOrchestrator(
    dependencies({ extractProducts: async () => products, search1688: search }),
  );
  const { scanId } = service.start({
    categoryUrl: 'https://shopee.vn/cat',
    config: CONFIG,
    cookies: COOKIES,
  });
  await waitForSettled(service, scanId);
  return { service, scanId };
}

describe('buildCsv', () => {
  const row: CsvRow = {
    shopeeTitle: 'Áo, đẹp',
    shopeePriceVND: 1_000_000,
    shopeeUrl: 'https://shopee.vn/i.1',
    title1688: 'Offer "x"',
    priceCNY: 12.5,
    url1688: 'https://detail.1688.com/offer/1.html',
    landedCostVND: 131_250,
    shopName: '',
    shopRating: 0,
    moq: 1,
  };

  it('writes the exact header line, in SPEC order', () => {
    expect(buildCsv([]).split('\r\n')[0]).toBe(CSV_HEADERS.join(','));
    expect(CSV_HEADERS.join(',')).toBe(
      'STT,Shopee Title,Shopee Price (₫),Shopee URL,1688 Title,1688 Price (¥),1688 URL,Landed Cost (₫),Match,Shop Name,Shop Rating,MOQ',
    );
  });

  it('quotes cells containing commas and quotes', () => {
    const csv = buildCsv([row]);
    expect(csv).toContain('"Áo, đẹp"');
    expect(csv).toContain('"Offer ""x"""');
  });

  it('writes plain integer VND and a trimmed ¥ price', () => {
    const csv = buildCsv([row]);
    expect(csv).toContain(',1000000,');
    expect(csv).toContain(',12.5,');
    expect(csv).toContain(',131250,');
  });
});

describe('ScanOrchestrator', () => {
  it('keeps only offers whose landed cost beats the Shopee price', async () => {
    const { service, scanId } = await runScan(
      [product({ imageUrl: 'match' }), product({ imageUrl: 'no-match', title: 'B' })],
      async (_context, imageUrl) =>
        imageUrl === 'match' ? [offer({ priceCNY: 10 })] : [offer({ priceCNY: 200 })],
    );

    const progress = service.progress(scanId);
    expect(progress?.status).toBe('completed');
    expect(progress?.completed).toBe(2);
    expect(progress?.total).toBe(2);

    const result = service.result(scanId);
    expect(result?.matches).toBe(1);
    expect(result?.totalScanned).toBe(2);

    const csv = Buffer.from(result?.csvBase64 ?? '', 'base64').toString('utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('https://detail.1688.com/offer/1.html');
    expect(csv).toContain('Landed Cost (₫)');
  });

  it('aborts the scan on AUTH_REQUIRED and keeps the partial CSV', async () => {
    const { service, scanId } = await runScan(
      [product({ imageUrl: 'ok' }), product({ imageUrl: 'dead', title: 'Dead' })],
      async (_context, imageUrl) => {
        if (imageUrl === 'dead') throw new ScanSearchError('AUTH_REQUIRED');
        return [offer({ priceCNY: 10 })];
      },
    );

    const progress = service.progress(scanId);
    expect(progress?.status).toBe('error');
    expect(progress?.error?.type).toBe('AUTH_REQUIRED');
    expect(service.result(scanId)?.matches).toBeGreaterThanOrEqual(1);
  });

  it('counts a failed search and keeps scanning', async () => {
    const { service, scanId } = await runScan(
      [product({ imageUrl: 'fail' }), product({ imageUrl: 'ok', title: 'B' })],
      async (_context, imageUrl) => {
        if (imageUrl === 'fail') throw new Error('boom');
        return [offer({ priceCNY: 10 })];
      },
    );

    const progress = service.progress(scanId);
    expect(progress?.status).toBe('completed');
    expect(progress?.errors).toBe(1);
    expect(service.result(scanId)?.matches).toBe(1);
  });

  it('treats an offer with no match as no row', async () => {
    const { service, scanId } = await runScan([product()], async () => []);
    expect(service.progress(scanId)?.status).toBe('completed');
    expect(service.result(scanId)?.matches).toBe(0);
  });

  it('stops a running scan and keeps the partial result', async () => {
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = new ScanOrchestrator(
      dependencies({
        extractProducts: async () => [product({ imageUrl: 'slow' })],
        search1688: async () => {
          await gate;
          return [offer({ priceCNY: 10 })];
        },
      }),
    );
    const { scanId } = service.start({
      categoryUrl: 'https://shopee.vn/cat',
      config: CONFIG,
      cookies: COOKIES,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(service.stop(scanId)).toBe(true);
    release();
    await waitForSettled(service, scanId);

    expect(service.progress(scanId)?.status).toBe('stopped');
    expect(service.result(scanId)).not.toBeNull();
  });

  it('reports null for an unknown scan', () => {
    const service = new ScanOrchestrator(dependencies());
    expect(service.progress('missing')).toBeNull();
    expect(service.result('missing')).toBeNull();
    expect(service.stop('missing')).toBe(false);
  });
});
