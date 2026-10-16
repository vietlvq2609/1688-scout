// Thin HTTP client for the local helper.
//
// Only the background service worker calls this (the popup talks to the
// worker, never to the helper directly). Every request carries a 30s timeout
// and a failure becomes a typed HelperError with a Vietnamese message.

import { CONSTANTS, DEFAULT_SCAN_CONFIG } from "./core/constants.js";
import { HELPER_ERROR_MESSAGES } from "./core/errors.js";
import type {
  ChromeCookie,
  HelperStatus,
  ScanCategoryRequest,
  ScanProgress,
  ScanResult,
  SessionCheckResponse,
} from "./core/types.js";

/** A helper call that failed, with a code the popup can branch on. */
export class HelperError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HelperError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONSTANTS.HELPER_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${CONSTANTS.HELPER_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    throw new HelperError("HELPER_UNREACHABLE", HELPER_ERROR_MESSAGES.HELPER_UNREACHABLE);
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new HelperError(
      error?.code ?? "HELPER_ERROR",
      error?.message ?? HELPER_ERROR_MESSAGES.SCAN_FAILED,
    );
  }
  return body as T;
}

function postJson(path: string, payload: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export function checkHealth(): Promise<HelperStatus> {
  return request<HelperStatus>(CONSTANTS.HELPER_ENDPOINTS.STATUS);
}

export function checkSession(cookies: ChromeCookie[]): Promise<SessionCheckResponse> {
  return request<SessionCheckResponse>(
    CONSTANTS.HELPER_ENDPOINTS.SESSION_CHECK,
    postJson(CONSTANTS.HELPER_ENDPOINTS.SESSION_CHECK, { cookies }),
  );
}

export function startScan(
  categoryUrl: string,
  cookies: ScanCategoryRequest["cookies"],
): Promise<{ scanId: string; status: "started" }> {
  const payload: ScanCategoryRequest = {
    categoryUrl,
    config: DEFAULT_SCAN_CONFIG,
    cookies,
  };
  return request(CONSTANTS.HELPER_ENDPOINTS.SCAN_CATEGORY, postJson(CONSTANTS.HELPER_ENDPOINTS.SCAN_CATEGORY, payload));
}

export function getProgress(scanId: string): Promise<ScanProgress> {
  return request<ScanProgress>(CONSTANTS.HELPER_ENDPOINTS.SCAN_PROGRESS(scanId));
}

export function getResult(scanId: string): Promise<ScanResult> {
  return request<ScanResult>(CONSTANTS.HELPER_ENDPOINTS.SCAN_RESULT(scanId));
}

export function stopScan(scanId: string): Promise<unknown> {
  return request(CONSTANTS.HELPER_ENDPOINTS.SCAN_STOP(scanId), { method: "POST" });
}
