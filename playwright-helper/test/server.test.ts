// External-behaviour tests for the helper HTTP server.
// The app is started on an ephemeral port (listen(0)) and driven with global
// fetch. No real browser is launched and no external network is touched.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { mkdtempSync } from 'node:fs';

// HELPER_AUTH_FILE must be set before src/constants.js is evaluated, so the
// temp auth dir is created and the env prepared before the dynamic import.
const tempDir = mkdtempSync(path.join(tmpdir(), '1688-scout-helper-'));
process.env.HELPER_AUTH_FILE = path.join(tempDir, '1688-auth.json');
process.env.HELPER_PORT = '3001';

const { createApp } = await import('../src/server.js');

let app: Express;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  app = createApp();
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  server.close();
  await rm(tempDir, { recursive: true, force: true });
});

describe('GET /api/status', () => {
  it('returns the documented status JSON with loggedIn false when no auth file exists', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({
      running: true,
      loggedIn: false,
      port: 3001,
      version: '1.0.0',
    });
  });

  it('reports loggedIn true when a valid auth file exists at HELPER_AUTH_FILE', async () => {
    const file = path.join(tempDir, '1688-auth.json');
    await writeFile(file, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      running: true,
      loggedIn: true,
      port: 3001,
      version: '1.0.0',
    });
    await unlink(file);
  });

  it('reports loggedIn false when the auth file is corrupt JSON', async () => {
    const file = path.join(tempDir, '1688-auth.json');
    await writeFile(file, 'not json{{{', 'utf8');
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.loggedIn).toBe(false);
    await unlink(file);
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
    const res = await fetch(`${baseUrl}/api/status`, {
      headers: { origin: 'chrome-extension://abc123' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
