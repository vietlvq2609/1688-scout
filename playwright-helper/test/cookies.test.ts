// External-behaviour tests for the Chrome → Playwright cookie mapping.
// Pure data in, pure data out: no browser, no network, no chrome.*.
import { describe, expect, it } from 'vitest';
import { toPlaywrightCookies } from '../src/cookies.js';
import type { ChromeCookie } from '../../src/core/types.js';

function chromeCookie(overrides: Partial<ChromeCookie> = {}): ChromeCookie {
  return {
    name: 'cookie_name',
    value: 'cookie_value',
    domain: '.1688.com',
    path: '/',
    secure: true,
    httpOnly: true,
    ...overrides,
  };
}

describe('toPlaywrightCookies', () => {
  it('returns an empty array for an empty jar', () => {
    expect(toPlaywrightCookies([])).toEqual([]);
  });

  it('keeps name, value, domain, path, secure and httpOnly', () => {
    expect(toPlaywrightCookies([chromeCookie()])).toEqual([
      {
        name: 'cookie_name',
        value: 'cookie_value',
        domain: '.1688.com',
        path: '/',
        secure: true,
        httpOnly: true,
      },
    ]);
  });

  it.each([
    ['no_restriction', 'None'],
    ['unspecified', 'None'],
    ['lax', 'Lax'],
    ['strict', 'Strict'],
  ] as const)('maps sameSite %s to %s', (chromeSameSite, playwrightSameSite) => {
    const [cookie] = toPlaywrightCookies([chromeCookie({ sameSite: chromeSameSite })]);
    expect(cookie.sameSite).toBe(playwrightSameSite);
  });

  it('omits sameSite when Chrome did not report one', () => {
    const [cookie] = toPlaywrightCookies([chromeCookie()]);
    expect(cookie).not.toHaveProperty('sameSite');
  });

  it('drops the Chrome-only hostOnly and session flags', () => {
    const [cookie] = toPlaywrightCookies([chromeCookie({ hostOnly: true })]);
    expect(cookie).not.toHaveProperty('hostOnly');
    expect(cookie).not.toHaveProperty('session');
  });

  it('keeps a finite expires value', () => {
    const [cookie] = toPlaywrightCookies([chromeCookie({ expires: 1_800_000_000 })]);
    expect(cookie.expires).toBe(1_800_000_000);
  });

  it('omits expires when Chrome did not report one (session cookie)', () => {
    const [cookie] = toPlaywrightCookies([chromeCookie()]);
    expect(cookie).not.toHaveProperty('expires');
  });

  it('omits expires when it is not a finite number', () => {
    const [cookie] = toPlaywrightCookies([chromeCookie({ expires: Number.NaN })]);
    expect(cookie).not.toHaveProperty('expires');
  });
});
