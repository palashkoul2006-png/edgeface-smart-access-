@echo off
title EdgeFace - Launcher
color 0B
echo ============================================================
echo   EdgeFace - Starting services...
echo ============================================================
echo.
echo   This launcher will open two windows:
echo     [1] EdgeFace Backend  (Python/FastAPI on port 8000)
echo     [2] EdgeFace Frontend (Bun/Vite on port 5173)
echo.
echo   Dashboard will open automatically in your browser.
echo.
echo ============================================================
echo.

:: Window 1 - Backend
echo Starting backend server window...
start "EdgeFace - Backend (port 8000)" cmd /k "cd /d %~dp0edgeface-local && start.bat"

:: Small gap so both windows don't race
timeout /t 1 /nobreak >nul

:: Window 2 - Frontend
echo Starting frontend dev server window...
start "EdgeFace - Frontend (port 5173)" cmd /k "cd /d %~dp0 && npm run dev"

:: Wait then open the dashboard
echo.
echo Waiting 5 seconds for services to initialise...
timeout /t 5 /nobreak

echo Opening EdgeFace dashboard in browser...
start http://localhost:5173

echo.
echo Both services launched. Close this window whenever you like.
echo Close the two server windows (or press Ctrl+C inside them) to stop services.
pause
