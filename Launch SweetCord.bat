@echo off
setlocal EnableExtensions
title SweetCord Launcher
cd /d "%~dp0"

echo.
echo  ========================================
echo             SWEETCORD LAUNCHER
echo  ========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Make sure this file stays in the SweetCord repository root.
  goto :fail
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install the current Node.js LTS version from:
  echo https://nodejs.org/
  echo Then reopen this launcher.
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js LTS with npm included.
  goto :fail
)

echo Node.js:
node --version
echo npm:
npm --version
echo.

if not exist "node_modules" (
  echo [SETUP] Installing SweetCord dependencies. This happens on first launch.
  echo Keep this window open while npm finishes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed. Check your internet connection
    echo and the npm output above, then run this file again.
    goto :fail
  )
)

if not exist ".env.local" (
  echo [NOTE] .env.local is not configured.
  echo SweetCord can start, but sign-in, friends, and chat need a dedicated
  echo SweetCord Supabase project and values from .env.example.
  echo See the Backend setup section in README.md.
  echo.
)

echo [START] Opening SweetCord in your default browser...
echo Keep this window open while using SweetCord.
echo Local address: http://127.0.0.1:5173
echo Press Ctrl+C in this window to stop the app.
echo.

call npm run dev -- --open
set "APP_EXIT_CODE=%ERRORLEVEL%"

if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] SweetCord stopped with exit code %APP_EXIT_CODE%.
  goto :fail
)

goto :eof

:fail
echo.
pause
exit /b 1
