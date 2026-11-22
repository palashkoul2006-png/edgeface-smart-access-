@echo off
title EdgeFace - Backend Server
color 0A
echo ============================================================
echo   EdgeFace Smart Access Control - Backend Server
echo ============================================================
echo.

:: ── 1. Python check ──────────────────────────────────────────
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% NEQ 0 (
    color 0C
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download: https://www.python.org/downloads/
    echo         Tick "Add Python to PATH" during install.
    goto :error
)
python --version
echo        Python found OK.
echo.

:: ── 2. Mosquitto check (non-crashing) ────────────────────────
echo [2/5] Checking Mosquitto MQTT broker...
tasklist > "%TEMP%\ef_tasklist.txt" 2>nul
findstr /i "mosquitto" "%TEMP%\ef_tasklist.txt" >nul 2>nul
if %errorlevel% EQU 0 (
    echo        Mosquitto is running OK.
) else (
    echo [WARNING] Mosquitto not detected.
    echo           MQTT and ESP32 features will be unavailable until it starts.
    echo           To start: open a new terminal and run  mosquitto -v
    echo           Download: https://mosquitto.org/download/
)
del "%TEMP%\ef_tasklist.txt" >nul 2>nul
echo.

:: ── 3. Create venv ───────────────────────────────────────────
echo [3/5] Setting up Python virtual environment...
if not exist "venv\" (
    echo        Creating venv...
    python -m venv venv
    if %errorlevel% NEQ 0 (
        color 0C
        echo [ERROR] Failed to create virtual environment.
        goto :error
    )
    echo        venv created.
) else (
    echo        venv already exists.
)
echo.

:: ── 4. Install requirements ───────────────────────────────────
echo [4/5] Installing Python dependencies...
call venv\Scripts\activate.bat
if %errorlevel% NEQ 0 (
    color 0C
    echo [ERROR] Failed to activate virtual environment.
    goto :error
)

pip install -r requirements.txt --quiet --disable-pip-version-check
if %errorlevel% NEQ 0 (
    color 0C
    echo [ERROR] pip install failed. Check internet connection.
    goto :error
)
echo        Dependencies installed OK.
echo.

:: ── Verify key packages ───────────────────────────────────────
python -c "import fastapi" >nul 2>&1
if %errorlevel% EQU 0 ( echo        fastapi     OK ) else ( echo [WARN]  fastapi     missing )

python -c "import uvicorn" >nul 2>&1
if %errorlevel% EQU 0 ( echo        uvicorn     OK ) else ( echo [WARN]  uvicorn     missing )

python -c "import cv2" >nul 2>&1
if %errorlevel% EQU 0 ( echo        opencv      OK ) else ( echo [WARN]  opencv-contrib-python not installed - camera disabled )

python -c "import paho" >nul 2>&1
if %errorlevel% EQU 0 ( echo        paho-mqtt   OK ) else ( echo [WARN]  paho-mqtt   missing )
echo.

:: ── Create required directories ───────────────────────────────
if not exist "face_data\" mkdir face_data
if not exist "data\" mkdir data

:: ── 5. Start uvicorn ─────────────────────────────────────────
echo [5/5] Starting EdgeFace backend...
echo.
echo        API:   http://127.0.0.1:8000
echo        Docs:  http://127.0.0.1:8000/docs
echo        WS:    ws://127.0.0.1:8000/ws/events
echo.
echo ============================================================
echo   Press Ctrl+C to stop the server.
echo ============================================================
echo.

uvicorn main:app --host 127.0.0.1 --port 8000 --reload
goto :eof

:error
echo.
echo ============================================================
echo   Setup failed. Read the message above, fix it, then retry.
echo ============================================================
pause
exit /b 1
