/**
 * MV3 background service worker.
 *
 * Ticket 07 implements the real behaviour here:
 *   - read the Shopee cookies and start a scan through the local helper
 *   - poll `/api/scan/:id/progress` and mirror it into `chrome.storage.session`
 *     so the popup can re-attach after it has been closed
 *   - download the resulting CSV from a `data:` URL (a service worker has no
 *     `URL.createObjectURL`)
 *
 * The file exists now so the manifest's background entry point resolves.
 */
export {};

chrome.runtime.onInstalled.addListener(() => {
  console.log("[1688 Scout] service worker ready");
});
