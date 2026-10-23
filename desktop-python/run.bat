@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 sweetcord.py
) else (
  python sweetcord.py
)
if errorlevel 1 (
  echo.
  echo SweetCord could not start. Install Python 3.10+ with Tcl/Tk enabled.
  pause
)
endlocal
