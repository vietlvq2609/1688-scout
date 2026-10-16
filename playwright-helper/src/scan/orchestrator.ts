// Scan orchestration + CSV.
//
// `ScanOrchestrator` owns the lifecycle in an in-memory Map keyed by scanId:
// start() spawns run() in the background, progress()/result() read the record,
// and stop() aborts it. The two scrapers arrive through ScanDependencies, so
// the whole state machine is tested with fakes and no browser.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from 'playwright';
import { ERROR_MESSAGES } from '../../../src/core/errors.js';
import type {
  ChromeCookie,
  ScanConfig,
  ScanProgress,
  ScanResult,
  SearchError,
  ShopeeCategoryProduct,
  SiteCookies,
  SixteenEightEightOffer,
} from '../../../src/core/types.js';
import { createScanContext } from '../browser.js';
import { PARALLEL_CONTEXTS, SCAN_TIMEOUT_MS } from '../constants.js';
import { ScanSearchError } from '../errors.js';
import { extractProducts } from '../shopee/extractor.js';
import { search1688 } from '../sixteen-eight-eight/search.js';

export interface ScanDependencies {
  createScanContext(cookies: ChromeCookie[]): Promise<BrowserContext>;
  extractProducts(
    page: Page,
    categoryUrl: string,
    config: ScanConfig,
  ): Promise<ShopeeCategoryProduct[]>;
  search1688(context: BrowserContext, imageUrl: string): Promise<SixteenEightEightOffer[]>;
}

const DEFAULT_DEPENDENCIES: ScanDependencies = {
  createScanContext,
  extractProducts,
  search1688,
};

export interface ScanStartParams {
  categoryUrl: string;
  config: ScanConfig;
  cookies: SiteCookies;
}

/** One matched row, exactly the columns of the CSV. */
export interface CsvRow {
  shopeeTitle: string;
  shopeePriceVND: number;
  shopeeUrl: string;
  title1688: string;
  priceCNY: number;
  url1688: string;
  landedCostVND: number;
  shopName: string;
  shopRating: number;
  moq: number;
}

/** The scan lifecycle as the HTTP routes see it. */
export interface ScanService {
  start(params: ScanStartParams): { scanId: string; status: 'started' };
  progress(scanId: string): ScanProgress | null;
  result(scanId: string): ScanResult | null;
  stop(scanId: string): boolean;
}

interface ScanRecord {
  scanId: string;
  categoryUrl: string;
  config: ScanConfig;
  status: "running" | "completed" | "error" | "stopped";
  completed: number;
  total: number;
  currentTitle: string;
  errors: number;
  rows: CsvRow[];
  error: SearchError | null;
  startedAt: string;
  completedAt: string | null;
  controller: AbortController;
}

export const CSV_HEADERS = [
  'STT',
  'Shopee Title',
  'Shopee Price (₫)',
  'Shopee URL',
  '1688 Title',
  '1688 Price (¥)',
  '1688 URL',
  'Landed Cost (₫)',
  'Match',
  'Shop Name',
  'Shop Rating',
  'MOQ',
] as const;

export class ScanOrchestrator implements ScanService {
  private readonly scans = new Map<string, ScanRecord>();

  constructor(private readonly dependencies: ScanDependencies = DEFAULT_DEPENDENCIES) {}

  start(params: ScanStartParams): { scanId: string; status: 'started' } {
    const scanId = randomUUID();
    const record: ScanRecord = {
      scanId,
      categoryUrl: params.categoryUrl,
      config: params.config,
      status: 'running',
      completed: 0,
      total: 0,
      currentTitle: '',
      errors: 0,
      rows: [],
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      controller: new AbortController(),
    };
    this.scans.set(scanId, record);

    void this.run(record, params).catch((error: unknown) => {
      record.error = toSearchError(error);
      record.status = 'error';
      record.completedAt = new Date().toISOString();
    });

    return { scanId, status: 'started' };
  }

  progress(scanId: string): ScanProgress | null {
    const record = this.scans.get(scanId);
    if (!record) return null;
    return {
      scanId,
      completed: record.completed,
      total: record.total,
      currentTitle: record.currentTitle,
      status: record.status,
      errors: record.errors,
      ...(record.error ? { error: record.error } : {}),
    };
  }

