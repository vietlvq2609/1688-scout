// External-behaviour tests for the helper HTTP server.
// The app is started on an ephemeral port (listen(0)) and driven with global
// fetch. The 1688 session checker is a fake injected through createApp, so no
// real browser is launched and no external network is touched.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { ChromeCookie, ScanProgress, ScanResult, SiteCookies } from '../../src/core/types.js';
import type { ScanService } from '../src/scan/orchestrator.js';

process.env.HELPER_PORT = '3001';

const { createApp } = await import('../src/server.js');

const checkSignedIn = vi.fn(async () => true);

const scanService: ScanService = {
  start: vi.fn(() => ({ scanId: 'scan-1', status: 'started' as const })),
  progress: vi.fn(),
  result: vi.fn(),
  stop: vi.fn(() => true),
};

let app: Express;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  app = createApp({ checkSignedIn, scanService });
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  checkSignedIn.mockReset();
  checkSignedIn.mockResolvedValue(true);
  vi.mocked(scanService.start).mockReturnValue({ scanId: 'scan-1', status: 'started' });
  vi.mocked(scanService.start).mockClear();
  vi.mocked(scanService.progress).mockReturnValue({
    scanId: 'scan-1',
    completed: 1,
    total: 2,
    currentTitle: 'Áo',
    status: 'running',
    errors: 0,
  });
  vi.mocked(scanService.result).mockReturnValue({
    scanId: 'scan-1',
    csvBase64: 'abc',
    matches: 1,
    totalScanned: 2,
    errors: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
  });
  vi.mocked(scanService.stop).mockReturnValue(true);
});

describe('GET /api/status', () => {
  it('returns the documented liveness JSON, with no session state', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({
      running: true,
      port: 3001,
      version: '1.0.0',
    });
  });
});

describe('POST /api/session-check', () => {
  const jar: ChromeCookie[] = [
    {
      name: '_m_h5_tk',
      value: 'token',
      domain: '.1688.com',
      path: '/',
      secure: true,
      httpOnly: true,
    },
  ];

  async function postSessionCheck(payload: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/session-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  it('reports signedIn true for a live jar', async () => {
    const res = await postSessionCheck({ cookies: jar });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(res.json()).resolves.toEqual({ signedIn: true });
    expect(checkSignedIn).toHaveBeenCalledWith(jar);
  });

  it('reports signedIn false for a dead jar', async () => {
    checkSignedIn.mockResolvedValue(false);
    const res = await postSessionCheck({ cookies: jar });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ signedIn: false });
  });

  it('rejects a body with no cookies array as a client error', async () => {
    const res = await postSessionCheck({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(checkSignedIn).not.toHaveBeenCalled();
  });

  it('rejects a non-array cookies value as a client error', async () => {
    const res = await postSessionCheck({ cookies: 'not-an-array' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(checkSignedIn).not.toHaveBeenCalled();
  });

  it('returns a generic JSON error when the session check itself fails', async () => {
    checkSignedIn.mockRejectedValue(new Error('boom'));
    const res = await postSessionCheck({ cookies: jar });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.message).toBe('string');
    expect(JSON.stringify(body)).not.toContain('boom');
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 error object, never HTML', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.message).toBe('string');
  });
});

describe('error handler', () => {
  it('returns a JSON error (no stack trace) when a request body exceeds the 10MB limit', async () => {
    const oversized = 'x'.repeat(11 * 1024 * 1024);
    const res = await fetch(`${baseUrl}/api/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: oversized }),
    });
    expect(res.status).toBe(413);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.message).toBe('string');
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});

describe('CORS', () => {
  it('allows cross-origin requests from the extension', async () => {
    const origin = `chrome-extension://${'a'.repeat(32)}`;
    const res = await fetch(`${baseUrl}/api/status`, { headers: { origin } });
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('does not expose the helper to an arbitrary website origin', async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      headers: { origin: 'https://evil.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('scan routes', () => {
  const validBody = {
    categoryUrl: 'https://shopee.vn/Thoi-Trang-Nam-cat.11035567',
    config: { maxPages: 3, maxProductsPerPage: 30, cnyVndRate: 3500, markupMultiplier: 3 },
    cookies: { shopee: [], sixteenEightEight: [] } satisfies SiteCookies,
  };

  function postScan(payload: unknown): Promise<Response> {
    return fetch(`${baseUrl}/api/scan-category`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  it('starts a scan and returns 202 with the scan id', async () => {
    const res = await postScan(validBody);
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ scanId: 'scan-1', status: 'started' });
    expect(scanService.start).toHaveBeenCalledWith({
      categoryUrl: validBody.categoryUrl,
      config: validBody.config,
      cookies: validBody.cookies,
    });
  });

  it.each([
    ['a missing categoryUrl', { ...validBody, categoryUrl: undefined }],
    ['a non-numeric config', { ...validBody, config: { maxPages: '3' } }],
    ['cookies without the 1688 jar', { ...validBody, cookies: { shopee: [] } }],
  ])('rejects %s with 400', async (_label, payload) => {
    const res = await postScan(payload);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(scanService.start).not.toHaveBeenCalled();
  });

  it('returns progress for a known scan', async () => {
    const res = await fetch(`${baseUrl}/api/scan/scan-1/progress`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ScanProgress;
    expect(body.status).toBe('running');
    expect(body.completed).toBe(1);
    expect(scanService.progress).toHaveBeenCalledWith('scan-1');
  });

  it('returns 404 for an unknown scan', async () => {
    vi.mocked(scanService.progress).mockReturnValue(null);
    const res = await fetch(`${baseUrl}/api/scan/nope/progress`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns the CSV result for a known scan', async () => {
    const res = await fetch(`${baseUrl}/api/scan/scan-1/result`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ScanResult;
    expect(body.csvBase64).toBe('abc');
    expect(body.matches).toBe(1);
  });

  it('stops a running scan', async () => {
    const res = await fetch(`${baseUrl}/api/scan/scan-1/stop`, { method: 'POST' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'stopped' });
    expect(scanService.stop).toHaveBeenCalledWith('scan-1');
  });

  it('returns 404 when stopping an unknown scan', async () => {
    vi.mocked(scanService.stop).mockReturnValue(false);
    const res = await fetch(`${baseUrl}/api/scan/nope/stop`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
