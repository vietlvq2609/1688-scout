// Scan routes: POST /api/scan-category, GET progress/result, POST stop.
// The ScanService is injected so route tests stay browser-free.
import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ScanConfig, SiteCookies } from '../../../src/core/types.js';
import { httpErrorPayload } from '../constants.js';
import type { ScanService } from '../scan/orchestrator.js';

export function createScanRouter(service: ScanService): Router {
  const router = Router();

  const start: RequestHandler = (req, res) => {
    const body = req.body as
      | { categoryUrl?: unknown; config?: unknown; cookies?: unknown }
      | undefined;

    if (
      typeof body?.categoryUrl !== 'string'
      || body.categoryUrl === ''
      || !isScanConfig(body.config)
      || !isSiteCookies(body.cookies)
    ) {
      res.status(400).json(httpErrorPayload('INVALID_REQUEST', 'Yêu cầu quét không hợp lệ'));
      return;
    }

    const { scanId, status } = service.start({
      categoryUrl: body.categoryUrl,
      config: body.config,
      cookies: body.cookies,
    });
    res.status(202).json({ scanId, status });
  };

  const progress: RequestHandler = (req, res) => {
    const scanId = readScanId(req.params.id);
    const value = scanId ? service.progress(scanId) : null;
    if (!value) {
      res.status(404).json(httpErrorPayload('NOT_FOUND', 'Không tìm thấy lượt quét'));
      return;
    }
    res.json(value);
  };

  const result: RequestHandler = (req, res) => {
    const scanId = readScanId(req.params.id);
    const value = scanId ? service.result(scanId) : null;
    if (!value) {
      res.status(404).json(httpErrorPayload('NOT_FOUND', 'Không tìm thấy lượt quét'));
      return;
    }
    res.json(value);
  };

  const stop: RequestHandler = (req, res) => {
    const scanId = readScanId(req.params.id);
    if (!scanId || !service.stop(scanId)) {
      res.status(404).json(httpErrorPayload('NOT_FOUND', 'Không tìm thấy lượt quét'));
      return;
    }
    res.json({ status: 'stopped' });
  };

  router.post('/api/scan-category', start);
  router.get('/api/scan/:id/progress', progress);
  router.get('/api/scan/:id/result', result);
  router.post('/api/scan/:id/stop', stop);

  return router;
}

function readScanId(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isScanConfig(value: unknown): value is ScanConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;
  return ['maxPages', 'maxProductsPerPage', 'cnyVndRate', 'markupMultiplier'].every(
    (key) => typeof config[key] === 'number' && Number.isFinite(config[key]),
  );
}

function isSiteCookies(value: unknown): value is SiteCookies {
  if (typeof value !== 'object' || value === null) return false;
  const cookies = value as Record<string, unknown>;
  return Array.isArray(cookies.shopee) && Array.isArray(cookies.sixteenEightEight);
}
