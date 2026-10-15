# 01: Project Scaffold + Core Types

**What to build:** Initialize the Plasmo MV3 extension project with TypeScript, React, and the shared core types/constants/errors that both extension and helper will use. Project compiles and type-checks.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `pnpm create plasmo` — MV3, React, TypeScript
- [ ] `src/core/types.ts` — Shared interfaces: `ShopeeCategoryProduct`, `ScanConfig`, `ScanCategoryRequest`, `ScanProgress`, `ScanResult`, `SixteenEightEightResult`, `HelperStatus`, `SearchErrorType`, `SearchError`
- [ ] `src/core/constants.ts` — Defaults: maxPages=3, maxProductsPerPage=30, cnyVndRate=3500, markupMultiplier=3, helperBaseUrl, helper endpoints, Shopee URL patterns, selectors
- [ ] `src/core/errors.ts` — Error codes + Vietnamese messages
- [ ] `package.json` — Dependencies: plasmo, react, typescript; dev: vitest, @types/chrome
- [ ] `tsconfig.json` — Strict mode, path aliases for `@core`, `@features`, `@platform`
- [ ] `plasmo.config.json` — Manifest V3, host permissions for `shopee.vn`, `shopee.com.vn`, side panel disabled, popup enabled
- [ ] `pnpm build` succeeds, `pnpm typecheck` passes