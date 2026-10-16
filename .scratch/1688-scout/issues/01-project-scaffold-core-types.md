# 01: Minimal Extension Scaffold + Core Types

**What to build:** the extension skeleton — hand-written MV3 manifest, a `tsc` build, `chrome-types` for Chrome API typing, and the shared domain types / constants / Vietnamese copy. No framework, no bundler, no content scripts, no tests. At the end `pnpm build` produces a `dist/` that loads unpacked in Chrome and shows the popup.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `package.json` — devDependencies only (`typescript`, `chrome-types`); scripts `build` = `tsc && node scripts/copy-static.mjs`, `typecheck` = `tsc --noEmit`; `"type": "module"`
- [ ] `tsconfig.json` — strict, ES2022 + NodeNext, `types: ["chrome-types"]`, `lib: ["ES2022", "DOM"]`, `rootDir: "src"`, `outDir: "dist"`
- [ ] `manifest.json` — MV3; `action.default_popup`; background service worker as ESM; permissions `cookies`, `downloads`, `storage`; host permissions `*://*.shopee.vn/*`, `*://*.shopee.com.vn/*`, `http://localhost:3001/*`; icons from `assets/icon.png`
- [ ] `popup.html` + `style.css` — 360px-wide shell, Vietnamese title, no styling framework
- [ ] `src/popup.ts` — minimal shell that renders the app name and version (ticket 07 builds the real UI)
- [ ] `src/background.ts` — MV3 service worker entry with its responsibilities documented (ticket 07 fills it in)
- [ ] `scripts/copy-static.mjs` — dependency-free Node script that copies `manifest.json`, `popup.html`, `style.css` and `assets/icon.png` into `dist/`
- [ ] `src/core/types.ts` — `ShopeeCategoryProduct`, `ScanConfig`, `ChromeCookie`, `ScanCategoryRequest`, `ScanProgress`, `ScanResult`, `SixteenEightEightResult`, `HelperStatus`, `SearchErrorType`, `SearchError`. Node-safe: no `chrome.*`, no DOM
- [ ] `src/core/constants.ts` — scan defaults, helper base URL + endpoint paths, 1688 limits, storage keys
- [ ] `src/core/errors.ts` — `ERROR_MESSAGES`, `HELPER_ERROR_MESSAGES`, `createSearchError()` (Vietnamese copy)
- [ ] `pnpm typecheck` passes, `pnpm build` emits `dist/`, and `chrome://extensions` → Load unpacked → `dist/` shows the popup
