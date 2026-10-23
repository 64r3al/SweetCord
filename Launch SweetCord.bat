@echo off
setlocal EnableExtensions EnableDelayedExpansion
title SweetCord Launcher
cd /d "%~dp0"
set "LOG_FILE=%~dp0sweetcord-launch.log"

> "%LOG_FILE%" echo SweetCord launcher diagnostics
>> "%LOG_FILE%" echo Started: %DATE% %TIME%
>> "%LOG_FILE%" echo Working directory: %CD%
>> "%LOG_FILE%" echo.

echo.
echo  ========================================
echo             SWEETCORD LAUNCHER
echo  ========================================
echo.
echo Working folder: %CD%
echo Diagnostic log: "%LOG_FILE%"
echo.

call :main
set "APP_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%APP_EXIT_CODE%"=="0" (
  echo [FAILED] SweetCord did not start correctly. Error code: %APP_EXIT_CODE%
  echo Read the messages above and the diagnostic log shown below.
  >> "%LOG_FILE%" echo Final exit code: %APP_EXIT_CODE%
) else (
  echo [STOPPED] SweetCord's development server has stopped.
  >> "%LOG_FILE%" echo Development server stopped normally.
)

echo.
echo Log file: "%LOG_FILE%"
echo This window will stay open. Take a screenshot of the error if you need help.
echo.
pause
exit /b %APP_EXIT_CODE%

:main
if not exist "package.json" (
  echo [ERROR] package.json was not found in this folder.
  echo You must run this file from the extracted SweetCord repository root,
  echo not from a folder containing only the BAT file.
  >> "%LOG_FILE%" echo ERROR: package.json not found.
  exit /b 1
)

where.exe node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ then close and reopen this launcher.
  >> "%LOG_FILE%" echo ERROR: node.exe not found in PATH.
  exit /b 1
)

where.exe npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found.
  echo Reinstall Node.js LTS from https://nodejs.org/ with npm included.
  >> "%LOG_FILE%" echo ERROR: npm not found in PATH.
  exit /b 1
)

echo [INFO] Node.js version:
node --version
node --version >> "%LOG_FILE%" 2>&1
echo [INFO] npm version:
call npm.cmd --version
call npm.cmd --version >> "%LOG_FILE%" 2>&1
echo.

if not exist "node_modules" (
  echo [SETUP] Installing required packages for the first launch...
  echo This needs an internet connection and may take a few minutes.
  echo.
  call npm.cmd install
  set "INSTALL_CODE=!ERRORLEVEL!"
  >> "%LOG_FILE%" echo npm install exit code: !INSTALL_CODE!
  if not "!INSTALL_CODE!"=="0" (
    echo.
    echo [ERROR] npm install failed. Check the npm error above.
    exit /b 1
  )
)

if not exist ".env.local" (
  echo [NOTE] .env.local has not been created.
  echo The interface can launch, but account sign-in and real chat require
  echo a dedicated SweetCord Supabase backend. Setup instructions are in README.md.
  echo.
)

echo [START] Starting the local web app now...
echo When Vite starts, look for a Local URL. Open this if your browser does not:
echo http://127.0.0.1:5173
echo Keep this window open while using SweetCord.
echo Press Ctrl+C here to stop it.
echo.
>> "%LOG_FILE%" echo Starting: npm run dev -- --host 127.0.0.1 --open
call npm.cmd run dev -- --host 127.0.0.1 --open
set "SERVER_CODE=%ERRORLEVEL%"
>> "%LOG_FILE%" echo Vite exit code: %SERVER_CODE%
exit /b %SERVER_CODE%
