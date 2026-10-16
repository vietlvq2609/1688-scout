// Popup: display and user actions only. All state and helper calls live in
// the background worker; this file sends messages and renders the response.
//
// While a scan runs the popup subscribes to chrome.storage.session, so it
// re-attaches to an in-flight scan when reopened without re-checking sessions.

import { CONSTANTS } from "./core/constants.js";
import { HELPER_ERROR_MESSAGES } from "./core/errors.js";
import type { PopupRequest, PopupResponse, PopupState, StoredScanState } from "./core/messages.js";

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`popup: missing #${id}`);
  return element as T;
}

const versionEl = el<HTMLSpanElement>("version");
const helperDot = el<HTMLSpanElement>("helper-dot");
const helperValue = el<HTMLSpanElement>("helper-value");
const shopeeDot = el<HTMLSpanElement>("shopee-dot");
const shopeeValue = el<HTMLSpanElement>("shopee-value");
const sessionDot = el<HTMLSpanElement>("session-dot");
const sessionValue = el<HTMLSpanElement>("session-value");
const categoryUrlEl = el<HTMLParagraphElement>("category-url");
const hintEl = el<HTMLParagraphElement>("hint");
const scanButton = el<HTMLButtonElement>("scan-button");
const progressEl = el<HTMLDivElement>("progress");
const progressFill = el<HTMLDivElement>("progress-fill");
const progressText = el<HTMLParagraphElement>("progress-text");
const stopButton = el<HTMLButtonElement>("stop-button");
const doneEl = el<HTMLDivElement>("done");
const doneText = el<HTMLParagraphElement>("done-text");
const downloadButton = el<HTMLButtonElement>("download-button");
const loginButton = el<HTMLButtonElement>("login-button");
const errorEl = el<HTMLParagraphElement>("error");

let state: PopupState | null = null;
let busy = false;

type Tone = "ok" | "bad" | "unknown";

function setStatus(dot: HTMLElement, value: HTMLElement, tone: Tone, text: string): void {
  dot.dataset.tone = tone;
  value.textContent = text;
}

function send(message: PopupRequest): Promise<PopupResponse> {
  return chrome.runtime.sendMessage(message) as Promise<PopupResponse>;
}

async function activeTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

function hintFor(current: PopupState): string {
  if (!current.helper) return HELPER_ERROR_MESSAGES.HELPER_UNREACHABLE;
  if (!current.isCategoryPage) return HELPER_ERROR_MESSAGES.NOT_A_CATEGORY_PAGE;
  if (!current.signedInShopee) return HELPER_ERROR_MESSAGES.SHOPEE_NOT_SIGNED_IN;
  if (current.signedIn1688 === false) {
    return HELPER_ERROR_MESSAGES.SIXTEEN_EIGHT_EIGHT_NOT_SIGNED_IN;
  }
  return "";
}

function renderScan(current: PopupState): void {
  const scan: StoredScanState | null = current.scan;
  const running = scan?.status === "running";

  progressEl.hidden = !running;
  if (running && scan) {
    const percent = scan.total > 0 ? Math.round((scan.completed / scan.total) * 100) : 0;
    progressFill.style.width = `${percent}%`;
    const title = scan.currentTitle ? ` — ${scan.currentTitle}` : "";
    progressText.textContent = `Đang quét ${scan.completed}/${scan.total}${title}`;
  }

  const finished = scan !== null && !running;
  doneEl.hidden = !finished;
  if (finished && scan) {
    if (scan.status === "completed") {
      doneText.textContent = `Hoàn tất! Tìm thấy ${scan.matches ?? 0} sản phẩm`;
    } else if (scan.status === "stopped") {
      doneText.textContent = `Đã dừng. Đã quét ${scan.completed}/${scan.total} sản phẩm`;
    } else {
      doneText.textContent = "Quét thất bại.";
    }
    downloadButton.hidden = !scan.csvDataUrl;
  }

  const failed = scan?.status === "error" && scan.errorMessage;
  errorEl.hidden = !failed;
  if (failed && scan) {
    errorEl.textContent =
      scan.errorCode === "AUTH_REQUIRED"
        ? HELPER_ERROR_MESSAGES.SIXTEEN_EIGHT_EIGHT_NOT_SIGNED_IN
        : scan.errorMessage;
  }
}

function render(): void {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  if (!state) return;

  const current = state;
  setStatus(
    helperDot,
    helperValue,
    current.helper ? "ok" : "bad",
    current.helper ? `v${current.helper.version}` : "Helper không chạy",
  );
  setStatus(
    shopeeDot,
    shopeeValue,
    current.signedInShopee ? "ok" : "bad",
    current.signedInShopee ? "Đã đăng nhập" : "Chưa đăng nhập",
  );
  setStatus(
    sessionDot,
    sessionValue,
    current.signedIn1688 === null ? "unknown" : current.signedIn1688 ? "ok" : "bad",
    current.signedIn1688 === null
      ? "Không kiểm tra được"
      : current.signedIn1688
        ? "Đã đăng nhập"
        : "Chưa đăng nhập",
  );

  categoryUrlEl.hidden = !current.categoryUrl;
  categoryUrlEl.textContent = current.categoryUrl ?? "";

  loginButton.hidden = current.signedIn1688 !== false;

  renderScan(current);

  const running = current.scan?.status === "running";
  scanButton.disabled = busy || running || !current.helper || !current.signedInShopee
    || !current.isCategoryPage || current.signedIn1688 !== true;
  scanButton.textContent = running ? "Đang quét…" : "Quét danh mục này";

  const hint = hintFor(current);
  hintEl.hidden = hint === "";
  hintEl.textContent = hint;
}

function applyResponse(response: PopupResponse): void {
  if (response.ok) {
    if (response.state) state = response.state;
  } else {
    errorEl.hidden = false;
    errorEl.textContent = response.message;
  }
}

async function run(action: () => Promise<PopupResponse>): Promise<void> {
  busy = true;
  render();
  try {
    applyResponse(await action());
  } finally {
    busy = false;
    render();
  }
}

scanButton.addEventListener("click", () => {
  const categoryUrl = state?.categoryUrl;
  if (!categoryUrl) return;
  void run(() => send({ type: "START_SCAN", categoryUrl }));
});

stopButton.addEventListener("click", () => {
  void run(() => send({ type: "STOP_SCAN" }));
});

downloadButton.addEventListener("click", () => {
  void run(() => send({ type: "DOWNLOAD_CSV" }));
});

loginButton.addEventListener("click", () => {
  void run(async () => {
    const response = await send({ type: "OPEN_1688_LOGIN" });
    if (response.ok) {
      state = { ...(state as PopupState), signedIn1688: false };
    }
    return response;
  });
});

chrome.storage.session.onChanged.addListener((changes) => {
  const change = changes[CONSTANTS.STORAGE_KEYS.SCAN_STATE];
  if (!change) return;
  if (state) {
    state = { ...state, scan: (change.newValue as StoredScanState | undefined) ?? null };
  }
  render();
});

async function init(): Promise<void> {
  hintEl.hidden = false;
  hintEl.textContent = "Đang kiểm tra…";
  try {
    applyResponse(await send({ type: "GET_POPUP_STATE", tabUrl: await activeTabUrl() }));
  } catch {
    errorEl.hidden = false;
    errorEl.textContent = HELPER_ERROR_MESSAGES.HELPER_UNREACHABLE;
  }
  render();
}

void init();