  result(scanId: string): ScanResult | null {
    const record = this.scans.get(scanId);
    if (!record) return null;
    return {
      scanId,
      csvBase64: Buffer.from(`\uFEFF${buildCsv(record.rows)}`, 'utf8').toString('base64'),
      matches: record.rows.length,
      totalScanned: record.completed,
      errors: record.errors,
      startedAt: record.startedAt,
      completedAt: record.completedAt ?? new Date().toISOString(),
    };
  }

  stop(scanId: string): boolean {
    const record = this.scans.get(scanId);
    if (!record || record.status !== 'running') return false;
    record.controller.abort();
    return true;
  }

  private async run(record: ScanRecord, params: ScanStartParams): Promise<void> {
    const timeout = setTimeout(() => record.controller.abort(), SCAN_TIMEOUT_MS);
    const context = await this.dependencies.createScanContext([
      ...params.cookies.shopee,
      ...params.cookies.sixteenEightEight,
    ]);

    try {
      const page = await context.newPage();
      let products: ShopeeCategoryProduct[];
      try {
        products = await this.dependencies.extractProducts(page, params.categoryUrl, params.config);
      } finally {
        await page.close();
      }
      record.total = products.length;

      await runWithConcurrency(
        products,
        PARALLEL_CONTEXTS,
        record.controller.signal,
        (product) => this.searchProduct(record, context, product),
      );

      record.status = record.error
        ? 'error'
        : record.controller.signal.aborted
          ? 'stopped'
          : 'completed';
    } catch (error) {
      record.error = toSearchError(error);
      record.status = 'error';
    } finally {
      clearTimeout(timeout);
      await context.close().catch(() => {});
      record.completedAt = new Date().toISOString();
    }
  }

  private async searchProduct(
    record: ScanRecord,
    context: BrowserContext,
    product: ShopeeCategoryProduct,
  ): Promise<void> {
    record.currentTitle = product.title;
    try {
      const offers = await this.dependencies.search1688(context, product.imageUrl);
      const best = offers[0];
      if (!best) return;

      const landedCostVND =
        best.priceCNY * record.config.cnyVndRate * record.config.markupMultiplier;
      if (landedCostVND < product.priceVND) {
        record.rows.push({
          shopeeTitle: product.title,
          shopeePriceVND: product.priceVND,
          shopeeUrl: product.productUrl,
          title1688: best.title,
          priceCNY: best.priceCNY,
          url1688: best.productUrl,
          landedCostVND,
          shopName: best.shopName,
          shopRating: best.shopRating,
          moq: best.moq,
        });
      }
    } catch (error) {
      if (error instanceof ScanSearchError && error.type === 'AUTH_REQUIRED') {
        // The handed-off session died; stop hammering 1688 and keep the partial CSV.
        record.error = { type: 'AUTH_REQUIRED', message: error.message };
        record.controller.abort();
        return;
      }
      record.errors += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[1688-scout-helper] loi khi tim 1688 cho "${product.title}": ${reason}`);
    } finally {
      record.completed += 1;
    }
  }
}

/** Build the CSV string (no BOM — the caller adds it). */
export function buildCsv(rows: CsvRow[]): string {
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  rows.forEach((row, index) => {
    lines.push(
      [
        index + 1,
        row.shopeeTitle,
        Math.round(row.shopeePriceVND),
        row.shopeeUrl,
        row.title1688,
        formatCny(row.priceCNY),
        row.url1688,
        Math.round(row.landedCostVND),
        '✓',
        row.shopName,
        row.shopRating,
        row.moq,
      ]
        .map(csvCell)
        .join(','),
    );
  });
  return `${lines.join('\r\n')}\r\n`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCny(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '');
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  signal: AbortSignal,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length && !signal.aborted) {
      const item = items[index];
      index += 1;
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function toSearchError(error: unknown): SearchError {
  if (error instanceof ScanSearchError) {
    return { type: error.type, message: error.message };
  }
  return { type: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR };
}
