// Messages between the popup and the background service worker, plus the
// scan state the background mirrors into chrome.storage.session.
//
// Node-safe like the rest of src/core: no `chrome.*`, no DOM. The popup and
// the worker both type their `chrome.runtime.sendMessage` calls from here.

import type { HelperStatus } from "./types.js";

/** The in-flight or finished scan, mirrored into chrome.storage.session. */
export interface StoredScanState {
  scanId: string;
  status: "running" | "completed" | "error" | "stopped";
  categoryUrl: string;
  completed: number;
  total: number;
  currentTitle: string;
  errors: number;
  /** Set once a result exists; a `data:text/csv;base64,…` URL for re-download. */
  csvDataUrl: string | null;
  filename: string | null;
  /** Matched rows in the result; null until the result is fetched. */
  matches: number | null;
  /** Set when status is "error". */
  errorCode: string | null;
  errorMessage: string | null;
}

/** Everything the popup needs to render one screen. */
export interface PopupState {
  /** null when the helper did not answer. */
  helper: HelperStatus | null;
  /** Whether the handed-off 1688 jar is signed in; null when unknown. */
  signedIn1688: boolean | null;
  /** Whether the seller's Chrome holds any Shopee cookies. */
  signedInShopee: boolean;
  /** The active tab's URL when it points at Shopee; otherwise null. */
  categoryUrl: string | null;
  isCategoryPage: boolean;
  scan: StoredScanState | null;
}

export type PopupRequest =
  | { type: "GET_POPUP_STATE"; tabUrl: string | null }
  | { type: "START_SCAN"; categoryUrl: string }
  | { type: "STOP_SCAN" }
  | { type: "DOWNLOAD_CSV" }
  | { type: "OPEN_1688_LOGIN" };

export type PopupResponse =
  | { ok: true; state?: PopupState }
  | { ok: false; code: string; message: string };
