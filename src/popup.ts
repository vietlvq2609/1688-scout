/**
 * Popup entry point.
 *
 * Ticket 07 replaces this shell with the real UI: helper status, 1688 login
 * status, the "Quét danh mục này" button, progress and the CSV download.
 * For now it only proves that the manifest, the build and this entry point are
 * wired together.
 */
const versionElement = document.querySelector<HTMLSpanElement>("#version");

if (versionElement) {
  versionElement.textContent = `v${chrome.runtime.getManifest().version}`;
}
