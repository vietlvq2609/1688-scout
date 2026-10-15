// Persistence for the helper's own 1688 session (Playwright storageState).
// Pure fs + JSON — no browser, no network. Ticket 03 (QR login) writes the
// state via saveAuthState; reading it back here powers /api/status's
// loggedIn flag and browser contexts with a logged-in session.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BrowserContextOptions } from 'playwright';
import { AUTH_FILE_PATH } from './constants.js';

/** Playwright storageState: cookies + per-origin localStorage. */
export type AuthState = NonNullable<BrowserContextOptions['storageState']>;

function isValidAuthState(value: unknown): value is AuthState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the persisted 1688 auth state. Returns null when the file is missing
 * or not valid JSON (corrupt), so callers treat both as "not logged in".
 */
export async function loadAuthState(
  filePath: string = AUTH_FILE_PATH,
): Promise<AuthState | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidAuthState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist the 1688 auth state as JSON, creating the file if needed. */
export async function saveAuthState(
  state: AuthState,
  filePath: string = AUTH_FILE_PATH,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/** Remove the persisted auth state (log out). Safe when no file exists. */
export async function clearAuthState(
  filePath: string = AUTH_FILE_PATH,
): Promise<void> {
  await fs.rm(filePath, { force: true });
}
