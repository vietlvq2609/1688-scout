# 01: Minimal Extension Scaffold + Core Types

**What to build:** the extension skeleton — hand-written MV3 manifest, a `tsc` build, `chrome-types` for Chrome API typing, and the shared domain types / constants / Vietnamese copy. No framework, no bundler, no content scripts, no tests. At the end `pnpm build` produces a `dist/` that loads unpacked in Chrome and shows the popup.

**Blocked by:** None (can start immediately)

**Status:** done

**Delivered:** `8f9356a`

- [x] `package.json` — devDependencies only (`typescript`, `chrome-types`); scripts `build` = `node scripts/build.mjs`, `typecheck` = `tsc --noEmit`; `"type": "module"`
- [x] `tsconfig.json` — strict, ES2022 + NodeNext, `types: ["chrome-types"]`, `lib: ["ES2022", "DOM"]`, `rootDir: "src"`, `outDir: "dist"`
- [x] `manifest.json` — MV3; `action.default_popup`; background service worker as ESM; permissions `cookies`, `downloads`, `storage`; host permissions `*://*.shopee.vn/*`, `*://*.shopee.com.vn/*`, `http://localhost:3001/*`; icons from `assets/icon.png`
- [x] `popup.html` + `style.css` — 360px-wide shell, Vietnamese title, no styling framework
- [x] `src/popup.ts` — minimal shell that renders the app version (ticket 07 builds the real UI)
- [x] `src/background.ts` — MV3 service worker entry with its responsibilities documented (ticket 07 fills it in)
- [x] `scripts/build.mjs` — dependency-free Node script: cleans `dist/`, runs `tsc`, copies `manifest.json`, `popup.html`, `style.css` and `assets/icon.png` into `dist/`
- [x] `src/core/types.ts` — `ShopeeCategoryProduct`, `ScanConfig`, `ChromeCookie`, `ScanCategoryRequest`, `ScanProgress`, `ScanResult`, `SixteenEightEightResult`, `HelperStatus`, `SearchErrorType`, `SearchError`. Node-safe: no `chrome.*`, no DOM
- [x] `src/core/constants.ts` — scan defaults, helper base URL + endpoint paths, 1688 limits, storage keys
- [x] `src/core/errors.ts` — `ERROR_MESSAGES`, `HELPER_ERROR_MESSAGES`, `createSearchError()` (Vietnamese copy)
- [x] `pnpm typecheck` passes, `pnpm build` emits `dist/`, and Chrome packs `dist/` without manifest errors

**Notes:**
- The build is a single script (`scripts/build.mjs`) rather than a `tsc && cp` chain so it stays cross-platform and needs no extra dependency.
- `assets/icon.png` (512×512) was salvaged from the abandoned Plasmo attempt.
- To load it: `pnpm build` → `chrome://extensions` → Developer mode → Load unpacked → `dist/`.
