# Local Helper: Non-Technical Setup + 1688 Authentication

---

## The Setup Challenge

```
Non-technical user must:
1. Install Node.js
2. Install Playwright + Chromium
3. Run server.js (keep terminal open)
4. Handle 1688 login
```

---

## Solution 1: One-Click Installer (Windows/macOS)

### Windows: `install.bat` + `start-helper.bat`

```bat
@echo off
:: install.bat - Run ONCE as Administrator
title 1688 Scout Helper Installer
echo ==========================================
echo 1688 Scout - Local Helper Setup
echo ==========================================
echo.

:: 1. Check/Install Node.js
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Installing via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo.
        echo ❌ Auto-install failed. Please install manually:
        echo    https://nodejs.org/en/download/
        pause
        exit /b 1
    )
    echo Node.js installed. Please RESTART terminal and re-run install.bat
    pause
    exit /b 0
) else (
    echo ✓ Node.js found: & node --version
)

:: 2. Install Playwright
echo.
echo [2/4] Installing Playwright...
npm install -g playwright@latest 2>&1 | findstr /V "npm WARN"
if %errorlevel% neq 0 (
    echo ❌ Failed. Try: npm install -g playwright
    pause
    exit /b 1
)
echo ✓ Playwright installed

:: 3. Install Chromium
echo.
echo [3/4] Installing Chromium browser...
npx playwright install chromium 2>&1 | findstr /V "npm WARN"
if %errorlevel% neq 0 (
    echo ❌ Failed. Try: npx playwright install chromium
    pause
    exit /b 1
)
echo ✓ Chromium installed

:: 4. Create shortcuts
echo.
echo [4/4] Creating shortcuts...
copy /Y "start-helper.bat" "%USERPROFILE%\Desktop\1688 Scout Helper.lnk" >nul 2>&1
echo ✓ Shortcut created on Desktop

echo.
echo ==========================================
echo ✅ INSTALLATION COMPLETE!
echo ==========================================
echo.
echo To use 1688 Scout:
echo 1. Double-click "1688 Scout Helper" on Desktop
echo 2. Keep the black window OPEN while using extension
echo 3. Login to 1688.com when prompted (first time only)
echo.
pause
```

```bat
@echo off
:: start-helper.bat - Run EACH SESSION (double-click)
title 1688 Scout Helper - Running...
cd /d "%~dp0playwright-helper"
echo Starting 1688 Scout Helper...
echo Keep this window open while using the extension.
echo.
echo First run: Will open browser for 1688 login.
echo Subsequent runs: Uses saved session.
echo.
node server.js
pause
```

### macOS/Linux: `install.sh` + `start-helper.sh`

```bash
#!/bin/bash
# install.sh - Run ONCE: chmod +x install.sh && ./install.sh

set -e

echo "=========================================="
echo "1688 Scout - Local Helper Setup"
echo "=========================================="

# 1. Node.js
echo "[1/4] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Installing via Homebrew..."
        brew install node
    else
        echo "Please install Node.js: https://nodejs.org/en/download/"
        exit 1
    fi
else
    echo "✓ Node.js: $(node --version)"
fi

# 2. Playwright
echo "[2/4] Installing Playwright..."
npm install -g playwright@latest

# 3. Chromium
echo "[3/4] Installing Chromium..."
npx playwright install chromium

# 4. Desktop shortcut
echo "[4/4] Creating launcher..."
cat > ~/Desktop/1688-Scout-Helper.command << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/../1688-scout/playwright-helper"
echo "Starting 1688 Scout Helper..."
echo "Keep this window open while using the extension."
echo "First run: Will open browser for 1688 login."
node server.js
EOF
chmod +x ~/Desktop/1688-Scout-Helper.command

echo ""
echo "=========================================="
echo "✅ INSTALLATION COMPLETE!"
echo "=========================================="
echo ""
echo "To use: Double-click '1688-Scout-Helper' on Desktop"
echo "Keep the terminal window OPEN while using the extension."
```

---

## Solution 2: Packaged App (Electron/Tauri) - Better UX

Instead of raw Node.js, wrap helper in a **native-looking app**:

```
┌─────────────────────────────────────────┐
│  1688 Scout Helper          [×] [−] [□] │
├─────────────────────────────────────────┤
│  🟢 Server Running on localhost:3001    │
│                                         │
│  1688 Status:  ✓ Logged in (seller@...) │
│                                         │
│  [ Open 1688 Login ]  [ Clear Session ] │
│                                         │
│  Logs:                                  │
│  [10:30:15] Server started              │
│  [10:30:22] 1688 session restored       │
│  [10:31:05] Search: "áo thun" → 12 results│
│                                         │
│  [ Minimize to Tray ]                   │
└─────────────────────────────────────────┘
```

**Tauri (Rust + WebView)** - Smaller (~5MB), native menus, tray icon, auto-updates.

