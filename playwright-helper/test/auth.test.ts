// External-behaviour tests for the auth storage module (1688-auth.json).
// Pure fs + JSON: no browser, no network. Auth files live in a temp dir,
// never in the repo.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadAuthState, saveAuthState, clearAuthState } from '../src/auth.js';

let tempDir: string;

async function newTempDir(): Promise<string> {
  tempDir = await mkdtemp(path.join(tmpdir(), '1688-scout-auth-'));
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined as unknown as string;
  }
});

describe('loadAuthState', () => {
  it('returns null when the auth file does not exist', async () => {
    const dir = await newTempDir();
    expect(await loadAuthState(path.join(dir, '1688-auth.json'))).toBeNull();
  });

  it('returns null when the auth file is corrupt JSON', async () => {
    const dir = await newTempDir();
    const file = path.join(dir, '1688-auth.json');
    await writeFile(file, 'this is not json{{{', 'utf8');
    expect(await loadAuthState(file)).toBeNull();
  });

  it('returns the stored Playwright storageState when the file is valid', async () => {
    const dir = await newTempDir();
    const file = path.join(dir, '1688-auth.json');
    await writeFile(file, JSON.stringify({ cookies: [], origins: [] }), 'utf8');
    expect(await loadAuthState(file)).toEqual({ cookies: [], origins: [] });
  });
});

describe('saveAuthState', () => {
  it('writes a file that loadAuthState reads back unchanged (round trip)', async () => {
    const dir = await newTempDir();
    const file = path.join(dir, '1688-auth.json');
    const state = {
      cookies: [{ name: 'c', value: 'v', domain: '.1688.com', path: '/' }],
      origins: [{ origin: 'https://air.1688.com', localStorage: [] }],
    };
    await saveAuthState(state, file);
    expect(await loadAuthState(file)).toEqual(state);
  });

  it('creates the auth file when it does not exist yet', async () => {
    const dir = await newTempDir();
    const file = path.join(dir, '1688-auth.json');
    await saveAuthState({ cookies: [], origins: [] }, file);
    expect(await loadAuthState(file)).toEqual({ cookies: [], origins: [] });
  });
});

describe('clearAuthState', () => {
  it('removes the saved auth state so loadAuthState returns null again', async () => {
    const dir = await newTempDir();
    const file = path.join(dir, '1688-auth.json');
    await saveAuthState({ cookies: [], origins: [] }, file);
    await clearAuthState(file);
    expect(await loadAuthState(file)).toBeNull();
  });

  it('does not throw when there is no auth file to remove', async () => {
    const dir = await newTempDir();
    await expect(clearAuthState(path.join(dir, '1688-auth.json'))).resolves.toBeUndefined();
  });
});
