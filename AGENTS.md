# 1688 Scout — Agent Context

## Overview
Chrome MV3 extension for Shopee Vietnam sellers: click button on product page → side panel shows 1688 image-search matches. Vietnamese UI, no backend.

## Stack
- **Package manager**: pnpm
- **Framework**: Plasmo (React + TypeScript + MV3)
- **TypeScript**: 5.x (Plasmo default)
- **React**: 18.x (Plasmo default)
- **Build**: Plasmo (WXT/Rollup)

## Critical Rules (Must Not Violate)

- **Feature isolation** — 1688 logic separate from Shopee logic; no cross-imports
- **Platform wrappers** — Chrome APIs only via `platform/` wrappers; never directly in features
- **Messaging contract** — Follow exact `SEARCH_1688` / `SEARCH_1688_RESULT` contract
- **State machine** — Use exact `SidePanelState` union type; no ad-hoc state
- **No backend** — Zero backend/cloud code; all client-side
- **MV3 SW lifecycle** — Requests idempotent; handle missing responses
- **Image compression** — Compress to 800×800 JPEG 0.8 before upload
- **MVP scope only** — Only 8 SPEC features; no calculator, history, settings, multi-image

## Anti-Patterns (Do Not Do)

- Import `chrome.*` directly in features
- Cross-import between feature modules
- Add backend/cloud code
- Mutate state outside defined transitions
- Skip image compression
- Test private methods/internal state

## References
- **Architecture**: `ARCHITECTURE.md` — directory tree, file conventions, module boundaries, where new features go
- **Testing**: `TESTING.md` — external-behavior testing philosophy, integration over unit, fixture strategy