// External-behaviour tests for the 1688 session check.
// The Playwright context is replaced by a fake through the ScanContextFactory
// seam, so these tests never launch a browser and never touch the network.
import { describe, expect, it } from 'vitest';
import { checkSignedIn, isLoginUrl } from '../src/session.js';
import type { ScanContextFactory, SessionCheckContext } from '../src/session.js';
import type { ChromeCookie } from '../../src/core/types.js';

const SESSION_CHECK_URL = 'https://i.1688.com/';
const IMAGE_SEARCH_URL = 'https://air.1688.com/kapp/1688-search/pc-image-search/';

interface FakeContext {
  createContext: ScanContextFactory;
  navigatedTo: () => string | undefined;
  closed: () => boolean;
  receivedCookies: () => ChromeCookie[] | undefined;
}

function fakeContext(opts: { finalUrl?: string; gotoError?: Error } = {}): FakeContext {
  let navigatedTo: string | undefined;
  let closed = false;
  let receivedCookies: ChromeCookie[] | undefined;

  const context: SessionCheckContext = {
    newPage: async () => ({
      goto: async (url) => {
        navigatedTo = url;
        if (opts.gotoError) throw opts.gotoError;
      },
      url: () => opts.finalUrl ?? SESSION_CHECK_URL,
    }),
    close: async () => {
      closed = true;
    },
  };

  return {
    createContext: async (cookies) => {
      receivedCookies = cookies;
      return context;
    },
    navigatedTo: () => navigatedTo,
    closed: () => closed,
    receivedCookies: () => receivedCookies,
  };
}

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

describe('isLoginUrl', () => {
  it.each([
    'https://login.1688.com/member/signin.htm',
    'https://login.taobao.com/member/login.jhtml',
    'https://passport.login.1688.com/',
  ])('treats %s as a login page', (url) => {
    expect(isLoginUrl(url)).toBe(true);
  });

  it.each([
    IMAGE_SEARCH_URL,
    'https://www.1688.com/',
    'https://login.1688.com.evil.example/',
    'not a url',
  ])('does not treat %s as a login page', (url) => {
    expect(isLoginUrl(url)).toBe(false);
  });
});

describe('checkSignedIn', () => {
  it('reports true when the signed-in page renders without a login redirect', async () => {
    const fake = fakeContext();
    await expect(checkSignedIn(jar, fake.createContext)).resolves.toBe(true);
    expect(fake.navigatedTo()).toBe(SESSION_CHECK_URL);
  });

  it('reports false when 1688 redirects to login.1688.com', async () => {
    const fake = fakeContext({ finalUrl: 'https://login.1688.com/member/signin.htm' });
    await expect(checkSignedIn(jar, fake.createContext)).resolves.toBe(false);
  });

  it('reports false when 1688 redirects to login.taobao.com', async () => {
    const fake = fakeContext({ finalUrl: 'https://login.taobao.com/member/login.jhtml' });
    await expect(checkSignedIn(jar, fake.createContext)).resolves.toBe(false);
  });

  it('hands the 1688 jar to the context factory', async () => {
    const fake = fakeContext();
    await checkSignedIn(jar, fake.createContext);
    expect(fake.receivedCookies()).toEqual(jar);
  });

  it('closes the context it opened', async () => {
    const fake = fakeContext();
    await checkSignedIn(jar, fake.createContext);
    expect(fake.closed()).toBe(true);
  });

  it('closes the context even when navigation throws', async () => {
    const fake = fakeContext({ gotoError: new Error('navigation failed') });
    await expect(checkSignedIn(jar, fake.createContext)).rejects.toThrow('navigation failed');
    expect(fake.closed()).toBe(true);
  });
});
