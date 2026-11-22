@echo off
title EdgeFace - One-Time Setup
color 0B
echo ============================================================
echo   EdgeFace Local Backend - One-Time Installation
echo ============================================================
echo.

:: Python check
echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Python 3.10+ is required but not found.
    echo         Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

:: Create venv
echo [2/6] Creating Python virtual environment...
if exist "venv\" (
    echo        venv already exists, skipping.
) else (
    python -m venv venv
    if errorlevel 1 (
        color 0C
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
    echo        venv created successfully.
)
echo.

:: Activate and install
echo [3/6] Installing Python packages from requirements.txt...
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    color 0C
    echo [ERROR] pip install failed. Check internet connection and requirements.txt.
    pause
    exit /b 1
)
echo        All packages installed.
echo.

:: Download haarcascade if missing
echo [4/6] Checking for Haar Cascade face detection model...
if not exist "data\" mkdir data
if exist "data\haarcascade_frontalface_default.xml" (
    echo        Cascade file already present, skipping download.
) else (
    echo        Downloading haarcascade_frontalface_default.xml from OpenCV GitHub...
    :: Try PowerShell (available on all modern Windows)
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml' -OutFile 'data\haarcascade_frontalface_default.xml'" 2>nul
    if exist "data\haarcascade_frontalface_default.xml" (
        echo        Download successful.
    ) else (
        echo [WARNING] Automatic download failed.
        echo           Manually place haarcascade_frontalface_default.xml into:
        echo           %~dp0data\
        echo           Get it from: https://github.com/opencv/opencv/tree/master/data/haarcascades
    )
)
echo.

:: Create face_data directory
echo [5/6] Creating face_data directory...
if not exist "face_data\" (
    mkdir face_data
    echo        face_data\ created.
) else (
    echo        face_data\ already exists.
)
echo.

:: Create placeholder for edgeface.db (app will init tables on first run)
echo [6/6] Preparing database...
if not exist "edgeface.db" (
    type nul > edgeface.db
    echo        edgeface.db placeholder created (app will initialise tables).
) else (
    echo        edgeface.db already exists.
)
echo.

echo ============================================================
echo   Installation complete!
echo.
echo   To start the backend server, run:
echo     start.bat
echo.
echo   Or from the project root run:
echo     start-edgeface.bat    (launches both frontend + backend)
echo ============================================================
pause