```rust
// src-tauri/src/main.rs
use tauri::{Manager, SystemTray, SystemTrayMenu, CustomMenuItem};

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show"))
        .add_item(CustomMenuItem::new("login", "Login 1688"))
        .add_item(CustomMenuItem::new("quit", "Quit"));

    tauri::Builder::default()
        .system_tray(SystemTray::new().with_menu(tray_menu))
        .invoke_handler(tauri::generate_handler![start_server, login_1688, get_status])
        .run(tauri::generate_context!())
        .expect("error running app");
}

#[tauri::command]
async fn start_server(app: tauri::AppHandle) -> Result<String, String> {
    // Spawn Playwright Node.js as child process
    // Communicate via stdin/stdout or HTTP
}
```

**Pros**: Native installer (`.msi`/`.dmg`), tray icon, auto-start, no terminal.
**Cons**: More dev work; Rust learning curve.

---

## 1688 Authentication: How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Playwright Helper Process                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Browser Context (Persistent)                        │   │
│  │  - cookies, localStorage, sessionStorage            │   │
│  │  - Saved to: ./1688-auth.json                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  On Startup:                                                │
│  1. Load storageState from ./1688-auth.json                │
│  2. If valid → skip login                                   │
│  3. If expired/missing → open login page                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation: `playwright-helper/server.ts`

```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import express from 'express';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '1688-auth.json');
const APP_KEY = '12574478'; // From network inspection

class SixteenEightEightSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: false, // Headful for login/captcha
      args: ['--disable-blink-features=AutomationControlled']
    });

    // Load saved session
    if (fs.existsSync(AUTH_FILE)) {
      this.context = await this.browser.newContext({
        storageState: AUTH_FILE
      });
    } else {
      this.context = await this.browser.newContext();
    }

    this.page = await this.context.newPage();
    
    // Inject stealth scripts
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Verify session
    await this.ensureLoggedIn();
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    await this.page.goto('https://www.1688.com', { waitUntil: 'networkidle' });
    
    // Check if logged in (look for user avatar/logout button)
    const isLoggedIn = await this.page.locator('.member-info, .user-name, [data-spm*="logout"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isLoggedIn) {
      console.log('🔐 Session expired. Opening login...');
      await this.performLogin();
    } else {
      console.log('✅ 1688 session restored');
      await this.saveSession();
    }
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    // Navigate to login
    await this.page.goto('https://login.1688.com/', { waitUntil: 'networkidle' });
    
    // Wait for manual login (QR code or password)
    // User scans QR with 1688 app or enters credentials
    console.log('⏳ Waiting for login... (scan QR or enter password)');
    
    // Wait for redirect to 1688.com with logged-in state
    await this.page.waitForURL('https://www.1688.com/**', { timeout: 120000 });
    
    // Verify
    const loggedIn = await this.page.locator('.member-info, .user-name').first().isVisible({ timeout: 10000 }).catch(() => false);
    if (!loggedIn) throw new Error('Login failed');
    
    await this.saveSession();
    console.log('✅ Login successful, session saved');
  }

  private async saveSession(): Promise<void> {
    if (!this.context) return;
    const state = await this.context.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  }

  async searchImage(imageBuffer: Buffer): Promise<SearchResult> {
    if (!this.page) throw new Error('Not initialized');
    
    // Upload logic here...
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}

// Express server
const app = express();
app.use(express.json({ limit: '10mb' }));

const session = new SixteenEightEightSession();

app.post('/api/search', async (req, res) => {
  try {
    // Handle image upload from extension
    const imageBase64 = req.body.image; // base64 string
    const buffer = Buffer.from(imageBase64, 'base64');
    const result = await session.searchImage(buffer);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/batch', async (req, res) => {
  // Batch search with parallel contexts
});

app.get('/api/status', async (req, res) => {
  res.json({ 
    loggedIn: fs.existsSync(AUTH_FILE),
    serverTime: new Date().toISOString()
  });
});

app.post('/api/login', async (req, res) => {
  // Force re-login
  fs.unlinkSync(AUTH_FILE);
  await session.initialize();
  res.json({ success: true });
});

session.initialize().then(() => {
  app.listen(3001, () => console.log('🚀 Helper running on http://localhost:3001'));
});
```

---

## First-Time User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  USER'S FIRST RUN                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Double-click "1688 Scout Helper" on Desktop            │
│                                                             │
│  2. Terminal opens:                                        │
│     Starting 1688 Scout Helper...                          │
│     Keep this window open while using the extension.       │
│     First run: Will open browser for 1688 login.           │
│                                                             │
│  3. Chromium window opens → 1688 login page                │
│                                                             │
│  4. User logs in:                                          │
│     ┌─────────────────────────────────────────┐            │
│     │  1688 Login                             │            │
│     │  [QR Code]  ← Scan with 1688 mobile app │            │
│     │  OR                                     │            │
│     │  [Phone/Email] [Password] [Login]       │            │
│     └─────────────────────────────────────────┘            │
│                                                             │
│  5. After login → browser redirects to 1688.com           │
│                                                             │
│  6. Terminal: "✅ Login successful, session saved"         │
│                                                             │
│  7. Browser window closes (headless mode for searches)     │
│                                                             │
│  8. Helper ready! Extension can now search.                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Subsequent Runs

