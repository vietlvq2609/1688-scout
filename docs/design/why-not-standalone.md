# Why Playwright Cannot Run Inside a Chrome Extension

---

## The Core Constraint

| Environment | Can Run Playwright? |
|-------------|---------------------|
| **Node.js process** (terminal, server) | ✅ Yes |
| **Chrome Extension (MV3) Service Worker** | ❌ No |
| **Chrome Extension Content Script** | ❌ No |
| **Web Page (browser)** | ❌ No |

---

## Why: Technical Reasons

### 1. Playwright = Node.js Library That Controls Browsers

```javascript
// This code runs in Node.js, NOT in the browser
const { chromium } = require('playwright');

const browser = await chromium.launch();  // Launches REAL Chrome/Chromium process
const page = await browser.newPage();      // Creates new tab
await page.goto('https://1688.com');       // Navigates
```

**Playwright is a Node.js process that launches and controls a SEPARATE browser instance via CDP (Chrome DevTools Protocol).**

### 2. Chrome Extension Service Worker ≠ Node.js

| Feature | Node.js | MV3 Service Worker |
|---------|---------|-------------------|
| **Runtime** | V8 + Node APIs (fs, net, child_process) | V8 + Web APIs (fetch, crypto, streams) |
| **Process Control** | `child_process.spawn()` | ❌ Not allowed |
| **File System** | `fs.readFile()` | ❌ Not allowed (only `chrome.storage`) |
| **Raw TCP/Sockets** | `net.connect()` | ❌ Not allowed |
| **Launch Browser** | `chromium.launch()` | ❌ Impossible |

**Service Workers are sandboxed** — they cannot spawn processes, access filesystem, or open raw sockets.

### 3. Content Scripts Run in Page Context

- Runs in the **web page's JavaScript context**
- Same restrictions as any webpage JS
- Cannot escape the browser sandbox

---

## What "Standalone Extension" Means

```
┌─────────────────────────────────────────────────────────────┐
│  Standalone .crx (What Users Expect)                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. User downloads file.crx                              │ │
│  │ 2. Drags to chrome://extensions                         │ │
│  │ 3. Clicks "Add" → Works immediately                     │ │
│  │ 4. No terminal, no Node.js, no Python, no Docker        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**With Playwright, this is impossible** because Playwright requires a Node.js runtime.

---

## The Architecture You Actually Get with Playwright

```
┌─────────────────────────────────────────────────────────────┐
│  User's Machine                                             │
│                                                             │
│  ┌──────────────────┐         HTTP/WS          ┌──────────┐ │
│  │ Chrome Extension │ ◄──────────────────────► │ Node.js  │ │
│  │ (Frontend Only)  │    localhost:3001        │ Process  │ │
│  │                  │                          │          │ │
│  │ - Side Panel     │   JSON requests          │ - Express│ │
│  │ - Content Script │   Image blobs            │ - Playwright│ │
│  │ - Button Inject  │   Progress events        │ - Chrome  │ │
│  └──────────────────┘                          └──────────┘ │
│         ▲                                              │    │
│         │                                              │    │
│         └──────────────────────────────────────────────┘    │
│                    User must run this:                        │
│                    $ node server.js                           │
│                    (keeps terminal open)                      │
└─────────────────────────────────────────────────────────────┘
```

### What the User Must Do

```bash
# Every time they want to use the tool:
$ cd 1688-scout
$ pnpm install          # First time only
$ npx playwright install chromium  # First time only
$ node playwright-helper/server.js   # KEEP THIS RUNNING
# → "Server listening on http://localhost:3001"
```

Then in Chrome: click extension button → works.

**If they close the terminal → extension breaks.**

---

## Alternatives That ARE Standalone

### Option 1: Pure Extension (Reverse-Engineer 1688 API)
- **How**: Implement `sign` generation in TypeScript using `crypto.subtle`
- **Runs**: Entirely in Service Worker
- **Distribution**: ✅ True standalone `.crx`
- **Difficulty**: High (may be impossible if `sign` is server-side)

### Option 2: Extension + Native Messaging (Advanced)
- **How**: Extension talks to a **compiled native binary** (Go/Rust/C++) via `chrome.runtime.sendNativeMessage`
- **Runs**: Native binary on user's machine (installed via installer)
- **Distribution**: ⚠️ Requires installer (`.msi`/`.dmg`/`.deb`), not just `.crx`
- **Difficulty**: Very high (native code, code signing, per-OS builds)

### Option 3: Extension + External API (Your Own Server)
- **How**: Extension calls `https://your-api.com/search` → your server runs Playwright
- **Runs**: Your server (VPS, Cloud Run, etc.)
- **Distribution**: ✅ Standalone `.crx`
- **Cost**: You pay for server + bandwidth
- **Privacy**: User images go to your server

### Option 4: Accept Local Helper (Current Hybrid)
- **How**: User runs `node server.js` locally
- **Distribution**: ⚠️ Technical users only
- **Cost**: Free (runs on user's machine)
- **Privacy**: ✅ Images never leave machine

---

## Decision Matrix for Your Case

| Requirement | Pure Extension | Native Messaging | Your Server | Local Helper |
|-------------|----------------|------------------|-------------|--------------|
| **Standalone .crx** | ✅ | ⚠️ Needs installer | ✅ | ❌ |
| **Non-technical users** | ✅ | ⚠️ Complex install | ✅ | ❌ |
| **No server cost** | ✅ | ✅ | ❌ | ✅ |
| **Privacy (local only)** | ✅ | ✅ | ❌ | ✅ |
| **Handles 1688 `sign`** | ❓ Unknown | ✅ (if binary does it) | ✅ | ✅ |
| **Development effort** | High (RE) | Very High | Medium | **Low** |

---

## My Honest Assessment

**For "Both Eventually" (personal + distribution):**

| Phase | Approach | Why |
|-------|----------|-----|
| **Now (Personal)** | Local Playwright Helper | Fastest to working; validates product |
| **v1 (Technical Users)** | Local Helper + Install Script | `install.bat`/`install.sh` automates Node + Playwright setup |
| **v2 (General Distribution)** | **Pure Extension** (if `sign` cracked) OR **Your Server API** | Only paths to true standalone `.crx` |

---

## The "Install Script" Compromise (v1)

You can make the local helper **almost** user-friendly:

```bash
# install.bat (Windows)
@echo off
echo Installing 1688 Scout Helper...
winget install Node.js 2>nul || (echo "Please install Node.js manually" && pause)
npm install -g playwright
playwright install chromium
echo Done! Run "start-helper.bat" to use.
```

```bash
# start-helper.bat
@echo off
cd %~dp0playwright-helper
node server.js
```

**Still requires**: User runs `install.bat` once, then `start-helper.bat` each session.

---

## Bottom Line

> **Playwright = Node.js process = NOT standalone extension.**

If you need **true standalone `.crx` for non-technical sellers**, you have two paths:
1. **Crack the `sign`** → Pure extension (investigate first!)
2. **Host your own API server** → Extension calls your server (you pay hosting)

The local Playwright helper is **only for personal/technical use**.

---

## Recommended Next Step

**Spend 2 hours investigating the `sign` parameter** (see `inspect-1688.md`). 

- If you find client-side HMAC code → **Pure extension is possible** → build that
- If `sign` is server-generated → **Must choose**: Local helper (technical users) or Your server API (distribution)

Want me to help you run the `sign` investigation now?