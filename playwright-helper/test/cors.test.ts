// External-behaviour tests for the helper's CORS allow-list.
// Pure string logic: no browser, no network beyond the ephemeral test server.
import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../src/cors.js';

const EXTENSION_ID = 'a'.repeat(32);

describe('isAllowedOrigin', () => {
  it('allows a Chrome extension origin', () => {
    expect(isAllowedOrigin(`chrome-extension://${EXTENSION_ID}`)).toBe(true);
  });

  it('allows requests with no Origin header (curl, same-origin)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });

  it.each([
    'https://shopee.vn',
    'https://evil.example',
    'http://localhost:3000',
    `chrome-extension://${'z'.repeat(32)}`,
    'chrome-extension://short',
    'chrome-extension://',
    'not a url',
  ])('rejects %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});
