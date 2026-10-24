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
  echo [SETUP] Installing Electron dependencies on first launch...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    popd
    pause
    exit /b 1
  )
)

echo [START] Launching SweetCord Desktop...
echo Log file: "%LOG_FILE%"
call npm.cmd start > "%LOG_FILE%" 2>&1
set "APP_EXIT_CODE=%ERRORLEVEL%"
popd

if not "%APP_EXIT_CODE%"=="0" (
  echo.
  echo [FAILED] SweetCord Desktop exited with code %APP_EXIT_CODE%.
  echo Read: "%LOG_FILE%"
  pause
)
exit /b %APP_EXIT_CODE%
