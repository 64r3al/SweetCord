@echo off
setlocal EnableExtensions
title SweetCord Desktop
cd /d "%~dp0"
set "DESKTOP_DIR=%~dp0desktop-electron"
set "LOG_FILE=%~dp0sweetcord-desktop-launch.log"

echo.
echo  ========================================
echo          SWEETCORD DESKTOP SHELL
echo  ========================================
echo.
echo This opens Discord's official web app in a SweetCord desktop window.
echo Sign in on Discord's own page. Do not paste or share account tokens.
echo.

if not exist "%DESKTOP_DIR%\package.json" (
  echo [ERROR] desktop-electron\package.json was not found.
  pause
  exit /b 1
)

where.exe node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

where.exe npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js LTS with npm included.
  pause
  exit /b 1
)

pushd "%DESKTOP_DIR%"
if errorlevel 1 (
  echo [ERROR] Could not enter the desktop-electron folder.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo [SETUP] Installing SweetCord Desktop dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    popd
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo [DOWNLOAD] The Electron runtime is not installed yet.
  echo Its first download comes from the official Electron GitHub release.
  echo Keep this window open; a slow or blocked connection may take time.
  echo.
  call npm.cmd run prepare:electron
  set "DOWNLOAD_CODE=%ERRORLEVEL%"
  if not "%DOWNLOAD_CODE%"=="0" (
    echo.
    echo [ERROR] Electron could not download its desktop runtime.
    echo Check that your connection can reach github.com and github.com release downloads.
    echo Do not reinstall all dependencies yet; this is the separate Electron runtime.
    popd
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo [ERROR] Electron's runtime is still missing after the download command.
  echo Run this manually in the desktop-electron folder:
  echo   npm.cmd run prepare:electron
  popd
  pause
  exit /b 1
)

echo.
echo [START] Starting SweetCord Desktop...
echo [INFO] Electron runtime is present.
echo [INFO] Runtime output will also be saved to:
echo        "%LOG_FILE%"
echo.
call npm.cmd start
set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo [FAILED] SweetCord Desktop exited with code %APP_EXIT_CODE%.
  echo If the window never appeared, copy the error text above.
  echo Log file from previous launch, if present: "%LOG_FILE%"
  pause
)
popd
exit /b %APP_EXIT_CODE%