```
Terminal: "✅ 1688 session restored" → Ready immediately
```

---

## Handling Session Expiry

1688 sessions expire (typically 7-30 days). The helper handles this:

```typescript
// In searchImage(), if 302 to login or captcha detected:
if (response.url().includes('login') || await hasCaptcha(page)) {
  console.log('🔐 Session expired, re-login required');
  await performLogin(); // Opens browser, waits for login
  // Retry search
}
```

**User Experience**: Extension shows "Vui lòng đăng nhập 1688" → user clicks → helper opens browser → user logs in → search continues.

---

## Security & Privacy

| Concern | Mitigation |
|---------|------------|
| **Images sent to helper** | Localhost only; never leaves machine |
| **1688 cookies stored** | `1688-auth.json` in helper folder (user's machine) |
| **No external server** | All traffic: Extension → localhost → 1688 |
| **Open port** | Only localhost:3001; firewall blocks external |

---

## Distribution Package Structure

```
1688-scout/
├── extension/                 # Plasmo extension (builds to .crx)
│   └── ...
├── playwright-helper/         # Node.js helper
│   ├── package.json
│   ├── server.ts
│   └── 1688-auth.json        # Created at runtime (gitignored)
├── install/
│   ├── install.bat            # Windows installer
│   ├── start-helper.bat       # Windows launcher
│   ├── install.sh             # macOS/Linux installer
│   └── start-helper.sh        # macOS/Linux launcher
└── docs/
    └── USER_GUIDE.md          # Screenshots + steps
```

---

## User Guide Template (Vietnamese)

```markdown
# Hướng Dẫn Cài Đặt 1688 Scout Helper

## 🖥️ Yêu Cầu
- Windows 10/11 hoặc macOS 12+
- Kết nối internet (để tải Chromium ~150MB)

## 📥 Cài Đặt (Chỉ Làm 1 Lần)

### Windows:
1. Tải file `1688-scout-windows.zip` từ [release page]
2. Giải nén → vào thư mục `install`
3. **Chuột phải** `install.bat` → **Chạy với tư cách Quản trị viên**
4. Chờ cài đặt xong (2-5 phút)
5. Sẽ có shortcut **"1688 Scout Helper"** trên Desktop

### macOS:
1. Tải `1688-scout-mac.zip`
2. Giải nén → mở Terminal trong thư mục `install`
3. Chạy: `chmod +x install.sh && ./install.sh`
4. Sẽ có file **"1688-Scout-Helper.command"** trên Desktop

## 🚀 Sử Dụng Hàng Ngày

1. **Mở Helper**: Double-click shortcut trên Desktop
2. **Giữ cửa sổ đen mở** (không tắt)
3. **Mở Chrome** → vào Shopee.vn
4. Click nút **"Tìm trên 1688"** hoặc **"Quét danh mục"**
5. Kết quả hiện trong sidebar phải

## 🔐 Đăng Nhập 1688 (Lần Đầu / Khi Hết Hạn)

- Lần đầu: Helper tự mở trình duyệt → bạn quét mã QR bằng app 1688 hoặc nhập tài khoản
- Sau đó: Tự động dùng session đã lưu
- Nếu bị đăng xuất: Helper tự mở lại trang đăng nhập

## ❓ Khắc Phục Sự Cố

| Vấn đề | Giải Pháp |
|--------|-----------|
| "Node.js not found" | Cài Node.js từ nodejs.org |
| Helper không khởi động | Chạy lại `install.bat` |
| "Lỗi kết nối" | Kiểm tra cửa sổ Helper có đang mở không |
| 1688 báo captcha | Helper sẽ mở trình duyệt để bạn xử lý |
```

---

## Summary: What You Deliver to Non-Technical Users

| File | Purpose |
|------|---------|
| `1688-scout-windows.zip` | Contains: extension `.crx` + `install/` folder |
| `install.bat` | One-click setup (Node + Playwright + Chromium) |
| `start-helper.bat` | Daily launcher (Desktop shortcut) |
| `USER_GUIDE.pdf` | Vietnamese screenshots + steps |

**User only does**: Extract → Right-click install.bat → "Run as Administrator" → Done.

---

## Next Step

Want me to:
1. **Scaffold the `playwright-helper/` folder** with `package.json`, `server.ts`, install scripts?
2. **Design the extension ↔ helper messaging protocol** (WebSocket vs HTTP, auth token)?
3. **Create the Tauri wrapper spec** for native app version?

The helper can be built and tested independently while you work on the extension.