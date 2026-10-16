// MV3 background service worker: owns all state and every helper HTTP call.
//
// The popup only displays and sends messages. Scan state lives in
// chrome.storage.session so a scan survives the popup closing, and the worker
// re-attaches to a running scan whenever it restarts.

import { CONSTANTS } from "./core/constants.js";
import { HELPER_ERROR_MESSAGES } from "./core/errors.js";
import type { PopupRequest, PopupResponse, PopupState, StoredScanState } from "./core/messages.js";
import { collectSiteCookies, isCategoryPage, isShopeeUrl } from "./cookies.js";
import * as helper from "./helperClient.js";
import { HelperError } from "./helperClient.js";

const SCAN_KEY = CONSTANTS.STORAGE_KEYS.SCAN_STATE;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

async function readScan(): Promise<StoredScanState | null> {
  const stored = await chrome.storage.session.get(SCAN_KEY);
  return (stored[SCAN_KEY] as StoredScanState | undefined) ?? null;
}

async function writeScan(state: StoredScanState | null): Promise<void> {
  if (state) {
    await chrome.storage.session.set({ [SCAN_KEY]: state });
  } else {
    await chrome.storage.session.remove(SCAN_KEY);
  }
}

/** Snapshot for the popup: helper, both sessions, the tab, the scan. */
async function buildState(tabUrl: string | null): Promise<PopupState> {
  const [cookies, scan] = await Promise.all([collectSiteCookies(), readScan()]);

  let helperStatus: PopupState["helper"] = null;
  let signedIn1688: boolean | null = null;
  try {
    helperStatus = await helper.checkHealth();
    signedIn1688 = (await helper.checkSession(cookies.sixteenEightEight)).signedIn;
  } catch {
    helperStatus = null;
    signedIn1688 = null;
  }

  return {
    helper: helperStatus,
    signedIn1688,
    signedInShopee: cookies.shopee.length > 0,
    categoryUrl: isShopeeUrl(tabUrl) ? tabUrl : null,
    isCategoryPage: isCategoryPage(tabUrl),
    scan,
  };
}

function csvFilename(categoryUrl: string): string {
  let slug = "danh-muc";
  try {
    const last = new URL(categoryUrl).pathname.split("/").filter(Boolean).pop();
    if (last) slug = last;
  } catch {
    // keep the default
  }
  slug = slug.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "danh-muc";
  const date = new Date().toISOString().slice(0, 10);
  return `matches-${slug}-${date}.csv`;
}

function schedulePoll(delayMs: number = CONSTANTS.SCAN_POLL_MS): void {
  if (pollTimer !== null) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void poll();
  }, delayMs);
}

async function download(csvDataUrl: string, filename: string): Promise<void> {
  try {
    await chrome.downloads.download({ url: csvDataUrl, filename, saveAs: false });
  } catch {
    // A failed download is surfaced by the popup's "Tải CSV" button retry.
  }
}

/** One progress poll. Fetches the result and downloads on a terminal status. */
async function poll(): Promise<void> {
  const scan = await readScan();
  if (!scan || scan.status !== "running") return;

  let progress;
  try {
    progress = await helper.getProgress(scan.scanId);
  } catch (error) {
    const code = error instanceof HelperError ? error.code : "HELPER_UNREACHABLE";
    const message = error instanceof Error ? error.message : HELPER_ERROR_MESSAGES.HELPER_UNREACHABLE;
    await writeScan({ ...scan, status: "error", errorCode: code, errorMessage: message });
    return;
  }

  const next: StoredScanState = {
    ...scan,
    status: progress.status,
    completed: progress.completed,
    total: progress.total,
    currentTitle: progress.currentTitle,
    errors: progress.errors,
  };

  if (progress.status === "running") {
    await writeScan(next);
    schedulePoll();
    return;
  }

  // Terminal: keep the partial CSV even for a mid-scan session death.
  try {
    const result = await helper.getResult(scan.scanId);
    next.matches = result.matches;
    next.filename = csvFilename(scan.categoryUrl);
    next.csvDataUrl = result.csvBase64 ? `data:text/csv;base64,${result.csvBase64}` : null;
  } catch (error) {
    next.errorCode = error instanceof HelperError ? error.code : "HELPER_ERROR";
    next.errorMessage = error instanceof Error ? error.message : HELPER_ERROR_MESSAGES.SCAN_FAILED;
  }

  if (progress.status === "error") {
    next.errorCode = progress.error?.type ?? next.errorCode ?? "SCAN_FAILED";
    next.errorMessage = progress.error?.message ?? HELPER_ERROR_MESSAGES.SCAN_FAILED;
  }

  await writeScan(next);
  if (next.csvDataUrl) {
    await download(next.csvDataUrl, next.filename ?? "matches.csv");
  }
}

async function startScan(categoryUrl: string): Promise<PopupState> {
  const cookies = await collectSiteCookies();
  if (cookies.shopee.length === 0) {
    throw new HelperError("SHOPEE_NOT_SIGNED_IN", HELPER_ERROR_MESSAGES.SHOPEE_NOT_SIGNED_IN);
  }

  const { scanId } = await helper.startScan(categoryUrl, cookies);
  await writeScan({
    scanId,
    status: "running",
    categoryUrl,
    completed: 0,
    total: 0,
    currentTitle: "",
    errors: 0,
    csvDataUrl: null,
    filename: null,
    matches: null,
    errorCode: null,
    errorMessage: null,
  });
  schedulePoll(0);
  return buildState(categoryUrl);
}

async function stopCurrentScan(): Promise<PopupState> {
  const scan = await readScan();
  if (scan && scan.status === "running") {
    try {
      await helper.stopScan(scan.scanId);
    } catch {
      // The scan may already be gone; the result fetch below decides.
    }
    await poll();
  }
  return buildState(scan?.categoryUrl ?? null);
}

async function redownload(): Promise<PopupState> {
  const scan = await readScan();
  if (scan?.csvDataUrl) {
    await download(scan.csvDataUrl, scan.filename ?? "matches.csv");
  }
  return buildState(scan?.categoryUrl ?? null);
}

async function handle(message: PopupRequest): Promise<PopupResponse> {
  switch (message.type) {
    case "GET_POPUP_STATE":
      return { ok: true, state: await buildState(message.tabUrl) };
    case "START_SCAN":
      return { ok: true, state: await startScan(message.categoryUrl) };
    case "STOP_SCAN":
      return { ok: true, state: await stopCurrentScan() };
    case "DOWNLOAD_CSV":
      return { ok: true, state: await redownload() };
    case "OPEN_1688_LOGIN":
      await chrome.tabs.create({ url: CONSTANTS.SIXTEEN_EIGHT_EIGHT_SIGN_IN_URL });
      return { ok: true };
  }
}

function toErrorResponse(error: unknown): PopupResponse {
  if (error instanceof HelperError) {
    return { ok: false, code: error.code, message: error.message };
  }
  return { ok: false, code: "SCAN_FAILED", message: HELPER_ERROR_MESSAGES.SCAN_FAILED };
}

chrome.runtime.onMessage.addListener((message: PopupRequest, _sender, sendResponse) => {
  void handle(message).then(sendResponse, (error: unknown) => sendResponse(toErrorResponse(error)));
  return true;
});

// Re-attach to a scan that was running when the service worker was evicted.
void (async () => {
  const scan = await readScan();
  if (scan?.status === "running") schedulePoll(0);
})();
