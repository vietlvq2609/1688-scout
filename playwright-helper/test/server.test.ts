// External-behaviour tests for the helper HTTP server.
// The app is started on an ephemeral port (listen(0)) and driven with global
// fetch. The 1688 session checker is a fake injected through createApp, so no
// real browser is launched and no external network is touched.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { ChromeCookie } from '../../src/core/types.js';

process.env.HELPER_PORT = '3001';

const { createApp } = await import('../src/server.js');

const checkSignedIn = vi.fn(async () => true);

let app: Express;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  app = createApp({ checkSignedIn });
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
