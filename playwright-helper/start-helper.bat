@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo    1688 Scout Helper
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [Loi] Chua cai Node.js.
  echo Hay tai Node.js 22 tai https://nodejs.org/ roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [Loi] Chua cai pnpm.
  echo Mo Command Prompt va chay: corepack enable
  echo Sau do chay lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Cai dat lan dau, viec nay mat vai phut...
  call pnpm install
  if errorlevel 1 (
    echo.
    echo [Loi] Cai dat that bai. Kiem tra ket noi mang roi thu lai.
    pause
    exit /b 1
  )
)

echo [2/2] Dang khoi dong Helper...
echo Mo http://localhost:3001/api/status de kiem tra.
echo Giu cua so nay mo trong khi quet. Nhan Ctrl+C de dung.
echo.
call pnpm start

echo.
echo Helper da dung lai.
pause
