@echo off
setlocal EnableExtensions
title FossFLOW Dev Server

REM ============================================================
REM  FossFLOW - local development startup script
REM
REM  What it does:
REM    1. Checks Node.js is available (24+ recommended)
REM    2. Runs "npm install" on first run (node_modules missing)
REM    3. Builds the fossflow-lib package on first run
REM    4. Regenerates custom icon packs from the icon-packs folder
REM    5. Starts the dev server at http://localhost:3000
REM
REM  Stop the server with Ctrl+C in this window.
REM ============================================================

cd /d "%~dp0"
if not exist "package.json" (
    echo [ERROR] package.json not found. Place this script in the
    echo         FossFLOW project root folder and run it again.
    pause
    exit /b 1
)

echo ==============================================
echo  FossFLOW local dev startup
echo ==============================================
echo.

REM ---------- 1. Check Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    echo         Please install Node.js 24 or later from https://nodejs.org
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node %NODE_VER%

set "NODE_MAJOR="
if defined NODE_VER (
    for /f "tokens=1 delims=." %%a in ("%NODE_VER:~1%") do set "NODE_MAJOR=%%a"
)
if not defined NODE_MAJOR set "NODE_MAJOR=0"
if %NODE_MAJOR% LSS 24 (
    echo [WARN] package.json asks for Node 24+, but you have %NODE_VER%.
    echo        The install or build may fail.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

REM ---------- 2. Install dependencies ----------
if not exist "node_modules" (
    echo [....] Installing dependencies - first run, this can take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Check the output above,
        echo         then fix the issue and run this script again.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
) else (
    echo [OK] Dependencies already installed.
)

REM ---------- 3. Build the library ----------
if not exist "packages\fossflow-lib\dist" (
    echo [....] Building fossflow-lib - required once before first start...
    echo.
    call npm run build:lib
    if errorlevel 1 (
        echo.
        echo [ERROR] Library build failed. Check the output above.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Library built.
) else (
    echo [OK] Library already built.
)

REM ---------- 4. Regenerate custom icon packs ----------
if exist "icon-packs" (
    echo [....] Regenerating custom icon packs from icon-packs folder...
    node scripts\generate-icon-packs.mjs
    echo.
)

REM ---------- 5. Start dev server ----------
echo.
echo ==============================================
echo  Starting dev server...
echo  Open:  http://localhost:3000
echo  Stop:  Ctrl+C in this window
echo ==============================================
echo.
call npm run dev

echo.
echo Dev server exited.
pause
exit /b 0
